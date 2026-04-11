from sqlalchemy import Column, Integer, String, Float, DateTime, Date
from sqlalchemy.sql import func
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nordnet_id = Column(String, unique=True, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    transaction_type = Column(String, nullable=False)  # KJØPT / SALG
    name = Column(String, nullable=False)
    isin = Column(String)
    ticker = Column(String, index=True)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    amount_nok = Column(Float)
    fees_nok = Column(Float)
    exchange_rate = Column(Float)


# Legacy — kept so existing DB table isn't orphaned
class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ticker = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    avg_price = Column(Float, nullable=False)
    last_price = Column(Float, nullable=True)
    value = Column(Float, nullable=True)
    value_nok = Column(Float, nullable=True)
    return_pct = Column(Float, nullable=True)
    return_nok = Column(Float, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    close_price = Column(Float, nullable=False)
    currency = Column(String, nullable=False)


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, unique=True, index=True)
    total_value_nok = Column(Float, nullable=False)
    total_value_usd = Column(Float, nullable=True)
