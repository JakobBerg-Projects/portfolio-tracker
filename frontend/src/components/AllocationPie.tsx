"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Allocation } from "@/lib/api";

interface AllocationPieProps {
  data: Allocation[];
}

const COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
  "#e11d48", "#84cc16", "#a855f7", "#0ea5e9", "#ef4444",
];

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
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={120}
            label={(props: { name?: string; value?: number }) =>
              `${props.name ?? ""} (${(props.value ?? 0).toFixed(1)}%)`
            }
            labelLine
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
    </div>
  );
}
