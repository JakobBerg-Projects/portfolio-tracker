"""Behavioral bias detection from transaction history.

Analyzes trading patterns to reveal cognitive biases such as
disposition effect, loss holding, overtrading, and concentration bias.
"""

from datetime import date as date_type, timedelta
from collections import defaultdict

from app.services import yf_cache


def _parse_date(d) -> date_type:
    if isinstance(d, date_type):
        return d
    return date_type.fromisoformat(str(d))


def compute_behavioral_biases(transactions: list[dict]) -> dict:
    """Run all bias detectors on the transaction history.

    Each transaction dict must have: trade_date, transaction_type, ticker,
    quantity, price, currency, amount_nok, name.
    """
    if len(transactions) < 3:
        return {"error": "Trenger minst 3 transaksjoner for atferdsanalyse"}

    sorted_txns = sorted(transactions, key=lambda t: _parse_date(t["trade_date"]))

    biases = []

    disposition = _disposition_effect(sorted_txns)
    if disposition:
        biases.append(disposition)

    loss_holding = _loss_holding_duration(sorted_txns)
    if loss_holding:
        biases.append(loss_holding)

    overtrading = _overtrading_analysis(sorted_txns)
    if overtrading:
        biases.append(overtrading)

    concentration = _concentration_bias(sorted_txns)
    if concentration:
        biases.append(concentration)

    anchoring = _anchoring_bias(sorted_txns)
    if anchoring:
        biases.append(anchoring)

    # Overall score (0-100, higher = more biased behavior detected)
    detected = [b for b in biases if b.get("detected")]
    severity_sum = sum(b.get("severity", 0) for b in detected)
    max_possible = len(biases) * 3  # max severity per bias is 3
    bias_score = round(severity_sum / max_possible * 100) if max_possible > 0 else 0

    return {
        "biases": biases,
        "bias_score": bias_score,
        "total_transactions": len(sorted_txns),
        "total_sells": sum(1 for t in sorted_txns if t["transaction_type"] == "SALG"),
        "total_buys": sum(1 for t in sorted_txns if t["transaction_type"] == "KJØPT"),
        "unique_tickers": len(set(t["ticker"] for t in sorted_txns if t.get("ticker"))),
        "period_start": sorted_txns[0]["trade_date"].isoformat() if isinstance(sorted_txns[0]["trade_date"], date_type) else sorted_txns[0]["trade_date"],
        "period_end": sorted_txns[-1]["trade_date"].isoformat() if isinstance(sorted_txns[-1]["trade_date"], date_type) else sorted_txns[-1]["trade_date"],
    }


def _disposition_effect(txns: list[dict]) -> dict | None:
    """Disposition effect: selling winners too early, holding losers too long.

    Measures Proportion of Gains Realized (PGR) vs Proportion of Losses
    Realized (PLR). PGR >> PLR indicates disposition effect.
    """
    sells = [t for t in txns if t["transaction_type"] == "SALG"]
    if len(sells) < 2:
        return None

    # Build cost basis per ticker using FIFO-like weighted average
    positions: dict[str, dict] = {}
    gains_realized = 0
    gains_paper = 0
    losses_realized = 0
    losses_paper = 0

    # Track realized gains/losses at each sell
    sell_outcomes: list[dict] = []

    for txn in txns:
        ticker = txn.get("ticker", "")
        if not ticker:
            continue

        if txn["transaction_type"] == "KJØPT":
            if ticker not in positions:
                positions[ticker] = {"qty": 0, "total_cost": 0.0}
            positions[ticker]["qty"] += txn["quantity"]
            positions[ticker]["total_cost"] += txn["quantity"] * txn["price"]

        elif txn["transaction_type"] == "SALG":
            if ticker not in positions or positions[ticker]["qty"] < 0.001:
                continue
            avg_cost = positions[ticker]["total_cost"] / positions[ticker]["qty"]
            sell_price = txn["price"]
            pnl_per_share = sell_price - avg_cost
            total_pnl = pnl_per_share * txn["quantity"]

            if total_pnl > 0:
                gains_realized += 1
            else:
                losses_realized += 1

            sell_outcomes.append({
                "ticker": ticker,
                "name": txn.get("name", ticker),
                "pnl_pct": round(pnl_per_share / avg_cost * 100, 1) if avg_cost > 0 else 0,
                "date": _parse_date(txn["trade_date"]).isoformat(),
            })

            # Update position
            ratio = min(txn["quantity"] / positions[ticker]["qty"], 1.0)
            positions[ticker]["total_cost"] *= (1 - ratio)
            positions[ticker]["qty"] -= txn["quantity"]

    # Get current prices to evaluate paper gains/losses
    open_tickers = [t for t, p in positions.items() if p["qty"] > 0.001]
    if open_tickers:
        try:
            from app.services.market_data import fetch_live_data
            current_prices, _ = fetch_live_data(open_tickers)
            for ticker in open_tickers:
                if ticker in current_prices and positions[ticker]["qty"] > 0.001:
                    avg_cost = positions[ticker]["total_cost"] / positions[ticker]["qty"]
                    if current_prices[ticker] > avg_cost:
                        gains_paper += 1
                    else:
                        losses_paper += 1
        except Exception:
            pass

    total_gains = gains_realized + gains_paper
    total_losses = losses_realized + losses_paper

    pgr = gains_realized / total_gains if total_gains > 0 else 0
    plr = losses_realized / total_losses if total_losses > 0 else 0

    detected = pgr > plr + 0.1 and total_gains >= 2 and total_losses >= 1
    diff = pgr - plr

    if diff > 0.4:
        severity = 3
    elif diff > 0.2:
        severity = 2
    elif diff > 0.1:
        severity = 1
    else:
        severity = 0

    # Sort sells: biggest winners sold, biggest losers held
    winners_sold = sorted(
        [s for s in sell_outcomes if s["pnl_pct"] > 0],
        key=lambda s: s["pnl_pct"]
    )
    losers_sold = sorted(
        [s for s in sell_outcomes if s["pnl_pct"] < 0],
        key=lambda s: s["pnl_pct"]
    )

    return {
        "id": "disposition_effect",
        "name": "Disposisjonseffekten",
        "description": "Tendensen til a selge vinnere for tidlig og holde pa tapere for lenge.",
        "detected": detected,
        "severity": severity,
        "metrics": {
            "pgr": round(pgr, 2),
            "plr": round(plr, 2),
            "pgr_plr_diff": round(diff, 2),
            "gains_realized": gains_realized,
            "gains_paper": gains_paper,
            "losses_realized": losses_realized,
            "losses_paper": losses_paper,
        },
        "detail": (
            f"Du realiserer {round(pgr*100)}% av gevinstene dine, men bare {round(plr*100)}% av tapene. "
            f"Dette tyder pa at du selger vinnere raskere enn tapere."
            if detected else
            f"PGR ({round(pgr*100)}%) og PLR ({round(plr*100)}%) er relativt balansert."
        ),
        "examples": {
            "winners_sold": winners_sold[:3],
            "losers_sold": losers_sold[:3],
        },
    }


def _loss_holding_duration(txns: list[dict]) -> dict | None:
    """Analyze if losing positions are held significantly longer than winners."""
    # Build round-trip trades (buy -> sell for same ticker)
    buys: dict[str, list] = defaultdict(list)
    round_trips: list[dict] = []

    for txn in txns:
        ticker = txn.get("ticker", "")
        if not ticker:
            continue
        trade_date = _parse_date(txn["trade_date"])

        if txn["transaction_type"] == "KJØPT":
            buys[ticker].append({
                "date": trade_date,
                "price": txn["price"],
                "qty": txn["quantity"],
            })
        elif txn["transaction_type"] == "SALG" and buys[ticker]:
            # Match against earliest buy (FIFO)
            buy = buys[ticker][0]
            holding_days = (trade_date - buy["date"]).days
            pnl_pct = (txn["price"] - buy["price"]) / buy["price"] * 100 if buy["price"] > 0 else 0

            round_trips.append({
                "ticker": ticker,
                "name": txn.get("name", ticker),
                "buy_date": buy["date"].isoformat(),
                "sell_date": trade_date.isoformat(),
                "holding_days": holding_days,
                "pnl_pct": round(pnl_pct, 1),
                "is_winner": pnl_pct > 0,
            })

            # Reduce buy qty
            sell_qty = txn["quantity"]
            while sell_qty > 0.001 and buys[ticker]:
                if buys[ticker][0]["qty"] <= sell_qty:
                    sell_qty -= buys[ticker][0]["qty"]
                    buys[ticker].pop(0)
                else:
                    buys[ticker][0]["qty"] -= sell_qty
                    sell_qty = 0

    if len(round_trips) < 3:
        return None

    winners = [rt for rt in round_trips if rt["is_winner"]]
    losers = [rt for rt in round_trips if not rt["is_winner"]]

    if not winners or not losers:
        return None

    avg_win_days = sum(rt["holding_days"] for rt in winners) / len(winners)
    avg_loss_days = sum(rt["holding_days"] for rt in losers) / len(losers)

    ratio = avg_loss_days / avg_win_days if avg_win_days > 0 else 1
    detected = ratio > 1.5 and len(losers) >= 2

    if ratio > 3:
        severity = 3
    elif ratio > 2:
        severity = 2
    elif ratio > 1.5:
        severity = 1
    else:
        severity = 0

    # Longest held losers
    longest_losers = sorted(losers, key=lambda rt: rt["holding_days"], reverse=True)[:3]
    quickest_winners = sorted(winners, key=lambda rt: rt["holding_days"])[:3]

    return {
        "id": "loss_holding",
        "name": "Tapsaversjon",
        "description": "Holder du tapende posisjoner lenger enn vinnende?",
        "detected": detected,
        "severity": severity,
        "metrics": {
            "avg_winner_holding_days": round(avg_win_days),
            "avg_loser_holding_days": round(avg_loss_days),
            "ratio": round(ratio, 1),
            "total_round_trips": len(round_trips),
            "winners": len(winners),
            "losers": len(losers),
        },
        "detail": (
            f"Du holder tapere i snitt {round(avg_loss_days)} dager vs. vinnere i {round(avg_win_days)} dager "
            f"({ratio:.1f}x lengre). Dette kan tyde pa at du unngår a realisere tap."
            if detected else
            f"Holdperioden for vinnere ({round(avg_win_days)}d) og tapere ({round(avg_loss_days)}d) er relativt lik."
        ),
        "examples": {
            "longest_losers": longest_losers,
            "quickest_winners": quickest_winners,
        },
    }


def _overtrading_analysis(txns: list[dict]) -> dict | None:
    """Detect if trading frequency increases after gains (overconfidence)."""
    if len(txns) < 5:
        return None

    # Group transactions by week
    weekly: dict[int, list] = defaultdict(list)
    for txn in txns:
        d = _parse_date(txn["trade_date"])
        week_num = d.isocalendar()[1] + d.year * 100
        weekly[week_num].append(txn)

    if len(weekly) < 4:
        return None

    sorted_weeks = sorted(weekly.keys())

    # For each week, compute: trade count and whether previous week had net gains
    post_gain_counts = []
    post_loss_counts = []
    normal_counts = []

    for i, week in enumerate(sorted_weeks):
        if i == 0:
            continue
        prev_week = sorted_weeks[i - 1]
        prev_txns = weekly[prev_week]

        # Simple PnL proxy: sum of sell amounts minus buy amounts
        prev_sells = sum(abs(t.get("amount_nok", 0)) for t in prev_txns if t["transaction_type"] == "SALG")
        prev_buys = sum(abs(t.get("amount_nok", 0)) for t in prev_txns if t["transaction_type"] == "KJØPT")

        current_count = len(weekly[week])

        if prev_sells > prev_buys * 0.1 and prev_sells > 0:
            # Previous week had significant selling (possibly realizing gains)
            post_gain_counts.append(current_count)
        elif prev_buys > 0 and prev_sells == 0:
            normal_counts.append(current_count)
        else:
            normal_counts.append(current_count)

    # Alternative: check if trading accelerates over time
    first_half = sorted_weeks[:len(sorted_weeks)//2]
    second_half = sorted_weeks[len(sorted_weeks)//2:]

    first_half_avg = sum(len(weekly[w]) for w in first_half) / len(first_half) if first_half else 0
    second_half_avg = sum(len(weekly[w]) for w in second_half) / len(second_half) if second_half else 0

    # Trading frequency metrics
    total_days = (_parse_date(txns[-1]["trade_date"]) - _parse_date(txns[0]["trade_date"])).days
    trades_per_month = len(txns) / max(total_days / 30, 1)

    # Detect overtrading: more than 8 trades/month or accelerating
    acceleration = second_half_avg / first_half_avg if first_half_avg > 0 else 1
    high_frequency = trades_per_month > 8
    accelerating = acceleration > 1.5 and len(sorted_weeks) >= 6

    detected = high_frequency or accelerating

    if high_frequency and accelerating:
        severity = 3
    elif high_frequency or (accelerating and acceleration > 2):
        severity = 2
    elif accelerating:
        severity = 1
    else:
        severity = 0

    # Busiest trading days
    daily_counts: dict[str, int] = defaultdict(int)
    for txn in txns:
        d = _parse_date(txn["trade_date"]).isoformat()
        daily_counts[d] += 1
    busiest_days = sorted(daily_counts.items(), key=lambda x: x[1], reverse=True)[:3]

    return {
        "id": "overtrading",
        "name": "Overtrading",
        "description": "Handler du for ofte, spesielt etter gode perioder?",
        "detected": detected,
        "severity": severity,
        "metrics": {
            "trades_per_month": round(trades_per_month, 1),
            "total_days": total_days,
            "first_half_avg_per_week": round(first_half_avg, 1),
            "second_half_avg_per_week": round(second_half_avg, 1),
            "acceleration": round(acceleration, 2),
        },
        "detail": (
            (f"Du handler i snitt {trades_per_month:.1f} ganger per maned. " +
             (f"Handelsfrekvensen har okt {acceleration:.1f}x fra forste til andre halvdel av perioden. " if accelerating else "") +
             "Hoy handelsfrekvens oker transaksjonskostnader og kan indikere overconfidence.")
            if detected else
            f"Handelsfrekvensen din ({trades_per_month:.1f}/maned) er moderat."
        ),
        "examples": {
            "busiest_days": [{"date": d, "count": c} for d, c in busiest_days],
        },
    }


def _concentration_bias(txns: list[dict]) -> dict | None:
    """Detect over-concentration: putting too much into single positions."""
    buys_by_ticker: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}

    for txn in txns:
        ticker = txn.get("ticker", "")
        if not ticker:
            continue
        if txn["transaction_type"] == "KJØPT":
            buys_by_ticker[ticker] += abs(txn.get("amount_nok", 0) or txn["quantity"] * txn["price"])
            names[ticker] = txn.get("name", ticker)

    if len(buys_by_ticker) < 3:
        return None

    total_invested = sum(buys_by_ticker.values())
    if total_invested == 0:
        return None

    concentrations = []
    for ticker, amount in buys_by_ticker.items():
        pct = amount / total_invested * 100
        concentrations.append({
            "ticker": ticker,
            "name": names.get(ticker, ticker),
            "invested_nok": round(amount),
            "pct_of_total": round(pct, 1),
        })

    concentrations.sort(key=lambda c: c["pct_of_total"], reverse=True)

    top_pct = concentrations[0]["pct_of_total"]
    top3_pct = sum(c["pct_of_total"] for c in concentrations[:3])

    # HHI (Herfindahl-Hirschman Index) for concentration
    hhi = sum((c["pct_of_total"] / 100) ** 2 for c in concentrations)
    equal_weight_hhi = 1 / len(concentrations)

    detected = top_pct > 25 or top3_pct > 60
    if top_pct > 40 or top3_pct > 75:
        severity = 3
    elif top_pct > 30 or top3_pct > 65:
        severity = 2
    elif detected:
        severity = 1
    else:
        severity = 0

    return {
        "id": "concentration_bias",
        "name": "Konsentrasjonsbias",
        "description": "Legger du for mye kapital i fa posisjoner?",
        "detected": detected,
        "severity": severity,
        "metrics": {
            "top_position_pct": top_pct,
            "top3_pct": round(top3_pct, 1),
            "hhi": round(hhi, 4),
            "equal_weight_hhi": round(equal_weight_hhi, 4),
            "num_positions": len(concentrations),
        },
        "detail": (
            f"Storste posisjon utgjor {top_pct:.0f}% av total investert kapital ({concentrations[0]['name']}). "
            f"Topp 3 utgjor {top3_pct:.0f}%. Hoy konsentrasjon oker risikoen for store tap fra enkeltaksjer."
            if detected else
            f"Portefoljen er relativt jevnt fordelt. Storste posisjon er {top_pct:.0f}% ({concentrations[0]['name']})."
        ),
        "examples": {
            "top_positions": concentrations[:5],
        },
    }


def _anchoring_bias(txns: list[dict]) -> dict | None:
    """Detect anchoring: buying more of losing positions (averaging down)."""
    # Find tickers where multiple buys happened at declining prices
    buys_by_ticker: dict[str, list] = defaultdict(list)

    for txn in txns:
        ticker = txn.get("ticker", "")
        if not ticker or txn["transaction_type"] != "KJØPT":
            continue
        buys_by_ticker[ticker].append({
            "date": _parse_date(txn["trade_date"]),
            "price": txn["price"],
            "quantity": txn["quantity"],
            "name": txn.get("name", ticker),
        })

    averaging_down_tickers = []
    for ticker, buys in buys_by_ticker.items():
        if len(buys) < 2:
            continue
        buys_sorted = sorted(buys, key=lambda b: b["date"])

        # Check if later buys were at lower prices
        declining_buys = 0
        for i in range(1, len(buys_sorted)):
            if buys_sorted[i]["price"] < buys_sorted[i-1]["price"] * 0.95:
                declining_buys += 1

        if declining_buys > 0:
            first_price = buys_sorted[0]["price"]
            last_price = buys_sorted[-1]["price"]
            price_change = (last_price - first_price) / first_price * 100

            averaging_down_tickers.append({
                "ticker": ticker,
                "name": buys_sorted[0]["name"],
                "num_buys": len(buys_sorted),
                "declining_buys": declining_buys,
                "first_price": round(first_price, 2),
                "last_price": round(last_price, 2),
                "price_change_pct": round(price_change, 1),
            })

    if not averaging_down_tickers:
        return None

    averaging_down_tickers.sort(key=lambda t: t["price_change_pct"])

    total_multi_buy = sum(1 for buys in buys_by_ticker.values() if len(buys) >= 2)
    avg_down_ratio = len(averaging_down_tickers) / total_multi_buy if total_multi_buy > 0 else 0

    detected = avg_down_ratio > 0.3 and len(averaging_down_tickers) >= 2

    if avg_down_ratio > 0.6:
        severity = 3
    elif avg_down_ratio > 0.4:
        severity = 2
    elif detected:
        severity = 1
    else:
        severity = 0

    return {
        "id": "anchoring",
        "name": "Forankringsbias (averaging down)",
        "description": "Kjoper du mer av aksjer som faller, forankret til den opprinnelige prisen?",
        "detected": detected,
        "severity": severity,
        "metrics": {
            "tickers_averaged_down": len(averaging_down_tickers),
            "total_multi_buy_tickers": total_multi_buy,
            "avg_down_ratio": round(avg_down_ratio, 2),
        },
        "detail": (
            f"Du har kjopt mer til lavere kurs i {len(averaging_down_tickers)} av {total_multi_buy} aksjer "
            f"med flere kjop ({round(avg_down_ratio*100)}%). Averaging down kan vare rasjonelt, men kan ogsa "
            f"indikere at du er forankret til opprinnelig kjopspris og unngår a innromme tap."
            if detected else
            f"Begrenset tegn til averaging down ({len(averaging_down_tickers)} av {total_multi_buy} aksjer)."
        ),
        "examples": {
            "averaged_down": averaging_down_tickers[:3],
        },
    }
