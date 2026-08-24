from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import Transaction
from app.models.user import User
from app.services.auth import get_current_user
from app.schemas.analysis import (
    FactorExposureResponse,
    RiskMetricsResponse,
    CorrelationMatrixResponse,
    ContagionAnalysisResponse,
    BehavioralBiasResponse,
)
from app.services.analysis import (
    compute_factor_exposure,
    compute_risk_metrics,
    compute_correlation_matrix,
    compute_contagion_analysis,
)
from app.services.behavioral import compute_behavioral_biases

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _get_transactions(db: Session, user_id: int) -> list[dict]:
    transactions = db.query(Transaction).filter_by(user_id=user_id).order_by(Transaction.trade_date).all()
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
def get_factor_exposure(period: str = "3y", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fama-French 3-factor regression on portfolio returns."""
    txn_data = _get_transactions(db, current_user.id)
    result = compute_factor_exposure(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return FactorExposureResponse(**result)


@router.get("/risk")
def get_risk_metrics(period: str = "1y", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Portfolio risk metrics: Sharpe, Sortino, volatility, max drawdown."""
    txn_data = _get_transactions(db, current_user.id)
    result = compute_risk_metrics(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return RiskMetricsResponse(**result)


@router.get("/correlation")
def get_correlation_matrix(period: str = "1y", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Pairwise return correlations between holdings."""
    txn_data = _get_transactions(db, current_user.id)
    result = compute_correlation_matrix(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return CorrelationMatrixResponse(**result)


@router.get("/contagion")
def get_contagion_analysis(period: str = "1y", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Correlation comparison: normal vs. stress periods."""
    txn_data = _get_transactions(db, current_user.id)
    result = compute_contagion_analysis(txn_data, period)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return ContagionAnalysisResponse(**result)


@router.get("/behavioral")
def get_behavioral_biases(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Behavioral bias detection from transaction history."""
    transactions = db.query(Transaction).filter_by(user_id=current_user.id).order_by(Transaction.trade_date).all()
    if not transactions:
        raise HTTPException(status_code=404, detail="Ingen transaksjoner funnet")

    txn_data = [
        {
            "trade_date": t.trade_date,
            "transaction_type": t.transaction_type,
            "ticker": t.ticker,
            "name": t.name,
            "quantity": t.quantity,
            "price": t.price,
            "currency": t.currency,
            "amount_nok": t.amount_nok,
        }
        for t in transactions
    ]

    result = compute_behavioral_biases(txn_data)

    if "error" in result:
        return JSONResponse(status_code=200, content=result)

    return BehavioralBiasResponse(**result)
