import mysql, { type Pool } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

type Value = string | number | null;
type SQLite = typeof import("./db.ts");
let sqlite: SQLite | undefined;
let pool: Pool | undefined;

const schema = [
  `CREATE TABLE IF NOT EXISTS users (id CHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(200) NOT NULL, recovery_hash CHAR(64) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'USD', month_start TINYINT NOT NULL DEFAULT 1, number_format VARCHAR(10) NOT NULL DEFAULT 'fr-FR', theme VARCHAR(10) NOT NULL DEFAULT 'light', created_at VARCHAR(30) NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at VARCHAR(30) NOT NULL, INDEX sessions_user(user_id), CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS accounts (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(80) NOT NULL, type VARCHAR(40) NOT NULL, currency CHAR(3) NOT NULL, opening_cents BIGINT NOT NULL DEFAULT 0, icon VARCHAR(40) NOT NULL DEFAULT 'account_balance_wallet', active BOOLEAN NOT NULL DEFAULT TRUE, created_at VARCHAR(30) NOT NULL, INDEX accounts_user(user_id), CONSTRAINT accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS categories (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(60) NOT NULL, type VARCHAR(10) NOT NULL, icon VARCHAR(40) NOT NULL, color CHAR(7) NOT NULL, created_at VARCHAR(30) NOT NULL, INDEX categories_user(user_id), CONSTRAINT categories_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS transactions (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, type VARCHAR(10) NOT NULL, amount_cents BIGINT NOT NULL, currency CHAR(3) NOT NULL, category_id CHAR(36) NULL, account_id CHAR(36) NOT NULL, target_account_id CHAR(36) NULL, description VARCHAR(250) NOT NULL, transaction_date CHAR(10) NOT NULL, created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL, INDEX transactions_user_date(user_id,transaction_date), INDEX transactions_account(user_id,account_id), INDEX transactions_category(category_id), INDEX transactions_target(target_account_id), CONSTRAINT transactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT transactions_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL, CONSTRAINT transactions_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id), CONSTRAINT transactions_target_fk FOREIGN KEY (target_account_id) REFERENCES accounts(id), CONSTRAINT positive_amount CHECK (amount_cents > 0)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS budgets (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, category_id CHAR(36) NULL, amount_cents BIGINT NOT NULL, currency CHAR(3) NOT NULL, period VARCHAR(10) NOT NULL, start_date CHAR(10) NOT NULL, end_date CHAR(10) NULL, created_at VARCHAR(30) NOT NULL, INDEX budgets_user(user_id), INDEX budgets_category(category_id), CONSTRAINT budgets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT budgets_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE, CONSTRAINT budgets_positive CHECK (amount_cents > 0)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS goals (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, target_cents BIGINT NOT NULL, current_cents BIGINT NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL, target_date CHAR(10) NULL, status VARCHAR(15) NOT NULL DEFAULT 'active', created_at VARCHAR(30) NOT NULL, INDEX goals_user(user_id), CONSTRAINT goals_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT goals_positive CHECK (target_cents > 0)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS recurring (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, account_id CHAR(36) NOT NULL, category_id CHAR(36) NULL, type VARCHAR(10) NOT NULL, amount_cents BIGINT NOT NULL, currency CHAR(3) NOT NULL, description VARCHAR(250) NOT NULL, frequency VARCHAR(10) NOT NULL, next_date CHAR(10) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at VARCHAR(30) NOT NULL, INDEX recurring_user(user_id), INDEX recurring_account(account_id), INDEX recurring_category(category_id), CONSTRAINT recurring_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT recurring_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id), CONSTRAINT recurring_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL, CONSTRAINT recurring_positive CHECK (amount_cents > 0)) ENGINE=InnoDB`,
];

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production")
      throw new Error("DATABASE_URL est requis en production.");
    sqlite = await import("./db.ts");
    return;
  }
  const url = new URL(process.env.DATABASE_URL);
  if (url.protocol !== "mysql:")
    throw new Error("DATABASE_URL doit utiliser mysql://.");
  const ca = readFileSync(
    resolve(process.env.MYSQL_CA_PATH || "certs/aiven-ca.pem"),
    "utf8",
  );
  pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { ca, rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    multipleStatements: false,
  });
  await pool.query("SELECT 1");
  for (const statement of schema) await pool.query(statement);
}
export const now = () => new Date().toISOString();
export const uid = () => randomUUID();
export async function all<T = Record<string, unknown>>(
  sql: string,
  ...values: Value[]
): Promise<T[]> {
  if (sqlite) return sqlite.all<T>(sql, ...values);
  if (!pool) throw new Error("Base de données non initialisée.");
  const [rows] = await pool.query(sql, values);
  return rows as T[];
}
export async function one<T = Record<string, unknown>>(
  sql: string,
  ...values: Value[]
): Promise<T | undefined> {
  return (await all<T>(sql, ...values))[0];
}
export async function run(sql: string, ...values: Value[]): Promise<void> {
  if (sqlite) {
    sqlite.run(sql, ...values);
    return;
  }
  if (!pool) throw new Error("Base de données non initialisée.");
  await pool.query(sql, values);
}
