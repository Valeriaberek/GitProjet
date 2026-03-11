import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Rowing Logbook</Text>
        <Text style={styles.subtitle}>Scaffold React Native (Expo) ready.</Text>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
    color: "#152238"
  },
  subtitle: {
    fontSize: 16,
    color: "#3a4a66"
  }
});
