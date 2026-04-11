"""Portfolio analysis: Fama-French 5-factor exposure and risk metrics."""

import io
import zipfile
from datetime import date as date_type, timedelta

import numpy as np
import pandas as pd
import statsmodels.api as sm
import yfinance as yf


# ---------------------------------------------------------------------------
# Fama-French factor data (Global Developed Markets, 5 factors)
# ---------------------------------------------------------------------------

_FF_URL = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_5_Factors_Daily_CSV.zip"

_ff_cache: dict[str, pd.DataFrame] = {}

_FACTOR_COLS = ["Mkt-RF", "SMB", "HML", "RMW", "CMA", "RF"]


def _fetch_ff_factors() -> pd.DataFrame:
    """Download daily Fama-French 5-factor (Developed Markets) data and cache."""
    if "df" in _ff_cache:
        return _ff_cache["df"]

    import urllib.request

    resp = urllib.request.urlopen(_FF_URL, timeout=30)
    zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    csv_name = [n for n in zf.namelist() if n.lower().endswith(".csv")][0]
    raw = zf.read(csv_name).decode("utf-8")

    # Find the header row with factor names
    lines = raw.split("\n")
    start_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Data rows start with an 8-digit date
        if stripped and stripped[0].isdigit() and len(stripped.split(",")[0].strip()) == 8:
            start_idx = i
            break

    if start_idx is None:
        raise ValueError("Could not parse Fama-French CSV")

    # Read data lines until blank or non-numeric
    data_lines = []
    for line in lines[start_idx:]:
        stripped = line.strip()
        if not stripped or not stripped[0].isdigit():
            break
        data_lines.append(stripped)

    df = pd.read_csv(
        io.StringIO("\n".join(data_lines)),
        header=None,
        names=["date"] + _FACTOR_COLS,
        skipinitialspace=True,
    )
    df["date"] = pd.to_datetime(df["date"].astype(str).str.strip(), format="%Y%m%d")
    df = df.set_index("date")

    # Values are in percent, convert to decimal
    for col in _FACTOR_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce") / 100.0

    # Drop rows with missing data (-99.99 → NaN after conversion is fine)
    df = df.replace(-0.9999, np.nan).dropna()

    _ff_cache["df"] = df
    return df


# ---------------------------------------------------------------------------
# Portfolio daily returns from transaction history
# ---------------------------------------------------------------------------

def _build_portfolio_returns(transactions: list[dict], period: str = "3y") -> pd.Series:
    """Build daily portfolio return series from transactions.

    Returns a pd.Series indexed by date with daily returns (decimal, not %).
    """
    from app.services.market_data import calculate_portfolio_history

    history = calculate_portfolio_history(transactions, period)
    if len(history) < 2:
        return pd.Series(dtype=float)

    df = pd.DataFrame(history)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()

    # TWR index: 1 + twr_pct/100
    df["twr_index"] = 1 + df["twr_pct"] / 100.0
    # Daily returns from TWR index changes
    df["daily_return"] = df["twr_index"].pct_change()

    return df["daily_return"].dropna()


def _detect_non_us_tickers(transactions: list[dict]) -> list[str]:
    """Find tickers with non-USD currency (i.e. non-US stocks)."""
    non_us: dict[str, str] = {}
    for t in transactions:
        ticker = t.get("ticker", "")
        currency = t.get("currency", "USD")
        if ticker and currency != "USD" and ticker not in non_us:
            non_us[ticker] = currency
    return list(non_us.keys())


# ---------------------------------------------------------------------------
# Fama-French regression
# ---------------------------------------------------------------------------

def compute_factor_exposure(transactions: list[dict], period: str = "3y") -> dict:
    """Run Fama-French 5-factor regression on portfolio returns.

    Uses Developed Markets (global) factors from Kenneth French's data library.
    """
    port_returns = _build_portfolio_returns(transactions, period)
    if len(port_returns) < 30:
        return {"error": "Ikke nok data for faktoranalyse (trenger minst 30 datapunkter)"}

    try:
        ff = _fetch_ff_factors()
    except Exception as e:
        return {"error": f"Kunne ikke hente Fama-French data: {str(e)}"}

    # Align dates
    combined = pd.DataFrame({"port": port_returns}).join(ff, how="inner")
    combined = combined.dropna()

    if len(combined) < 30:
        return {"error": "Ikke nok overlappende data mellom portefølje og faktorer"}

    # Excess returns
    y = combined["port"] - combined["RF"]
    X = combined[["Mkt-RF", "SMB", "HML", "RMW", "CMA"]]
    X = sm.add_constant(X)

    model = sm.OLS(y, X).fit()

    factor_labels = [
        ("Alpha", "const"),
        ("Marked (Mkt-RF)", "Mkt-RF"),
        ("Størrelse (SMB)", "SMB"),
        ("Verdi (HML)", "HML"),
        ("Lønnsomhet (RMW)", "RMW"),
        ("Investering (CMA)", "CMA"),
    ]

    factors = []
    for name, param_name in factor_labels:
        factors.append({
            "name": name,
            "coefficient": round(float(model.params[param_name]), 6),
            "t_stat": round(float(model.tvalues[param_name]), 2),
            "p_value": round(float(model.pvalues[param_name]), 4),
            "significant": float(model.pvalues[param_name]) < 0.05,
        })

    # Annualize alpha (daily -> annual)
    daily_alpha = float(model.params["const"])
    annual_alpha = ((1 + daily_alpha) ** 252 - 1) * 100

    # Detect non-US stocks for warning
    non_us_tickers = _detect_non_us_tickers(transactions)

    result = {
        "factors": factors,
        "r_squared": round(float(model.rsquared), 4),
        "adj_r_squared": round(float(model.rsquared_adj), 4),
        "annual_alpha_pct": round(annual_alpha, 2),
        "n_observations": int(model.nobs),
        "period": period,
        "model": "Fama-French 5-faktor (utviklede markeder)",
        "non_us_tickers": non_us_tickers,
    }

    return result


# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------

def compute_risk_metrics(transactions: list[dict], period: str = "1y") -> dict:
    """Calculate risk metrics from portfolio history."""
    port_returns = _build_portfolio_returns(transactions, period)
    if len(port_returns) < 2:
        return {"error": "Ikke nok data for risikoanalyse"}

    daily_returns = port_returns.values
    n_days = len(daily_returns)

    # Annualized return
    cumulative = (1 + pd.Series(daily_returns)).prod()
    annual_return = (cumulative ** (252 / n_days) - 1) if n_days > 0 else 0

    # Annualized volatility
    daily_vol = float(np.std(daily_returns, ddof=1))
    annual_vol = daily_vol * np.sqrt(252)

    # Sharpe ratio using risk-free rate from FF data
    try:
        ff = _fetch_ff_factors()
        aligned = pd.DataFrame({"port": port_returns}).join(ff[["RF"]], how="inner")
        avg_rf_daily = float(aligned["RF"].mean())
    except Exception:
        avg_rf_daily = 0.0

    avg_rf_annual = (1 + avg_rf_daily) ** 252 - 1
    sharpe = (annual_return - avg_rf_annual) / annual_vol if annual_vol > 0 else 0

    # Sortino ratio (downside deviation)
    downside = daily_returns[daily_returns < 0]
    downside_vol = float(np.std(downside, ddof=1)) * np.sqrt(252) if len(downside) > 1 else 0
    sortino = (annual_return - avg_rf_annual) / downside_vol if downside_vol > 0 else 0

    # Max drawdown
    cumulative_returns = (1 + pd.Series(daily_returns)).cumprod()
    running_max = cumulative_returns.cummax()
    drawdown = (cumulative_returns - running_max) / running_max
    max_drawdown = float(drawdown.min())

    # Best / worst day
    best_day = float(np.max(daily_returns))
    worst_day = float(np.min(daily_returns))

    # Positive days ratio
    positive_days = float(np.sum(daily_returns > 0)) / n_days if n_days > 0 else 0

    return {
        "annual_return_pct": round(annual_return * 100, 2),
        "annual_volatility_pct": round(annual_vol * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "max_drawdown_pct": round(max_drawdown * 100, 2),
        "best_day_pct": round(best_day * 100, 2),
        "worst_day_pct": round(worst_day * 100, 2),
        "positive_days_pct": round(positive_days * 100, 1),
        "trading_days": n_days,
        "period": period,
    }


# ---------------------------------------------------------------------------
# Correlation matrix
# ---------------------------------------------------------------------------

def _fetch_individual_returns(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """Download daily close prices for each ticker and compute daily returns.

    Returns a DataFrame with tickers as columns and dates as index.
    """
    from datetime import datetime

    period_map = {
        "1mo": timedelta(days=31),
        "3mo": timedelta(days=93),
        "ytd": None,
        "1y": timedelta(days=365),
        "3y": timedelta(days=3 * 365),
        "5y": timedelta(days=5 * 365),
    }

    if period == "ytd":
        start = date_type(datetime.now().year, 1, 1)
    elif period in period_map:
        start = date_type.today() - period_map[period]
    else:
        start = date_type.today() - timedelta(days=3 * 365)

    all_returns: dict[str, pd.Series] = {}
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(start=start.isoformat())
            if hist.empty:
                continue
            close = hist["Close"].dropna()
            if hasattr(close, "columns"):
                close = close.iloc[:, 0]
            if close.index.tz is not None:
                close.index = close.index.tz_localize(None)
            returns = close.pct_change().dropna()
            if len(returns) > 5:
                all_returns[ticker] = returns
        except Exception:
            continue

    if not all_returns:
        return pd.DataFrame()

    df = pd.DataFrame(all_returns)
    df = df.dropna(how="all")
    return df


def compute_correlation_matrix(transactions: list[dict], period: str = "1y") -> dict:
    """Compute pairwise return correlations between holdings."""
    tickers = list(set(t["ticker"] for t in transactions if t.get("ticker")))
    if len(tickers) < 2:
        return {"error": "Trenger minst 2 aksjer for korrelasjonsanalyse"}

    returns_df = _fetch_individual_returns(tickers, period)
    if returns_df.shape[1] < 2:
        return {"error": "Ikke nok prisdata for korrelasjonsberegning"}

    corr = returns_df.corr()
    tickers_used = list(corr.columns)

    # Build matrix as list of lists
    matrix = []
    for t in tickers_used:
        row = [round(float(corr.loc[t, t2]), 4) for t2 in tickers_used]
        matrix.append(row)

    # Average pairwise correlation (excluding diagonal)
    n = len(tickers_used)
    pair_corrs = []
    for i in range(n):
        for j in range(i + 1, n):
            pair_corrs.append(float(corr.iloc[i, j]))

    avg_corr = float(np.mean(pair_corrs)) if pair_corrs else 0.0
    min_corr = float(np.min(pair_corrs)) if pair_corrs else 0.0
    max_corr = float(np.max(pair_corrs)) if pair_corrs else 0.0

    n_observations = len(returns_df.dropna())

    return {
        "tickers": tickers_used,
        "matrix": matrix,
        "avg_correlation": round(avg_corr, 4),
        "min_correlation": round(min_corr, 4),
        "max_correlation": round(max_corr, 4),
        "n_observations": n_observations,
        "period": period,
    }


# ---------------------------------------------------------------------------
# Contagion analysis: normal vs. stress correlations
# ---------------------------------------------------------------------------

def compute_contagion_analysis(transactions: list[dict], period: str = "1y") -> dict:
    """Compare correlations in normal vs. stress periods.

    Stress is defined as days where the portfolio return is below -1 std dev.
    """
    tickers = list(set(t["ticker"] for t in transactions if t.get("ticker")))
    if len(tickers) < 2:
        return {"error": "Trenger minst 2 aksjer for contagion-analyse"}

    returns_df = _fetch_individual_returns(tickers, period)
    if returns_df.shape[1] < 2:
        return {"error": "Ikke nok prisdata for contagion-analyse"}

    # Use equal-weight portfolio return as stress indicator
    port_return = returns_df.mean(axis=1)
    threshold = port_return.mean() - port_return.std()
    stress_mask = port_return < threshold
    normal_mask = ~stress_mask

    stress_days = int(stress_mask.sum())
    normal_days = int(normal_mask.sum())

    if stress_days < 10 or normal_days < 10:
        return {"error": "Ikke nok stress- eller normaldager for analyse (trenger minst 10 av hver)"}

    normal_corr = returns_df.loc[normal_mask].corr()
    stress_corr = returns_df.loc[stress_mask].corr()

    tickers_used = list(returns_df.columns)
    n = len(tickers_used)

    # Build pair-level comparison
    pairs = []
    normal_pairs = []
    stress_pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            t1, t2 = tickers_used[i], tickers_used[j]
            nc = float(normal_corr.loc[t1, t2])
            sc = float(stress_corr.loc[t1, t2])
            pairs.append({
                "ticker_1": t1,
                "ticker_2": t2,
                "normal_correlation": round(nc, 4),
                "stress_correlation": round(sc, 4),
                "change": round(sc - nc, 4),
            })
            normal_pairs.append(nc)
            stress_pairs.append(sc)

    avg_normal = float(np.mean(normal_pairs)) if normal_pairs else 0.0
    avg_stress = float(np.mean(stress_pairs)) if stress_pairs else 0.0

    return {
        "tickers": tickers_used,
        "pairs": pairs,
        "avg_normal_correlation": round(avg_normal, 4),
        "avg_stress_correlation": round(avg_stress, 4),
        "contagion_delta": round(avg_stress - avg_normal, 4),
        "stress_days": stress_days,
        "normal_days": normal_days,
        "stress_threshold_pct": round(float(threshold) * 100, 2),
        "period": period,
    }
