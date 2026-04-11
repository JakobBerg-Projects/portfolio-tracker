from datetime import date as date_type

import yfinance as yf
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import Transaction
from app.schemas.portfolio import (
    HoldingResponse,
    PortfolioSummary,
    PortfolioHistoryPoint,
    UploadResponse,
)
from app.services.nordnet_parser import parse_nordnet_transactions
from app.services.market_data import (
    calculate_portfolio_history,
    fetch_exchange_rate,
    fetch_live_data,
)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_split_multipliers(ticker: str, start_date: date_type) -> list[tuple[date_type, float]]:
    """Fetch stock split history for a ticker from yfinance.

    Returns a list of (date, cumulative_multiplier) pairs sorted by date.
    E.g. a 10:1 split on 2024-06-10 returns [(2024-06-10, 10.0)].
    """
    try:
        splits = yf.Ticker(ticker).splits
        if splits is None or splits.empty:
            return []
        result = []
        for dt, ratio in splits.items():
            split_date = dt.date() if hasattr(dt, "date") else dt
            if split_date >= start_date:
                result.append((split_date, float(ratio)))
        return sorted(result, key=lambda x: x[0])
    except Exception:
        return []


def _derive_holdings(transactions) -> list[dict]:
    """Derive current positions from transaction history (weighted-average cost).

    Accounts for stock splits by adjusting quantity and cost basis
    when a split occurs between transactions.
    """
    # Group transactions by ticker to know which tickers need split data
    txn_by_ticker: dict[str, list] = {}
    for txn in transactions:
        if not txn.ticker:
            continue
        txn_by_ticker.setdefault(txn.ticker, []).append(txn)

    # Fetch split data for each ticker
    splits_by_ticker: dict[str, list[tuple[date_type, float]]] = {}
    for ticker, txns in txn_by_ticker.items():
        earliest = min(t.trade_date for t in txns)
        splits = _get_split_multipliers(ticker, earliest)
        if splits:
            splits_by_ticker[ticker] = splits

    positions: dict[str, dict] = {}

    for txn in sorted(transactions, key=lambda t: t.trade_date):
        ticker = txn.ticker
        if not ticker:
            continue

        if ticker not in positions:
            positions[ticker] = {
                "name": txn.name,
                "ticker": ticker,
                "isin": txn.isin,
                "currency": txn.currency,
                "quantity": 0.0,
                "cost_native": 0.0,
                "cost_nok": 0.0,
                "_splits_applied": set(),
            }

        # Apply any splits that occurred on or before this transaction date
        if ticker in splits_by_ticker:
            for split_date, ratio in splits_by_ticker[ticker]:
                if split_date <= txn.trade_date and split_date not in positions[ticker]["_splits_applied"]:
                    positions[ticker]["quantity"] *= ratio
                    # Cost basis stays the same in total, but per-share cost drops
                    positions[ticker]["_splits_applied"].add(split_date)

        if txn.transaction_type == "KJØPT":
            positions[ticker]["quantity"] += txn.quantity
            positions[ticker]["cost_native"] += txn.quantity * txn.price
            positions[ticker]["cost_nok"] += abs(txn.amount_nok or 0)
        elif txn.transaction_type == "SALG":
            qty = positions[ticker]["quantity"]
            if qty > 0:
                ratio = min(txn.quantity / qty, 1.0)
                positions[ticker]["cost_native"] *= 1 - ratio
                positions[ticker]["cost_nok"] *= 1 - ratio
            positions[ticker]["quantity"] -= txn.quantity

    # Apply any remaining splits that haven't been applied yet (after last transaction)
    for ticker, splits in splits_by_ticker.items():
        if ticker in positions:
            for split_date, ratio in splits:
                if split_date not in positions[ticker]["_splits_applied"]:
                    positions[ticker]["quantity"] *= ratio
                    positions[ticker]["_splits_applied"].add(split_date)

    result = []
    for pos in positions.values():
        if pos["quantity"] > 0.001:
            avg_price = (
                pos["cost_native"] / pos["quantity"] if pos["quantity"] > 0 else 0
            )
            # Remove internal tracking field
            pos.pop("_splits_applied", None)
            result.append({**pos, "avg_price": avg_price})
    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    mode: str = "replace",
    db: Session = Depends(get_db),
):
    """Upload a Nordnet transaction-history CSV."""
    content = await file.read()
    for encoding in ["utf-16", "utf-8-sig", "latin-1"]:
        try:
            csv_text = content.decode(encoding)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    else:
        raise HTTPException(status_code=400, detail="Could not decode CSV file")

    parsed = parse_nordnet_transactions(csv_text)
    if not parsed:
        raise HTTPException(status_code=400, detail="No transactions found in CSV")

    if mode == "replace":
        db.query(Transaction).delete()

    count = 0
    for t in parsed:
        if mode == "append" and t["nordnet_id"]:
            exists = (
                db.query(Transaction)
                .filter_by(nordnet_id=t["nordnet_id"])
                .first()
            )
            if exists:
                continue

        db.add(
            Transaction(
                nordnet_id=t["nordnet_id"] or None,
                trade_date=date_type.fromisoformat(t["trade_date"]),
                transaction_type=t["transaction_type"],
                name=t["name"],
                isin=t["isin"],
                ticker=t["ticker"],
                quantity=t["quantity"],
                price=t["price"],
                currency=t["currency"],
                amount_nok=t["amount_nok"],
                fees_nok=t["fees_nok"],
                exchange_rate=t["exchange_rate"],
            )
        )
        count += 1

    db.commit()
    return UploadResponse(
        message=f"Importerte {count} transaksjoner",
        transaction_count=count,
    )


@router.get("/holdings")
def get_holdings(db: Session = Depends(get_db)):
    """Derive current holdings from transactions, enriched with live prices."""
    transactions = db.query(Transaction).order_by(Transaction.trade_date).all()
    if not transactions:
        return []

    holdings = _derive_holdings(transactions)
    if not holdings:
        return []

    tickers = [h["ticker"] for h in holdings]
    current_prices, today_changes = fetch_live_data(tickers)
    usd_nok = fetch_exchange_rate("USD", "NOK")

    results = []
    for i, h in enumerate(holdings):
        price = current_prices.get(h["ticker"])
        value = price * h["quantity"] if price else None
        value_nok = value
        if value is not None and h["currency"] != "NOK":
            value_nok = value * usd_nok

        cost_nok = h["cost_nok"]
        return_nok = (value_nok - cost_nok) if value_nok else None
        return_pct = (
            (return_nok / cost_nok * 100) if return_nok is not None and cost_nok > 0 else None
        )

        results.append(
            HoldingResponse(
                id=i + 1,
                name=h["name"],
                ticker=h["ticker"],
                currency=h["currency"],
                quantity=round(h["quantity"], 4),
                avg_price=round(h["avg_price"], 2),
                last_price=round(price, 2) if price else None,
                value=round(value, 2) if value else None,
                value_nok=round(value_nok, 2) if value_nok else None,
                today_pct=today_changes.get(h["ticker"]),
                return_pct=round(return_pct, 2) if return_pct is not None else None,
                return_nok=round(return_nok, 2) if return_nok is not None else None,
            ).model_dump()
        )

    return results


@router.get("/summary", response_model=PortfolioSummary)
def get_summary(db: Session = Depends(get_db)):
    transactions = db.query(Transaction).order_by(Transaction.trade_date).all()
    if not transactions:
        return PortfolioSummary(
            total_value_nok=0,
            total_value_usd=0,
            total_return_nok=0,
            total_return_pct=0,
            holdings_count=0,
        )

    holdings = _derive_holdings(transactions)
    if not holdings:
        return PortfolioSummary(
            total_value_nok=0,
            total_value_usd=0,
            total_return_nok=0,
            total_return_pct=0,
            holdings_count=0,
        )

    tickers = [h["ticker"] for h in holdings]
    current_prices, _ = fetch_live_data(tickers)
    usd_nok = fetch_exchange_rate("USD", "NOK")

    total_value_nok = 0.0
    total_cost_nok = 0.0
    for h in holdings:
        price = current_prices.get(h["ticker"])
        if price is None:
            continue
        value = price * h["quantity"]
        if h["currency"] != "NOK":
            value *= usd_nok
        total_value_nok += value
        total_cost_nok += h["cost_nok"]

    total_return_nok = total_value_nok - total_cost_nok
    total_value_usd = total_value_nok / usd_nok if usd_nok > 0 else 0

    return PortfolioSummary(
        total_value_nok=round(total_value_nok, 2),
        total_value_usd=round(total_value_usd, 2),
        total_return_nok=round(total_return_nok, 2),
        total_return_pct=round(
            (total_return_nok / total_cost_nok * 100) if total_cost_nok > 0 else 0, 2
        ),
        holdings_count=len(holdings),
    )


@router.get("/history", response_model=list[PortfolioHistoryPoint])
def get_history(period: str = "1y", db: Session = Depends(get_db)):
    transactions = db.query(Transaction).order_by(Transaction.trade_date).all()
    if not transactions:
        return []

    txn_data = [
        {
            "trade_date": t.trade_date,
            "transaction_type": t.transaction_type,
            "ticker": t.ticker,
            "quantity": t.quantity,
            "currency": t.currency,
        }
        for t in transactions
    ]

    history = calculate_portfolio_history(txn_data, period)
    return [PortfolioHistoryPoint(**point) for point in history]


@router.get("/allocation")
def get_allocation(db: Session = Depends(get_db)):
    transactions = db.query(Transaction).order_by(Transaction.trade_date).all()
    if not transactions:
        return []

    holdings = _derive_holdings(transactions)
    if not holdings:
        return []

    tickers = [h["ticker"] for h in holdings]
    current_prices, _ = fetch_live_data(tickers)
    usd_nok = fetch_exchange_rate("USD", "NOK")

    items = []
    for h in holdings:
        price = current_prices.get(h["ticker"])
        if price is None:
            continue
        value = price * h["quantity"]
        if h["currency"] != "NOK":
            value *= usd_nok
        items.append({"name": h["name"], "ticker": h["ticker"], "value_nok": value})

    total = sum(it["value_nok"] for it in items)
    if total == 0:
        return []

    return [
        {
            "name": it["name"],
            "ticker": it["ticker"],
            "value_nok": round(it["value_nok"], 2),
            "percentage": round(it["value_nok"] / total * 100, 2),
        }
        for it in items
    ]
