import { useEffect, useState, type FormEvent } from "react";
import { useFinance } from "./App";
import { canPromptInstall, installApp, isInstalled } from "./install";
import { PasswordInput } from "./PasswordInput";
import {
  api,
  send,
  formatMoney,
  iso,
  monthRange,
  sumType,
  savingsRate,
} from "./lib";
import type { Analytics, Category, Currency, Recurring, User } from "./types";
const Icon = ({ name }: { name: string }) => (
  <span className="material-symbols-outlined" aria-hidden="true">
    {name}
  </span>
);
const Title = ({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) => (
  <div className="page-title">
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="muted">{desc}</p>
    </div>
  </div>
);
const amount = (v: number, c: Currency) => formatMoney(v, c);
function useData<T>(url: string, refresh = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<T>(url)
      .then((x) => {
        if (live) setData(x);
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
const ranges = {
  week: () => {
    const d = new Date(),
      s = new Date(d);
    s.setDate(d.getDate() - 6);
    return { from: iso(s), to: iso(d) };
  },
  month: () => monthRange(),
  year: () => ({
    from: `${new Date().getFullYear()}-01-01`,
    to: iso(new Date()),
  }),
};
function Period({
  period,
  setPeriod,
  from,
  setFrom,
  to,
  setTo,
}: {
  period: string;
  setPeriod: (x: string) => void;
  from: string;
  setFrom: (x: string) => void;
  to: string;
  setTo: (x: string) => void;
}) {
  return (
    <div className="period">
      <div className="segment">
        {[
          ["week", "Semaine"],
          ["month", "Mois"],
          ["year", "Année"],
          ["custom", "Personnalisé"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={period === v ? "active" : ""}
            onClick={() => {
              setPeriod(v);
              if (v !== "custom") {
                const r = ranges[v as "week" | "month" | "year"]();
                setFrom(r.from);
                setTo(r.to);
              }
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <>
          <input
            aria-label="Date de début"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            aria-label="Date de fin"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
function AnalysisContent({ a }: { a: Analytics }) {
  const income = sumType(a, "income"),
    expense = sumType(a, "expense"),
    total = a.categories.reduce((s, x) => s + x.amount_cents, 0),
    months = Array.from(new Set(a.monthly.map((x) => x.month)))
      .sort()
      .slice(-12),
    max = Math.max(1, ...a.monthly.map((x) => x.amount_cents));
  return (
    <>
      <div className="metrics">
        <div className="metric card">
          <span className="eyebrow">REVENUS</span>
          <strong>{amount(income, a.currency)}</strong>
          <small>Période sélectionnée</small>
        </div>
        <div className="metric card">
          <span className="eyebrow">DÉPENSES</span>
          <strong>{amount(expense, a.currency)}</strong>
          <small>Période sélectionnée</small>
        </div>
        <div className="metric card">
          <span className="eyebrow">ÉPARGNE NETTE</span>
          <strong>{amount(income - expense, a.currency)}</strong>
          <small>Taux : {savingsRate(income, expense)} %</small>
        </div>
        <div className="metric card">
          <span className="eyebrow">MOYENNE QUOTIDIENNE</span>
          <strong>
            {amount(
              expense /
                Math.max(
                  1,
                  Math.floor(
                    (new Date(a.to).getTime() - new Date(a.from).getTime()) /
                      864e5,
                  ) + 1,
                ),
              a.currency,
            )}
          </strong>
          <small>Dépenses / jour</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <h2>Évolution mensuelle</h2>
          {months.length ? (
            <div className="bar-chart">
              {months.map((m) => {
                const inc =
                    a.monthly.find((x) => x.month === m && x.type === "income")
                      ?.amount_cents || 0,
                  exp =
                    a.monthly.find((x) => x.month === m && x.type === "expense")
                      ?.amount_cents || 0;
                return (
                  <div className="bar-group" key={m}>
                    <div className="bars">
                      <div
                        className="bar income"
                        style={{ height: Math.max(2, (inc / max) * 100) + "%" }}
                        title={"Revenus " + amount(inc, a.currency)}
                      />
                      <div
                        className="bar expense"
                        style={{ height: Math.max(2, (exp / max) * 100) + "%" }}
                        title={"Dépenses " + amount(exp, a.currency)}
                      />
                    </div>
                    <small>
                      {m.slice(5)}/{m.slice(2, 4)}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucune donnée à afficher.</div>
          )}
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
        </section>
        <section className="card">
          <h2>Dépenses par catégorie</h2>
          {a.categories.length ? (
            a.categories.map((c) => (
              <div className="category-line" key={c.name}>
                <div className="spread">
                  <span>
                    <i
                      className="dot"
                      style={{ background: c.color || "#64748b" }}
                    />
                    {c.name || "Autre"}
                  </span>
                  <strong>{amount(c.amount_cents, a.currency)}</strong>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: (c.amount_cents / total) * 100 + "%",
                      background: c.color || "#64748b",
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Aucune dépense sur cette période.</div>
          )}
        </section>
      </div>
      <div className="card insight">
        <Icon name="lightbulb" />
        <div>
          <strong>Poste de dépense principal</strong>
          <p>
            {a.categories[0]
              ? `${a.categories[0].name} · ${amount(a.categories[0].amount_cents, a.currency)} (${Math.round((a.categories[0].amount_cents / total) * 100)} % des dépenses)`
              : "Aucune dépense enregistrée."}
          </p>
        </div>
      </div>
    </>
  );
}
export function AnalyticsPage() {
  const { user } = useFinance(),
    [period, setPeriod] = useState("month"),
    [from, setFrom] = useState(monthRange().from),
    [to, setTo] = useState(monthRange().to),
    [cur, setCur] = useState<Currency>(user.currency),
    { data: a, error } = useData<Analytics>(
      `/analytics?from=${from}&to=${to}&currency=${cur}`,
    );
  return (
    <>
      <Title
        eyebrow="VUE FINANCIÈRE"
        title="Analyses & graphiques"
        desc="Suivez l’évolution de vos flux et les principaux postes de dépense."
      />
      <div className="card filter-card">
        <Period {...{ period, setPeriod, from, setFrom, to, setTo }} />
        <label>
          Devise{" "}
          <select
            value={cur}
            onChange={(e) => setCur(e.target.value as Currency)}
          >
            <option>USD</option>
            <option>CDF</option>
          </select>
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      {a ? (
        <AnalysisContent a={a} />
      ) : (
        <div className="skeleton-list">
          <div />
          <div />
          <div />
        </div>
      )}
    </>
  );
}
export function ReportsPage() {
  const { user } = useFinance(),
    [period, setPeriod] = useState("month"),
    [from, setFrom] = useState(monthRange().from),
    [to, setTo] = useState(monthRange().to),
    [cur, setCur] = useState<Currency>(user.currency),
    { data: a, error } = useData<Analytics>(
      `/analytics?from=${from}&to=${to}&currency=${cur}`,
    );
  return (
    <>
      <Title
        eyebrow="DOCUMENTS FINANCIERS"
        title="Rapports"
        desc="Consultez vos résultats par période et exportez vos opérations."
      />
      <div className="card filter-card">
        <Period {...{ period, setPeriod, from, setFrom, to, setTo }} />
        <label>
          Devise{" "}
          <select
            value={cur}
            onChange={(e) => setCur(e.target.value as Currency)}
          >
            <option>USD</option>
            <option>CDF</option>
          </select>
        </label>
        <div className="report-actions">
          <a
            className="primary"
            href={`/api/reports/csv?from=${from}&to=${to}`}
            download
          >
            <Icon name="download" /> Exporter CSV
          </a>
          <button className="secondary-button" onClick={() => window.print()}>
            <Icon name="picture_as_pdf" /> Imprimer / PDF
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {a ? (
        <>
          <div className="report-heading card">
            <div>
              <span className="eyebrow">RAPPORT FINANCEFLOW</span>
              <h2>
                Du {from} au {to}
              </h2>
              <p>
                Montants en {cur}. Les autres devises ne sont pas converties
                automatiquement.
              </p>
            </div>
            <Icon name="account_balance_wallet" />
          </div>
          <AnalysisContent a={a} />
        </>
      ) : (
        <div className="skeleton-list">
          <div />
          <div />
          <div />
        </div>
      )}
    </>
  );
}
export function RecurringPage() {
  const { user, accounts, categories, flash } = useFinance(),
    [refresh, setRefresh] = useState(0),
    { data: items, error } = useData<Recurring[]>("/recurring", refresh),
    [editing, setEditing] = useState<Recurring | null>(null),
    [accountId, setAccountId] = useState(""),
    [type, setType] = useState<"income" | "expense">("expense"),
    [categoryId, setCategoryId] = useState(""),
    [value, setValue] = useState(""),
    [cur, setCur] = useState<Currency>(user.currency),
    [description, setDescription] = useState(""),
    [frequency, setFrequency] = useState("monthly"),
    [day, setDay] = useState(iso(new Date())),
    [busy, setBusy] = useState(false);
  const cats = categories.filter((c) => c.type === type);
  function edit(r: Recurring) {
    setEditing(r);
    setAccountId(r.account_id);
    setType(r.type);
    setCategoryId(r.category_id);
    setValue(String(r.amount_cents / 100));
    setCur(r.currency);
    setDescription(r.description);
    setFrequency(r.frequency);
    setDay(r.next_date);
  }
  function clear() {
    setEditing(null);
    setAccountId("");
    setCategoryId("");
    setValue("");
    setDescription("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        "/recurring" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          account_id: accountId,
          type,
          category_id: categoryId,
          amount: Number(value),
          currency: cur,
          description,
          frequency,
          next_date: day,
          active: editing ? Boolean(editing.active) : true,
        },
      );
      setRefresh((x) => x + 1);
      clear();
      flash("Récurrence enregistrée.");
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
        title="Transactions récurrentes"
        desc="Préparez vos opérations périodiques. Leur exécution automatique sera ajoutée ultérieurement."
      />
      <div className="two-col">
        <div className="stack">
          {error && <div className="error">{error}</div>}
          {items?.length ? (
            items.map((r) => (
              <div className="card recurring-card" key={r.id}>
                <div className="spread">
                  <strong>{r.description}</strong>
                  <span className="status normal">
                    {r.active ? "Actif" : "Inactif"}
                  </span>
                </div>
                <p>
                  {r.type === "income" ? "Revenu" : "Dépense"} · {r.frequency} ·{" "}
                  {amount(r.amount_cents, r.currency)}
                </p>
                <small>Prochaine date prévue : {r.next_date}</small>
                <div className="card-actions">
                  <button onClick={() => edit(r)}>Modifier</button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Supprimer cette récurrence ?"))
                        return;
                      try {
                        await send("/recurring/" + r.id, "DELETE");
                        setRefresh((x) => x + 1);
                        flash("Récurrence supprimée.");
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
            <div className="empty">Aucune récurrence définie.</div>
          )}
        </div>
        <form className="card form-card stack" onSubmit={save}>
          <h2>{editing ? "Modifier la récurrence" : "Nouvelle récurrence"}</h2>
          <label>
            Type
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as "income" | "expense");
                setCategoryId("");
              }}
            >
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
          </label>
          <label>
            Devise
            <select
              value={cur}
              onChange={(e) => {
                setCur(e.target.value as Currency);
                setAccountId("");
              }}
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
          <label>
            Compte
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Sélectionner</option>
              {accounts
                .filter((a) => a.currency === cur)
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Catégorie
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sélectionner</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Montant
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
            Description
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Fréquence
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
              <option value="yearly">Annuelle</option>
            </select>
          </label>
          <label>
            Prochaine date
            <input
              required
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
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
export function SettingsPage() {
  const { user, setUser, flash } = useFinance(),
    [installable, setInstallable] = useState(canPromptInstall()),
    [installed, setInstalled] = useState(isInstalled()),
    [name, setName] = useState(user.name),
    [cur, setCur] = useState<Currency>(user.currency),
    [rate, setRate] = useState(
      user.usd_cdf_rate == null ? "" : String(user.usd_cdf_rate),
    ),
    [month, setMonth] = useState(user.month_start),
    [numberFormat, setNumberFormat] = useState(user.number_format),
    [theme, setTheme] = useState(user.theme),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => {
      setInstallable(canPromptInstall());
      setInstalled(isInstalled());
    };
    window.addEventListener("financeflow:installable", update);
    return () => window.removeEventListener("financeflow:installable", update);
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await send<User>("/me", "PUT", {
        name,
        currency: cur,
        usd_cdf_rate: rate.trim() === "" ? null : Number(rate),
        month_start: Number(month),
        number_format: numberFormat,
        theme,
      });
      setUser(u);
      flash("Préférences enregistrées.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await send<User>("/me/password", "PUT", { currentPassword, newPassword });
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      flash("Mot de passe modifié.");
    } catch (e) {
      flash((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="VOTRE ESPACE"
        title="Paramètres"
        desc="Gérez votre profil, vos préférences et la sécurité de votre compte."
      />
      {user.must_change_password && (
        <div className="notice admin-password-notice" role="alert">
          Changez le mot de passe administrateur initial avant d’utiliser l’application.
        </div>
      )}
      <div className="two-col">
        <form className="card form-card stack" onSubmit={save}>
          <h2>Profil et préférences</h2>
          <label>
            Nom
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Adresse email
            <input disabled value={user.email} />
          </label>
          <label>
            Devise principale
            <select
              value={cur}
              onChange={(e) => setCur(e.target.value as Currency)}
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
          <label>
            Taux de change manuel : 1 USD = combien de CDF ?
            <input
              type="number"
              min="0.0001"
              max="1000000000"
              step="0.0001"
              placeholder="Ex. 2850"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <small className="muted">
              Ce taux sera enregistré sur les nouvelles transactions. Modifier
              le taux ne recalculera pas les anciennes opérations.
            </small>
          </label>
          <label>
            Début du mois financier
            <input
              type="number"
              min="1"
              max="28"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </label>
          <label>
            Format des nombres
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value)}
            >
              <option value="fr-FR">Français : 1 250,00</option>
              <option value="en-US">Anglais : 1,250.00</option>
            </select>
          </label>
          <label>
            Apparence
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Enregistrer les préférences
          </button>
        </form>
        <form className="card form-card stack" onSubmit={password}>
          <h2>Sécurité</h2>
          <label>
            Mot de passe actuel
            <PasswordInput
              required
              visibilityLabel="le mot de passe actuel"
              aria-label="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Nouveau mot de passe
            <PasswordInput
              required
              minLength={10}
              visibilityLabel="le nouveau mot de passe"
              aria-label="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Modifier le mot de passe
          </button>
          <p className="muted">
            Votre session reste active sur cet appareil. Les autres sessions
            seront déconnectées.
          </p>
        </form>
      </div>
      <section className="card form-card stack">
        <h2>Application sur cet appareil</h2>
        <p className="muted">
          Installez FinanceFlow depuis le navigateur pour l’ouvrir comme une
          application. Les pages et les données déjà chargées restent disponibles
          hors ligne. Vous pouvez aussi saisir des transactions, qui seront
          synchronisées automatiquement au retour d’Internet.
        </p>
        {installed ? (
          <p>FinanceFlow est installé sur cet appareil.</p>
        ) : installable ? (
          <button
            type="button"
            className="primary"
            onClick={() => installApp().catch(() => flash("Installation indisponible.", true))}
          >
            Installer FinanceFlow
          </button>
        ) : (
          <p className="muted">
            Sur Chrome ou Edge, ouvrez le menu du navigateur puis choisissez
            « Installer l’application ». Sur iPhone, utilisez Partager puis
            « Sur l’écran d’accueil ».
          </p>
        )}
      </section>
    </>
  );
}
