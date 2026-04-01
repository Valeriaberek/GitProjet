import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "register";
type Tab = "dashboard" | "sessions" | "members" | "boats" | "stats";
type SessionStatus = "IN_PROGRESS" | "COMPLETED";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ROWER" | "STAFF" | "ADMIN";
}

interface DashboardPayload {
  generatedAt: string;
  indicators: {
    inProgressCount: number;
    completedTodayCount: number;
    availableBoats: number;
    totalBoats: number;
  };
  activeSessions: Array<{
    id: string;
    boatName: string;
    responsibleName: string;
    crew: string[];
    departureTime: string;
    durationMinutes: number;
    route: string | null;
    plannedDistanceKm: number;
    isOverThreeHours: boolean;
  }>;
}

interface SessionItem {
  id: string;
  boatName: string;
  responsibleName: string;
  departureTime: string;
  returnTime: string | null;
  status: SessionStatus;
  plannedDistanceKm: number;
  actualDistanceKm: number | null;
  route: string | null;
}

interface SessionDetail extends SessionItem {
  crew: string[];
  remarks: string | null;
}

interface MemberItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ROWER" | "STAFF" | "ADMIN";
  isActive: boolean;
  createdAt: string;
}

interface BoatItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  condition: string;
  isOutOfService: boolean;
}

interface StatsOverview {
  period: string;
  sessionCount: number;
  totalDistanceKm: number;
  totalDurationHours: number;
}

interface RowerStat {
  rowerId: string;
  rowerName: string;
  sessionCount: number;
  totalDistanceKm: number;
}

interface BoatStat {
  boatId: string;
  boatName: string;
  sessionCount: number;
  totalDistanceKm: number;
  usageRatePercent: number;
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
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [isLoadingSessionDetail, setIsLoadingSessionDetail] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [boats, setBoats] = useState<BoatItem[]>([]);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [rowerStats, setRowerStats] = useState<RowerStat[]>([]);
  const [boatStats, setBoatStats] = useState<BoatStat[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>("");
  const [sessionBoatFilter, setSessionBoatFilter] = useState("");
  const [sessionRowerFilter, setSessionRowerFilter] = useState("");
  const [sessionDateFilter, setSessionDateFilter] = useState("");

  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberLastName, setNewMemberLastName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"ROWER" | "STAFF" | "ADMIN">("ROWER");

  const [newBoatName, setNewBoatName] = useState("");
  const [newBoatType, setNewBoatType] = useState("");
  const [newBoatCapacity, setNewBoatCapacity] = useState("1");
  const [newBoatCondition, setNewBoatCondition] = useState("Bon etat");

  const [statsPeriod, setStatsPeriod] = useState("month");

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);
  const hasAdminAccess = useMemo(() => user?.role === "ADMIN" || user?.role === "STAFF", [user]);
  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  useEffect(() => {
    if (!token && !refreshToken) {
      setUser(null);
      return;
    }

    void bootstrapSession();
  }, [token, refreshToken]);

  useEffect(() => {
    if (!isAuthenticated || !hasAdminAccess) {
      setDashboard(null);
      setSessions([]);
      setMembers([]);
      setBoats([]);
      setOverview(null);
      setRowerStats([]);
      setBoatStats([]);
      setSelectedSession(null);
      return;
    }

    void loadDashboardData();
  }, [isAuthenticated, hasAdminAccess]);

  useEffect(() => {
    if (!isAuthenticated || !hasAdminAccess) {
      return;
    }

    void loadSessions();
  }, [sessionStatusFilter, sessionBoatFilter, sessionRowerFilter, sessionDateFilter, isAuthenticated, hasAdminAccess]);

  useEffect(() => {
    if (!isAuthenticated || !hasAdminAccess) {
      return;
    }

    void loadStats();
  }, [statsPeriod, isAuthenticated, hasAdminAccess]);

  useEffect(() => {
    if (!hasAdminAccess) {
      return;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "1") {
        setActiveTab("dashboard");
      } else if (event.key === "2") {
        setActiveTab("sessions");
      } else if (event.key === "3" && isAdmin) {
        setActiveTab("members");
      } else if (event.key === "4" && isAdmin) {
        setActiveTab("boats");
      } else if (event.key === "5") {
        setActiveTab("stats");
      } else if (event.key.toLowerCase() === "r") {
        void loadDashboardData();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasAdminAccess, isAdmin]);

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

  async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!token) {
      throw new Error("Session invalide");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof body === "object" && body && "message" in body
          ? Array.isArray((body as { message?: string | string[] }).message)
            ? (body as { message?: string[] }).message?.[0]
            : (body as { message?: string }).message
          : undefined;
      throw new Error(message || "Erreur API");
    }

    return body as T;
  }

  async function loadDashboardData(): Promise<void> {
    setIsLoadingData(true);
    setError(null);

    try {
      const [dashboardData, sessionData] = await Promise.all([
        apiFetch<DashboardPayload>("/admin/dashboard"),
        apiFetch<{ items: SessionItem[]; total: number }>("/sessions/history?page=1&pageSize=20")
      ]);
      setDashboard(dashboardData);
      setSessions(sessionData.items);
      setSessionsTotal(sessionData.total);

      if (isAdmin) {
        const [membersData, boatsData] = await Promise.all([
          apiFetch<MemberItem[]>("/members"),
          apiFetch<BoatItem[]>("/boats")
        ]);
        setMembers(membersData);
        setBoats(boatsData);
      }

      await loadStats();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le dashboard");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function loadSessions(): Promise<void> {
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "20" });
      if (sessionStatusFilter) {
        params.set("status", sessionStatusFilter);
      }
      if (sessionBoatFilter.trim()) {
        params.set("boat", sessionBoatFilter.trim());
      }
      if (sessionRowerFilter.trim()) {
        params.set("rower", sessionRowerFilter.trim());
      }
      if (sessionDateFilter) {
        params.set("date", sessionDateFilter);
      }

      const data = await apiFetch<{ items: SessionItem[]; total: number }>(`/sessions/history?${params.toString()}`);
      setSessions(data.items);
      setSessionsTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur chargement sorties");
    }
  }

  async function loadStats(): Promise<void> {
    try {
      const [overviewData, rowersData, boatsData] = await Promise.all([
        apiFetch<StatsOverview>(`/stats/overview?period=${statsPeriod}`),
        apiFetch<RowerStat[]>("/stats/rowers"),
        apiFetch<BoatStat[]>("/stats/boats")
      ]);
      setOverview(overviewData);
      setRowerStats(rowersData);
      setBoatStats(boatsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur chargement statistiques");
    }
  }

  async function closeSession(sessionId: string): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>(`/sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setInfo("Sortie cloturee.");
      await loadDashboardData();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Erreur cloture sortie");
    }
  }

  async function exportSessionsCsv(): Promise<void> {
    if (!token) {
      return;
    }

    const params = new URLSearchParams();
    if (sessionStatusFilter) {
      params.set("status", sessionStatusFilter);
    }
    if (sessionBoatFilter.trim()) {
      params.set("boat", sessionBoatFilter.trim());
    }
    if (sessionRowerFilter.trim()) {
      params.set("rower", sessionRowerFilter.trim());
    }
    if (sessionDateFilter) {
      params.set("date", sessionDateFilter);
    }

    const response = await fetch(`${API_BASE_URL}/sessions/export.csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      setError("Export CSV impossible");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sessions-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      await apiFetch<MemberItem>("/members", {
        method: "POST",
        body: JSON.stringify({
          firstName: newMemberFirstName,
          lastName: newMemberLastName,
          email: newMemberEmail,
          role: newMemberRole
        })
      });
      setNewMemberFirstName("");
      setNewMemberLastName("");
      setNewMemberEmail("");
      setNewMemberRole("ROWER");
      setInfo("Membre cree.");
      setMembers(await apiFetch<MemberItem[]>("/members"));
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Erreur creation membre");
    }
  }

  async function toggleMemberStatus(member: MemberItem): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>(`/members/${member.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !member.isActive })
      });
      setMembers(await apiFetch<MemberItem[]>("/members"));
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Erreur statut membre");
    }
  }

  async function createBoat(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      await apiFetch<BoatItem>("/boats", {
        method: "POST",
        body: JSON.stringify({
          name: newBoatName,
          type: newBoatType,
          capacity: Number(newBoatCapacity),
          condition: newBoatCondition
        })
      });
      setNewBoatName("");
      setNewBoatType("");
      setNewBoatCapacity("1");
      setNewBoatCondition("Bon etat");
      setInfo("Bateau cree.");
      setBoats(await apiFetch<BoatItem[]>("/boats"));
    } catch (boatError) {
      setError(boatError instanceof Error ? boatError.message : "Erreur creation bateau");
    }
  }

  async function toggleBoatOutOfService(boat: BoatItem): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>(`/boats/${boat.id}/out-of-service`, {
        method: "PATCH",
        body: JSON.stringify({ isOutOfService: !boat.isOutOfService })
      });
      setBoats(await apiFetch<BoatItem[]>("/boats"));
    } catch (boatError) {
      setError(boatError instanceof Error ? boatError.message : "Erreur mise a jour bateau");
    }
  }

  async function openSessionDetail(sessionId: string): Promise<void> {
    setIsLoadingSessionDetail(true);
    try {
      const detail = await apiFetch<SessionDetail>(`/sessions/${sessionId}`);
      setSelectedSession(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Erreur chargement detail sortie");
    } finally {
      setIsLoadingSessionDetail(false);
    }
  }

  function formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
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
          hasAdminAccess ? (
            <section className="panel dashboard-app" aria-label="Dashboard admin">
              <div className="dashboard-header app-toolbar">
                <div>
                  <h2>Dashboard administration</h2>
                  <p className="subtitle">
                    Connecte: <strong>{user.name}</strong> ({user.role})
                  </p>
                </div>
                <div className="toolbar-actions">
                  <span className="live-pill">Live {dashboard ? new Date(dashboard.generatedAt).toLocaleTimeString("fr-FR") : "--:--:--"}</span>
                  <button className="chip" type="button" onClick={() => void loadDashboardData()}>
                    Actualiser
                  </button>
                  <button className="primary" type="button" onClick={() => void onLogout()}>
                    Se deconnecter
                  </button>
                </div>
              </div>

              <div className="tabs">
                <button className={activeTab === "dashboard" ? "chip chip-active" : "chip"} onClick={() => setActiveTab("dashboard")} type="button">Tableau de bord</button>
                <button className={activeTab === "sessions" ? "chip chip-active" : "chip"} onClick={() => setActiveTab("sessions")} type="button">Sorties</button>
                {isAdmin ? <button className={activeTab === "members" ? "chip chip-active" : "chip"} onClick={() => setActiveTab("members")} type="button">Membres</button> : null}
                {isAdmin ? <button className={activeTab === "boats" ? "chip chip-active" : "chip"} onClick={() => setActiveTab("boats")} type="button">Bateaux</button> : null}
                <button className={activeTab === "stats" ? "chip chip-active" : "chip"} onClick={() => setActiveTab("stats")} type="button">Statistiques</button>
              </div>

              <div className="quick-actions" role="note" aria-label="Actions rapides">
                <button className="chip" type="button" onClick={() => setActiveTab("dashboard")}>Vue live</button>
                <button className="chip" type="button" onClick={() => setActiveTab("sessions")}>Cloturer une sortie</button>
                <button className="chip" type="button" onClick={() => setActiveTab("stats")}>Voir les stats</button>
                <p className="shortcut-hint">Raccourcis: 1-5 pour les onglets, R pour actualiser</p>
              </div>

              {isLoadingData ? <p className="status">Chargement des donnees...</p> : null}

              {activeTab === "dashboard" ? (
                <>
                  <div className="dashboard-grid">
                    <article className="metric-card">
                      <h3>Sorties en cours</h3>
                      <p className="metric-value">{dashboard?.indicators.inProgressCount ?? 0}</p>
                    </article>
                    <article className="metric-card">
                      <h3>Sorties cloturees aujourd'hui</h3>
                      <p className="metric-value">{dashboard?.indicators.completedTodayCount ?? 0}</p>
                    </article>
                    <article className="metric-card metric-wide">
                      <h3>Bateaux disponibles</h3>
                      <p className="metric-value">
                        {dashboard?.indicators.availableBoats ?? 0} / {dashboard?.indicators.totalBoats ?? 0}
                      </p>
                    </article>
                  </div>

                  <h3>Sorties en temps reel</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bateau</th>
                          <th>Responsable</th>
                          <th>Equipage</th>
                          <th>Depart</th>
                          <th>Duree</th>
                          <th>Parcours</th>
                          <th>Distance prevue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboard?.activeSessions ?? []).map((session) => (
                          <tr
                            key={session.id}
                            className={`${session.isOverThreeHours ? "row-alert" : ""} row-clickable`}
                            onClick={() => void openSessionDetail(session.id)}
                          >
                            <td>{session.boatName}</td>
                            <td>{session.responsibleName}</td>
                            <td>{session.crew.join(", ") || "-"}</td>
                            <td>{new Date(session.departureTime).toLocaleString("fr-FR")}</td>
                            <td>
                              <span>{formatMinutes(session.durationMinutes)}</span>
                              <div className="duration-bar" aria-hidden="true">
                                <span style={{ width: `${Math.min((session.durationMinutes / 180) * 100, 100)}%` }} />
                              </div>
                            </td>
                            <td>{session.route || "-"}</td>
                            <td>{session.plannedDistanceKm} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {activeTab === "sessions" ? (
                <>
                  <h3>Gestion des sorties</h3>
                  <div className="filters-grid">
                    <select value={sessionStatusFilter} onChange={(event) => setSessionStatusFilter(event.target.value)}>
                      <option value="">Tous statuts</option>
                      <option value="IN_PROGRESS">En cours</option>
                      <option value="COMPLETED">Cloturees</option>
                    </select>
                    <input value={sessionBoatFilter} onChange={(event) => setSessionBoatFilter(event.target.value)} placeholder="Filtre bateau" />
                    <input value={sessionRowerFilter} onChange={(event) => setSessionRowerFilter(event.target.value)} placeholder="Filtre rameur" />
                    <input type="date" value={sessionDateFilter} onChange={(event) => setSessionDateFilter(event.target.value)} />
                  </div>
                  <p className="status">Total: {sessionsTotal}</p>
                  <button className="chip" type="button" onClick={() => void exportSessionsCsv()}>
                    Export CSV
                  </button>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bateau</th>
                          <th>Responsable</th>
                          <th>Depart</th>
                          <th>Retour</th>
                          <th>Statut</th>
                          <th>Distance</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session) => (
                          <tr key={session.id} className="row-clickable" onClick={() => void openSessionDetail(session.id)}>
                            <td>{session.boatName}</td>
                            <td>{session.responsibleName}</td>
                            <td>{new Date(session.departureTime).toLocaleString("fr-FR")}</td>
                            <td>{session.returnTime ? new Date(session.returnTime).toLocaleString("fr-FR") : "-"}</td>
                            <td>{session.status}</td>
                            <td>{session.actualDistanceKm ?? session.plannedDistanceKm} km</td>
                            <td>
                              {session.status === "IN_PROGRESS" ? (
                                <button
                                  className="chip"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void closeSession(session.id);
                                  }}
                                >
                                  Cloturer
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <section className="detail-drawer" aria-live="polite">
                    {isLoadingSessionDetail ? <p className="status">Chargement du detail...</p> : null}
                    {selectedSession ? (
                      <>
                        <h4>Detail sortie</h4>
                        <p>
                          <strong>{selectedSession.boatName}</strong> - {selectedSession.status}
                        </p>
                        <p>Responsable: {selectedSession.responsibleName}</p>
                        <p>Parcours: {selectedSession.route || "-"}</p>
                        <p>Equipage: {selectedSession.crew.join(", ") || "-"}</p>
                        <p>Remarques: {selectedSession.remarks || "-"}</p>
                      </>
                    ) : (
                      <p className="status">Clique une sortie pour voir son detail.</p>
                    )}
                  </section>
                </>
              ) : null}

              {activeTab === "members" && isAdmin ? (
                <>
                  <h3>Gestion des membres</h3>
                  <form className="form compact-form" onSubmit={createMember}>
                    <input required value={newMemberFirstName} onChange={(event) => setNewMemberFirstName(event.target.value)} placeholder="Prenom" />
                    <input required value={newMemberLastName} onChange={(event) => setNewMemberLastName(event.target.value)} placeholder="Nom" />
                    <input required type="email" value={newMemberEmail} onChange={(event) => setNewMemberEmail(event.target.value)} placeholder="Email" />
                    <select value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value as "ROWER" | "STAFF" | "ADMIN")}>
                      <option value="ROWER">ROWER</option>
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button className="primary" type="submit">Creer</button>
                  </form>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Prenom</th>
                          <th>Nom</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Statut</th>
                          <th>Inscription</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td>{member.firstName}</td>
                            <td>{member.lastName}</td>
                            <td>{member.email}</td>
                            <td>{member.role}</td>
                            <td>{member.isActive ? "Actif" : "Inactif"}</td>
                            <td>{new Date(member.createdAt).toLocaleDateString("fr-FR")}</td>
                            <td>
                              <button className="chip" type="button" onClick={() => void toggleMemberStatus(member)}>
                                {member.isActive ? "Desactiver" : "Reactiver"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {activeTab === "boats" && isAdmin ? (
                <>
                  <h3>Gestion des bateaux</h3>
                  <form className="form compact-form" onSubmit={createBoat}>
                    <input required value={newBoatName} onChange={(event) => setNewBoatName(event.target.value)} placeholder="Nom bateau" />
                    <input required value={newBoatType} onChange={(event) => setNewBoatType(event.target.value)} placeholder="Type" />
                    <input required type="number" min={1} value={newBoatCapacity} onChange={(event) => setNewBoatCapacity(event.target.value)} placeholder="Capacite" />
                    <input required value={newBoatCondition} onChange={(event) => setNewBoatCondition(event.target.value)} placeholder="Etat" />
                    <button className="primary" type="submit">Creer</button>
                  </form>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th>Type</th>
                          <th>Capacite</th>
                          <th>Etat</th>
                          <th>Statut</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boats.map((boat) => (
                          <tr key={boat.id}>
                            <td>{boat.name}</td>
                            <td>{boat.type}</td>
                            <td>{boat.capacity}</td>
                            <td>{boat.condition}</td>
                            <td>{boat.isOutOfService ? "Hors service" : "Disponible"}</td>
                            <td>
                              <button className="chip" type="button" onClick={() => void toggleBoatOutOfService(boat)}>
                                {boat.isOutOfService ? "Remettre en service" : "Mettre hors service"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {activeTab === "stats" ? (
                <>
                  <h3>Statistiques</h3>
                  <div className="filters-grid">
                    <select value={statsPeriod} onChange={(event) => setStatsPeriod(event.target.value)}>
                      <option value="week">Semaine</option>
                      <option value="month">Mois</option>
                      <option value="year">Annee</option>
                      <option value="all">Tout</option>
                    </select>
                  </div>

                  <div className="dashboard-grid">
                    <article className="metric-card">
                      <h3>Nombre de sorties</h3>
                      <p className="metric-value">{overview?.sessionCount ?? 0}</p>
                    </article>
                    <article className="metric-card">
                      <h3>Distance totale</h3>
                      <p className="metric-value">{overview?.totalDistanceKm.toFixed(1) ?? "0.0"} km</p>
                    </article>
                    <article className="metric-card metric-wide">
                      <h3>Duree totale</h3>
                      <p className="metric-value">{overview?.totalDurationHours.toFixed(1) ?? "0.0"} h</p>
                    </article>
                  </div>

                  <h4>Classement rameurs</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Rameur</th>
                          <th>Sorties</th>
                          <th>Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowerStats.map((rower) => (
                          <tr key={rower.rowerId}>
                            <td>{rower.rowerName}</td>
                            <td>{rower.sessionCount}</td>
                            <td>{rower.totalDistanceKm.toFixed(1)} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4>Utilisation bateaux</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bateau</th>
                          <th>Sorties</th>
                          <th>Distance</th>
                          <th>Taux utilisation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boatStats.map((boat) => (
                          <tr key={boat.boatId}>
                            <td>{boat.boatName}</td>
                            <td>{boat.sessionCount}</td>
                            <td>{boat.totalDistanceKm.toFixed(1)} km</td>
                            <td>{boat.usageRatePercent.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          ) : (
            <section className="panel panel-warning" aria-label="Acces refuse">
              <h2>Role insuffisant</h2>
              <p>
                Le compte <strong>{user.email}</strong> est connecte en tant que <strong>{user.role}</strong>.
              </p>
              <p>Ce role n&apos;a pas acces au dashboard web admin.</p>
              <button className="primary" type="button" onClick={() => void onLogout()}>
                Se deconnecter
              </button>
            </section>
          )
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
