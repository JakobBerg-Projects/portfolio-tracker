from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import portfolio

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Portfolio Analyzer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
