import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

type Screen = "dashboard";

type Session = {
  id: string;
  boatName: string;
  skipperName: string;
  skipperId: string;
  startAtIso: string;
};

const CURRENT_USER_ID = "m1";

function elapsedLabel(startAtIso: string): string {
  const minutes = Math.floor((Date.now() - new Date(startAtIso).getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export default function App() {
  const [email, setEmail] = useState("rameur@rowinglogbook.dev");
  const [password, setPassword] = useState("password");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [screen] = useState<Screen>("dashboard");

  const [sessions] = useState<Session[]>([
    {
      id: "s1",
      boatName: "Yole 4+",
      skipperName: "Lina Morel",
      skipperId: CURRENT_USER_ID,
      startAtIso: new Date(Date.now() - 130 * 60000).toISOString()
    },
    {
      id: "s2",
      boatName: "Huit",
      skipperName: "Nora Petit",
      skipperId: "m2",
      startAtIso: new Date(Date.now() - 170 * 60000).toISOString()
    }
  ]);

  const activeSessions = useMemo(() => sessions, [sessions]);

  function onLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Email et mot de passe sont obligatoires.");
      return;
    }
    setError("");
    setIsAuthenticated(true);
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Rowing Logbook</Text>
          <Text style={styles.subtitle}>Connexion rameur</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={onLogin}><Text style={styles.primaryButtonText}>Se connecter</Text></Pressable>
          <Pressable style={styles.linkButton} onPress={() => Alert.alert("Mot de passe oublie", "Un email de reinitialisation serait envoye.")}><Text style={styles.linkButtonText}>Mot de passe oublie</Text></Pressable>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><Text style={styles.headerTitle}>Tableau de bord</Text><Pressable style={styles.secondaryButton} onPress={() => setIsAuthenticated(false)}><Text style={styles.secondaryButtonText}>Deconnexion</Text></Pressable></View>
      {screen === "dashboard" ? (
        <FlatList
          data={activeSessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const warning = Date.now() - new Date(item.startAtIso).getTime() >= 150 * 60000;
            return (
              <View style={[styles.card, warning && styles.cardWarning]}>
                <Text style={styles.cardTitle}>{item.boatName}</Text>
                <Text style={styles.cardText}>Responsable: {item.skipperName}</Text>
                <Text style={styles.cardText}>Duree: {elapsedLabel(item.startAtIso)}</Text>
                {warning ? <Text style={styles.warningText}>Alerte visuelle: +2h30</Text> : null}
                {item.skipperId === CURRENT_USER_ID ? <Text style={styles.badgeText}>Vous etes responsable</Text> : null}
              </View>
            );
          }}
        />
      ) : null}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f7fb" },
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 8 },
  title: { fontSize: 30, fontWeight: "700", color: "#12233d" },
  subtitle: { color: "#436084", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#12233d" },
  label: { color: "#294665", fontWeight: "600" },
  input: { borderRadius: 10, borderWidth: 1, borderColor: "#bfd1e6", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, color: "#1f3550" },
  primaryButton: { marginTop: 8, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: "#1f6fb2", alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#e7f0fa", alignItems: "center" },
  secondaryButtonText: { color: "#245179", fontWeight: "700" },
  linkButton: { alignItems: "center", marginTop: 6 },
  linkButtonText: { color: "#285f96", textDecorationLine: "underline" },
  errorText: { color: "#b13030", fontWeight: "600", marginTop: 4 },
  listContainer: { padding: 16, gap: 12 },
  card: { borderRadius: 14, padding: 14, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d2e2f2", gap: 4 },
  cardWarning: { borderColor: "#e3aa47", backgroundColor: "#fff5e4" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#203a58" },
  cardText: { color: "#4c6a8d" },
  warningText: { color: "#9b5b00", fontWeight: "700" },
  badgeText: { color: "#1f6fb2", fontWeight: "700" }
});
