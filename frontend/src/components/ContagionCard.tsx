"use client";

import { ContagionAnalysis } from "@/lib/api";

interface ContagionCardProps {
  data: ContagionAnalysis | null;
  loading: boolean;
}

function DeltaIndicator({ change }: { change: number }) {
  const isUp = change > 0.05;
  const isDown = change < -0.05;

  if (isUp) {
    return (
      <span className="text-red-600 dark:text-red-400 font-medium">
        +{change.toFixed(2)}
      </span>
    );
  }
  if (isDown) {
    return (
      <span className="text-green-600 dark:text-green-400 font-medium">
        {change.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="text-gray-500 dark:text-gray-400">
      {change >= 0 ? "+" : ""}
      {change.toFixed(2)}
    </span>
  );
}

function buildInterpretation(data: ContagionAnalysis): string[] {
  const lines: string[] = [];
  const delta = data.contagion_delta;

  if (delta > 0.15) {
    lines.push(
      `Korrelasjonen øker i snitt med ${delta.toFixed(2)} under stress. Dette er en tydelig smitteeffekt, og diversifiseringen svekkes betydelig når markedet faller.`
    );
  } else if (delta > 0.05) {
    lines.push(
      `Korrelasjonen øker moderat (${delta.toFixed(2)}) under stress. Diversifiseringen holder seg delvis, men aksjene beveger seg mer i takt ved markedsnedgang.`
    );
  } else if (delta > -0.05) {
    lines.push(
      `Korrelasjonen endres lite under stress (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}). Diversifiseringen i porteføljen holder seg godt, også i urolige perioder.`
    );
  } else {
    lines.push(
      `Korrelasjonen synker faktisk under stress (${delta.toFixed(2)}). Porteføljen har naturlig risikodemping ved markedsnedgang.`
    );
  }

  // Find pairs with biggest contagion increase
  const sorted = [...data.pairs].sort((a, b) => b.change - a.change);
  const worst = sorted[0];
  if (worst && worst.change > 0.1) {
    lines.push(
      `Størst smitteeffekt mellom ${worst.ticker_1} og ${worst.ticker_2}: korrelasjonen øker fra ${worst.normal_correlation.toFixed(2)} til ${worst.stress_correlation.toFixed(2)} under stress.`
    );
  }

  // Find pairs that hold up well
  const best = sorted[sorted.length - 1];
  if (best && best.change < -0.05) {
    lines.push(
      `${best.ticker_1} og ${best.ticker_2} dekorrelerer under stress (endring ${best.change.toFixed(2)}), som gir ekstra beskyttelse.`
    );
  }

  return lines;
}

export default function ContagionCard({
  data,
  loading,
}: ContagionCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Contagion-analyse
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Analyserer stressperioder...
        </p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Contagion-analyse
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {data?.error || "Ingen data tilgjengelig"}
        </p>
      </div>
    );
  }

  const interpretation = buildInterpretation(data);
  const deltaColor =
    data.contagion_delta > 0.05
      ? "text-red-600 dark:text-red-400"
      : data.contagion_delta < -0.05
        ? "text-green-600 dark:text-green-400"
        : "text-gray-600 dark:text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contagion-analyse
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Korrelasjon i normale vs. stressperioder &middot; {data.normal_days}{" "}
            normale / {data.stress_days} stressdager
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Stressgrense: {data.stress_threshold_pct.toFixed(2)}%
          </p>
          <p className={`text-sm font-semibold ${deltaColor}`}>
            Delta: {data.contagion_delta >= 0 ? "+" : ""}
            {data.contagion_delta.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Summary bars */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Normal korrelasjon
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {data.avg_normal_correlation.toFixed(2)}
          </p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Stresskorrelasjon
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {data.avg_stress_correlation.toFixed(2)}
          </p>
        </div>
      </div>

      {interpretation.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
            Tolkning
          </p>
          {interpretation.map((line, i) => (
            <p
              key={i}
              className={`text-sm text-blue-900 dark:text-blue-200 ${
                i === 0 ? "font-medium" : ""
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">
                Par
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                Normal
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                Stress
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                Endring
              </th>
            </tr>
          </thead>
          <tbody>
            {data.pairs
              .sort((a, b) => b.change - a.change)
              .map((pair) => (
                <tr
                  key={`${pair.ticker_1}-${pair.ticker_2}`}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <td className="py-2 text-gray-900 dark:text-gray-100 font-medium">
                    {pair.ticker_1} / {pair.ticker_2}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                    {pair.normal_correlation.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                    {pair.stress_correlation.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    <DeltaIndicator change={pair.change} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Stressperioder defineres som dager der porteføljeavkastningen er lavere
          enn snittet minus ett standardavvik. Positiv endring (rød) betyr at
          korrelasjonen øker under stress, noe som reduserer diversifiseringsgevinsten
          nettopp når den trengs mest.
        </p>
      </div>
    </div>
  );
}
