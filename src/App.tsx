import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Account, Category, User } from "./types";
import { api, send } from "./lib";
import { Dashboard, TransactionsPage, TransactionForm } from "./pages";
import { AccountsPage, CategoriesPage, BudgetsPage, GoalsPage } from "./pages2";
import {
  AnalyticsPage,
  ReportsPage,
  RecurringPage,
  SettingsPage,
} from "./pages3";

type Context = {
  user: User;
  setUser: (u: User) => void;
  accounts: Account[];
  categories: Category[];
  reload: () => Promise<void>;
  flash: (message: string, error?: boolean) => void;
};
export const FinanceContext = createContext<Context>(null!);
export const useFinance = () => useContext(FinanceContext);
const Icon = ({ name }: { name: string }) => (
  <span className="material-symbols-outlined" aria-hidden="true">
    {name}
  </span>
);
const links = [
  ["/", "dashboard", "Vue d’ensemble"],
  ["/analyses", "monitoring", "Analyses & graphiques"],
  ["/transactions", "receipt_long", "Transactions"],
  ["/transactions/new", "add_circle", "Nouvelle transaction"],
  ["/accounts", "account_balance_wallet", "Comptes"],
  ["/categories", "category", "Catégories"],
  ["/budgets", "donut_small", "Budgets"],
  ["/goals", "savings", "Objectifs"],
  ["/recurring", "repeat", "Récurrences"],
  ["/reports", "description", "Rapports"],
  ["/settings", "settings", "Paramètres"],
];

function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "reset") {
        const r = await send<{ recoveryCode: string }>("/auth/reset", "POST", {
          email,
          recoveryCode: code,
          password,
        });
        setRecovery(r.recoveryCode);
        setMode("login");
        setPassword("");
      } else {
        const r = await send<{ user: User; recoveryCode?: string }>(
          mode === "login" ? "/auth/login" : "/auth/register",
          "POST",
          { name, email, password },
        );
        if (r.recoveryCode) setRecovery(r.recoveryCode);
        else onLogin(r.user);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="account_balance_wallet" />
          </span>
          <strong>FinanceFlow</strong>
        </div>
        <span className="eyebrow">VOTRE ESPACE FINANCIER</span>
        <h1>
          {mode === "login"
            ? "Bienvenue sur FinanceFlow"
            : mode === "register"
              ? "Créer votre compte"
              : "Récupérer votre accès"}
        </h1>
        <p className="muted">
          Visualisez et gérez vos finances personnelles en toute clarté.
        </p>
        {recovery ? (
          <div className="notice">
            <strong>Conservez votre code de récupération</strong>
            <p>
              Il vous sera demandé si vous oubliez votre mot de passe. Il ne
              sera plus affiché après cette étape.
            </p>
            <code>{recovery}</code>
            <button
              className="primary wide"
              onClick={() => {
                setRecovery("");
                api<User>("/me")
                  .then(onLogin)
                  .catch(() => {});
              }}
            >
              J’ai sauvegardé ce code
            </button>
          </div>
        ) : (
          <>
            <div className="segment">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Se connecter
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}
              >
                Créer un compte
              </button>
            </div>
            <form onSubmit={submit} className="stack">
              {mode === "register" && (
                <label>
                  Nom complet
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Adresse email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {mode === "reset" && (
                <label>
                  Code de récupération
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
              <label>
                Mot de passe <small>10 caractères minimum</small>
                <input
                  required
                  minLength={mode === "login" ? 1 : 10}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-button right"
                  onClick={() => setMode("reset")}
                >
                  Mot de passe oublié ?
                </button>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? "Veuillez patienter…"
                  : mode === "login"
                    ? "Se connecter"
                    : mode === "register"
                      ? "Créer mon compte"
                      : "Réinitialiser le mot de passe"}
              </button>
            </form>
          </>
        )}
      </div>
      <div className="auth-hero">
        <span className="pill">● Votre trésorerie en un coup d’œil</span>
        <h2>Gérez vos flux en toute sérénité</h2>
        <p>
          Comptes, transactions, budgets et objectifs réunis dans une interface
          claire.
        </p>
        <div className="hero-mini">
          <div>
            <span>REVENUS</span>
            <strong>Comprendre vos entrées</strong>
            <Icon name="trending_up" />
          </div>
          <div>
            <span>BUDGETS</span>
            <strong>Garder le cap</strong>
            <Icon name="track_changes" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, flash } = useFinance(),
    [mobile, setMobile] = useState(false);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => setMobile(false), [location.pathname]);
  async function logout() {
    try {
      await send("/auth/logout", "POST");
      window.location.href = "/";
    } catch (e) {
      flash((e as Error).message, true);
    }
  }
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div>
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Icon name="account_balance_wallet" />
            </span>
            <strong>FinanceFlow</strong>
          </Link>
          <nav>
            {links.map(([to, icon, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/" || to === "/transactions"}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="profile">
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Déconnexion"
            onClick={logout}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {mobile && <div className="overlay" onClick={() => setMobile(false)} />}
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-button menu"
            aria-label="Ouvrir le menu"
            onClick={() => setMobile(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            <span>Portefeuille</span>
            <Icon name="chevron_right" />
            <strong>
              {links.find(([p]) => p === location.pathname)?.[2] ||
                "FinanceFlow"}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="search-shortcut"
              onClick={() => navigate("/transactions")}
            >
              <Icon name="search" />
              <span>Rechercher une opération…</span>
            </button>
            <Link className="primary" to="/transactions/new">
              <Icon name="add" />
              <span>Transaction</span>
            </Link>
            <span className="avatar small">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [accounts, setAccounts] = useState<Account[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    );
  const flash = useCallback((message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4500);
  }, []);
  const reload = useCallback(async () => {
    const [a, c] = await Promise.all([
      api<Account[]>("/accounts"),
      api<Category[]>("/categories"),
    ]);
    setAccounts(a);
    setCategories(c);
  }, []);
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) reload().catch((e) => flash((e as Error).message, true));
  }, [user, reload, flash]);
  if (user) {
    document.documentElement.dataset.theme = user.theme;
    document.documentElement.dataset.numberFormat = user.number_format;
  }
  if (loading)
    return <div className="loading-screen">Chargement de FinanceFlow…</div>;
  return (
    <>
      {!user ? (
        <Auth onLogin={setUser} />
      ) : (
        <FinanceContext.Provider
          value={{ user, setUser, accounts, categories, reload, flash }}
        >
          <Shell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/transactions/new" element={<TransactionForm />} />
              <Route
                path="/transactions/:id/edit"
                element={<TransactionForm />}
              />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/analyses" element={<AnalyticsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/recurring" element={<RecurringPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Shell>
        </FinanceContext.Provider>
      )}
      {toast && (
        <div className={toast.error ? "toast bad" : "toast"} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}
