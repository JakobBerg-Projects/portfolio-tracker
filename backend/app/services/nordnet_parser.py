import pandas as pd
import yfinance as yf
from io import StringIO

_search_cache: dict[str, str] = {}

TICKER_MAP = {
    # Norwegian stocks — Oslo Børs (.OL suffix)
    "Equinor": "EQNR.OL",
    "DNB": "DNB.OL",
    "Telenor": "TEL.OL",
    "Mowi": "MOWI.OL",
    "Yara International": "YAR.OL",
    "Norsk Hydro": "NHY.OL",
    "Orkla": "ORK.OL",
    "Aker BP": "AKRBP.OL",
    "Frontline": "FRO.OL",
    "Kongsberg Gruppen": "KOG.OL",
    "Bakkafrost": "BAKKA.OL",
    "Gjensidige Forsikring": "GJF.OL",
    "Storebrand": "STB.OL",
    "Tomra Systems": "TOM.OL",
    "Salmar": "SALM.OL",
    "Schibsted ser. A": "SCHA.OL",
    "Schibsted ser. B": "SCHB.OL",
    "Autostore Holdings": "AUTO.OL",
    "Vår Energi": "VAR.OL",
    "Hafnia": "HAFNI.OL",
    # US stocks
    "Apple": "AAPL",
    "Microsoft": "MSFT",
    "Alphabet A": "GOOGL",
    "Amazon.com": "AMZN",
    "Amazon": "AMZN",
    "NVIDIA": "NVDA",
    "Tesla": "TSLA",
    "Meta Platforms": "META",
    "CrowdStrike A": "CRWD",
    "Palantir Technologies": "PLTR",
    "CoreWeave": "CRWV",
    "Vertiv Holdings A": "VRT",
    "Shopify": "SHOP",
    "IonQ": "IONQ",
    "Roblox A": "RBLX",
    "Roku A": "ROKU",
    "Unity Software": "U",
    "Advanced Micro Devices": "AMD",
    "Adobe": "ADBE",
    "PayPal": "PYPL",
    "Teladoc Health": "TDOC",
    "Sea ADR A": "SE",
    "Alibaba Group ADR": "BABA",
    "StoneCo A Common Share": "STNE",
}


def search_yahoo_ticker(name: str) -> str | None:
    if name in _search_cache:
        return _search_cache[name]
    try:
        search = yf.Search(name)
        for result in search.quotes[:5]:
            symbol = result.get("symbol", "")
            long_name = result.get("longname", "").lower()
            short_name = result.get("shortname", "").lower()
            name_lower = name.lower()
            if (
                name_lower in long_name
                or name_lower in short_name
                or any(word in long_name for word in name_lower.split() if len(word) > 3)
            ):
                _search_cache[name] = symbol
                return symbol
    except Exception:
        pass
    _search_cache[name] = ""
    return None


def guess_ticker(name: str, currency: str) -> str:
    normalized = name.strip()

    if normalized in TICKER_MAP:
        return TICKER_MAP[normalized]

    for key, ticker in TICKER_MAP.items():
        if key.lower() in normalized.lower() or normalized.lower() in key.lower():
            return ticker

    yahoo_result = search_yahoo_ticker(normalized)
    if yahoo_result:
        return yahoo_result

    if currency == "NOK":
        return normalized.upper().replace(" ", "")[:10] + ".OL"
    return normalized.upper().replace(" ", "")[:10]


def _clean_number(value) -> float:
    if pd.isna(value) or value is None:
        return 0.0
    s = str(value).strip()
    if not s or s == "nan":
        return 0.0
    s = s.replace("\u00a0", "").replace(" ", "")
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_nordnet_transactions(csv_content: str) -> list[dict]:
    """Parse a Nordnet transaction-history CSV export.

    Expects tab-separated UTF-16 file with columns including
    Transaksjonstype, Verdipapir, ISIN, Antall, Kurs, Beløp, etc.
    """
    lines = csv_content.strip().splitlines()
    header_idx = 0
    for i, line in enumerate(lines):
        if "Transaksjonstype" in line:
            header_idx = i
            break

    csv_from_header = "\n".join(lines[header_idx:])

    df = pd.read_csv(StringIO(csv_from_header), sep="\t", dtype=str)
    if df.empty or len(df.columns) < 10:
        return []

    # Normalize column names (non-breaking spaces, whitespace)
    df.columns = df.columns.str.replace("\u00a0", " ", regex=False).str.strip()

    if "Transaksjonstype" not in df.columns:
        return []

    # Keep only buy / sell rows
    df = df[df["Transaksjonstype"].str.strip().isin(["KJØPT", "SALG"])]
    if df.empty:
        return []

    # pandas auto-renames duplicate columns: Valuta, Valuta.1, Valuta.2, …
    # Valuta.2 = currency after Kjøpsverdi (instrument currency for buys)
    # Valuta.3 = currency after Resultat  (instrument currency for sells)

    transactions: list[dict] = []
    for _, row in df.iterrows():
        name = str(row.get("Verdipapir", "")).strip()
        txn_type = str(row.get("Transaksjonstype", "")).strip()
        trade_date = str(row.get("Handelsdag", "")).strip()
        isin = str(row.get("ISIN", "")).strip()

        quantity = _clean_number(row.get("Antall", "0"))
        price = _clean_number(row.get("Kurs", "0"))
        amount_nok = _clean_number(row.get("Beløp", "0"))
        fees = _clean_number(row.get("Totale Avgifter", "0"))
        exchange_rate = _clean_number(row.get("Vekslingskurs", "0"))

        if not name or name == "nan" or quantity == 0:
            continue

        # Determine instrument currency
        currency = "NOK"
        kv_cur = str(row.get("Valuta.2", "")).strip()
        res_cur = str(row.get("Valuta.3", "")).strip()
        if kv_cur and kv_cur not in ("NOK", "nan", ""):
            currency = kv_cur
        elif res_cur and res_cur not in ("NOK", "nan", ""):
            currency = res_cur
        elif exchange_rate > 0:
            currency = "USD"

        ticker = guess_ticker(name, currency)
        nordnet_id = str(row.get("Id", "")).strip()

        transactions.append(
            {
                "nordnet_id": nordnet_id if nordnet_id != "nan" else "",
                "trade_date": trade_date,
                "transaction_type": txn_type,
                "name": name,
                "isin": isin if isin != "nan" else "",
                "ticker": ticker,
                "quantity": quantity,
                "price": price,
                "currency": currency,
                "amount_nok": amount_nok,
                "fees_nok": fees,
                "exchange_rate": exchange_rate,
            }
        )

    return transactions
