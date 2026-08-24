"use client";

import { FactorExposure, FactorDetail } from "@/lib/api";

interface FactorExposureCardProps {
  data: FactorExposure | null;
  loading: boolean;
}

function SignificanceBadge({ significant }: { significant: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
        significant
          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
      }`}
    >
      {significant ? "Signifikant" : "Ikke sign."}
    </span>
  );
}

function FactorBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  const width = Math.min(pct * 100, 100);
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
        <div
          className={`absolute top-0 h-full rounded-full ${
            isPositive ? "bg-blue-500" : "bg-amber-500"
          }`}
          style={{
            width: `${width}%`,
            left: isPositive ? "50%" : undefined,
            right: isPositive ? undefined : "50%",
          }}
        />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gray-300 dark:bg-gray-600" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule-based interpretation
// ---------------------------------------------------------------------------

function getFactorByKey(factors: FactorDetail[], key: string): FactorDetail | undefined {
  return factors.find((f) => f.name.includes(key));
}

function buildInterpretation(data: FactorExposure): string[] {
  const lines: string[] = [];
  const factors = data.factors;

  // Market beta
  const mkt = getFactorByKey(factors, "Mkt-RF");
  if (mkt?.significant) {
    const beta = mkt.coefficient;
    if (beta > 1.2) {
      lines.push(
        `Porteføljen har en beta på ${beta.toFixed(2)}, som betyr at den svinger betydelig mer enn markedet. Ved en markedsnedgang på 10% kan du forvente et fall på omtrent ${(beta * 10).toFixed(0)}%.`
      );
    } else if (beta > 0.8) {
      lines.push(
        `Porteføljen følger markedet tett med en beta på ${beta.toFixed(2)}.`
      );
    } else {
      lines.push(
        `Porteføljen har lav markedseksponering (beta ${beta.toFixed(2)}) og er mer defensiv enn markedet.`
      );
    }
  }

  // Size (SMB)
  const smb = getFactorByKey(factors, "SMB");
  if (smb?.significant) {
    if (smb.coefficient > 0.3) {
      lines.push("Porteføljen er tungt vektet mot småselskaper, som historisk har gitt høyere avkastning, men med mer risiko.");
    } else if (smb.coefficient < -0.3) {
      lines.push("Porteføljen er dominert av store selskaper, som typisk gir mer stabilitet, men lavere vekstpotensial.");
    }
  }

  // Value (HML)
  const hml = getFactorByKey(factors, "HML");
  if (hml?.significant) {
    if (hml.coefficient > 0.3) {
      lines.push("Porteføljen heller mot verdiaksjer, altså selskaper som handles til lave multipler relativt til fundamentale verdier.");
    } else if (hml.coefficient < -0.3) {
      lines.push("Porteføljen er vekstorientert, eksponert mot selskaper med høye verdsettelser og forventning om fremtidig inntjeningsvekst.");
    }
  }

  // Profitability (RMW)
  const rmw = getFactorByKey(factors, "RMW");
  if (rmw?.significant) {
    if (rmw.coefficient > 0.3) {
      lines.push("Porteføljen favoriserer selskaper med høy lønnsomhet og stabile marginer.");
    } else if (rmw.coefficient < -0.3) {
      lines.push("Porteføljen inneholder selskaper med lavere lønnsomhet, typisk vekstselskaper som prioriterer vekst over kortsiktig profitt.");
    }
  }

  // Investment (CMA)
  const cma = getFactorByKey(factors, "CMA");
  if (cma?.significant) {
    if (cma.coefficient > 0.3) {
      lines.push("Porteføljen er eksponert mot konservative selskaper som investerer forsiktig og returnerer kapital til aksjonærer.");
    } else if (cma.coefficient < -0.3) {
      lines.push("Porteføljen inneholder selskaper som investerer aggressivt i vekst, typisk tech og innovasjon.");
    }
  }

  // Alpha
  const alpha = data.annual_alpha_pct;
  if (Math.abs(alpha) > 5) {
    const alphaFactor = getFactorByKey(factors, "Alpha");
    if (alphaFactor?.significant) {
      if (alpha > 0) {
        lines.push(`Porteføljen har generert en statistisk signifikant meravkastning (alpha) på ${alpha.toFixed(1)}% årlig utover det faktorene forklarer. Merk at høy alpha over korte perioder ofte skyldes konsentrasjonsrisiko snarere enn dyktighet.`);
      } else {
        lines.push(`Porteføljen har underprestert med ${Math.abs(alpha).toFixed(1)}% årlig relativt til faktoreksponeringen. Denne underprestasjonen er statistisk signifikant.`);
      }
    } else {
      const tStat = alphaFactor?.t_stat ?? 0;
      const nObs = data.n_observations;
      if (alpha > 0) {
        lines.push(`Alpha på +${alpha.toFixed(1)}% årlig er ikke statistisk signifikant (t=${tStat.toFixed(2)}, n=${nObs}). Selv om tallet virker høyt, skyldes det at den daglige meravkastningen er liten sammenlignet med porteføljens daglige svingninger. Over kort tid og med høy volatilitet kan man ikke skille denne avkastningen fra tilfeldigheter. Lengre tidsperiode eller lavere volatilitet ville gitt et tydeligere bilde.`);
      } else {
        lines.push(`Alpha på ${alpha.toFixed(1)}% årlig er ikke statistisk signifikant (t=${tStat.toFixed(2)}, n=${nObs}). Den daglige underprestasjonen er for liten relativt til porteføljens daglige svingninger til å fastslå at den er reell.`);
      }
    }
  }

  // R²
  const r2 = data.r_squared * 100;
  if (r2 < 40) {
    lines.push(`Modellen forklarer kun ${r2.toFixed(0)}% av porteføljens variasjon. Dette kan skyldes konsentrert portefølje eller eksponering mot faktorer som ikke fanges opp.`);
  } else if (r2 > 70) {
    lines.push(`Modellen forklarer ${r2.toFixed(0)}% av porteføljens variasjon, som tyder på at faktoreksponeringen gir et godt bilde av porteføljens drivere.`);
  }

  // Overall profile summary
  const profile: string[] = [];
  if (mkt?.significant && mkt.coefficient > 1.2) profile.push("høy-beta");
  if (smb?.significant && smb.coefficient < -0.3) profile.push("storselskap");
  if (smb?.significant && smb.coefficient > 0.3) profile.push("småselskap");
  if (hml?.significant && hml.coefficient < -0.3) profile.push("vekst");
  if (hml?.significant && hml.coefficient > 0.3) profile.push("verdi");
  if (rmw?.significant && rmw.coefficient < -0.3) profile.push("lav lønnsomhet");
  if (cma?.significant && cma.coefficient < -0.3) profile.push("aggressiv investering");

  if (profile.length >= 2) {
    lines.unshift(`Porteføljeprofil: ${profile.join(", ")}.`);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FactorExposureCard({
  data,
  loading,
}: FactorExposureCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Faktoreksponering (Fama-French)
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Kjører regresjonsanalyse...
        </p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Faktoreksponering (Fama-French)
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {data?.error || "Ingen data tilgjengelig"}
        </p>
      </div>
    );
  }

  const maxAbs = Math.max(
    ...data.factors
      .filter((f) => f.name !== "Alpha")
      .map((f) => Math.abs(f.coefficient))
  );

  const alphaColor =
    data.annual_alpha_pct >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const hasNonUs = data.non_us_tickers && data.non_us_tickers.length > 0;
  const interpretation = buildInterpretation(data);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Faktoreksponering (Fama-French)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            5-faktormodell (utviklede markeder) &middot; {data.n_observations}{" "}
            observasjoner
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            R&sup2; = {(data.r_squared * 100).toFixed(1)}%
          </p>
          <p className={`text-sm font-semibold ${alphaColor}`}>
            Alpha: {data.annual_alpha_pct >= 0 ? "+" : ""}
            {data.annual_alpha_pct}% p.a.
          </p>
        </div>
      </div>

      {hasNonUs && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Porteføljen inneholder ikke-amerikanske aksjer (
            {data.non_us_tickers.join(", ")}). Faktormodellen bruker globale
            (utviklede markeder) faktorer som dekker disse, men lokal
            markedsspesifikk eksponering fanges ikke fullstendig opp.
          </p>
        </div>
      )}

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
                Faktor
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                Koeffisient
              </th>
              <th className="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">
                Eksponering
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                t-verdi
              </th>
              <th className="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {data.factors
              .filter((f) => f.name !== "Alpha")
              .map((factor) => (
                <tr
                  key={factor.name}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <td className="py-3 text-gray-900 dark:text-gray-100 font-medium">
                    {factor.name}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-900 dark:text-gray-100">
                    {factor.coefficient >= 0 ? "+" : ""}
                    {factor.coefficient.toFixed(4)}
                  </td>
                  <td className="py-3 flex justify-center">
                    <FactorBar value={factor.coefficient} maxAbs={maxAbs} />
                  </td>
                  <td className="py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {factor.t_stat.toFixed(2)}
                  </td>
                  <td className="py-3 text-center">
                    <SignificanceBadge significant={factor.significant} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Mkt-RF:</strong> Markedsrisiko (beta).{" "}
          <strong>SMB:</strong> Small Minus Big, positiv = eksponert mot
          småselskaper. <strong>HML:</strong> High Minus Low, positiv =
          eksponert mot verdiaksjer. <strong>RMW:</strong> Robust Minus Weak,
          positiv = eksponert mot lønnsomme selskaper.{" "}
          <strong>CMA:</strong> Conservative Minus Aggressive, positiv =
          eksponert mot konservative investeringsselskaper.
        </p>
      </div>
    </div>
  );
}
