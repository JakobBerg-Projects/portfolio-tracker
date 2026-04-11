from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import Transaction
from app.schemas.analysis import (
    FactorExposureResponse,
    RiskMetricsResponse,
    CorrelationMatrixResponse,
    ContagionAnalysisResponse,
)
from app.services.analysis import (
    compute_factor_exposure,
    compute_risk_metrics,
    compute_correlation_matrix,
    compute_contagion_analysis,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _get_transactions(db: Session) -> list[dict]:
    transactions = db.query(Transaction).order_by(Transaction.trade_date).all()
    if not transactions:
        raise HTTPException(status_code=404, detail="Ingen transaksjoner funnet")
    return [
        {
            "trade_date": t.trade_date,
            "transaction_type": t.transaction_type,
            "ticker": t.ticker,
            "quantity": t.quantity,
            "currency": t.currency,
        }
        for t in transactions
    ]


@router.get("/factors")
def get_factor_exposure(period: str = "3y", db: Session = Depends(get_db)):
    """Fama-French 3-factor regression on portfolio returns."""
    txn_data = _get_transactions(db)
    result = compute_factor_exposure(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return FactorExposureResponse(**result)


@router.get("/risk")
def get_risk_metrics(period: str = "1y", db: Session = Depends(get_db)):
    """Portfolio risk metrics: Sharpe, Sortino, volatility, max drawdown."""
    txn_data = _get_transactions(db)
    result = compute_risk_metrics(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return RiskMetricsResponse(**result)


@router.get("/correlation")
def get_correlation_matrix(period: str = "1y", db: Session = Depends(get_db)):
    """Pairwise return correlations between holdings."""
    txn_data = _get_transactions(db)
    result = compute_correlation_matrix(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return CorrelationMatrixResponse(**result)


@router.get("/contagion")
def get_contagion_analysis(period: str = "1y", db: Session = Depends(get_db)):
    """Correlation comparison: normal vs. stress periods."""
    txn_data = _get_transactions(db)
    result = compute_contagion_analysis(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return ContagionAnalysisResponse(**result)
