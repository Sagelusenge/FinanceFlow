import { useEffect, useState, type FormEvent } from "react";
import { useFinance } from "./App";
import { api, send } from "./lib";

interface Summary {
  users: number;
  active_users: number;
  accounts: number;
  transactions: number;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_admin: number | boolean;
  disabled_at: string | null;
  created_at: string;
  account_count: number;
  transaction_count: number;
}
interface UserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

export function AdminPage() {
  const { flash } = useFinance();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserPage | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let active = true;
    api<Summary>("/admin/summary")
      .then((result) => { if (active) setSummary(result); })
      .catch((issue) => { if (active) setError((issue as Error).message); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), search });
    api<UserPage>(`/admin/users?${params}`)
      .then((result) => { if (active) setUsers(result); })
      .catch((issue) => { if (active) setError((issue as Error).message); });
    return () => { active = false; };
  }, [page, search, refresh]);

  function findUsers(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }
  async function setDisabled(user: AdminUser, disabled: boolean) {
    if (!window.confirm(`${disabled ? "Désactiver" : "Réactiver"} le compte de ${user.email} ?`)) return;
    setBusyId(user.id);
    try {
      await send(`/admin/users/${user.id}/status`, "PUT", { disabled });
      setError("");
      setRefresh((value) => value + 1);
      flash(disabled ? "Utilisateur désactivé." : "Utilisateur réactivé.");
    } catch (issue) {
      flash((issue as Error).message, true);
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Vue d’ensemble</h1>
          <p className="muted">Suivez l’activité du service et gérez l’accès des utilisateurs.</p>
        </div>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="admin-metrics">
        {([
          ["Utilisateurs", summary?.users],
          ["Utilisateurs actifs", summary?.active_users],
          ["Comptes financiers", summary?.accounts],
          ["Transactions", summary?.transactions],
        ] as const).map(([label, count]) => (
          <div className="card admin-metric" key={label}>
            <small>{label}</small>
            <strong>{count ?? "…"}</strong>
          </div>
        ))}
      </div>
      <section className="card admin-users">
        <div className="section-heading">
          <div>
            <h2>Utilisateurs</h2>
            <p className="muted">Les montants et les opérations détaillées restent privés à chaque utilisateur.</p>
          </div>
          <strong>{users?.total ?? "…"} compte(s)</strong>
        </div>
        <form className="admin-search" onSubmit={findUsers}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un nom ou un email" aria-label="Chercher un utilisateur" />
          <button className="primary">Rechercher</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Utilisateur</th><th>Créé le</th><th>Comptes</th><th>Transactions</th><th>Statut</th><th>Action</th></tr></thead>
            <tbody>
              {users?.items.map((user) => {
                const admin = Boolean(user.is_admin);
                const disabled = Boolean(user.disabled_at);
                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><small>{user.email}</small></td>
                    <td>{new Date(user.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>{user.account_count}</td>
                    <td>{user.transaction_count}</td>
                    <td><span className={`status-pill ${disabled ? "inactive" : ""}`}>{admin ? "Admin" : disabled ? "Désactivé" : "Actif"}</span></td>
                    <td>{admin ? "—" : <button type="button" className={disabled ? "secondary-button" : "text-button danger"} disabled={busyId === user.id} onClick={() => void setDisabled(user, !disabled)}>{disabled ? "Réactiver" : "Désactiver"}</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users?.items.length === 0 && <p className="muted">Aucun utilisateur trouvé.</p>}
        {users && users.pages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button>
            <span>Page {page} / {users.pages}</span>
            <button disabled={page >= users.pages} onClick={() => setPage((value) => value + 1)}>Suivant</button>
          </div>
        )}
      </section>
    </>
  );
}
