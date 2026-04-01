import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

export default function App() {
  const [email, setEmail] = useState("rameur@rowinglogbook.dev");
  const [password, setPassword] = useState("password");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  function onLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Email et mot de passe sont obligatoires.");
      return;
    }
    setError("");
    setIsAuthenticated(true);
  }

  if (isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Authentification OK</Text>
          <Text style={styles.subtitle}>La suite des ecrans arrive sur les branches suivantes.</Text>
          <Pressable style={styles.primaryButton} onPress={() => setIsAuthenticated(false)}>
            <Text style={styles.primaryButtonText}>Se deconnecter</Text>
          </Pressable>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Rowing Logbook</Text>
        <Text style={styles.subtitle}>Connexion rameur</Text>

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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={onLogin}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
        <Pressable
          style={styles.linkButton}
          onPress={() => Alert.alert("Mot de passe oublie", "Un email de reinitialisation serait envoye.")}
        >
          <Text style={styles.linkButtonText}>Mot de passe oublie</Text>
        </Pressable>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f7fb" },
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 8 },
  title: { fontSize: 30, fontWeight: "700", color: "#12233d" },
  subtitle: { color: "#436084", marginBottom: 8 },
  label: { color: "#294665", fontWeight: "600" },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfd1e6",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f3550"
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#1f6fb2",
    alignItems: "center"
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  linkButton: { alignItems: "center", marginTop: 6 },
  linkButtonText: { color: "#285f96", textDecorationLine: "underline" },
  errorText: { color: "#b13030", fontWeight: "600", marginTop: 4 }
});
