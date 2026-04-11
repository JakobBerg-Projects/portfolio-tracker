"use client";

import { CorrelationMatrix } from "@/lib/api";

interface CorrelationMatrixCardProps {
  data: CorrelationMatrix | null;
  loading: boolean;
}

function correlationColor(value: number): string {
  if (value >= 0.8) return "bg-red-500 text-white";
  if (value >= 0.5) return "bg-red-300 dark:bg-red-700 text-red-900 dark:text-red-100";
  if (value >= 0.2) return "bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100";
  if (value >= -0.2) return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  if (value >= -0.5) return "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100";
  return "bg-blue-500 text-white";
}

function buildInterpretation(data: CorrelationMatrix): string[] {
  const lines: string[] = [];
  const avg = data.avg_correlation;

  if (avg > 0.7) {
    lines.push(
      `Gjennomsnittlig korrelasjon er ${avg.toFixed(2)}, som er høy. Porteføljen har begrenset diversifisering, og aksjene tenderer til å bevege seg i samme retning.`
    );
  } else if (avg > 0.4) {
    lines.push(
      `Gjennomsnittlig korrelasjon er ${avg.toFixed(2)}, som er moderat. Porteføljen har noe diversifisering, men flere aksjer er fortsatt samkjørte.`
    );
  } else if (avg > 0.1) {
    lines.push(
      `Gjennomsnittlig korrelasjon er ${avg.toFixed(2)}, som er lav. Porteføljen er godt diversifisert med aksjer som beveger seg relativt uavhengig.`
    );
  } else {
    lines.push(
      `Gjennomsnittlig korrelasjon er ${avg.toFixed(2)}, noe som indikerer svært god diversifisering. Aksjene har lav eller negativ samvariasjon.`
    );
  }

  if (data.max_correlation > 0.8) {
    // Find the pair with highest correlation
    const n = data.tickers.length;
    let maxPair = { i: 0, j: 1, val: -2 };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (data.matrix[i][j] > maxPair.val) {
          maxPair = { i, j, val: data.matrix[i][j] };
        }
      }
    }
    lines.push(
      `Høyest korrelasjon er mellom ${data.tickers[maxPair.i]} og ${data.tickers[maxPair.j]} (${maxPair.val.toFixed(2)}). Disse gir lite diversifiseringsgevinst sammen.`
    );
  }

  if (data.min_correlation < 0) {
    const n = data.tickers.length;
    let minPair = { i: 0, j: 1, val: 2 };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (data.matrix[i][j] < minPair.val) {
          minPair = { i, j, val: data.matrix[i][j] };
        }
      }
    }
    lines.push(
      `${data.tickers[minPair.i]} og ${data.tickers[minPair.j]} har negativ korrelasjon (${minPair.val.toFixed(2)}), som gir god risikospredning.`
    );
  }

  return lines;
}

export default function CorrelationMatrixCard({
  data,
  loading,
}: CorrelationMatrixCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Korrelasjonsmatrise
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Beregner korrelasjoner...
        </p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Korrelasjonsmatrise
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {data?.error || "Ingen data tilgjengelig"}
        </p>
      </div>
    );
  }

  const interpretation = buildInterpretation(data);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Korrelasjonsmatrise
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Parvise korrelasjoner mellom daglige avkastninger &middot;{" "}
            {data.n_observations} observasjoner
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Snitt: {data.avg_correlation.toFixed(2)}
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
        <table className="text-xs">
          <thead>
            <tr>
              <th className="py-2 px-2 text-left text-gray-500 dark:text-gray-400 font-medium" />
              {data.tickers.map((t) => (
                <th
                  key={t}
                  className="py-2 px-2 text-center text-gray-500 dark:text-gray-400 font-medium"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tickers.map((rowTicker, i) => (
              <tr key={rowTicker}>
                <td className="py-1 px-2 font-medium text-gray-900 dark:text-gray-100">
                  {rowTicker}
                </td>
                {data.tickers.map((colTicker, j) => {
                  const val = data.matrix[i][j];
                  const isDiag = i === j;
                  return (
                    <td key={colTicker} className="py-1 px-1 text-center">
                      <span
                        className={`inline-block w-12 py-1 rounded text-xs font-mono ${
                          isDiag
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                            : correlationColor(val)
                        }`}
                      >
                        {val.toFixed(2)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-500" />
          <span>Negativ</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
          <span>Lav</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-orange-200 dark:bg-orange-800" />
          <span>Moderat</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-500" />
          <span>Høy</span>
        </div>
      </div>

      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Korrelasjonen måler lineær samvariasjon mellom -1 og +1. Verdier nær +1
          betyr at aksjene beveger seg i takt. Verdier nær 0 betyr uavhengig
          bevegelse. Negative verdier betyr at de beveger seg i motsatt retning.
        </p>
      </div>
    </div>
  );
}
