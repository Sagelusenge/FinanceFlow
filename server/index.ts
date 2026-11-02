import express, { type Request, type Response } from "express";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { initDb, all, one, run, now, uid } from "./database.ts";

const scrypt = promisify(scryptCallback);
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ error: message });
const text = (v: unknown, max = 150) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1e10
    ? Math.round(v * 100)
    : 0;
const currency = (v: unknown) => (v === "USD" || v === "CDF" ? v : "");
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v))
    ? v
    : "";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
};
const checkPassword = async (password: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
};
const cookies = (req: Request) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim().split("=").map(decodeURIComponent))
      .filter((x) => x.length === 2),
  );
const secure = (req: Request) =>
  req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
const session = async (req: Request, res: Response, userId: string) => {
  const token = randomBytes(32).toString("hex");
  await run(
    "INSERT INTO sessions VALUES (?,?,?)",
    digest(token),
    userId,
    new Date(Date.now() + 30 * 864e5).toISOString(),
  );
  res.setHeader(
    "Set-Cookie",
    `ff_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure(req)}`,
  );
};
const clearSession = async (req: Request, res: Response) => {
  const token = cookies(req).ff_session;
  if (token)
    await run("DELETE FROM sessions WHERE token_hash=?", digest(token));
  res.setHeader(
    "Set-Cookie",
    `ff_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure(req)}`,
  );
};
const publicUser = (u: Record<string, unknown>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  currency: u.currency,
  usd_cdf_rate: u.usd_cdf_rate,
  month_start: u.month_start,
  number_format: u.number_format,
  theme: u.theme,
});
app.use("/api", async (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        return fail(res, "Origine non autorisée.", 403);
      }
      if (
        originHost !== req.headers.host &&
        origin !== process.env.FRONTEND_ORIGIN
      )
        return fail(res, "Origine non autorisée.", 403);
    }
  }
  next();
});
const authAttempts = new Map<string, { count: number; reset: number }>();
app.use("/api/auth", (req, res, next) => {
  if (!["/login", "/register", "/reset"].includes(req.path)) return next();
  const key = req.ip || "unknown",
    current = authAttempts.get(key),
    time = Date.now();
  const state =
    current && current.reset > time
      ? current
      : { count: 0, reset: time + 15 * 60_000 };
  state.count++;
  authAttempts.set(key, state);
  if (state.count > 30)
    return fail(res, "Trop de tentatives. Réessayez plus tard.", 429);
  next();
});
app.post("/api/auth/register", async (req, res) => {
  const name = text(req.body.name, 80),
    email = text(req.body.email, 254).toLowerCase(),
    password = req.body.password;
  if (
    !name ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 200
  )
    return fail(
      res,
      "Nom, email valide et mot de passe de 10 caractères minimum requis.",
    );
  if (await one("SELECT id FROM users WHERE email=?", email))
    return fail(res, "Cette adresse est déjà utilisée.", 409);
  const id = uid(),
    recovery = randomBytes(16).toString("hex");
  await run(
    "INSERT INTO users (id,name,email,password_hash,recovery_hash,currency,month_start,number_format,theme,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    id,
    name,
    email,
    await hashPassword(password),
    digest(recovery),
    "USD",
    1,
    "fr-FR",
    "light",
    now(),
  );
  const defaults: [string, string, string, string][] = [
    ["Alimentation", "expense", "restaurant", "#ef4760"],
    ["Transport", "expense", "directions_car", "#7c83d4"],
    ["Logement", "expense", "home", "#3b82f6"],
    ["Santé", "expense", "medical_services", "#ef7b45"],
    ["Internet", "expense", "wifi", "#8b5cf6"],
    ["Loisirs", "expense", "sports_esports", "#ec4899"],
    ["Shopping", "expense", "shopping_bag", "#db7676"],
    ["Factures", "expense", "receipt_long", "#64748b"],
    ["Autres dépenses", "expense", "more_horiz", "#64748b"],
    ["Salaire", "income", "payments", "#059669"],
    ["Commerce", "income", "storefront", "#0d9488"],
    ["Freelance", "income", "work", "#16a34a"],
    ["Investissement", "income", "trending_up", "#0284c7"],
    ["Autres revenus", "income", "add_circle", "#10b981"],
  ];
  for (const [n, t, i, c] of defaults)
    await run(
      "INSERT INTO categories VALUES (?,?,?,?,?,?,?)",
      uid(),
      id,
      n,
      t,
      i,
      c,
      now(),
    );
  await session(req, res, id);
  res.status(201).json({
    user: publicUser((await one("SELECT * FROM users WHERE id=?", id))!),
    recoveryCode: recovery,
  });
});
app.post("/api/auth/login", async (req, res) => {
  const email = text(req.body.email, 254).toLowerCase(),
    password = req.body.password;
  const u = await one<Record<string, unknown>>(
    "SELECT * FROM users WHERE email=?",
    email,
  );
  if (
    !u ||
    typeof password !== "string" ||
    !(await checkPassword(password, String(u.password_hash)))
  )
    return fail(res, "Identifiants incorrects.", 401);
  await session(req, res, String(u.id));
  res.json({ user: publicUser(u) });
});
app.post("/api/auth/logout", async (req, res) => {
  await clearSession(req, res);
  res.json({ ok: true });
});
app.post("/api/auth/reset", async (req, res) => {
  const email = text(req.body.email, 254).toLowerCase(),
    code = text(req.body.recoveryCode, 100),
    password = req.body.password;
  if (typeof password !== "string" || password.length < 10)
    return fail(res, "Mot de passe de 10 caractères minimum requis.");
  const u = await one<Record<string, unknown>>(
    "SELECT * FROM users WHERE email=?",
    email,
  );
  if (!u || digest(code) !== u.recovery_hash)
    return fail(res, "Code de récupération invalide.", 401);
  const fresh = randomBytes(16).toString("hex");
  await run(
    "UPDATE users SET password_hash=?,recovery_hash=? WHERE id=?",
    await hashPassword(password),
    digest(fresh),
    String(u.id),
  );
  await run("DELETE FROM sessions WHERE user_id=?", String(u.id));
  res.json({ recoveryCode: fresh });
});
app.use("/api", async (req, res, next) => {
  if (req.path.startsWith("/auth/")) return next();
  const token = cookies(req).ff_session;
  const u = token
    ? await one<Record<string, unknown>>(
        "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
        digest(token),
        now(),
      )
    : undefined;
  if (!u) return fail(res, "Session expirée. Connectez-vous.", 401);
  res.locals.user = u;
  next();
});
const userId = (res: Response) => String(res.locals.user.id);
const owned = async (table: string, id: string, res: Response) =>
  one<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id=? AND user_id=?`,
    id,
    userId(res),
  );
const account = (id: string, res: Response) => owned("accounts", id, res);
const category = (id: string, res: Response) => owned("categories", id, res);
app.get("/api/me", async (_req, res) => res.json(publicUser(res.locals.user)));
app.put("/api/me", async (req, res) => {
  const u = res.locals.user;
  const name = text(req.body.name, 80),
    cur = currency(req.body.currency),
    submittedRate = req.body.usd_cdf_rate,
    rate =
      submittedRate === undefined
        ? (u.usd_cdf_rate ?? null)
        : submittedRate,
    month = Number(req.body.month_start),
    fmt = req.body.number_format,
    theme = req.body.theme;
  if (
    !name ||
    !cur ||
    (rate !== null &&
      (typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate <= 0 ||
        rate > 1_000_000_000 ||
        Math.round(rate * 10_000) !== rate * 10_000)) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 28 ||
    !["fr-FR", "en-US"].includes(fmt) ||
    !["light", "dark"].includes(theme)
  )
    return fail(res, "Préférences invalides.");
  await run(
    "UPDATE users SET name=?,currency=?,usd_cdf_rate=?,month_start=?,number_format=?,theme=? WHERE id=?",
    name,
    cur,
    rate,
    month,
    fmt,
    theme,
    String(u.id),
  );
  res.json(
    publicUser((await one("SELECT * FROM users WHERE id=?", String(u.id)))!),
  );
});
app.put("/api/me/password", async (req, res) => {
  const u = res.locals.user;
  if (
    typeof req.body.currentPassword !== "string" ||
    !(await checkPassword(req.body.currentPassword, String(u.password_hash))) ||
    typeof req.body.newPassword !== "string" ||
    req.body.newPassword.length < 10
  )
    return fail(
      res,
      "Mot de passe actuel incorrect ou nouveau mot de passe trop court.",
    );
  await run(
    "UPDATE users SET password_hash=? WHERE id=?",
    await hashPassword(req.body.newPassword),
    String(u.id),
  );
  await run(
    "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
    String(u.id),
    digest(cookies(req).ff_session || ""),
  );
  res.json({ ok: true });
});
app.get("/api/accounts", async (_req, res) =>
  res.json(
    await all(
      `SELECT a.*, a.opening_cents + COALESCE((SELECT SUM(CASE WHEN t.type='income' AND t.account_id=a.id THEN t.amount_cents WHEN t.type='expense' AND t.account_id=a.id THEN -t.amount_cents WHEN t.type='transfer' AND t.account_id=a.id THEN -t.amount_cents WHEN t.type='transfer' AND t.target_account_id=a.id THEN t.amount_cents ELSE 0 END) FROM transactions t WHERE t.user_id=a.user_id AND (t.account_id=a.id OR t.target_account_id=a.id)),0) AS balance_cents FROM accounts a WHERE a.user_id=? ORDER BY a.created_at`,
      userId(res),
    ),
  ),
);
app.post("/api/accounts", async (req, res) => {
  const name = text(req.body.name, 80),
    type = text(req.body.type, 40),
    cur = currency(req.body.currency),
    opening = Number(req.body.openingBalance || 0);
  if (
    !name ||
    !["cash", "bank", "mobile_money", "wallet", "other"].includes(type) ||
    !cur ||
    !Number.isFinite(opening) ||
    opening < 0 ||
    opening > 1e10
  )
    return fail(res, "Compte invalide.");
  const id = uid();
  await run(
    "INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?,?)",
    id,
    userId(res),
    name,
    type,
    cur,
    Math.round(opening * 100),
    text(req.body.icon, 40) || "account_balance_wallet",
    1,
    now(),
  );
  res.status(201).json({ id });
});
app.put("/api/accounts/:id", async (req, res) => {
  const a = await account(req.params.id, res);
  if (!a) return fail(res, "Compte introuvable.", 404);
  const name = text(req.body.name, 80),
    type = text(req.body.type, 40);
  if (
    !name ||
    !["cash", "bank", "mobile_money", "wallet", "other"].includes(type)
  )
    return fail(res, "Compte invalide.");
  await run(
    "UPDATE accounts SET name=?,type=?,icon=?,active=? WHERE id=? AND user_id=?",
    name,
    type,
    text(req.body.icon, 40) || String(a.icon),
    req.body.active === false ? 0 : 1,
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
app.delete("/api/accounts/:id", async (req, res) => {
  if (!(await account(req.params.id, res)))
    return fail(res, "Compte introuvable.", 404);
  if (
    await one(
      "SELECT id FROM transactions WHERE user_id=? AND (account_id=? OR target_account_id=?) LIMIT 1",
      userId(res),
      req.params.id,
      req.params.id,
    )
  )
    return fail(
      res,
      "Ce compte possède des transactions. Désactivez-le à la place.",
    );
  if (
    await one(
      "SELECT id FROM recurring WHERE user_id=? AND account_id=? LIMIT 1",
      userId(res),
      req.params.id,
    )
  )
    return fail(
      res,
      "Ce compte possède des récurrences. Supprimez-les ou désactivez-le.",
    );
  await run(
    "DELETE FROM accounts WHERE id=? AND user_id=?",
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
app.get("/api/categories", async (_req, res) =>
  res.json(
    await all(
      "SELECT * FROM categories WHERE user_id=? ORDER BY type,name",
      userId(res),
    ),
  ),
);
app.post("/api/categories", async (req, res) => {
  const name = text(req.body.name, 60),
    type = req.body.type,
    color = text(req.body.color, 20),
    icon = text(req.body.icon, 40);
  if (
    !name ||
    !["income", "expense"].includes(type) ||
    !/^#[0-9a-fA-F]{6}$/.test(color) ||
    !icon
  )
    return fail(res, "Catégorie invalide.");
  const id = uid();
  await run(
    "INSERT INTO categories VALUES (?,?,?,?,?,?,?)",
    id,
    userId(res),
    name,
    type,
    icon,
    color,
    now(),
  );
  res.status(201).json({ id });
});
app.put("/api/categories/:id", async (req, res) => {
  const c = await category(req.params.id, res);
  if (!c) return fail(res, "Catégorie introuvable.", 404);
  const name = text(req.body.name, 60),
    color = text(req.body.color, 20),
    icon = text(req.body.icon, 40);
  if (!name || !/^#[0-9a-fA-F]{6}$/.test(color) || !icon)
    return fail(res, "Catégorie invalide.");
  await run(
    "UPDATE categories SET name=?,icon=?,color=? WHERE id=? AND user_id=?",
    name,
    icon,
    color,
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
app.delete("/api/categories/:id", async (req, res) => {
  if (!(await category(req.params.id, res)))
    return fail(res, "Catégorie introuvable.", 404);
  await run(
    "DELETE FROM categories WHERE id=? AND user_id=?",
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
async function transactionInput(body: Record<string, unknown>, res: Response) {
  const type = body.type,
    amount = money(body.amount),
    accountId = text(body.account_id, 50),
    targetId = text(body.target_account_id, 50),
    categoryId = text(body.category_id, 50),
    a = await account(accountId, res),
    cur = currency(body.currency),
    d = date(body.transaction_date),
    description = text(body.description, 250);
  if (
    !["income", "expense", "transfer"].includes(String(type)) ||
    !amount ||
    !a ||
    !cur ||
    a.currency !== cur ||
    !d ||
    !description
  )
    return null;
  if (type === "transfer") {
    const target = await account(targetId, res);
    if (!target || target.id === a.id || target.currency !== cur) return null;
  } else if (
    !categoryId ||
    !(await category(categoryId, res)) ||
    (await category(categoryId, res))?.type !== type
  )
    return null;
  return {
    type: String(type),
    amount,
    cur,
    accountId,
    targetId: type === "transfer" ? targetId : null,
    categoryId: type === "transfer" ? null : categoryId,
    description,
    d,
  };
}
app.get("/api/transactions", async (req, res) => {
  const q = req.query,
    where = ["t.user_id=?"],
    params: (string | number | null)[] = [userId(res)];
  const add = (sql: string, v: string | number) => {
    where.push(sql);
    params.push(v);
  };
  if (q.type && ["income", "expense", "transfer"].includes(String(q.type)))
    add("t.type=?", String(q.type));
  if (q.account) {
    where.push("(t.account_id=? OR t.target_account_id=?)");
    params.push(String(q.account), String(q.account));
  }
  if (q.category) add("t.category_id=?", String(q.category));
  if (date(q.from)) add("t.transaction_date>=?", String(q.from));
  if (date(q.to)) add("t.transaction_date<=?", String(q.to));
  if (q.min && money(Number(q.min)))
    add("t.amount_cents>=?", money(Number(q.min)));
  if (q.max && money(Number(q.max)))
    add("t.amount_cents<=?", money(Number(q.max)));
  if (q.search)
    add(
      "(t.description LIKE ? OR c.name LIKE ? OR a.name LIKE ?)",
      `%${text(q.search, 80)}%`,
    );
  const sort =
    (
      {
        newest: "t.transaction_date DESC,t.created_at DESC",
        oldest: "t.transaction_date ASC,t.created_at ASC",
        amount_asc: "t.amount_cents ASC",
        amount_desc: "t.amount_cents DESC",
      } as Record<string, string>
    )[String(q.sort)] || "t.transaction_date DESC,t.created_at DESC";
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20)),
    page = Math.max(1, Number(q.page) || 1);
  const condition = where.join(" AND ");
  const total =
    (
      await one<{ count: number }>(
        `SELECT count(*) AS count FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN accounts a ON a.id=t.account_id WHERE ${condition}`,
        ...params,
      )
    )?.count || 0;
  const items = await all(
    `SELECT t.*,c.name AS category_name,c.icon AS category_icon,c.color AS category_color,a.name AS account_name,ta.name AS target_account_name FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN accounts ta ON ta.id=t.target_account_id WHERE ${condition} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
app.post("/api/transactions", async (req, res) => {
  const clientId = req.body.client_id;
  if (clientId !== undefined &&
      (typeof clientId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)))
    return fail(res, "Identifiant de transaction invalide.");
  const id = clientId || uid();
  const existing = clientId
    ? await one<{ user_id: string }>("SELECT user_id FROM transactions WHERE id=?", id)
    : undefined;
  if (existing)
    return existing.user_id === userId(res)
      ? res.json({ id, replayed: true })
      : fail(res, "Identifiant de transaction déjà utilisé.", 409);
  const rate = Object.hasOwn(req.body, "usd_cdf_rate_snapshot")
    ? req.body.usd_cdf_rate_snapshot
    : (res.locals.user.usd_cdf_rate as number | null) ?? null;
  if (rate !== null &&
      (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1e9))
    return fail(res, "Taux de change invalide.");
  const t = await transactionInput(req.body, res);
  if (!t)
    return fail(
      res,
      "Transaction invalide. Vérifiez le compte, la catégorie, la devise, la date et le montant.",
    );
  try {
    await run(
    "INSERT INTO transactions (id,user_id,type,amount_cents,currency,usd_cdf_rate,category_id,account_id,target_account_id,description,transaction_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    userId(res),
    t.type,
    t.amount,
    t.cur,
    rate,
    t.categoryId,
    t.accountId,
    t.targetId,
    t.description,
    t.d,
    now(),
    now(),
    );
  } catch (error) {
    const duplicate = clientId
      ? await one<{ user_id: string }>("SELECT user_id FROM transactions WHERE id=?", id)
      : undefined;
    if (duplicate?.user_id === userId(res)) return res.json({ id, replayed: true });
    throw error;
  }
  res.status(201).json({ id });
});
app.put("/api/transactions/:id", async (req, res) => {
  if (!(await owned("transactions", req.params.id, res)))
    return fail(res, "Transaction introuvable.", 404);
  const t = await transactionInput(req.body, res);
  if (!t) return fail(res, "Transaction invalide.");
  await run(
    "UPDATE transactions SET type=?,amount_cents=?,currency=?,category_id=?,account_id=?,target_account_id=?,description=?,transaction_date=?,updated_at=? WHERE id=? AND user_id=?",
    t.type,
    t.amount,
    t.cur,
    t.categoryId,
    t.accountId,
    t.targetId,
    t.description,
    t.d,
    now(),
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
app.delete("/api/transactions/:id", async (req, res) => {
  if (!(await owned("transactions", req.params.id, res)))
    return fail(res, "Transaction introuvable.", 404);
  await run(
    "DELETE FROM transactions WHERE id=? AND user_id=?",
    req.params.id,
    userId(res),
  );
  res.json({ ok: true });
});
async function crudInput(
  kind: string,
  b: Record<string, unknown>,
  res: Response,
) {
  const cur = currency(b.currency),
    amount = money(b.amount),
    d = date(b.start_date || b.next_date);
  if (!cur || !amount || !d) return null;
  if (kind === "budgets") {
    const cid = text(b.category_id, 50) || null;
    if (
      cid &&
      (!(await category(cid, res)) ||
        (await category(cid, res))?.type !== "expense")
    )
      return null;
    if (!["monthly", "global"].includes(String(b.period))) return null;
    return {
      category_id: cid,
      amount_cents: amount,
      currency: cur,
      period: b.period,
      start_date: d,
      end_date: date(b.end_date) || null,
    };
  }
  if (kind === "goals") {
    const name = text(b.name, 100),
      current = Number(b.current_amount || 0);
    if (!name || !Number.isFinite(current) || current < 0) return null;
    return {
      name,
      target_cents: amount,
      current_cents: Math.round(current * 100),
      currency: cur,
      target_date: date(b.target_date) || null,
      status: ["active", "completed", "paused"].includes(String(b.status))
        ? b.status
        : "active",
    };
  }
  const aid = text(b.account_id, 50),
    cid = text(b.category_id, 50),
    type = b.type;
  if (
    !(await account(aid, res)) ||
    (await account(aid, res))?.currency !== cur ||
    !["income", "expense"].includes(String(type)) ||
    !(await category(cid, res)) ||
    (await category(cid, res))?.type !== type ||
    !["daily", "weekly", "monthly", "yearly"].includes(String(b.frequency))
  )
    return null;
  return {
    account_id: aid,
    category_id: cid,
    type,
    amount_cents: amount,
    currency: cur,
    description: text(b.description, 250),
    frequency: b.frequency,
    next_date: d,
    active: b.active === false ? 0 : 1,
  };
}
for (const kind of ["budgets", "goals", "recurring"]) {
  app.get(`/api/${kind}`, async (_req, res) =>
    res.json(
      await all(
        `SELECT * FROM ${kind} WHERE user_id=? ORDER BY created_at DESC`,
        userId(res),
      ),
    ),
  );
  app.post(`/api/${kind}`, async (req, res) => {
    const v = await crudInput(kind, req.body, res);
    if (!v) return fail(res, "Données invalides.");
    const id = uid(),
      keys = Object.keys(v);
    await run(
      `INSERT INTO ${kind} (id,user_id,${keys.join(",")},created_at) VALUES (${Array(
        keys.length + 3,
      )
        .fill("?")
        .join(",")})`,
      id,
      userId(res),
      ...(Object.values(v) as (string | number | null)[]),
      now(),
    );
    res.status(201).json({ id });
  });
  app.put(`/api/${kind}/:id`, async (req, res) => {
    if (!(await owned(kind, req.params.id, res)))
      return fail(res, "Élément introuvable.", 404);
    const v = await crudInput(kind, req.body, res);
    if (!v) return fail(res, "Données invalides.");
    const keys = Object.keys(v);
    await run(
      `UPDATE ${kind} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=? AND user_id=?`,
      ...(Object.values(v) as (string | number | null)[]),
      req.params.id,
      userId(res),
    );
    res.json({ ok: true });
  });
  app.delete(`/api/${kind}/:id`, async (req, res) => {
    if (!(await owned(kind, req.params.id, res)))
      return fail(res, "Élément introuvable.", 404);
    await run(
      `DELETE FROM ${kind} WHERE id=? AND user_id=?`,
      req.params.id,
      userId(res),
    );
    res.json({ ok: true });
  });
}
app.get("/api/analytics", async (req, res) => {
  const from =
      date(req.query.from) ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10),
    to = date(req.query.to) || new Date().toISOString().slice(0, 10),
    cur = currency(req.query.currency) || String(res.locals.user.currency);
  const base = [userId(res), cur, from, to];
  const totals = await all(
    "SELECT type,SUM(amount_cents) AS amount_cents FROM transactions WHERE user_id=? AND currency=? AND transaction_date>=? AND transaction_date<=? AND type<>'transfer' GROUP BY type",
    ...base,
  );
  const categories = await all(
    "SELECT c.name,c.color,SUM(t.amount_cents) AS amount_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.user_id=? AND t.currency=? AND t.transaction_date>=? AND t.transaction_date<=? AND t.type='expense' GROUP BY t.category_id ORDER BY amount_cents DESC",
    ...base,
  );
  const monthly = await all(
    "SELECT substr(transaction_date,1,7) AS month,type,SUM(amount_cents) AS amount_cents FROM transactions WHERE user_id=? AND currency=? AND type<>'transfer' GROUP BY month,type ORDER BY month DESC LIMIT 24",
    userId(res),
    cur,
  );
  res.json({ totals, categories, monthly, from, to, currency: cur });
});
app.get("/api/reports/csv", async (req, res) => {
  const from = date(req.query.from) || "0000-01-01",
    to = date(req.query.to) || "9999-12-31";
  const rows = await all<Record<string, unknown>>(
    "SELECT t.transaction_date,t.type,t.description,t.amount_cents,t.currency,t.usd_cdf_rate,c.name AS category,a.name AS account FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN accounts a ON a.id=t.account_id WHERE t.user_id=? AND t.transaction_date>=? AND t.transaction_date<=? ORDER BY t.transaction_date DESC LIMIT 100000",
    userId(res),
    from,
    to,
  );
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    "Date,Type,Description,Montant,Devise,Taux USD/CDF appliqué,Catégorie,Compte",
    ...rows.map((r) =>
      [
        r.transaction_date,
        r.type,
        r.description,
        Number(r.amount_cents) / 100,
        r.currency,
        r.usd_cdf_rate,
        r.category,
        r.account,
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="financeflow-rapport.csv"',
  );
  res.send("\uFEFF" + csv);
});
app.get("/api/transactions/:id", async (_req, res) => {
  const t = await owned("transactions", _req.params.id, res);
  if (!t) return fail(res, "Transaction introuvable.", 404);
  res.json(t);
});
app.get("/api/budgets/summary", async (_req, res) => {
  const u = res.locals.user;
  const today = new Date(),
    day = Number(u.month_start) || 1;
  const start = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - (today.getUTCDate() < day ? 1 : 0),
      day,
    ),
  )
    .toISOString()
    .slice(0, 10);
  const items = await all<Record<string, unknown>>(
    "SELECT * FROM budgets WHERE user_id=? ORDER BY created_at DESC",
    userId(res),
  );
  res.json(
    await Promise.all(
      items.map(async (b) => {
        const from =
          b.period === "monthly"
            ? String(b.start_date) > start
              ? String(b.start_date)
              : start
            : String(b.start_date);
        const to =
          b.period === "global" &&
          b.end_date &&
          String(b.end_date) < now().slice(0, 10)
            ? String(b.end_date)
            : now().slice(0, 10);
        const spent =
          (
            await one<{ total: number }>(
              "SELECT COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE user_id=? AND type='expense' AND currency=? AND (? IS NULL OR category_id=?) AND transaction_date>=? AND transaction_date<=?",
              userId(res),
              String(b.currency),
              b.category_id as string | null,
              b.category_id as string | null,
              from,
              to,
            )
          )?.total || 0;
        return { ...b, spent_cents: spent };
      }),
    ),
  );
});
const dist = resolve("dist");
app.get("/health", async (_req, res) => {
  await one("SELECT 1 AS ok");
  res.json({ status: "ok" });
});
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", async (_req, res) =>
    res.sendFile(resolve(dist, "index.html")),
  );
}
await initDb();
app.listen(Number(process.env.PORT) || 3001, () =>
  console.log(`FinanceFlow: http://localhost:${process.env.PORT || 3001}`),
);
