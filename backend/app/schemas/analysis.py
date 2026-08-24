from pydantic import BaseModel


class FactorDetail(BaseModel):
    name: str
    coefficient: float
    t_stat: float
    p_value: float
    significant: bool


class FactorExposureResponse(BaseModel):
    factors: list[FactorDetail]
    r_squared: float
    adj_r_squared: float
    annual_alpha_pct: float
    n_observations: int
    period: str
    model: str
    non_us_tickers: list[str]


class RiskMetricsResponse(BaseModel):
    annual_return_pct: float
    annual_volatility_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float
    best_day_pct: float
    worst_day_pct: float
    positive_days_pct: float
    trading_days: int
    period: str


class CorrelationMatrixResponse(BaseModel):
    tickers: list[str]
    matrix: list[list[float]]
    avg_correlation: float
    min_correlation: float
    max_correlation: float
    n_observations: int
    period: str


class ContagionPair(BaseModel):
    ticker_1: str
    ticker_2: str
    normal_correlation: float
    stress_correlation: float
    change: float


class ContagionAnalysisResponse(BaseModel):
    tickers: list[str]
    pairs: list[ContagionPair]
    avg_normal_correlation: float
    avg_stress_correlation: float
    contagion_delta: float
    stress_days: int
    normal_days: int
    stress_threshold_pct: float
    period: str


class BiasResult(BaseModel):
    id: str
    name: str
    description: str
    detected: bool
    severity: int
    metrics: dict
    detail: str
    examples: dict


class BehavioralBiasResponse(BaseModel):
    biases: list[BiasResult]
    bias_score: int
    total_transactions: int
    total_sells: int
    total_buys: int
    unique_tickers: int
    period_start: str
    period_end: str
