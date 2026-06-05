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
    return <div className="p-6 text-center text-sm text-gray-500">{empty}</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-green-50 text-left text-green-700">
          {columns.map((c) => <th key={c.key} className="px-3 py-2.5 pr-4 font-semibold text-xs uppercase tracking-wide">{c.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey(row)} className={`border-t border-gray-100 transition-colors hover:bg-green-50/40 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2.5 pr-4">
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
