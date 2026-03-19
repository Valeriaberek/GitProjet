import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

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

const API_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

export default function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken || user) {
      return;
    }

    void fetchMe(accessToken);
  }, [accessToken, user]);

  async function fetchMe(token: string): Promise<void> {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Session invalide");
      }

      const data = (await response.json()) as User;
      setUser(data);
    } catch {
      if (refreshToken) {
        await refreshSession(refreshToken);
      } else {
        clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshSession(token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken: token })
      });

      const data = (await response.json()) as Partial<AuthResponse> & { message?: string | string[] };

      if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(message ?? "Session expiree");
      }

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      setInfo("Session restauree");
    } catch {
      clearSession();
      setError("Reconnecte-toi");
    }
  }

  async function submitAuth(): Promise<void> {
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      const endpoint = mode === "login" ? "login" : "register";
      const payload =
        mode === "register"
          ? { email, password, name }
          : {
              email,
              password
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
        throw new Error(message ?? "Authentification impossible");
      }

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      setPassword("");
      setInfo(mode === "register" ? "Compte cree" : "Connexion reussie");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erreur d'authentification");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout(): Promise<void> {
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
    setInfo("Session fermee");
  }

  function clearSession(): void {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Rowing Logbook</Text>
        <Text style={styles.subtitle}>Authentification mobile</Text>

        {user ? (
          <View style={styles.panel}>
            <Text style={styles.label}>Connecte: {user.name}</Text>
            <Text style={styles.value}>{user.email}</Text>
            <Text style={styles.value}>Role: {user.role}</Text>
            <Pressable style={styles.button} onPress={() => void logout()}>
              <Text style={styles.buttonText}>Se deconnecter</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.switchRow}>
              <Pressable
                style={mode === "login" ? styles.chipActive : styles.chip}
                onPress={() => setMode("login")}
              >
                <Text style={mode === "login" ? styles.chipTextActive : styles.chipText}>Connexion</Text>
              </Pressable>
              <Pressable
                style={mode === "register" ? styles.chipActive : styles.chip}
                onPress={() => setMode("register")}
              >
                <Text style={mode === "register" ? styles.chipTextActive : styles.chipText}>
                  Inscription
                </Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <TextInput
                style={styles.input}
                placeholder="Nom"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Pressable style={styles.button} onPress={() => void submitAuth()}>
              <Text style={styles.buttonText}>{mode === "login" ? "Se connecter" : "Creer un compte"}</Text>
            </Pressable>
          </View>
        )}

        {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
        {info ? <Text style={styles.ok}>{info}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7fb"
  },
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#152238",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 16,
    color: "#3a4a66",
    textAlign: "center",
    marginBottom: 12
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5dceb",
    padding: 14,
    gap: 10
  },
  switchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cad6eb",
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center"
  },
  chipActive: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#1b6b53"
  },
  chipText: {
    color: "#2d3953",
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d8e8",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  button: {
    backgroundColor: "#0f7f6d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1d2a3f"
  },
  value: {
    color: "#3c4a60"
  },
  loader: {
    marginTop: 12
  },
  ok: {
    marginTop: 12,
    color: "#0f684d",
    textAlign: "center"
  },
  error: {
    marginTop: 12,
    color: "#ab1f40",
    textAlign: "center"
  }
});
