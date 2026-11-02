import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFinance } from "./App";
import {
  api,
  send,
  convertMoney,
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
  Goal,
  Recurring,
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
  eyebrow: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) => (
  <div className="page-title">
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="muted">{desc}</p>
    </div>
    {action}
  </div>
);
const Empty = ({ text }: { text: string }) => (
  <div className="empty">
    <Icon name="inbox" />
    <p>{text}</p>
  </div>
);
const Confirm = (text: string) =>
  window.confirm(`Supprimer ${text} ? Cette action est définitive.`);
function useRemote<T>(url: string, refresh: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<T>(url)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [url, refresh]);
  return { data, error };
}
const amount = (c: number, cur: Currency) => formatMoney(c, cur);
const selected = (v: string, arr: { id: string }[]) =>
  arr.some((x) => x.id === v);

export function AccountsPage() {
  const { accounts, user, reload, flash } = useFinance(),
    [editing, setEditing] = useState<Account | null>(null),
    [name, setName] = useState(""),
    [type, setType] = useState("cash"),
    [cur, setCur] = useState<Currency>("USD"),
    [opening, setOpening] = useState("0"),
    [busy, setBusy] = useState(false);
  function edit(a: Account) {
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setCur(a.currency);
    setOpening(String(a.opening_cents / 100));
  }
  function clear() {
    setEditing(null);
    setName("");
    setType("cash");
    setCur("USD");
    setOpening("0");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        "/accounts" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          name,
          type,
          currency: cur,
          openingBalance: Number(opening),
          icon:
            type === "cash"
              ? "payments"
              : type === "mobile_money"
                ? "smartphone"
                : "account_balance",
          active: editing ? Boolean(editing.active) : true,
        },
      );
      await reload();
      clear();
      flash("Compte enregistré.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(a: Account) {
    if (!Confirm("ce compte")) return;
    try {
      await send("/accounts/" + a.id, "DELETE");
      await reload();
      flash("Compte supprimé.");
    } catch (e) {
      flash((e as Error).message, true);
    }
  }
  return (
    <>
      <Title
        eyebrow="SOURCES D’ARGENT"
        title="Comptes financiers"
        desc="Suivez vos espèces, banques et portefeuilles mobiles."
      />
      <div className="two-col">
        <div className="stack">
          {accounts.length ? (
            accounts.map((a) => (
              <div className="card account-card" key={a.id}>
                <div className="account-head">
                  <span className="metric-icon">
                    <Icon name={a.icon} />
                  </span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {a.type.replace("_", " ")} · {a.currency} ·{" "}
                      {a.active ? "Actif" : "Inactif"}
                    </small>
                  </div>
                </div>
                <strong className="account-balance">
                  {amount(a.balance_cents, a.currency)}
                </strong>
                {a.currency !== user.currency && user.usd_cdf_rate ? (
                  <small className="muted">
                    ≈ {amount(
                      convertMoney(
                        a.balance_cents,
                        a.currency,
                        user.currency,
                        user.usd_cdf_rate,
                      )!,
                      user.currency,
                    )} au taux manuel
                  </small>
                ) : null}
                <div className="card-actions">
                  <button onClick={() => edit(a)}>Modifier</button>
                  <button onClick={() => remove(a)}>Supprimer</button>
                  {a.active ? (
                    <button
                      onClick={async () => {
                        try {
                          await send("/accounts/" + a.id, "PUT", {
                            name: a.name,
                            type: a.type,
                            icon: a.icon,
                            active: false,
                          });
                          await reload();
                        } catch (e) {
                          flash((e as Error).message, true);
                        }
                      }}
                    >
                      Désactiver
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Empty text="Aucun compte. Créez votre première source d’argent." />
          )}
        </div>
        <form className="card form-card stack" onSubmit={save}>
          <h2>{editing ? "Modifier le compte" : "Nouveau compte"}</h2>
          <label>
            Nom *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Cash, M-Pesa, Banque"
            />
          </label>
          <label>
            Type *
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="cash">Espèces</option>
              <option value="bank">Banque</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="wallet">Portefeuille électronique</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label>
            Devise *
            <select
              disabled={!!editing}
              value={cur}
              onChange={(e) => setCur(e.target.value as Currency)}
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
          {!editing && (
            <label>
              Solde initial
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </label>
          )}
          <div className="form-actions">
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={clear}
              >
                Annuler
              </button>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function CategoriesPage() {
  const { categories, reload, flash } = useFinance(),
    [editing, setEditing] = useState<Category | null>(null),
    [name, setName] = useState(""),
    [type, setType] = useState<"income" | "expense">("expense"),
    [icon, setIcon] = useState("category"),
    [color, setColor] = useState("#006c49"),
    [busy, setBusy] = useState(false);
  function edit(c: Category) {
    setEditing(c);
    setName(c.name);
    setType(c.type);
    setIcon(c.icon);
    setColor(c.color);
  }
  function clear() {
    setEditing(null);
    setName("");
    setIcon("category");
    setColor("#006c49");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        "/categories" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        { name, type, icon, color },
      );
      await reload();
      clear();
      flash("Catégorie enregistrée.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="ORGANISATION"
        title="Catégories"
        desc="Classez vos revenus et dépenses selon vos besoins."
      />
      <div className="two-col">
        <div className="stack">
          {(["expense", "income"] as const).map((t) => (
            <section className="card" key={t}>
              <h2>{t === "expense" ? "Dépenses" : "Revenus"}</h2>
              <div className="category-list">
                {categories
                  .filter((c) => c.type === t)
                  .map((c) => (
                    <div className="category-item" key={c.id}>
                      <span
                        className="category-icon"
                        style={{ background: c.color + "22", color: c.color }}
                      >
                        <Icon name={c.icon} />
                      </span>
                      <strong>{c.name}</strong>
                      <button className="text-button" onClick={() => edit(c)}>
                        Modifier
                      </button>
                      <button
                        className="text-button danger"
                        onClick={async () => {
                          if (!Confirm("cette catégorie")) return;
                          try {
                            await send("/categories/" + c.id, "DELETE");
                            await reload();
                            flash("Catégorie supprimée.");
                          } catch (e) {
                            flash((e as Error).message, true);
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <form className="card form-card stack" onSubmit={save}>
          <h2>{editing ? "Modifier la catégorie" : "Nouvelle catégorie"}</h2>
          <label>
            Nom *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Type *
            <select
              disabled={!!editing}
              value={type}
              onChange={(e) => setType(e.target.value as "income" | "expense")}
            >
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
          </label>
          <label>
            Icône Material Symbols *
            <input
              required
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </label>
          <label>
            Couleur *
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <div className="form-actions">
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={clear}
              >
                Annuler
              </button>
            )}
            <button className="primary" disabled={busy}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function BudgetsPage() {
  const { categories, user, flash } = useFinance(),
    [refresh, setRefresh] = useState(0),
    { data: budgets, error } = useRemote<(Budget & { spent_cents: number })[]>(
      "/budgets/summary",
      refresh,
    ),
    range = monthRange(),
    { data: a } = useRemote<Analytics>(
      `/analytics?from=${range.from}&to=${range.to}&currency=${user.currency}`,
      refresh,
    ),
    [editing, setEditing] = useState<Budget | null>(null),
    [categoryId, setCategoryId] = useState(""),
    [value, setValue] = useState(""),
    [cur, setCur] = useState<Currency>(user.currency),
    [period, setPeriod] = useState<"monthly" | "global">("monthly"),
    [start, setStart] = useState(range.from),
    [end, setEnd] = useState(""),
    [busy, setBusy] = useState(false);
  function edit(b: Budget) {
    setEditing(b);
    setCategoryId(b.category_id || "");
    setValue(String(b.amount_cents / 100));
    setCur(b.currency);
    setPeriod(b.period);
    setStart(b.start_date);
    setEnd(b.end_date || "");
  }
  function clear() {
    setEditing(null);
    setCategoryId("");
    setValue("");
    setEnd("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        "/budgets" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          category_id: categoryId || null,
          amount: Number(value),
          currency: cur,
          period,
          start_date: start,
          end_date: end || null,
        },
      );
      setRefresh((x) => x + 1);
      clear();
      flash("Budget enregistré.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="PLANIFICATION"
        title="Budgets"
        desc="Définissez vos plafonds et suivez leur consommation."
      />
      <div className="two-col">
        <div className="cards-grid">
          {error && <div className="error">{error}</div>}
          {budgets?.length ? (
            budgets.map((b) => {
              const cat = categories.find((c) => c.id === b.category_id),
                used = b.spent_cents,
                percent = Math.round((used / b.amount_cents) * 100),
                state =
                  percent >= 100
                    ? "critical"
                    : percent >= 80
                      ? "warning"
                      : "normal";
              return (
                <div className="card budget-card" key={b.id}>
                  <div className="spread">
                    <span className="metric-icon">
                      <Icon name={cat?.icon || "account_balance_wallet"} />
                    </span>
                    <span className={"status " + state}>{percent}%</span>
                  </div>
                  <h2>{cat?.name || "Budget global"}</h2>
                  <div className="spread">
                    <strong>{amount(used, b.currency)}</strong>
                    <span className="muted">
                      / {amount(b.amount_cents, b.currency)}
                    </span>
                  </div>
                  <div className={"progress " + state}>
                    <span style={{ width: Math.min(100, percent) + "%" }} />
                  </div>
                  <small>
                    Reste :{" "}
                    {amount(Math.max(0, b.amount_cents - used), b.currency)} ·{" "}
                    {b.period === "monthly" ? "Mensuel" : "Global"}
                  </small>
                  <div className="card-actions">
                    <button onClick={() => edit(b)}>Modifier</button>
                    <button
                      onClick={async () => {
                        if (!Confirm("ce budget")) return;
                        try {
                          await send("/budgets/" + b.id, "DELETE");
                          setRefresh((x) => x + 1);
                          flash("Budget supprimé.");
                        } catch (e) {
                          flash((e as Error).message, true);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty text="Aucun budget défini pour le moment." />
          )}
        </div>
        <form className="card form-card stack" onSubmit={save}>
          <h2>{editing ? "Modifier le budget" : "Nouveau budget"}</h2>
          <label>
            Catégorie
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Toutes les dépenses</option>
              {categories
                .filter((c) => c.type === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Montant *
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            Devise
            <select
              value={cur}
              onChange={(e) => setCur(e.target.value as Currency)}
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
          <label>
            Période
            <select
              value={period}
              onChange={(e) =>
                setPeriod(e.target.value as "monthly" | "global")
              }
            >
              <option value="monthly">Mensuel</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label>
            Date de début
            <input
              required
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          {period === "global" && (
            <label>
              Date de fin
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          )}
          <div className="form-actions">
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={clear}
              >
                Annuler
              </button>
            )}
            <button className="primary" disabled={busy}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function GoalsPage() {
  const { user, flash } = useFinance(),
    [refresh, setRefresh] = useState(0),
    { data: goals, error } = useRemote<Goal[]>("/goals", refresh),
    [editing, setEditing] = useState<Goal | null>(null),
    [name, setName] = useState(""),
    [target, setTarget] = useState(""),
    [current, setCurrent] = useState("0"),
    [cur, setCur] = useState<Currency>(user.currency),
    [day, setDay] = useState(""),
    [status, setStatus] = useState("active"),
    [busy, setBusy] = useState(false);
  function edit(g: Goal) {
    setEditing(g);
    setName(g.name);
    setTarget(String(g.target_cents / 100));
    setCurrent(String(g.current_cents / 100));
    setCur(g.currency);
    setDay(g.target_date || "");
    setStatus(g.status);
  }
  function clear() {
    setEditing(null);
    setName("");
    setTarget("");
    setCurrent("0");
    setDay("");
    setStatus("active");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        "/goals" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          name,
          amount: Number(target),
          current_amount: Number(current),
          currency: cur,
          target_date: day || null,
          status,
        },
      );
      setRefresh((x) => x + 1);
      clear();
      flash("Objectif enregistré.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="ÉPARGNE"
        title="Objectifs financiers"
        desc="Donnez un cap à votre épargne et suivez vos progrès."
      />
      <div className="two-col">
        <div className="cards-grid">
          {error && <div className="error">{error}</div>}
          {goals?.length ? (
            goals.map((g) => (
              <div className="card goal-card" key={g.id}>
                <span className="metric-icon green">
                  <Icon name="savings" />
                </span>
                <h2>{g.name}</h2>
                <div className="spread">
                  <strong>{amount(g.current_cents, g.currency)}</strong>
                  <span className="muted">
                    / {amount(g.target_cents, g.currency)}
                  </span>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width:
                        Math.min(
                          100,
                          (g.current_cents / g.target_cents) * 100,
                        ) + "%",
                    }}
                  />
                </div>
                <small>
                  {Math.round((g.current_cents / g.target_cents) * 100)} % ·{" "}
                  {g.status === "completed"
                    ? "Terminé"
                    : g.status === "paused"
                      ? "En pause"
                      : "En cours"}
                  {g.target_date ? " · Cible " + formatDate(g.target_date) : ""}
                </small>
                <div className="card-actions">
                  <button onClick={() => edit(g)}>Gérer</button>
                  <button
                    onClick={async () => {
                      if (!Confirm("cet objectif")) return;
                      try {
                        await send("/goals/" + g.id, "DELETE");
                        setRefresh((x) => x + 1);
                        flash("Objectif supprimé.");
                      } catch (e) {
                        flash((e as Error).message, true);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty text="Aucun objectif. Créez votre premier projet d’épargne." />
          )}
        </div>
        <form className="card form-card stack" onSubmit={save}>
          <h2>{editing ? "Modifier l’objectif" : "Nouvel objectif"}</h2>
          <label>
            Nom *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Fonds d’urgence"
            />
          </label>
          <label>
            Montant cible *
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label>
            Déjà épargné
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            Devise
            <select
              value={cur}
              onChange={(e) => setCur(e.target.value as Currency)}
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
          <label>
            Date cible
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            Statut
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">En cours</option>
              <option value="paused">En pause</option>
              <option value="completed">Terminé</option>
            </select>
          </label>
          <div className="form-actions">
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={clear}
              >
                Annuler
              </button>
            )}
            <button className="primary" disabled={busy}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
