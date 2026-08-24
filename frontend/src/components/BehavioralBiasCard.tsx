"use client";

import { BehavioralBiases, BiasResult } from "@/lib/api";

interface BehavioralBiasCardProps {
  data: BehavioralBiases | null;
  loading: boolean;
}

function SeverityIndicator({ severity }: { severity: number }) {
  const levels = [1, 2, 3];
  return (
    <div className="flex gap-0.5">
      {levels.map((l) => (
        <div
          key={l}
          className={`w-2.5 h-2.5 rounded-full ${
            l <= severity
              ? severity >= 3
                ? "bg-red-500"
                : severity >= 2
                  ? "bg-amber-500"
                  : "bg-yellow-400"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

function BiasScoreGauge({ score }: { score: number }) {
  const color =
    score >= 60
      ? "text-red-500"
      : score >= 35
        ? "text-amber-500"
        : "text-green-500";
  const bgColor =
    score >= 60
      ? "bg-red-500"
      : score >= 35
        ? "bg-amber-500"
        : "bg-green-500";
  const label =
    score >= 60
      ? "Hoy bias-risiko"
      : score >= 35
        ? "Moderat bias-risiko"
        : "Lav bias-risiko";

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className={bgColor.replace("bg-", "stroke-")}
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}
        >
          {score}
        </span>
      </div>
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bias-score (0-100)
        </p>
      </div>
    </div>
  );
}

function BiasItem({ bias }: { bias: BiasResult }) {
  const iconMap: Record<string, string> = {
    disposition_effect: "💸",
    loss_holding: "⏳",
    overtrading: "🔄",
    concentration_bias: "🎯",
    anchoring: "⚓",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        bias.detected
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
          : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{iconMap[bias.id] || "📊"}</span>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {bias.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {bias.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bias.detected && <SeverityIndicator severity={bias.severity} />}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              bias.detected
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            }`}
          >
            {bias.detected ? "Pavist" : "Ikke pavist"}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {bias.detail}
      </p>

      {/* Bias-specific metrics */}
      {bias.id === "disposition_effect" && <DispositionMetrics bias={bias} />}
      {bias.id === "loss_holding" && <LossHoldingMetrics bias={bias} />}
      {bias.id === "overtrading" && <OvertradingMetrics bias={bias} />}
      {bias.id === "concentration_bias" && <ConcentrationMetrics bias={bias} />}
      {bias.id === "anchoring" && <AnchoringMetrics bias={bias} />}
    </div>
  );
}

function DispositionMetrics({ bias }: { bias: BiasResult }) {
  const m = bias.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">PGR (gevinster realisert)</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {((m.pgr ?? 0) * 100).toFixed(0)}%
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">PLR (tap realisert)</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {((m.plr ?? 0) * 100).toFixed(0)}%
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">Gevinster (realisert/papir)</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {m.gains_realized ?? 0} / {m.gains_paper ?? 0}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">Tap (realisert/papir)</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {m.losses_realized ?? 0} / {m.losses_paper ?? 0}
        </p>
      </div>
    </div>
  );
}

function LossHoldingMetrics({ bias }: { bias: BiasResult }) {
  const m = bias.metrics;
  const examples = bias.examples;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-white dark:bg-gray-900/50 rounded p-2">
          <p className="text-gray-500 dark:text-gray-400">Vinnere snitt</p>
          <p className="font-mono font-semibold text-green-600 dark:text-green-400">
            {m.avg_winner_holding_days ?? 0}d
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 rounded p-2">
          <p className="text-gray-500 dark:text-gray-400">Tapere snitt</p>
          <p className="font-mono font-semibold text-red-600 dark:text-red-400">
            {m.avg_loser_holding_days ?? 0}d
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 rounded p-2">
          <p className="text-gray-500 dark:text-gray-400">Ratio</p>
          <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {m.ratio ?? 0}x
          </p>
        </div>
      </div>
      {examples.longest_losers?.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium mb-1">Lengst holdte tapere:</p>
          {(examples.longest_losers as Array<Record<string, unknown>>).map(
            (rt, i) => (
              <p key={i}>
                {rt.name as string} -{rt.holding_days as number}d (
                {rt.pnl_pct as number}%)
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function OvertradingMetrics({ bias }: { bias: BiasResult }) {
  const m = bias.metrics;
  return (
    <div className="grid grid-cols-3 gap-3 text-xs">
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">Handler/maned</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {m.trades_per_month ?? 0}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">Periode (dager)</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {m.total_days ?? 0}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded p-2">
        <p className="text-gray-500 dark:text-gray-400">Akselerasjon</p>
        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          {m.acceleration ?? 0}x
        </p>
      </div>
    </div>
  );
}

function ConcentrationMetrics({ bias }: { bias: BiasResult }) {
  const examples = bias.examples;
  const positions = (examples.top_positions ?? []) as Array<
    Record<string, unknown>
  >;

  if (positions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {positions.map((pos, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400 w-32 truncate">
            {pos.name as string}
          </span>
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                (pos.pct_of_total as number) > 25
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(pos.pct_of_total as number, 100)}%` }}
            />
          </div>
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 w-10 text-right">
            {pos.pct_of_total as number}%
          </span>
        </div>
      ))}
    </div>
  );
}

function AnchoringMetrics({ bias }: { bias: BiasResult }) {
  const examples = bias.examples;
  const averaged = (examples.averaged_down ?? []) as Array<
    Record<string, unknown>
  >;

  if (averaged.length === 0) return null;

  return (
    <div className="text-xs space-y-1">
      {averaged.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-white dark:bg-gray-900/50 rounded p-2"
        >
          <span className="text-gray-700 dark:text-gray-300">
            {item.name as string}
          </span>
          <span className="font-mono">
            {item.first_price as number} → {item.last_price as number}{" "}
            <span className="text-red-500">
              ({item.price_change_pct as number}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BehavioralBiasCard({
  data,
  loading,
}: BehavioralBiasCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Atferdsbias-detektor
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Analyserer transaksjonshistorikk...
        </p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Atferdsbias-detektor
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {data?.error || "Ingen data tilgjengelig"}
        </p>
      </div>
    );
  }

  const detectedCount = data.biases.filter((b) => b.detected).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Atferdsbias-detektor
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {data.total_transactions} transaksjoner ({data.total_buys} kjop,{" "}
            {data.total_sells} salg) &middot; {data.unique_tickers} aksjer
            &middot; {data.period_start} til {data.period_end}
          </p>
        </div>
        <BiasScoreGauge score={data.bias_score} />
      </div>

      {detectedCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {detectedCount} av {data.biases.length} atferdsbias pavist i
            transaksjonshistorikken. Disse er vanlige blant alle investorer —
            bevissthet er forste steg mot bedre beslutninger.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {data.biases.map((bias) => (
          <BiasItem key={bias.id} bias={bias} />
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>PGR/PLR:</strong> Proportion of Gains/Losses Realized —
          sammenligner andelen gevinster vs. tap du realiserer.{" "}
          <strong>Severity:</strong> Alvorlighetsgrad basert pa styrken av
          det observerte monsteret.{" "}
          Analysen er basert pa transaksjonshistorikk og er kun veiledende.
        </p>
      </div>
    </div>
  );
}
