import { FormEvent, useMemo, useState } from "react";

type AuthMode = "login" | "register";
type AdminView = "dashboard" | "outings" | "members" | "boats" | "stats";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ROWER" | "STAFF" | "ADMIN";
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface CurrentOuting {
  id: string;
  boat: string;
  skipper: string;
  crewCount: number;
  startedAt: string;
  plannedKm: number;
  route: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TOKEN_STORAGE_KEY = "rl.auth.token";
const REFRESH_TOKEN_STORAGE_KEY = "rl.auth.refresh-token";
const DEV_DEFAULT_PASSWORD = "Rowing123!";

const ADMIN_NAV_ITEMS: Array<{ id: AdminView; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "outings", label: "Sorties" },
  { id: "members", label: "Membres" },
  { id: "boats", label: "Bateaux" },
  { id: "stats", label: "Statistiques" }
];

const MOCK_CURRENT_OUTINGS: CurrentOuting[] = [
  {
    id: "o-1",
    boat: "Skiff S1-07",
    skipper: "Camille Dupont",
    crewCount: 1,
    startedAt: "2026-03-19T07:25:00.000Z",
    plannedKm: 16,
    route: "Canal Nord"
  },
  {
    id: "o-2",
    boat: "Double D2-03",
    skipper: "Julien Martin",
    crewCount: 2,
    startedAt: "2026-03-19T08:10:00.000Z",
    plannedKm: 18,
    route: "Boucle Ouest"
  },
  {
    id: "o-3",
    boat: "Quatre Q4-01",
    skipper: "Eva Bernard",
    crewCount: 4,
    startedAt: "2026-03-19T09:05:00.000Z",
    plannedKm: 20,
    route: "Lac central"
  }
];

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [adminView, setAdminView] = useState<AdminView>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMe, setIsLoadingMe] = useState(false);

  const isAuthenticated = Boolean(token && user);
  const isAdminUser = user?.role === "STAFF" || user?.role === "ADMIN";

  const kpis = useMemo(
    () => ({
      currentOutings: MOCK_CURRENT_OUTINGS.length,
      closedToday: 18,
      availableBoats: 11,
      totalBoats: 15
    }),
    []
  );

  const enrichedOutings = useMemo(
    () =>
      MOCK_CURRENT_OUTINGS.map((outing) => {
        const minutes = Math.max(1, Math.floor((Date.now() - new Date(outing.startedAt).getTime()) / 60000));
        const isAlert = minutes >= 180;
        const isWarning = minutes >= 150;

        return {
          ...outing,
          minutes,
          isAlert,
          isWarning
        };
      }),
    []
  );

  async function bootstrapSession(nextToken: string | null, nextRefreshToken: string | null): Promise<void> {
    if (nextToken) {
      const meOk = await fetchMe(nextToken);
      if (meOk) {
        return;
      }
    }

    if (!nextRefreshToken) {
      clearSession();
      return;
    }

    await refreshSession(nextRefreshToken);
  }

  if ((token || refreshToken) && !user && !isLoadingMe) {
    void bootstrapSession(token, refreshToken);
  }

  async function fetchMe(currentToken: string): Promise<boolean> {
    setIsLoadingMe(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Session invalide, reconnecte-toi.");
      }

      const data = (await response.json()) as User;
      setUser(data);
      return true;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Erreur de session");
      return false;
    } finally {
      setIsLoadingMe(false);
    }
  }

  async function refreshSession(currentRefreshToken: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken })
      });

      const data = (await response.json()) as Partial<AuthResponse> & { message?: string | string[] };

      if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(message || "Session expiree");
      }

      saveSession(data.accessToken, data.refreshToken, data.user);
      setInfo("Session restauree.");
    } catch (refreshError) {
      clearSession();
      setError(refreshError instanceof Error ? refreshError.message : "Impossible de restaurer la session");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "login" : "register";
      const payload = mode === "login" ? { email, password } : { email, password, name };

      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as Partial<AuthResponse> & { message?: string | string[] };

      if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(message || "Echec de l'authentification");
      }

      saveSession(data.accessToken, data.refreshToken, data.user);
      setPassword("");
      setInfo(mode === "register" ? "Compte cree et connecte." : "Connexion reussie.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erreur d'authentification");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogout(): Promise<void> {
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });
    }

    clearSession();
    setPassword("");
    setInfo("Session fermee.");
  }

  function saveSession(nextToken: string, nextRefreshToken: string, nextUser: User): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, nextRefreshToken);
    setToken(nextToken);
    setRefreshToken(nextRefreshToken);
    setUser(nextUser);
  }

  function clearSession(): void {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  function fillDevCredentials(devEmail: string): void {
    setMode("login");
    setEmail(devEmail);
    setPassword(DEV_DEFAULT_PASSWORD);
    setError(null);
    setInfo(`Identifiants pre-remplis pour ${devEmail}`);
  }

  return (
    <main className="page">
      {isAuthenticated && user ? (
        isAdminUser ? (
          <section className="admin-shell">
            <aside className="admin-sidebar">
              <p className="brand">Rowing Logbook</p>
              <h1 className="admin-title">Admin Console</h1>
              <nav className="admin-nav" aria-label="Navigation admin">
                {ADMIN_NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className={adminView === item.id ? "admin-nav-item admin-nav-item-active" : "admin-nav-item"}
                    type="button"
                    onClick={() => setAdminView(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>

            <section className="admin-main">
              <header className="admin-header">
                <div>
                  <p className="admin-eyebrow">MVP Sprint 1</p>
                  <h2>
                    {adminView === "dashboard" ? "Dashboard" : "Module en construction"}
                  </h2>
                </div>
                <div className="admin-user-box">
                  <p>{user.name}</p>
                  <p>
                    {user.email} - {user.role}
                  </p>
                  <button className="secondary" type="button" onClick={() => void onLogout()}>
                    Se deconnecter
                  </button>
                </div>
              </header>

              {adminView === "dashboard" ? (
                <>
                  <section className="kpi-grid" aria-label="Indicateurs du jour">
                    <article className="kpi-card">
                      <p>Sorties en cours</p>
                      <h3>{kpis.currentOutings}</h3>
                    </article>
                    <article className="kpi-card">
                      <p>Sorties cloturees</p>
                      <h3>{kpis.closedToday}</h3>
                    </article>
                    <article className="kpi-card">
                      <p>Bateaux disponibles</p>
                      <h3>
                        {kpis.availableBoats}/{kpis.totalBoats}
                      </h3>
                    </article>
                  </section>

                  <section className="table-wrap" aria-label="Sorties en cours">
                    <div className="table-head">
                      <h3>Sorties en cours</h3>
                      <p>Duree coloree a partir de 2h30, alerte a 3h.</p>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Bateau</th>
                          <th>Responsable</th>
                          <th>Equipage</th>
                          <th>Parcours</th>
                          <th>Distance prevue</th>
                          <th>Duree</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrichedOutings.map((outing) => (
                          <tr key={outing.id}>
                            <td>{outing.boat}</td>
                            <td>{outing.skipper}</td>
                            <td>{outing.crewCount}</td>
                            <td>{outing.route}</td>
                            <td>{outing.plannedKm} km</td>
                            <td>
                              <span
                                className={
                                  outing.isAlert
                                    ? "pill pill-danger"
                                    : outing.isWarning
                                      ? "pill pill-warning"
                                      : "pill"
                                }
                              >
                                {formatDuration(outing.minutes)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              ) : (
                <section className="coming-soon">
                  <h3>{ADMIN_NAV_ITEMS.find((item) => item.id === adminView)?.label}</h3>
                  <p>Cette section arrive au sprint suivant selon la specification.</p>
                </section>
              )}
            </section>
          </section>
        ) : (
          <section className="card">
            <header className="hero">
              <p className="eyebrow">Acces restreint</p>
              <h1>Role insuffisant</h1>
              <p className="subtitle">Le web admin est reserve aux roles STAFF et ADMIN.</p>
            </header>
            <section className="panel">
              <p>
                Compte connecte: <strong>{user.name}</strong>
              </p>
              <p>
                {user.email} - {user.role}
              </p>
              <button className="primary" type="button" onClick={() => void onLogout()}>
                Se deconnecter
              </button>
            </section>
          </section>
        )
      ) : (
        <section className="card">
          <header className="hero">
            <p className="eyebrow">Rowing Logbook</p>
            <h1>Authentification admin</h1>
            <p className="subtitle">Connexion locale web + backend NestJS</p>
          </header>

          <div className="switcher" role="tablist" aria-label="Mode authentification">
            <button
              className={mode === "login" ? "chip chip-active" : "chip"}
              type="button"
              onClick={() => setMode("login")}
            >
              Connexion
            </button>
            <button
              className={mode === "register" ? "chip chip-active" : "chip"}
              type="button"
              onClick={() => setMode("register")}
            >
              Inscription
            </button>
          </div>

          <div className="dev-quick-login" aria-label="Connexions rapides de developpement">
            <p>Connexions rapides (dev)</p>
            <div className="dev-quick-login-actions">
              <button type="button" className="chip" onClick={() => fillDevCredentials("admin@rowing.local")}>
                ADMIN
              </button>
              <button type="button" className="chip" onClick={() => fillDevCredentials("staff@rowing.local")}>
                STAFF
              </button>
              <button type="button" className="chip" onClick={() => fillDevCredentials("rower@rowing.local")}>
                ROWER
              </button>
            </div>
          </div>

          <form className="form" onSubmit={onSubmit}>
            {mode === "register" ? (
              <label>
                Nom
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Valerie"
                />
              </label>
            ) : null}

            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@email.com"
              />
            </label>

            <label>
              Mot de passe
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 caracteres minimum"
              />
            </label>

            <button className="primary" type="submit" disabled={isSubmitting || isLoadingMe}>
              {isSubmitting ? "En cours..." : mode === "login" ? "Se connecter" : "Creer un compte"}
            </button>
          </form>
        </section>
      )}

      {isLoadingMe ? <p className="status">Verification de session...</p> : null}
      {info ? <p className="status status-ok">{info}</p> : null}
      {error ? <p className="status status-error">{error}</p> : null}
    </main>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes.toString().padStart(2, "0")}`;
}

export default App;
