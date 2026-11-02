import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cacheResponse,
  cachedResponse,
  clearOfflineData,
  queueTransaction,
  queuedTransactions,
  rememberUser,
  syncQueuedTransactions,
  type TransactionDraft,
} from "../src/offline.ts";

const local = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => { local.set(key, value); },
  removeItem: (key: string) => { local.delete(key); },
}});
Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });

test("offline data stays scoped and queued transactions survive failed sync", async () => {
  const user = { id: "user-a", name: "Alice", email: "a@test.local", currency: "USD" as const, usd_cdf_rate: 2850, month_start: 1, number_format: "fr-FR", theme: "light", is_admin: false, must_change_password: false };
  await rememberUser(user);
  await cacheResponse("/accounts", [{ id: "account-a" }]);
  assert.deepEqual(await cachedResponse("/accounts"), [{ id: "account-a" }]);
  const draft: TransactionDraft = { type: "expense", amount: 3, currency: "USD", account_id: "account-a", target_account_id: "", category_id: "category-a", description: "Offline", transaction_date: "2026-11-02", usd_cdf_rate_snapshot: 2850 };
  await queueTransaction(user.id, draft, "c98e45ec-9de3-42c0-bf5e-a0d67d0f5160");
  assert.equal((await queuedTransactions(user.id)).length, 1);
  assert.equal((await queuedTransactions("user-b")).length, 0);
  await assert.rejects(syncQueuedTransactions(user.id, async () => { throw new Error("network lost"); }));
  assert.equal((await queuedTransactions(user.id)).length, 1);
  const sent: TransactionDraft[] = [];
  assert.equal(await syncQueuedTransactions(user.id, async (payload) => { sent.push(payload); }), 1);
  assert.equal(sent[0].usd_cdf_rate_snapshot, 2850);
  assert.equal((await queuedTransactions(user.id)).length, 0);
  await clearOfflineData();
  assert.equal(await cachedResponse("/accounts"), undefined);
});
