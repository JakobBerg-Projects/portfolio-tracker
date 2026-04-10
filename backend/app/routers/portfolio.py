from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import Holding, PortfolioSnapshot
from app.schemas.portfolio import (
    HoldingResponse,
    PortfolioSummary,
    PortfolioHistoryPoint,
    UploadResponse,
)
from app.services.nordnet_parser import parse_nordnet_csv
from app.services.market_data import (
    calculate_portfolio_history,
    fetch_exchange_rate,
)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    mode: str = "replace",
    db: Session = Depends(get_db),
):
    """Upload a Nordnet CSV file. mode=replace (default) or mode=append."""
    content = await file.read()
    # Nordnet exports can be UTF-16-LE (starts with 0xFF 0xFE) or UTF-8
    for encoding in ["utf-16", "utf-8-sig", "latin-1"]:
        try:
            csv_text = content.decode(encoding)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    else:
        raise HTTPException(status_code=400, detail="Could not decode CSV file")

    parsed = parse_nordnet_csv(csv_text)
    if not parsed:
        raise HTTPException(status_code=400, detail="No holdings found in CSV")

    if mode == "replace":
        db.query(Holding).delete()

    # Insert new holdings
    db_holdings = []
    for h in parsed:
        holding = Holding(**h)
        db.add(holding)
        db_holdings.append(holding)

    db.commit()

    # Refresh to get IDs
    for h in db_holdings:
        db.refresh(h)

    return UploadResponse(
        message=f"Successfully imported {len(db_holdings)} holdings",
        holdings_count=len(db_holdings),
        holdings=[HoldingResponse.model_validate(h) for h in db_holdings],
    )


@router.get("/holdings", response_model=list[HoldingResponse])
def get_holdings(db: Session = Depends(get_db)):
    """Get all current holdings."""
    holdings = db.query(Holding).all()
    return [HoldingResponse.model_validate(h) for h in holdings]


@router.get("/summary", response_model=PortfolioSummary)
def get_summary(db: Session = Depends(get_db)):
    """Get portfolio summary with totals."""
    holdings = db.query(Holding).all()

    if not holdings:
        return PortfolioSummary(
            total_value_nok=0,
            total_value_usd=0,
            total_return_nok=0,
            total_return_pct=0,
            holdings_count=0,
        )

    total_value_nok = sum(h.value_nok or 0 for h in holdings)
    total_return_nok = sum(h.return_nok or 0 for h in holdings)
    total_cost_nok = total_value_nok - total_return_nok

    usd_nok = fetch_exchange_rate("USD", "NOK")
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
    """Get portfolio value over time."""
    holdings = db.query(Holding).all()

    if not holdings:
        return []

    holdings_data = [
        {
            "ticker": h.ticker,
            "quantity": h.quantity,
            "currency": h.currency,
        }
        for h in holdings
    ]

    history = calculate_portfolio_history(holdings_data, period)
    return [PortfolioHistoryPoint(**point) for point in history]


@router.get("/allocation")
def get_allocation(db: Session = Depends(get_db)):
    """Get portfolio allocation for pie chart."""
    holdings = db.query(Holding).all()

    if not holdings:
        return []

    total = sum(h.value_nok or 0 for h in holdings)
    if total == 0:
        return []

    return [
        {
            "name": h.name,
            "ticker": h.ticker,
            "value_nok": round(h.value_nok or 0, 2),
            "percentage": round((h.value_nok or 0) / total * 100, 2),
        }
        for h in holdings
    ]
