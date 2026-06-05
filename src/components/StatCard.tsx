export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold" style={{ color: "#1A4739" }}>
        {value}
      </div>
    </div>
  );
}
