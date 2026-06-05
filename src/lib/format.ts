export function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(amount);
}

export function dateOrDash(date: string | null): string {
  return date ?? "—";
}
