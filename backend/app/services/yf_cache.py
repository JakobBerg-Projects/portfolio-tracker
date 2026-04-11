"""Simple TTL cache for yfinance calls to avoid rate limiting.

All yfinance data access should go through this module so that
concurrent API endpoints reuse cached responses instead of
hammering Yahoo Finance with duplicate requests.
"""

import time
import yfinance as yf
import pandas as pd

_DEFAULT_TTL = 300  # 5 minutes

_cache: dict[str, tuple[float, object]] = {}


def _get(key: str):
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < _DEFAULT_TTL:
            return val
        del _cache[key]
    return None


def _put(key: str, val):
    _cache[key] = (time.time(), val)


def get_history(ticker: str, **kwargs) -> pd.DataFrame:
    key = f"hist:{ticker}:{sorted(kwargs.items())}"
    cached = _get(key)
    if cached is not None:
        return cached
    try:
        hist = yf.Ticker(ticker).history(**kwargs)
    except Exception:
        hist = pd.DataFrame()
    _put(key, hist)
    return hist


def get_splits(ticker: str) -> pd.Series:
    key = f"splits:{ticker}"
    cached = _get(key)
    if cached is not None:
        return cached
    try:
        splits = yf.Ticker(ticker).splits
        if splits is None:
            splits = pd.Series(dtype=float)
    except Exception:
        splits = pd.Series(dtype=float)
    _put(key, splits)
    return splits


def download(tickers: list[str], **kwargs) -> pd.DataFrame:
    key = f"download:{sorted(tickers)}:{sorted(kwargs.items())}"
    cached = _get(key)
    if cached is not None:
        return cached
    try:
        data = yf.download(tickers, **kwargs)
    except Exception:
        data = pd.DataFrame()
    _put(key, data)
    return data
