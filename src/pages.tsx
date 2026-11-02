import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFinance } from "./App";
import {
  api,
  send,
  formatMoney,
  formatDate,
  iso,
  monthRange,
  sumType,
  savingsRate,
} from "./lib";
import type {
  Account,
  Analytics,
  Budget,
  Category,
  Currency,
  Flow,
  Goal,
  Recurring,
  Transaction,
} from "./types";
const Icon = ({ name }: { name: string }) => (
  <span className="material-symbols-outlined" aria-hidden="true">
    {name}
  </span>
);
const Title = ({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) => (
  <div className="page-title">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {desc && <p className="muted">{desc}</p>}
    </div>
    {action}
  </div>
);
const Empty = ({
  icon = "inbox",
  text,
  link,
  label,
}: {
  icon?: string;
  text: string;
  link?: string;
  label?: string;
}) => (
  <div className="empty">
    <Icon name={icon} />
    <p>{text}</p>
    {link && (
      <Link className="primary" to={link}>
        {label || "Ajouter"}
      </Link>
    )}
  </div>
);
const ErrorBox = ({ message }: { message: string }) => (
  <div className="error" role="alert">
    {message}
  </div>
);
const Loading = () => (
  <div className="skeleton-list">
    <div />
    <div />
    <div />
  </div>
);
const useLoad = <T,>(path: string, refresh = 0) => {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api<T>(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, refresh]);
  return { data, error, loading, setData };
};
const confirmDelete = (label: string) =>
  window.confirm(`Supprimer ${label} ? Cette action est définitive.`);
const useMutation = () => {
  const { flash, reload } = useFinance();
  const [busy, setBusy] = useState(false);
  const mutate = async (path: string, method: string, data?: unknown) => {
    setBusy(true);
    try {
      const result = await send(path, method, data);
      await reload();
      flash("Modifications enregistrées.");
      return result;
    } catch (e) {
      flash((e as Error).message, true);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return { mutate, busy };
};
const moneyLabel = (value: number, currency: Currency) =>
  formatMoney(value, currency);
function Metric({
  label,
  value,
  icon,
  tone,
  footer,
}: {
  label: string;
  value: string;
  icon: string;
  tone?: string;
  footer?: string;
}) {
  return (
    <div className="metric card">
      <div className="metric-top">
        <span className="eyebrow">{label}</span>
        <span className={"metric-icon " + (tone || "")}>
          <Icon name={icon} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{footer || "Données actualisées"}</small>
    </div>
  );
}
function TransactionRows({ items }: { items: Transaction[] }) {
  return (
    <div className="transaction-list">
      {items.map((t) => (
        <div className="transaction-row" key={t.id}>
          <span
            className="tx-icon"
            style={{
              background: t.category_color
                ? `${t.category_color}22`
                : undefined,
              color: t.category_color || undefined,
            }}
          >
            <Icon
              name={
                t.category_icon ||
                (t.type === "transfer" ? "swap_horiz" : "payments")
              }
            />
          </span>
          <div className="tx-main">
            <strong>{t.description}</strong>
            <small>
              {t.type === "transfer"
                ? "Transfert"
                : t.category_name || "Sans catégorie"}{" "}
              · {t.account_name}
              {t.target_account_name ? " → " + t.target_account_name : ""}
            </small>
          </div>
          <small className="tx-date">{formatDate(t.transaction_date)}</small>
          <strong
            className={
              "tx-amount " + (t.type === "expense" ? "negative" : "positive")
            }
          >
            {t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}
            {moneyLabel(t.amount_cents, t.currency)}
          </strong>
          <Link
            className="icon-button"
            aria-label={"Modifier " + t.description}
            to={"/transactions/" + t.id + "/edit"}
          >
            <Icon name="edit" />
          </Link>
        </div>
      ))}
    </div>
  );
}
function Chart({ a }: { a: Analytics }) {
  const months = Array.from(new Set(a.monthly.map((m) => m.month)))
      .sort()
      .slice(-6),
    data = months.map((m) => ({
      month: m,
      income:
        a.monthly.find((x) => x.month === m && x.type === "income")
          ?.amount_cents || 0,
      expense:
        a.monthly.find((x) => x.month === m && x.type === "expense")
          ?.amount_cents || 0,
    })),
    max = Math.max(1, ...data.flatMap((x) => [x.income, x.expense]));
  return data.length ? (
    <div
      className="bar-chart"
      role="img"
      aria-label="Revenus et dépenses mensuels"
    >
      {data.map((x) => (
        <div className="bar-group" key={x.month}>
          <div className="bars">
            <div
              className="bar income"
              style={{ height: `${Math.max(3, (x.income / max) * 100)}%` }}
              title={"Revenus : " + moneyLabel(x.income, a.currency)}
            />
            <div
              className="bar expense"
              style={{ height: `${Math.max(3, (x.expense / max) * 100)}%` }}
              title={"Dépenses : " + moneyLabel(x.expense, a.currency)}
            />
          </div>
          <small>
            {x.month.slice(5)}/{x.month.slice(2, 4)}
          </small>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      icon="bar_chart"
      text="Les graphiques apparaîtront après vos premières transactions."
    />
  );
}
function CategoryBreakdown({ a }: { a: Analytics }) {
  const total = a.categories.reduce((s, c) => s + c.amount_cents, 0);
  return a.categories.length ? (
    <div className="category-bars">
      {a.categories.slice(0, 7).map((c) => (
        <div key={c.name}>
          <div className="spread">
            <span>
              <i className="dot" style={{ background: c.color || "#64748b" }} />
              {c.name || "Autre"}
            </span>
            <strong>{moneyLabel(c.amount_cents, a.currency)}</strong>
          </div>
          <div className="progress">
            <span
              style={{
                width: `${(c.amount_cents / total) * 100}%`,
                background: c.color || "#64748b",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty icon="pie_chart" text="Aucune dépense sur cette période." />
  );
}
export function Dashboard() {
  const { user, accounts } = useFinance(),
    range = monthRange(new Date(), user.month_start),
    {
      data: a,
      error,
      loading,
    } = useLoad<Analytics>(
      `/analytics?from=${range.from}&to=${range.to}&currency=${user.currency}`,
    ),
    { data: t } = useLoad<{ items: Transaction[] }>(`/transactions?limit=5`);
  const previousDay = new Date(range.from + "T12:00:00");
  previousDay.setDate(previousDay.getDate() - 1);
  const previousRange = monthRange(previousDay, user.month_start),
    { data: previous } = useLoad<Analytics>(
      `/analytics?from=${previousRange.from}&to=${previousRange.to}&currency=${user.currency}`,
    );
  const income = a ? sumType(a, "income") : 0,
    expense = a ? sumType(a, "expense") : 0,
    change = (current: number, old: number) =>
      old
        ? `${Math.round(((current - old) / old) * 100)} % vs mois précédent`
        : current
          ? "Nouveau ce mois"
          : "0 % vs mois précédent",
    balance = accounts
      .filter((x) => x.currency === user.currency)
      .reduce((s, x) => s + x.balance_cents, 0);
  return (
    <>
      <Title
        eyebrow="VOTRE TRÉSORERIE"
        title={`Bonjour, ${user.name.split(" ")[0]}.`}
        desc={`Voici l’état de vos finances au ${formatDate(iso(new Date()))}.`}
        action={
          <Link to="/transactions/new" className="primary">
            <Icon name="add" /> Nouvelle transaction
          </Link>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="metrics">
        {loading ? (
          <Loading />
        ) : (
          <>
            <Metric
              label="Solde disponible"
              value={moneyLabel(balance, user.currency)}
              icon="account_balance"
              footer={`${accounts.filter((x) => x.currency === user.currency).length} compte(s) en ${user.currency}`}
            />
            <Metric
              label="Revenus du mois"
              value={moneyLabel(income, user.currency)}
              icon="trending_up"
              tone="green"
              footer={change(
                income,
                previous ? sumType(previous, "income") : 0,
              )}
            />
            <Metric
              label="Dépenses du mois"
              value={moneyLabel(expense, user.currency)}
              icon="trending_down"
              tone="red"
              footer={change(
                expense,
                previous ? sumType(previous, "expense") : 0,
              )}
            />
            <Metric
              label="Épargne du mois"
              value={moneyLabel(income - expense, user.currency)}
              icon="savings"
              tone="blue"
              footer={`Taux d’épargne : ${savingsRate(income, expense)} %`}
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <div className="section-heading">
            <div>
              <h2>Flux de trésorerie mensuel</h2>
              <p>Revenus et dépenses sur les derniers mois</p>
            </div>
            <div className="legend">
              <span>
                <i className="dot green-bg" />
                Revenus
              </span>
              <span>
                <i className="dot red-bg" />
                Dépenses
              </span>
            </div>
          </div>
          {a ? <Chart a={a} /> : <Loading />}
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>Répartition des dépenses</h2>
            <Link to="/analyses" className="text-button">
              Voir l’analyse
            </Link>
          </div>
          {a ? <CategoryBreakdown a={a} /> : <Loading />}
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Dernières transactions</h2>
              <p>Activité sur tous vos comptes</p>
            </div>
            <Link className="text-button" to="/transactions">
              Voir tout l’historique →
            </Link>
          </div>
          {t?.items.length ? (
            <TransactionRows items={t.items} />
          ) : (
            <Empty
              icon="receipt_long"
              text="Aucune transaction pour le moment."
              link="/transactions/new"
              label="Ajouter une transaction"
            />
          )}
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>Mes comptes</h2>
            <Link className="text-button" to="/accounts">
              Gérer
            </Link>
          </div>
          {accounts.length ? (
            accounts.slice(0, 5).map((x) => (
              <div className="account-mini" key={x.id}>
                <span className="metric-icon">
                  <Icon name={x.icon} />
                </span>
                <div>
                  <strong>{x.name}</strong>
                  <small>{x.type.replace("_", " ")}</small>
                </div>
                <strong>{moneyLabel(x.balance_cents, x.currency)}</strong>
              </div>
            ))
          ) : (
            <Empty
              icon="account_balance_wallet"
              text="Créez votre premier compte pour commencer."
              link="/accounts"
              label="Créer un compte"
            />
          )}
        </section>
      </div>
    </>
  );
}

export function TransactionsPage() {
  const { accounts, categories, user, flash, reload } = useFinance(),
    [filters, setFilters] = useState({
      search: "",
      type: "",
      account: "",
      category: "",
      from: "",
      to: "",
      min: "",
      max: "",
      sort: "newest",
      page: 1,
    }),
    [refresh, setRefresh] = useState(0);
  const query = new URLSearchParams(
      Object.entries(filters)
        .filter(([, v]) => v !== "" && v !== 0)
        .map(([k, v]) => [k, String(v)]),
    ).toString(),
    { data, error, loading } = useLoad<{
      items: Transaction[];
      total: number;
      pages: number;
    }>(`/transactions?${query}`, refresh);
  const change = (key: string, value: string | number) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  async function remove(id: string) {
    if (!confirmDelete("cette transaction")) return;
    try {
      await send(`/transactions/${id}`, "DELETE");
      await reload();
      setRefresh((v) => v + 1);
      flash("Transaction supprimée.");
    } catch (e) {
      flash((e as Error).message, true);
    }
  }
  return (
    <>
      <Title
        eyebrow="HISTORIQUE FINANCIER"
        title="Transactions"
        desc="Retrouvez, filtrez et modifiez toutes vos opérations."
        action={
          <Link className="primary" to="/transactions/new">
            <Icon name="add" /> Nouvelle transaction
          </Link>
        }
      />
      <div className="card filter-card">
        <div className="filter-grid">
          <label>
            Rechercher
            <input
              placeholder="Description, catégorie, compte…"
              value={filters.search}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <label>
            Type
            <select
              value={filters.type}
              onChange={(e) => change("type", e.target.value)}
            >
              <option value="">Tous</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
              <option value="transfer">Transferts</option>
            </select>
          </label>
          <label>
            Compte
            <select
              value={filters.account}
              onChange={(e) => change("account", e.target.value)}
            >
              <option value="">Tous</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={filters.category}
              onChange={(e) => change("category", e.target.value)}
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Du
            <input
              type="date"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
          <label>
            Montant min.
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.min}
              onChange={(e) => change("min", e.target.value)}
            />
          </label>
          <label>
            Montant max.
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.max}
              onChange={(e) => change("max", e.target.value)}
            />
          </label>
          <label>
            Trier
            <select
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="newest">Plus récent</option>
              <option value="oldest">Plus ancien</option>
              <option value="amount_asc">Montant croissant</option>
              <option value="amount_desc">Montant décroissant</option>
            </select>
          </label>
        </div>
        <div className="quick-filters">
          <button
            onClick={() => {
              const d = iso(new Date());
              setFilters((f) => ({ ...f, from: d, to: d, page: 1 }));
            }}
          >
            Aujourd’hui
          </button>
          <button
            onClick={() => {
              const d = new Date();
              const start = new Date(d);
              start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
              setFilters((f) => ({
                ...f,
                from: iso(start),
                to: iso(d),
                page: 1,
              }));
            }}
          >
            Cette semaine
          </button>
          <button
            onClick={() => {
              const r = monthRange();
              setFilters((f) => ({ ...f, ...r, page: 1 }));
            }}
          >
            Ce mois
          </button>
          <button
            onClick={() =>
              setFilters({
                search: "",
                type: "",
                account: "",
                category: "",
                from: "",
                to: "",
                min: "",
                max: "",
                sort: "newest",
                page: 1,
              })
            }
          >
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="card">
        <div className="section-heading">
          <h2>{data?.total || 0} opération(s)</h2>
          <small>Devise principale : {user.currency}</small>
        </div>
        {error && <ErrorBox message={error} />}{" "}
        {loading ? (
          <Loading />
        ) : data?.items.length ? (
          <>
            <TransactionRows items={data.items} />
            <div className="pagination">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Précédent
              </button>
              <span>
                Page {filters.page} / {data.pages}
              </span>
              <button
                disabled={filters.page >= data.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Suivant
              </button>
            </div>
            <div className="delete-list">
              {data.items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => remove(t.id)}
                  aria-label={"Supprimer " + t.description}
                >
                  Supprimer {t.description}
                </button>
              ))}
            </div>
          </>
        ) : (
          <Empty
            text="Aucune transaction ne correspond à vos filtres."
            link="/transactions/new"
            label="Ajouter une transaction"
          />
        )}
      </div>
    </>
  );
}

export function TransactionForm() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { accounts, categories, user, flash, reload } = useFinance(),
    [type, setType] = useState<Flow>("expense"),
    [amount, setAmount] = useState(""),
    [cur, setCur] = useState<Currency>(user.currency),
    [accountId, setAccountId] = useState(""),
    [targetId, setTargetId] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [description, setDescription] = useState(""),
    [day, setDay] = useState(iso(new Date())),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const activeAccounts = accounts.filter((a) => a.active && a.currency === cur),
    validCategories = categories.filter((c) => c.type === type);
  useEffect(() => {
    if (!id) return;
    api<Transaction>(`/transactions/${id}`)
      .then((t) => {
        setType(t.type);
        setAmount(String(t.amount_cents / 100));
        setCur(t.currency);
        setAccountId(t.account_id);
        setTargetId(t.target_account_id || "");
        setCategoryId(t.category_id || "");
        setDescription(t.description);
        setDay(t.transaction_date);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!accountId || !activeAccounts.some((a) => a.id === accountId))
      setAccountId(activeAccounts[0]?.id || "");
  }, [cur, accounts]);
  useEffect(() => {
    if (
      type !== "transfer" &&
      !validCategories.some((c) => c.id === categoryId)
    )
      setCategoryId(validCategories[0]?.id || "");
  }, [type, categories]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      Number(amount) <= 0 ||
      !accountId ||
      (type === "transfer" && (!targetId || targetId === accountId))
    ) {
      setError("Vérifiez le montant et les comptes sélectionnés.");
      return;
    }
    setBusy(true);
    try {
      await send(`/transactions${id ? "/" + id : ""}`, id ? "PUT" : "POST", {
        type,
        amount: Number(amount),
        currency: cur,
        account_id: accountId,
        target_account_id: targetId,
        category_id: categoryId,
        description,
        transaction_date: day,
      });
      await reload();
      flash(id ? "Transaction modifiée." : "Transaction enregistrée.");
      navigate("/transactions");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="ÉCRITURE FINANCIÈRE"
        title={id ? "Modifier la transaction" : "Saisie d’une transaction"}
        desc="Enregistrez un revenu, une dépense ou un transfert entre comptes."
      />
      <div className="form-layout">
        <form className="card form-card stack" onSubmit={save}>
          <div className="segment flow-tabs">
            {(
              [
                ["expense", "Dépense"],
                ["income", "Revenu"],
                ["transfer", "Transfert"],
              ] as const
            ).map(([v, l]) => (
              <button
                type="button"
                key={v}
                className={type === v ? "active" : ""}
                onClick={() => setType(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>
              Montant *
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label>
              Devise *
              <select
                value={cur}
                onChange={(e) => {
                  setCur(e.target.value as Currency);
                  setAccountId("");
                  setTargetId("");
                }}
              >
                <option>USD</option>
                <option>CDF</option>
              </select>
            </label>
            <label>
              Compte {type === "transfer" ? "source" : ""} *
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Sélectionner</option>
                {activeAccounts.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {type === "transfer" ? (
              <label>
                Compte destinataire *
                <select
                  required
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">Sélectionner</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label>
                Catégorie *
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Sélectionner</option>
                  {validCategories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Date de l’opération *
              <input
                required
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          </div>
          <label>
            Description *
            <textarea
              required
              maxLength={250}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex. Courses de la semaine"
            />
          </label>
          {!accounts.length && (
            <div className="notice">
              Créez d’abord un compte financier.{" "}
              <Link to="/accounts">Gérer mes comptes</Link>
            </div>
          )}
          {error && <ErrorBox message={error} />}
          <div className="form-actions">
            <Link className="secondary-button" to="/transactions">
              Annuler
            </Link>
            <button className="primary" disabled={busy || !accounts.length}>
              {busy
                ? "Enregistrement…"
                : id
                  ? "Enregistrer les modifications"
                  : "Enregistrer la transaction"}
            </button>
          </div>
        </form>
        <aside className="card preview">
          <span className="eyebrow">APERÇU EN DIRECT</span>
          <div className="preview-box">
            <Icon
              name={
                type === "expense"
                  ? "trending_down"
                  : type === "income"
                    ? "trending_up"
                    : "swap_horiz"
              }
            />
            <h2>
              {type === "expense"
                ? "Dépense"
                : type === "income"
                  ? "Revenu"
                  : "Transfert"}
            </h2>
            <strong className={type === "expense" ? "negative" : "positive"}>
              {type === "expense" ? "−" : type === "income" ? "+" : ""}
              {moneyLabel(Math.round(Number(amount || 0) * 100), cur)}
            </strong>
            <p>{description || "Description de l’opération"}</p>
            <small>
              {accountId
                ? accounts.find((a) => a.id === accountId)?.name
                : "Sélectionnez un compte"}
            </small>
          </div>
          <p className="muted">
            Les transferts ne modifient pas vos revenus ni vos dépenses globaux.
            Les comptes doivent utiliser la même devise.
          </p>
        </aside>
      </div>
    </>
  );
}
