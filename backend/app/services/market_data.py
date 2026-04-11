import yfinance as yf
from datetime import datetime, timedelta, date as date_type


def fetch_exchange_rate(from_currency: str = "USD", to_currency: str = "NOK") -> float:
    try:
        pair = f"{from_currency}{to_currency}=X"
        ticker = yf.Ticker(pair)
        hist = ticker.history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return 10.5 if from_currency == "USD" and to_currency == "NOK" else 1.0


def _extract_close(data, ticker: str, single: bool):
    """Safely extract a Close price Series for one ticker from yf.download output."""
    if single:
        close = data["Close"]
    else:
        close = data["Close"][ticker]
    # If still a DataFrame (e.g. MultiIndex leftover), take first column
    if hasattr(close, "columns"):
        close = close.iloc[:, 0]
    return close.dropna()


def fetch_live_data(tickers: list[str]) -> tuple[dict[str, float], dict[str, float]]:
    """Fetch current prices and today's percentage change in one call."""
    prices: dict[str, float] = {}
    changes: dict[str, float] = {}
    if not tickers:
        return prices, changes
    try:
        data = yf.download(tickers, period="5d", progress=False)
        if data.empty:
            return prices, changes

        single = len(tickers) == 1
        for ticker in tickers:
            try:
                close = _extract_close(data, ticker, single)

                if len(close) > 0:
                    prices[ticker] = float(close.iloc[-1])
                if len(close) >= 2:
                    prev = float(close.iloc[-2])
                    curr = float(close.iloc[-1])
                    if prev > 0:
                        changes[ticker] = round((curr - prev) / prev * 100, 2)
            except (KeyError, TypeError):
                continue
    except Exception as e:
        print(f"Error fetching live data: {e}")

    return prices, changes


def calculate_portfolio_history(transactions: list[dict], period: str = "1y") -> list[dict]:
    """Calculate portfolio value over time from transaction history.

    Each transaction dict must have: trade_date, transaction_type, ticker,
    quantity, currency.
    """
    if not transactions:
        return []

    sorted_txns = sorted(transactions, key=lambda t: (
        t["trade_date"] if isinstance(t["trade_date"], date_type) else date_type.fromisoformat(t["trade_date"])
    ))
    tickers = list(set(t["ticker"] for t in sorted_txns if t.get("ticker")))
    if not tickers:
        return []

    # Build currency map (first occurrence per ticker)
    currency_map: dict[str, str] = {}
    for t in sorted_txns:
        if t["ticker"] and t["ticker"] not in currency_map:
            currency_map[t["ticker"]] = t.get("currency", "NOK")

    # Determine the earliest date we need prices from.
    # Use the later of (period start, first transaction date) so the chart
    # never shows empty time before the user's first trade.
    first_txn_date = sorted_txns[0]["trade_date"]
    if not isinstance(first_txn_date, date_type):
        first_txn_date = date_type.fromisoformat(first_txn_date)

    period_map = {
        "1d": timedelta(days=5),
        "5d": timedelta(days=7),
        "1mo": timedelta(days=31),
        "3mo": timedelta(days=93),
        "1y": timedelta(days=365),
        "3y": timedelta(days=3 * 365),
        "5y": timedelta(days=5 * 365),
    }

    if period == "ytd":
        period_start = date_type(datetime.now().year, 1, 1)
    elif period in period_map:
        period_start = date_type.today() - period_map[period]
    else:
        # "max" or unknown → go back to first transaction
        period_start = first_txn_date

    # Never start before the first transaction
    effective_start = max(period_start, first_txn_date)
    hist_kwargs: dict = {"start": effective_start.isoformat()}

    all_prices: dict = {}
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(**hist_kwargs)
            if hist.empty:
                continue
            close = hist["Close"].dropna()
            if hasattr(close, "columns"):
                close = close.iloc[:, 0]
            if close.index.tz is not None:
                close.index = close.index.tz_localize(None)
            all_prices[ticker] = close
        except Exception:
            continue

    # USD/NOK history
    usd_nok_df = None
    try:
        fx_hist = yf.Ticker("USDNOK=X").history(**hist_kwargs)
        if not fx_hist.empty:
            close = fx_hist["Close"].dropna()
            if hasattr(close, "columns"):
                close = close.iloc[:, 0]
            if close.index.tz is not None:
                close.index = close.index.tz_localize(None)
            usd_nok_df = close
    except Exception:
        pass

    if not all_prices:
        return []

    # Build position-change timeline  {date -> {ticker -> qty_change}}
    pos_changes: dict[date_type, dict[str, float]] = {}
    for t in sorted_txns:
        d = t["trade_date"] if isinstance(t["trade_date"], date_type) else date_type.fromisoformat(t["trade_date"])
        if d not in pos_changes:
            pos_changes[d] = {}
        qty = t["quantity"]
        if t["transaction_type"] == "SALG":
            qty = -qty
        pos_changes[d][t["ticker"]] = pos_changes[d].get(t["ticker"], 0) + qty

    txn_date_set = set(pos_changes.keys())

    # Helper: portfolio value from current positions at date d
    def _portfolio_value(positions: dict[str, float], d: date_type) -> float:
        usd_nok = 10.5
        if usd_nok_df is not None:
            closest = usd_nok_df.index[usd_nok_df.index.date <= d]
            if len(closest) > 0:
                usd_nok = float(usd_nok_df.loc[closest[-1]])

        total = 0.0
        for ticker, quantity in positions.items():
            if quantity < 0.001 or ticker not in all_prices:
                continue
            prices = all_prices[ticker]
            closest = prices.index[prices.index.date <= d]
            if len(closest) == 0:
                continue
            price = float(prices.loc[closest[-1]])
            value = price * quantity
            if currency_map.get(ticker, "NOK") != "NOK":
                value *= usd_nok
            total += value
        return total

    # All trading dates from price data
    all_dates: set[date_type] = set()
    for prices in all_prices.values():
        all_dates.update(d.date() for d in prices.index)
    dates = sorted(all_dates)

    txn_dates = sorted(pos_changes.keys())
    txn_idx = 0
    positions: dict[str, float] = {}

    # TWR state
    twr_index = 1.0
    value_after_last_flow: float | None = None

    history = []
    for d in dates:
        # 1. Value BEFORE today's transactions (current positions, today's prices)
        value_before = _portfolio_value(positions, d)

        # 2. Check if there are cash flows (transactions) today
        has_flow = False
        while txn_idx < len(txn_dates) and txn_dates[txn_idx] <= d:
            has_flow = True
            for ticker, qty in pos_changes[txn_dates[txn_idx]].items():
                positions[ticker] = positions.get(ticker, 0) + qty
            txn_idx += 1

        if has_flow:
            # Close the previous sub-period
            if value_after_last_flow is not None and value_after_last_flow > 0:
                twr_index *= value_before / value_after_last_flow

            # Value after applying transactions
            value_after = _portfolio_value(positions, d)
            value_after_last_flow = value_after

            history.append({
                "date": d.isoformat(),
                "total_value_nok": round(value_after, 2),
                "twr_pct": round((twr_index - 1) * 100, 2),
            })
        else:
            # No cash flow — mid sub-period
            if value_after_last_flow is not None and value_after_last_flow > 0:
                current_twr = twr_index * (value_before / value_after_last_flow)
            else:
                current_twr = twr_index

            history.append({
                "date": d.isoformat(),
                "total_value_nok": round(value_before, 2),
                "twr_pct": round((current_twr - 1) * 100, 2),
            })

    # "1d" → only keep last 2 data points (yesterday close vs today)
    if period == "1d" and len(history) > 2:
        history = history[-2:]

    return history
