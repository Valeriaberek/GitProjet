import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type Screen = "dashboard" | "new-session" | "history";

type Boat = {
  id: string;
  name: string;
  capacity: number;
};

type Member = {
  id: string;
  name: string;
};

type Session = {
  id: string;
  boatId: string;
  boatName: string;
  skipperId: string;
  skipperName: string;
  crewIds: string[];
  startAtIso: string;
  plannedDistanceKm: number;
  actualDistanceKm?: number;
  route?: string;
  preNotes?: string;
  postNotes?: string;
  endAtIso?: string;
};

const BOATS: Boat[] = [
  { id: "b1", name: "Yole 4+", capacity: 5 },
  { id: "b2", name: "Skiff", capacity: 1 },
  { id: "b3", name: "Huit", capacity: 9 }
];

const MEMBERS: Member[] = [
  { id: "m1", name: "Lina Morel" },
  { id: "m2", name: "Nora Petit" },
  { id: "m3", name: "Evan Laurent" },
  { id: "m4", name: "Noe Bernard" },
  { id: "m5", name: "Ines Faure" }
];

const CURRENT_USER: Member = MEMBERS[0];

function toLocalInputDate(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputDate(value: string): Date {
  return new Date(value);
}

function formatDate(valueIso: string): string {
  return new Date(valueIso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function elapsedMinutes(startIso: string, endIso?: string): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 60_000));
}

function sessionDurationLabel(startIso: string, endIso?: string): string {
  const minutes = elapsedMinutes(startIso, endIso);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function isNearAlertThreshold(startIso: string, endIso?: string): boolean {
  const minutes = elapsedMinutes(startIso, endIso);
  return !endIso && minutes >= 150;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");

  const [email, setEmail] = useState("rameur@rowinglogbook.dev");
  const [password, setPassword] = useState("password");
  const [authError, setAuthError] = useState("");

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: "s1",
      boatId: "b1",
      boatName: "Yole 4+",
      skipperId: CURRENT_USER.id,
      skipperName: CURRENT_USER.name,
      crewIds: ["m2", "m3"],
      startAtIso: new Date(Date.now() - 130 * 60_000).toISOString(),
      plannedDistanceKm: 12,
      route: "Parcours pont nord",
      preNotes: "Eau calme"
    },
    {
      id: "s2",
      boatId: "b3",
      boatName: "Huit",
      skipperId: "m2",
      skipperName: "Nora Petit",
      crewIds: ["m3", "m4", "m5"],
      startAtIso: new Date(Date.now() - 170 * 60_000).toISOString(),
      plannedDistanceKm: 14,
      route: "Canal est"
    }
  ]);

  const [selectedBoatId, setSelectedBoatId] = useState(BOATS[0].id);
  const [startInput, setStartInput] = useState(toLocalInputDate(new Date().toISOString()));
  const [plannedDistance, setPlannedDistance] = useState("10");
  const [route, setRoute] = useState("");
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [preNotes, setPreNotes] = useState("");
  const [createError, setCreateError] = useState("");

  const [closingSessionId, setClosingSessionId] = useState<string | null>(null);
  const [returnInput, setReturnInput] = useState(toLocalInputDate(new Date().toISOString()));
  const [actualDistance, setActualDistance] = useState("10");
  const [postNotes, setPostNotes] = useState("");
  const [closeError, setCloseError] = useState("");

  const [historyFilterBoatId, setHistoryFilterBoatId] = useState("all");
  const [historyFilterDate, setHistoryFilterDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const activeSessions = useMemo(() => sessions.filter((s) => !s.endAtIso), [sessions]);
  const closedSessions = useMemo(() => sessions.filter((s) => !!s.endAtIso), [sessions]);

  const currentUserSessions = useMemo(
    () => closedSessions.filter((s) => s.skipperId === CURRENT_USER.id || s.crewIds.includes(CURRENT_USER.id)),
    [closedSessions]
  );

  const historyFiltered = useMemo(() => {
    let items = [...currentUserSessions];
    if (historyFilterBoatId !== "all") {
      items = items.filter((s) => s.boatId === historyFilterBoatId);
    }
    if (historyFilterDate) {
      const target = new Date(historyFilterDate);
      items = items.filter((s) => {
        const d = new Date(s.startAtIso);
        return (
          d.getFullYear() === target.getFullYear() &&
          d.getMonth() === target.getMonth() &&
          d.getDate() === target.getDate()
        );
      });
    }
    return items.sort((a, b) => +new Date(b.startAtIso) - +new Date(a.startAtIso));
  }, [currentUserSessions, historyFilterBoatId, historyFilterDate]);

  const pageSize = 5;
  const historyPageCount = Math.max(1, Math.ceil(historyFiltered.length / pageSize));
  const paginatedHistory = historyFiltered.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  function onLogin() {
    if (!email.trim() || !password.trim()) {
      setAuthError("Email et mot de passe sont obligatoires.");
      return;
    }
    setAuthError("");
    setIsAuthenticated(true);
  }

  function onForgotPassword() {
    const target = email.trim() || "votre adresse";
    Alert.alert("Mot de passe oublié", `Un email de réinitialisation serait envoyé à ${target}.`);
  }

  function toggleCrew(memberId: string) {
    setSelectedCrewIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }

  function onCreateSession() {
    const boat = BOATS.find((b) => b.id === selectedBoatId);
    if (!boat) {
      setCreateError("Bateau invalide.");
      return;
    }

    const startDate = fromLocalInputDate(startInput);
    if (Number.isNaN(startDate.getTime())) {
      setCreateError("Heure de départ invalide.");
      return;
    }
    if (startDate.getTime() > Date.now()) {
      setCreateError("L'heure de départ ne peut pas être dans le futur.");
      return;
    }

    const distance = Number(plannedDistance.replace(",", "."));
    if (!Number.isFinite(distance) || distance <= 0) {
      setCreateError("La distance prévue doit être un nombre positif.");
      return;
    }

    const boatAlreadyInUse = activeSessions.some((s) => s.boatId === boat.id);
    if (boatAlreadyInUse) {
      setCreateError("Ce bateau a déjà une sortie en cours.");
      return;
    }

    const crewCountWithSkipper = selectedCrewIds.length + 1;
    if (crewCountWithSkipper > boat.capacity) {
      setCreateError(`Capacité dépassée: ${boat.capacity} places max (responsable inclus).`);
      return;
    }

    const newSession: Session = {
      id: `s${Date.now()}`,
      boatId: boat.id,
      boatName: boat.name,
      skipperId: CURRENT_USER.id,
      skipperName: CURRENT_USER.name,
      crewIds: selectedCrewIds,
      startAtIso: startDate.toISOString(),
      plannedDistanceKm: distance,
      route: route.trim() || undefined,
      preNotes: preNotes.trim() || undefined
    };

    setSessions((prev) => [newSession, ...prev]);
    setCreateError("");
    setRoute("");
    setPreNotes("");
    setSelectedCrewIds([]);
    setPlannedDistance("10");
    setStartInput(toLocalInputDate(new Date().toISOString()));
    setScreen("dashboard");
  }

  function startCloseSession(session: Session) {
    setClosingSessionId(session.id);
    setReturnInput(toLocalInputDate(new Date().toISOString()));
    setActualDistance(String(session.plannedDistanceKm));
    setPostNotes("");
    setCloseError("");
  }

  function onConfirmCloseSession() {
    const session = sessions.find((s) => s.id === closingSessionId);
    if (!session) {
      return;
    }

    const returnDate = fromLocalInputDate(returnInput);
    if (Number.isNaN(returnDate.getTime())) {
      setCloseError("Heure de retour invalide.");
      return;
    }

    if (returnDate.getTime() <= new Date(session.startAtIso).getTime()) {
      setCloseError("L'heure de retour doit être strictement postérieure au départ.");
      return;
    }

    const distance = Number(actualDistance.replace(",", "."));
    if (!Number.isFinite(distance) || distance <= 0) {
      setCloseError("La distance réelle doit être un nombre positif.");
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id
          ? {
              ...s,
              endAtIso: returnDate.toISOString(),
              actualDistanceKm: distance,
              postNotes: postNotes.trim() || undefined
            }
          : s
      )
    );

    setClosingSessionId(null);
    setCloseError("");
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.authContainer}>
          <Text style={styles.appTitle}>Rowing Logbook</Text>
          <Text style={styles.appSubtitle}>Connexion rameur</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="email@club.fr"
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="********"
          />

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={onLogin}>
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={onForgotPassword}>
            <Text style={styles.linkButtonText}>Mot de passe oublié</Text>
          </Pressable>
        </ScrollView>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bonjour {CURRENT_USER.name.split(" ")[0]}</Text>
          <Text style={styles.headerSubtitle}>Rameur</Text>
        </View>
        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            setIsAuthenticated(false);
            setScreen("dashboard");
          }}
        >
          <Text style={styles.logoutButtonText}>Deconnexion</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, screen === "dashboard" && styles.tabActive]}
          onPress={() => setScreen("dashboard")}
        >
          <Text style={[styles.tabText, screen === "dashboard" && styles.tabTextActive]}>Tableau de bord</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, screen === "new-session" && styles.tabActive]}
          onPress={() => setScreen("new-session")}
        >
          <Text style={[styles.tabText, screen === "new-session" && styles.tabTextActive]}>Nouvelle sortie</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, screen === "history" && styles.tabActive]}
          onPress={() => setScreen("history")}
        >
          <Text style={[styles.tabText, screen === "history" && styles.tabTextActive]}>Historique</Text>
        </Pressable>
      </View>

      {screen === "dashboard" ? (
        <FlatList
          data={activeSessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={styles.dashboardIntro}>
              <Text style={styles.sectionTitle}>Sorties en cours</Text>
              <Text style={styles.sectionSubtitle}>Suivi des bateaux actuellement sur l'eau</Text>
              <Pressable style={styles.primaryButton} onPress={() => setScreen("new-session")}> 
                <Text style={styles.primaryButtonText}>+ Nouvelle sortie</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const canClose = item.skipperId === CURRENT_USER.id;
            const showWarning = isNearAlertThreshold(item.startAtIso);
            return (
              <View style={[styles.card, showWarning && styles.cardWarning]}>
                <Text style={styles.cardTitle}>{item.boatName}</Text>
                <Text style={styles.cardText}>Responsable: {item.skipperName}</Text>
                <Text style={styles.cardText}>Depart: {formatDate(item.startAtIso)}</Text>
                <Text style={styles.cardText}>Duree: {sessionDurationLabel(item.startAtIso)}</Text>
                {showWarning ? <Text style={styles.warningText}>Alerte visuelle: +2h30</Text> : null}
                {canClose ? (
                  <Pressable style={styles.secondaryButton} onPress={() => startCloseSession(item)}>
                    <Text style={styles.secondaryButtonText}>Cloturer cette sortie</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune sortie en cours.</Text>}
        />
      ) : null}

      {screen === "new-session" ? (
        <ScrollView contentContainerStyle={styles.formContainer}>
          <Text style={styles.sectionTitle}>Creer une sortie</Text>

          <Text style={styles.label}>Bateau</Text>
          <View style={styles.choiceWrap}>
            {BOATS.map((boat) => (
              <Pressable
                key={boat.id}
                style={[styles.choiceChip, selectedBoatId === boat.id && styles.choiceChipSelected]}
                onPress={() => setSelectedBoatId(boat.id)}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    selectedBoatId === boat.id && styles.choiceChipTextSelected
                  ]}
                >
                  {boat.name} ({boat.capacity})
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Heure de depart (YYYY-MM-DDTHH:mm)</Text>
          <TextInput style={styles.input} value={startInput} onChangeText={setStartInput} />

          <Text style={styles.label}>Distance prevue (km)</Text>
          <TextInput
            style={styles.input}
            value={plannedDistance}
            onChangeText={setPlannedDistance}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Parcours (optionnel)</Text>
          <TextInput style={styles.input} value={route} onChangeText={setRoute} placeholder="Canal ou rive" />

          <Text style={styles.label}>Equipage (optionnel)</Text>
          <View style={styles.choiceWrap}>
            {MEMBERS.filter((m) => m.id !== CURRENT_USER.id).map((member) => {
              const selected = selectedCrewIds.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                  onPress={() => toggleCrew(member.id)}
                >
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Remarques (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={preNotes}
            onChangeText={setPreNotes}
            placeholder="Observations avant depart"
          />

          {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={onCreateSession}>
            <Text style={styles.primaryButtonText}>Valider la sortie</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {screen === "history" ? (
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Historique des sorties</Text>

          <Text style={styles.label}>Filtrer par bateau</Text>
          <View style={styles.choiceWrap}>
            <Pressable
              style={[styles.choiceChip, historyFilterBoatId === "all" && styles.choiceChipSelected]}
              onPress={() => {
                setHistoryFilterBoatId("all");
                setHistoryPage(1);
              }}
            >
              <Text style={[styles.choiceChipText, historyFilterBoatId === "all" && styles.choiceChipTextSelected]}>
                Tous
              </Text>
            </Pressable>
            {BOATS.map((boat) => (
              <Pressable
                key={boat.id}
                style={[styles.choiceChip, historyFilterBoatId === boat.id && styles.choiceChipSelected]}
                onPress={() => {
                  setHistoryFilterBoatId(boat.id);
                  setHistoryPage(1);
                }}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    historyFilterBoatId === boat.id && styles.choiceChipTextSelected
                  ]}
                >
                  {boat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Filtrer par date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={historyFilterDate}
            onChangeText={(v) => {
              setHistoryFilterDate(v);
              setHistoryPage(1);
            }}
            placeholder="2026-04-01"
          />

          <FlatList
            data={paginatedHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.boatName}</Text>
                <Text style={styles.cardText}>Depart: {formatDate(item.startAtIso)}</Text>
                <Text style={styles.cardText}>Retour: {item.endAtIso ? formatDate(item.endAtIso) : "-"}</Text>
                <Text style={styles.cardText}>
                  Distance: {item.actualDistanceKm ?? item.plannedDistanceKm} km
                </Text>
                <Text style={styles.cardText}>Equipage: {item.crewIds.length + 1} personnes</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune sortie dans l'historique.</Text>}
          />

          <View style={styles.pagination}>
            <Pressable
              style={[styles.secondaryButton, historyPage === 1 && styles.disabledButton]}
              disabled={historyPage === 1}
              onPress={() => setHistoryPage((p) => Math.max(1, p - 1))}
            >
              <Text style={styles.secondaryButtonText}>Precedent</Text>
            </Pressable>
            <Text style={styles.cardText}>
              Page {historyPage}/{historyPageCount}
            </Text>
            <Pressable
              style={[styles.secondaryButton, historyPage >= historyPageCount && styles.disabledButton]}
              disabled={historyPage >= historyPageCount}
              onPress={() => setHistoryPage((p) => Math.min(historyPageCount, p + 1))}
            >
              <Text style={styles.secondaryButtonText}>Suivant</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {closingSessionId ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Cloturer une sortie</Text>
            <Text style={styles.label}>Heure de retour (YYYY-MM-DDTHH:mm)</Text>
            <TextInput style={styles.input} value={returnInput} onChangeText={setReturnInput} />

            <Text style={styles.label}>Distance reelle (km)</Text>
            <TextInput
              style={styles.input}
              value={actualDistance}
              onChangeText={setActualDistance}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Remarques (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={postNotes}
              onChangeText={setPostNotes}
            />

            {closeError ? <Text style={styles.errorText}>{closeError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setClosingSessionId(null)}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onConfirmCloseSession}>
                <Text style={styles.primaryButtonText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7fb"
  },
  authContainer: {
    padding: 20,
    gap: 10,
    justifyContent: "center",
    flexGrow: 1
  },
  appTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#12233d"
  },
  appSubtitle: {
    color: "#436084",
    marginBottom: 12
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#12233d"
  },
  headerSubtitle: {
    color: "#436084"
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#9fb3cb",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  logoutButtonText: {
    color: "#325275",
    fontWeight: "600"
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#bed1e6",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#ffffff"
  },
  tabActive: {
    backgroundColor: "#dcedff",
    borderColor: "#86aeda"
  },
  tabText: {
    color: "#446487",
    fontWeight: "600",
    fontSize: 12
  },
  tabTextActive: {
    color: "#1a3f66"
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 12
  },
  dashboardIntro: {
    gap: 6,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#12233d"
  },
  sectionSubtitle: {
    color: "#507199"
  },
  card: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d2e2f2",
    gap: 4
  },
  cardWarning: {
    borderColor: "#e3aa47",
    backgroundColor: "#fff5e4"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#203a58"
  },
  cardText: {
    color: "#4c6a8d"
  },
  warningText: {
    color: "#9b5b00",
    fontWeight: "700"
  },
  formContainer: {
    padding: 16,
    gap: 8,
    paddingBottom: 120
  },
  historyContainer: {
    flex: 1,
    padding: 16,
    gap: 8
  },
  label: {
    color: "#294665",
    fontWeight: "600",
    marginTop: 4
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfd1e6",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f3550"
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#1f6fb2",
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#e7f0fa",
    alignItems: "center",
    marginTop: 6
  },
  secondaryButtonText: {
    color: "#245179",
    fontWeight: "700"
  },
  linkButton: {
    alignItems: "center",
    marginTop: 6
  },
  linkButtonText: {
    color: "#285f96",
    textDecorationLine: "underline"
  },
  errorText: {
    color: "#b13030",
    fontWeight: "600",
    marginTop: 4
  },
  emptyText: {
    color: "#5d7899",
    textAlign: "center",
    marginTop: 16
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: "#bad0e7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  choiceChipSelected: {
    borderColor: "#1f6fb2",
    backgroundColor: "#e1f0ff"
  },
  choiceChipText: {
    color: "#3f5f81",
    fontWeight: "600"
  },
  choiceChipTextSelected: {
    color: "#144f83"
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 8
  },
  disabledButton: {
    opacity: 0.45
  },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 16
  },
  modalCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 16,
    gap: 8
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  }
});
