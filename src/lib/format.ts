export function currency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0,
  }).format(amount);
}

export function dateOrDash(date: string | null): string {
  return date ?? "—";
}
