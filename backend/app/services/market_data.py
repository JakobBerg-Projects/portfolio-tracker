import yfinance as yf
import pandas as pd


def fetch_price_history(
    ticker: str,
    period: str = "1y",
) -> list[dict]:
    """Fetch historical daily close prices from Yahoo Finance."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)

        if hist.empty:
            return []

        prices = []
        for date, row in hist.iterrows():
            # Make timezone-naive for consistent handling
            dt = date.to_pydatetime().replace(tzinfo=None)
            prices.append({
                "ticker": ticker,
                "date": dt,
                "close_price": float(row["Close"]),
            })
        return prices
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return []


def fetch_exchange_rate(from_currency: str = "USD", to_currency: str = "NOK") -> float:
    """Fetch the current exchange rate."""
    try:
        pair = f"{from_currency}{to_currency}=X"
        ticker = yf.Ticker(pair)
        hist = ticker.history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return 10.5 if from_currency == "USD" and to_currency == "NOK" else 1.0


def calculate_portfolio_history(
    holdings: list[dict],
    period: str = "1y",
) -> list[dict]:
    """Calculate total portfolio value over time based on current holdings."""
    all_prices = {}
    tickers = list(set(h["ticker"] for h in holdings))

    # Batch download all tickers at once for speed
    try:
        ticker_str = " ".join(tickers)
        data = yf.download(ticker_str, period=period, group_by="ticker", progress=False)

        if data.empty:
            return []

        for ticker in tickers:
            try:
                if len(tickers) == 1:
                    close = data["Close"].dropna()
                else:
                    close = data[ticker]["Close"].dropna()
                if not close.empty:
                    close.index = close.index.tz_localize(None)
                    all_prices[ticker] = close
            except (KeyError, TypeError):
                continue
    except Exception as e:
        print(f"Error batch downloading: {e}")
        return []

    # Fetch USD/NOK history
    usd_nok_df = None
    try:
        fx = yf.download("USDNOK=X", period=period, progress=False)
        if not fx.empty:
            close = fx["Close"].dropna()
            if hasattr(close, "columns"):
                close = close.iloc[:, 0]
            close.index = close.index.tz_localize(None)
            usd_nok_df = close
    except Exception as e:
        print(f"Error fetching USD/NOK: {e}")

    if not all_prices:
        return []

    # Create a common date index
    all_dates = set()
    for prices in all_prices.values():
        all_dates.update(prices.index)
    dates = sorted(all_dates)

    portfolio_history = []
    for date in dates:
        total_nok = 0.0

        # Get exchange rate for this date
        usd_nok = 10.5  # fallback
        if usd_nok_df is not None:
            closest = usd_nok_df.index[usd_nok_df.index <= date]
            if len(closest) > 0:
                usd_nok = float(usd_nok_df.loc[closest[-1]])

        for holding in holdings:
            ticker = holding["ticker"]
            quantity = holding["quantity"]

            if ticker not in all_prices:
                continue

            prices = all_prices[ticker]
            closest = prices.index[prices.index <= date]
            if len(closest) == 0:
                continue

            price = float(prices.loc[closest[-1]])
            value = price * quantity

            if holding["currency"] == "USD":
                value_nok = value * usd_nok
            else:
                value_nok = value

            total_nok += value_nok

        total_usd = total_nok / usd_nok if usd_nok > 0 else 0

        portfolio_history.append({
            "date": date.isoformat() if hasattr(date, "isoformat") else str(date),
            "total_value_nok": round(total_nok, 2),
            "total_value_usd": round(total_usd, 2),
        })

    return portfolio_history
