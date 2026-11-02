import type { Analytics, Currency, Transaction } from "./types";
import { cacheResponse, cachedResponse, clearOfflineData } from "./offline";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const isAdmin = path.startsWith("/admin/");
  if (!navigator.onLine) {
    if (isGet) {
      if (isAdmin) throw new Error("L’administration nécessite une connexion Internet.");
      const cached = await cachedResponse<T>(path);
      if (cached !== undefined) return cached;
      throw new Error("Ces données ne sont pas encore disponibles hors ligne. Ouvrez cette page avec Internet une première fois.");
    }
    throw new Error("Connexion Internet requise pour enregistrer des modifications.");
  }
  for (let attempt = 0; attempt < (isGet ? 30 : 1); attempt++) {
    let response: Response;
    try {
      response = await fetch("/api" + path, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
      });
    } catch (error) {
      if (!isGet) throw new Error("Connexion Internet requise pour enregistrer des modifications.");
      if (attempt === 29 || !navigator.onLine) {
        const cached = await cachedResponse<T>(path);
        if (cached !== undefined) return cached;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    const json = response.headers.get("content-type")?.includes("application/json");
    if (
      isGet &&
      attempt < 29 &&
      ([502, 503, 504].includes(response.status) || !json)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    if (!json) {
      if (isGet) {
        const cached = await cachedResponse<T>(path);
        if (cached !== undefined) return cached;
      }
      throw new Error("Le serveur démarre. Réessayez dans un instant.");
    }
    const body = await response.json().catch(() => ({}));
    if ([401, 403].includes(response.status) && path === "/me") await clearOfflineData();
    if (!response.ok) throw new Error(body.error || "Une erreur est survenue.");
    if (isGet && !isAdmin) await cacheResponse(path, body);
    return body as T;
  }
  throw new Error("Le serveur ne répond pas. Réessayez dans un instant.");
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
export const convertMoney = (
  cents: number,
  from: Currency,
  to: Currency,
  usdCdfRate: number | null,
) => {
  if (from === to) return cents;
  if (!usdCdfRate || usdCdfRate <= 0) return null;
  return Math.round(
    from === "USD" ? cents * usdCdfRate : cents / usdCdfRate,
  );
};
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
