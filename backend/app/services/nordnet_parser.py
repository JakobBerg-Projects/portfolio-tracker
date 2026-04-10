import pandas as pd
import yfinance as yf
from io import StringIO

# Cache for Yahoo Finance search results to avoid repeated lookups
_search_cache: dict[str, str] = {}

# Mapping of common Nordnet names to Yahoo Finance tickers.
# Oslo Børs stocks use .OL suffix, US stocks use their standard ticker.
TICKER_MAP = {
    # Norwegian stocks - Oslo Børs (.OL suffix)
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
    "Vertx Holdings A": "VH.OL",
    # US stocks - Nordnet uses various name formats
    "Apple": "AAPL",
    "Apple Inc": "AAPL",
    "Microsoft": "MSFT",
    "Microsoft Corp": "MSFT",
    "Alphabet A": "GOOGL",
    "Alphabet Inc": "GOOGL",
    "Amazon": "AMZN",
    "Amazon.com Inc": "AMZN",
    "NVIDIA": "NVDA",
    "NVIDIA Corp": "NVDA",
    "Tesla": "TSLA",
    "Tesla Inc": "TSLA",
    "Meta Platforms": "META",
    "Meta Platforms Inc": "META",
    "CrowdStrike A": "CRWD",
    "CrowdStrike Holdings": "CRWD",
    "Palantir Technologies": "PLTR",
    "CoreWeave": "CRWV",
    "Vertiv Holdings A": "VRT",
}


def normalize_name(name: str) -> str:
    """Normalize a stock name for lookup."""
    return name.strip()


def search_yahoo_ticker(name: str) -> str | None:
    """Search Yahoo Finance for a ticker matching the given name."""
    if name in _search_cache:
        return _search_cache[name]

    try:
        search = yf.Search(name)
        for result in search.quotes[:5]:
            symbol = result.get("symbol", "")
            long_name = result.get("longname", "").lower()
            short_name = result.get("shortname", "").lower()
            name_lower = name.lower()

            # Check if the result is a reasonable match
            if (
                name_lower in long_name
                or name_lower in short_name
                or any(word in long_name for word in name_lower.split() if len(word) > 3)
            ):
                _search_cache[name] = symbol
                print(f"Yahoo search: '{name}' -> {symbol} ({result.get('longname', '')})")
                return symbol
    except Exception as e:
        print(f"Yahoo search failed for '{name}': {e}")

    _search_cache[name] = ""
    return None


def guess_ticker(name: str, currency: str) -> str:
    """Try to find a Yahoo Finance ticker for a Nordnet holding name.

    1. Direct lookup in TICKER_MAP
    2. Partial match in TICKER_MAP
    3. Yahoo Finance search (for funds etc.)
    4. Fallback heuristic
    """
    normalized = normalize_name(name)

    # Direct lookup
    if normalized in TICKER_MAP:
        return TICKER_MAP[normalized]

    # Partial match: check if any key is contained in the name
    for key, ticker in TICKER_MAP.items():
        if key.lower() in normalized.lower() or normalized.lower() in key.lower():
            return ticker

    # Yahoo Finance search (catches funds, ETFs, etc.)
    yahoo_result = search_yahoo_ticker(normalized)
    if yahoo_result:
        return yahoo_result

    # Fallback heuristic
    if currency == "NOK":
        return normalized.upper().replace(" ", "")[:10] + ".OL"
    else:
        return normalized.upper().replace(" ", "")[:10]


def parse_nordnet_csv(csv_content: str) -> list[dict]:
    """Parse a Nordnet portfolio CSV export.

    Expected columns (Norwegian):
    Navn, Valuta, Antall, GAV, I dag %, Siste kurs,
    Belåningsverdi, Verdi, Verdi NOK, Avkast. %, Avkast. NOK
    """
    # Nordnet CSVs often have a title row before the actual header.
    # Find the header row by looking for "Navn" in the lines.
    lines = csv_content.strip().splitlines()
    header_idx = 0
    for i, line in enumerate(lines):
        if "Navn" in line and "Valuta" in line:
            header_idx = i
            break

    csv_from_header = "\n".join(lines[header_idx:])

    # Nordnet uses tab or semicolon as separator, comma as decimal,
    # and space (or non-breaking space) as thousands separator.
    df = None
    for sep in ["\t", ";", ","]:
        try:
            candidate = pd.read_csv(
                StringIO(csv_from_header),
                sep=sep,
                dtype=str,  # Read everything as string first
                encoding="utf-8",
            )
            if len(candidate.columns) > 3:
                df = candidate
                break
        except Exception:
            continue

    if df is None:
        return []

    # Normalize column names: replace non-breaking spaces with regular spaces, strip
    df.columns = df.columns.str.replace("\u00a0", " ", regex=False).str.strip()

    # Support both stock CSV and fund CSV column names
    col_map = {
        # Stock CSV (aksjelister)
        "Navn": "name",
        "Valuta": "currency",
        "Antall": "quantity",
        "GAV": "avg_price",
        "I dag %": "today_pct",
        "Siste kurs": "last_price",
        "Belåningsverdi": "collateral_value",
        "Verdi": "value",
        "Verdi NOK": "value_nok",
        "Avkast. %": "return_pct",
        "Avkast. NOK": "return_nok",
        # Fund CSV (fondslister)
        "Kostpris": "avg_price",
        "NAV": "last_price",
        "Kjøpsverdi NOK": "cost_nok",
        "Verdi NOK": "value_nok",
        "Avkast. NOK": "return_nok",
    }

    df = df.rename(columns=col_map)

    # Drop rows where name is NaN or empty
    df = df.dropna(subset=["name"])

    # Convert numeric columns: strip spaces/non-breaking spaces, replace comma with dot
    numeric_cols = [
        "quantity", "avg_price", "last_price", "value",
        "value_nok", "return_pct", "return_nok", "cost_nok"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace("\u00a0", "", regex=False)  # non-breaking space
                .str.replace(" ", "", regex=False)        # regular space
                .str.replace(",", ".", regex=False)       # comma -> dot
                .str.replace("%", "", regex=False)        # remove % sign
                .str.strip()
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")

    holdings = []
    for _, row in df.iterrows():
        name = str(row.get("name", "")).strip()
        currency = str(row.get("currency", "NOK")).strip()

        if not name or name == "nan":
            continue

        ticker = guess_ticker(name, currency)

        quantity = float(row.get("quantity", 0) or 0)
        avg_price = float(row.get("avg_price", 0) or 0)
        last_price = float(row.get("last_price", 0) or 0)
        value = float(row.get("value", 0) or 0)
        value_nok = float(row.get("value_nok", 0) or 0)
        return_pct = float(row.get("return_pct", 0) or 0)
        return_nok = float(row.get("return_nok", 0) or 0)

        # For funds: compute value from NAV * quantity if value is missing
        if value == 0 and last_price > 0 and quantity > 0:
            value = last_price * quantity

        # For funds: compute avg_price from cost_nok / quantity if missing
        cost_nok = float(row.get("cost_nok", 0) or 0)
        if avg_price == 0 and cost_nok > 0 and quantity > 0:
            avg_price = cost_nok / quantity

        holdings.append({
            "name": name,
            "ticker": ticker,
            "currency": currency,
            "quantity": quantity,
            "avg_price": avg_price,
            "last_price": last_price,
            "value": value,
            "value_nok": value_nok,
            "return_pct": return_pct,
            "return_nok": return_nok,
        })

    return holdings
