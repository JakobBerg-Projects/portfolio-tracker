from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models import user  # noqa: F401 — ensure User table is created
from app.routers import portfolio, analysis, auth

# Create tables
Base.metadata.create_all(bind=engine)

# Lightweight migration: add user_id column to transactions if missing
with engine.connect() as conn:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "transactions" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("transactions")]
        if "user_id" not in columns:
            conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)"
            ))
            conn.commit()

app = FastAPI(title="Stock Portfolio Analyzer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(analysis.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
