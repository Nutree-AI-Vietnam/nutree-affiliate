export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-green-600">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-gray-800">{value}</div>
    </div>
  );
}
