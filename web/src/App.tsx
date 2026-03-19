import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "register";

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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TOKEN_STORAGE_KEY = "rl.auth.token";
const REFRESH_TOKEN_STORAGE_KEY = "rl.auth.refresh-token";

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
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

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  useEffect(() => {
    if (!token && !refreshToken) {
      setUser(null);
      return;
    }

    void bootstrapSession();
  }, [token, refreshToken]);

  async function bootstrapSession(): Promise<void> {
    if (token) {
      const meOk = await fetchMe(token);
      if (meOk) {
        return;
      }
    }

    if (!refreshToken) {
      clearSession();
      return;
    }

    await refreshSession(refreshToken);
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
      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              name
            };

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

  return (
    <main className="page">
      <section className="card">
        <header className="hero">
          <p className="eyebrow">Rowing Logbook</p>
          <h1>Authentification admin</h1>
          <p className="subtitle">Connexion locale web + backend NestJS</p>
        </header>

        {isAuthenticated && user ? (
          <section className="panel">
            <h2>Session active</h2>
            <p>
              Bonjour <strong>{user.name}</strong>
            </p>
            <p>{user.email}</p>
            <p>Role: {user.role}</p>
            <button className="primary" type="button" onClick={() => void onLogout()}>
              Se deconnecter
            </button>
          </section>
        ) : (
          <>
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
          </>
        )}

        {isLoadingMe ? <p className="status">Verification de session...</p> : null}
        {info ? <p className="status status-ok">{info}</p> : null}
        {error ? <p className="status status-error">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
