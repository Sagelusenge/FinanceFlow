import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const file = resolve(process.env.DATABASE_FILE || "data/financeflow.sqlite");
mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', usd_cdf_rate REAL, month_start INTEGER NOT NULL DEFAULT 1, number_format TEXT NOT NULL DEFAULT 'fr-FR', theme TEXT NOT NULL DEFAULT 'light', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL, opening_cents INTEGER NOT NULL DEFAULT 0, icon TEXT NOT NULL DEFAULT 'account_balance_wallet', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')), amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), currency TEXT NOT NULL, category_id TEXT REFERENCES categories(id) ON DELETE SET NULL, account_id TEXT NOT NULL REFERENCES accounts(id), target_account_id TEXT REFERENCES accounts(id), description TEXT NOT NULL, transaction_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_account ON transactions(user_id, account_id);
CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, category_id TEXT REFERENCES categories(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), currency TEXT NOT NULL, period TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, target_cents INTEGER NOT NULL CHECK(target_cents > 0), current_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL, target_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recurring (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT REFERENCES categories(id) ON DELETE SET NULL, type TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), currency TEXT NOT NULL, description TEXT NOT NULL, frequency TEXT NOT NULL, next_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
`);
const userColumns = db.prepare("PRAGMA table_info(users)").all() as {
  name: string;
}[];
if (!userColumns.some((column) => column.name === "usd_cdf_rate"))
  db.exec("ALTER TABLE users ADD COLUMN usd_cdf_rate REAL");
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const all = <T = Record<string, unknown>>(
  sql: string,
  ...values: (string | number | null)[]
) => db.prepare(sql).all(...values) as T[];
export const one = <T = Record<string, unknown>>(
  sql: string,
  ...values: (string | number | null)[]
) => db.prepare(sql).get(...values) as T | undefined;
export const run = (sql: string, ...values: (string | number | null)[]) =>
  db.prepare(sql).run(...values);
