import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns, rows, rowKey, empty = "No data",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <div className="mb-1 text-2xl">🌱</div>
        {empty}
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr style={{ background: "linear-gradient(90deg, #1A4739 0%, #29B6A1 100%)" }}>
          {columns.map((c) => (
            <th key={c.key} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90 first:rounded-tl-lg last:rounded-tr-lg">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey(row)}
            className={`border-b border-gray-100 dark:border-white/5 transition-colors hover:bg-[#E6F7F5]/60 dark:hover:bg-[#29B6A1]/10 ${
              i % 2 === 1
                ? "bg-gray-50/60 dark:bg-[#262626]"
                : "bg-white dark:bg-[#2D2D2D]"
            }`}
          >
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2.5 text-gray-700 dark:text-[#B0B0B0]">
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
