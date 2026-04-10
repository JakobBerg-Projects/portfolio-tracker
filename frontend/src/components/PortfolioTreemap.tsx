"use client";

import { Holding } from "@/lib/api";
import { useMemo, useState } from "react";

interface PortfolioTreemapProps {
  holdings: Holding[];
}

interface TreemapRect {
  holding: Holding;
  x: number;
  y: number;
  w: number;
  h: number;
}

function getColor(pct: number): string {
  if (pct >= 3) return "#15803d";
  if (pct >= 2) return "#16a34a";
  if (pct >= 1) return "#22c55e";
  if (pct >= 0.5) return "#4ade80";
  if (pct >= 0) return "#2d4a3e";
  if (pct >= -0.5) return "#4a2d2d";
  if (pct >= -1) return "#ef4444";
  if (pct >= -2) return "#dc2626";
  if (pct >= -3) return "#b91c1c";
  return "#991b1b";
}

// Squarified treemap layout algorithm
function squarify(
  items: { holding: Holding; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ holding: items[0].holding, x, y, w, h }];
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  // Sort descending by value
  const sorted = [...items].sort((a, b) => b.value - a.value);

  const rects: TreemapRect[] = [];
  layoutRow(sorted, 0, total, x, y, w, h, rects);
  return rects;
}

function layoutRow(
  items: { holding: Holding; value: number }[],
  start: number,
  total: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rects: TreemapRect[],
) {
  if (start >= items.length) return;
  if (items.length - start === 1) {
    rects.push({ holding: items[start].holding, x, y, w, h });
    return;
  }

  const isWide = w >= h;
  const mainSize = isWide ? w : h;
  const crossSize = isWide ? h : w;

  // Find how many items fit in the first row
  let rowTotal = 0;
  let bestAspect = Infinity;
  let rowEnd = start;

  const remaining = items.slice(start).reduce((s, i) => s + i.value, 0);

  for (let i = start; i < items.length; i++) {
    rowTotal += items[i].value;
    const rowFrac = rowTotal / remaining;
    const rowSize = rowFrac * mainSize;
    const count = i - start + 1;

    // Calculate worst aspect ratio in this row
    let worstAspect = 0;
    let itemTotal = 0;
    for (let j = start; j <= i; j++) {
      itemTotal += items[j].value;
      const itemFrac = items[j].value / rowTotal;
      const itemSize = itemFrac * crossSize;
      const aspect = Math.max(rowSize / itemSize, itemSize / rowSize);
      worstAspect = Math.max(worstAspect, aspect);
    }

    if (worstAspect <= bestAspect) {
      bestAspect = worstAspect;
      rowEnd = i;
    } else {
      break;
    }
  }

  // Layout the row
  const rowItems = items.slice(start, rowEnd + 1);
  const rowValue = rowItems.reduce((s, i) => s + i.value, 0);
  const rowFrac = rowValue / remaining;
  const rowSize = rowFrac * mainSize;

  let offset = 0;
  for (const item of rowItems) {
    const itemFrac = item.value / rowValue;
    const itemSize = itemFrac * crossSize;

    if (isWide) {
      rects.push({ holding: item.holding, x, y: y + offset, w: rowSize, h: itemSize });
    } else {
      rects.push({ holding: item.holding, x: x + offset, y, w: itemSize, h: rowSize });
    }
    offset += itemSize;
  }

  // Recurse for remaining items
  if (isWide) {
    layoutRow(items, rowEnd + 1, total, x + rowSize, y, w - rowSize, h, rects);
  } else {
    layoutRow(items, rowEnd + 1, total, x, y + rowSize, w, h - rowSize, rects);
  }
}

function formatPct(value: number | null): string {
  if (value === null) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function PortfolioTreemap({ holdings }: PortfolioTreemapProps) {
  const [tooltip, setTooltip] = useState<{
    holding: Holding;
    x: number;
    y: number;
  } | null>(null);

  const rects = useMemo(() => {
    const items = holdings
      .filter((h) => (h.value_nok ?? 0) > 0)
      .map((h) => ({ holding: h, value: h.value_nok ?? 0 }));
    return squarify(items, 0, 0, 100, 100);
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800 h-80 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Ingen data</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Porteføljekart
      </h2>
      <div
        className="relative w-full rounded overflow-hidden"
        style={{ paddingBottom: "60%" }}
      >
        <div className="absolute inset-0">
          {rects.map((rect, i) => {
            const todayPct = rect.holding.return_pct ?? 0;
            const minDim = Math.min(
              (rect.w / 100) * 1000,
              (rect.h / 100) * 600,
            );
            const showTicker = minDim > 40;
            const showPct = minDim > 60;

            return (
              <div
                key={rect.holding.id}
                className="absolute flex flex-col items-center justify-center text-white font-bold transition-opacity hover:opacity-80 cursor-default"
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  backgroundColor: getColor(todayPct),
                  border: "1px solid rgba(0,0,0,0.3)",
                }}
                onMouseEnter={(e) => {
                  const bounds = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    holding: rect.holding,
                    x: bounds.left + bounds.width / 2,
                    y: bounds.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {showTicker && (
                  <span
                    className="truncate px-1"
                    style={{ fontSize: `${Math.min(Math.max(minDim / 6, 10), 18)}px` }}
                  >
                    {rect.holding.ticker}
                  </span>
                )}
                {showPct && (
                  <span
                    style={{ fontSize: `${Math.min(Math.max(minDim / 8, 8), 14)}px` }}
                  >
                    {formatPct(todayPct)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {tooltip && (
          <div
            className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">{tooltip.holding.name}</p>
            <p>
              {tooltip.holding.ticker} &middot;{" "}
              {new Intl.NumberFormat("nb-NO", {
                style: "currency",
                currency: "NOK",
                maximumFractionDigits: 0,
              }).format(tooltip.holding.value_nok ?? 0)}
            </p>
            <p>I dag: {formatPct(tooltip.holding.return_pct)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
