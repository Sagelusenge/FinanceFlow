import type { Analytics, Currency, Transaction } from "./types";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Une erreur est survenue.");
  return body as T;
}
export const send = <T>(path: string, method: string, data?: unknown) =>
  api<T>(path, {
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
export const formatMoney = (
  cents: number,
  currency: Currency = "USD",
  locale = typeof document === "undefined"
    ? "fr-FR"
    : document.documentElement.dataset.numberFormat || "fr-FR",
) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency === "CDF" ? 0 : 2,
    maximumFractionDigits: currency === "CDF" ? 0 : 2,
  }).format(cents / 100) +
  " " +
  currency;
export const formatDate = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    new Date(d + "T12:00:00"),
  );
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const monthRange = (d = new Date(), start = 1) => ({
  from: iso(
    new Date(
      d.getFullYear(),
      d.getMonth() - (d.getDate() < start ? 1 : 0),
      start,
    ),
  ),
  to: iso(
    new Date(
      d.getFullYear(),
      d.getMonth() + (d.getDate() < start ? 0 : 1),
      start - 1,
    ),
  ),
});
export const sumType = (a: Analytics, type: string) =>
  a.totals.find((x) => x.type === type)?.amount_cents || 0;
export const savingsRate = (income: number, expense: number) =>
  income ? Math.round(((income - expense) / income) * 100) : 0;
export const transactionSign = (t: Transaction) =>
  t.type === "expense" ? -1 : 1;
