export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-[#1A4739] dark:text-white">
        {value}
      </div>
    </div>
  );
}
