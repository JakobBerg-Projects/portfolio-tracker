import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.holding import Transaction
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


def _build_portfolio_context(db: Session, user_id: int) -> str:
    """Build a text summary of the user's portfolio for the system prompt."""
    transactions = (
        db.query(Transaction)
        .filter_by(user_id=user_id)
        .order_by(Transaction.trade_date)
        .all()
    )

    if not transactions:
        return "Brukeren har ingen transaksjoner i portefoljen."

    # Current holdings via FIFO
    holdings: dict[str, dict] = {}
    for t in transactions:
        ticker = t.ticker or t.name
        if ticker not in holdings:
            holdings[ticker] = {
                "name": t.name,
                "ticker": t.ticker,
                "currency": t.currency,
                "qty": 0.0,
                "total_cost_nok": 0.0,
                "buys": 0,
                "sells": 0,
                "first_date": t.trade_date,
                "last_date": t.trade_date,
            }

        h = holdings[ticker]
        h["last_date"] = t.trade_date

        if t.transaction_type in ("KJØPT", "KJ\u00d8PT"):
            h["qty"] += t.quantity
            h["total_cost_nok"] += abs(t.amount_nok or (t.quantity * t.price))
            h["buys"] += 1
        elif t.transaction_type == "SALG":
            h["qty"] -= t.quantity
            h["sells"] += 1

    # Summary stats
    total_txns = len(transactions)
    first_date = transactions[0].trade_date
    last_date = transactions[-1].trade_date
    unique_tickers = len(holdings)
    buys = sum(1 for t in transactions if t.transaction_type in ("KJØPT", "KJ\u00d8PT"))
    sells = sum(1 for t in transactions if t.transaction_type == "SALG")

    lines = [
        f"PORTEFOLJE-OVERSIKT (per {date.today().isoformat()}):",
        f"Totalt {total_txns} transaksjoner ({buys} kjop, {sells} salg) fra {first_date} til {last_date}.",
        f"{unique_tickers} unike verdipapirer.",
        "",
        "NAVAERENDE POSISJONER (antall > 0):",
    ]

    active = {k: v for k, v in holdings.items() if v["qty"] > 0.01}
    closed = {k: v for k, v in holdings.items() if v["qty"] <= 0.01}

    if active:
        for ticker, h in sorted(active.items(), key=lambda x: -x[1]["total_cost_nok"]):
            avg_cost = h["total_cost_nok"] / max(h["qty"], 0.01)
            lines.append(
                f"  - {h['name']} ({h['ticker']}): {h['qty']:.2f} enheter, "
                f"snitt kostpris ~{avg_cost:.0f} {h['currency']}, "
                f"total investert ~{h['total_cost_nok']:.0f} NOK, "
                f"{h['buys']} kjop / {h['sells']} salg, "
                f"forste: {h['first_date']}, siste: {h['last_date']}"
            )
    else:
        lines.append("  Ingen aktive posisjoner.")

    if closed:
        lines.append("")
        lines.append("LUKKEDE POSISJONER:")
        for ticker, h in sorted(closed.items()):
            lines.append(
                f"  - {h['name']} ({h['ticker']}): "
                f"{h['buys']} kjop / {h['sells']} salg, "
                f"total investert ~{h['total_cost_nok']:.0f} NOK, "
                f"periode: {h['first_date']} til {h['last_date']}"
            )

    # Recent transactions
    recent = transactions[-15:]
    lines.append("")
    lines.append("SISTE TRANSAKSJONER:")
    for t in recent:
        lines.append(
            f"  {t.trade_date} {t.transaction_type} {t.quantity:.2f} {t.name} ({t.ticker}) "
            f"@ {t.price:.2f} {t.currency} = {t.amount_nok:.0f} NOK"
        )

    return "\n".join(lines)


SYSTEM_PROMPT = """\
Du er en AI-radgiver for en norsk privatinvestor. Du har tilgang til brukerens portefoljeoversikt nedenfor.

Dine oppgaver:
1. Svar pa sporsmal om portefoljen basert pa dataene du har tilgjengelig.
2. Gi konkrete forbedringsforslag for portefoljen (diversifisering, risiko, kostnader, allokering).
3. Forklar finanskonsepter pa en enkel og forstaelig mate.
4. Ver aerlig nar du ikke har nok data til a gi et sikkert svar.

Viktige regler:
- Svar alltid pa norsk.
- Ikke gi spesifikke kjops- eller salgsanbefalinger for enkeltaksjer. Du kan diskutere generelle prinsipper.
- Vennligst papeik at dette er generell informasjon, ikke personlig finansradgivning.
- Hold svarene konsise og relevante.
- Bruk tall og data fra portefoljen nar det er relevant.

{portfolio_context}
"""


@router.post("/chat")
async def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY er ikke konfigurert pa serveren",
        )

    import anthropic

    portfolio_context = _build_portfolio_context(db, current_user.id)
    system = SYSTEM_PROMPT.format(portfolio_context=portfolio_context)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    api_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system,
        messages=api_messages,
    )

    reply = response.content[0].text

    return ChatResponse(reply=reply)
