from pydantic import BaseModel


class HoldingResponse(BaseModel):
    id: int
    name: str
    ticker: str
    currency: str
    quantity: float
    avg_price: float
    last_price: float | None
    value: float | None
    value_nok: float | None
    return_pct: float | None
    return_nok: float | None
    today_pct: float | None = None


class PortfolioSummary(BaseModel):
    total_value_nok: float
    total_value_usd: float
    total_return_nok: float
    total_return_pct: float
    holdings_count: int


class PortfolioHistoryPoint(BaseModel):
    date: str
    total_value_nok: float
    twr_pct: float


class UploadResponse(BaseModel):
    message: str
    transaction_count: int
