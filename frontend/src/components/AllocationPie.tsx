"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Allocation } from "@/lib/api";

const RADIAN = Math.PI / 180;

const COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
  "#e11d48", "#84cc16", "#a855f7", "#0ea5e9", "#ef4444",
];

// Only slices at/above this share get a side label with a leader line.
// The many tiny slivers are what pile up and collide, so they stay unlabelled
// (still visible on hover via the tooltip).
const LABEL_THRESHOLD = 0.035;

interface OutsideLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
  index?: number;
}

function renderOutsideLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  percent = 0,
  name = "",
  index = 0,
}: OutsideLabelProps) {
  if (percent < LABEL_THRESHOLD) return null;

  const cos = Math.cos(-RADIAN * midAngle);
  const sin = Math.sin(-RADIAN * midAngle);
  const sx = cx + outerRadius * cos; // line start (on the slice edge)
  const sy = cy + outerRadius * sin;
  const mx = cx + (outerRadius + 18) * cos; // elbow
  const my = cy + (outerRadius + 18) * sin;
  const dir = cos >= 0 ? 1 : -1;
  const ex = mx + dir * 22; // horizontal run to the text
  const ey = my;
  const color = COLORS[index % COLORS.length];

  return (
    <g>
      <polyline
        points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
        stroke={color}
        strokeWidth={1}
        fill="none"
      />
      <circle cx={sx} cy={sy} r={2} fill={color} />
      <text
        x={ex + dir * 4}
        y={ey}
        textAnchor={dir > 0 ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        className="fill-gray-700 dark:fill-gray-200"
      >
        {name} {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
}

interface AllocationPieProps {
  data: Allocation[];
}

export default function AllocationPie({ data }: AllocationPieProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800 h-80 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Ingen data</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Porteføljefordeling</h2>
      <ResponsiveContainer width="100%" height={400}>
        {/* Wide side margins reserve room for the leader-line labels so they
            don't get clipped at the edges. */}
        <PieChart margin={{ top: 20, right: 120, bottom: 20, left: 120 }}>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={105}
            label={renderOutsideLabel}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Andel"]}
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid #374151",
              borderRadius: "0.5rem",
              color: "var(--foreground)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {(() => {
        const total = data.reduce((sum, d) => sum + d.percentage, 0) || 1;
        const remaining = data
          .map((d, index) => ({ d, index }))
          .filter(({ d }) => d.percentage / total < LABEL_THRESHOLD);
        if (remaining.length === 0) return null;
        return (
          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Øvrige</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {remaining.map(({ d, index }) => (
                <div
                  key={d.ticker}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{d.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {d.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
