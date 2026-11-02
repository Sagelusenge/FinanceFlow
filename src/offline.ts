import type { Currency, Flow, User } from "./types";

const DATABASE = "financeflow-offline";
const STORE = "responses";
const QUEUE = "pending-transactions";
const LAST_USER = "financeflow-last-user";

export interface TransactionDraft {
  type: Flow;
  amount: number;
  currency: Currency;
  account_id: string;
  target_account_id: string;
  category_id: string;
  description: string;
  transaction_date: string;
  usd_cdf_rate_snapshot: number | null;
}
export interface QueuedTransaction {
  key: string;
  userId: string;
  createdAt: string;
  payload: TransactionDraft & { client_id: string };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      if (!request.result.objectStoreNames.contains(QUEUE)) request.result.createObjectStore(QUEUE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function stored<T>(key: string, value?: T): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, value === undefined ? "readonly" : "readwrite");
    const request = value === undefined
      ? transaction.objectStore(STORE).get(key)
      : transaction.objectStore(STORE).put(value, key);
    request.onsuccess = () => resolve(value === undefined ? request.result as T | undefined : value);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export function rememberUser(user: User) {
  localStorage.setItem(LAST_USER, user.id);
  return stored("user:" + user.id, user).catch(() => undefined);
}

export async function cachedResponse<T>(path: string): Promise<T | undefined> {
  const userId = localStorage.getItem(LAST_USER);
  if (!userId) return undefined;
  try {
    return await stored<T>(path === "/me" ? "user:" + userId : `${userId}:${path}`);
  } catch {
    return undefined;
  }
}

export async function cacheResponse<T>(path: string, body: T) {
  if (path === "/me") {
    await rememberUser(body as User);
    return;
  }
  const userId = localStorage.getItem(LAST_USER);
  if (!userId) return;
  await stored(`${userId}:${path}`, body).catch(() => undefined);
}

export async function clearOfflineData() {
  localStorage.removeItem(LAST_USER);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    // A browser can disable local storage; the server session is still invalidated.
  }
}

function notifyQueueChanged() {
  window.dispatchEvent(new Event("financeflow:queue-changed"));
}

export async function queuedTransactions(userId: string): Promise<QueuedTransaction[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(QUEUE, "readonly");
    const request = transaction.objectStore(QUEUE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedTransaction[])
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function queueTransaction(userId: string, draft: TransactionDraft, clientId = crypto.randomUUID()) {
  const entry: QueuedTransaction = {
    key: `${userId}:${clientId}`,
    userId,
    createdAt: new Date().toISOString(),
    payload: { ...draft, client_id: clientId },
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(QUEUE, "readwrite");
    transaction.objectStore(QUEUE).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  notifyQueueChanged();
  return entry;
}

async function removeQueuedTransaction(key: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(QUEUE, "readwrite");
    transaction.objectStore(QUEUE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  notifyQueueChanged();
}

export async function discardQueuedTransaction(userId: string, clientId: string) {
  await removeQueuedTransaction(`${userId}:${clientId}`);
}

const inFlight = new Map<string, Promise<number>>();
export function syncQueuedTransactions(
  userId: string,
  sendTransaction: (payload: QueuedTransaction["payload"]) => Promise<unknown>,
): Promise<number> {
  const current = inFlight.get(userId);
  if (current) return current;
  const work = (async () => {
    let synced = 0;
    for (const entry of await queuedTransactions(userId)) {
      if (!navigator.onLine) break;
      await sendTransaction(entry.payload);
      await removeQueuedTransaction(entry.key);
      synced++;
    }
    return synced;
  })();
  inFlight.set(userId, work);
  void work.finally(() => inFlight.delete(userId)).catch(() => undefined);
  return work;
}
