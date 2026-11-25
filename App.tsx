import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { FeedbackProvider } from "./components/feedback/FeedbackProvider";
import { LoginScreen } from "./components/LoginScreen";
import { MainApp } from "./components/MainApp";
import { assertSupabaseConfig } from "./lib/config";
import { TAB_BAR_BASE_HEIGHT } from "./lib/safe-layout";
import { supabase } from "./lib/supabase";
import { colors } from "./lib/theme";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    try {
      assertSupabaseConfig();
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Invalid configuration");
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.boot} edges={["top", "bottom"]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (configError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.boot} edges={["top", "bottom"]}>
          <Text style={styles.configError}>{configError}</Text>
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const snackbarOffset = session?.user ? TAB_BAR_BASE_HEIGHT : 24;

  return (
    <SafeAreaProvider>
      <FeedbackProvider snackbarBottomOffset={snackbarOffset}>
        <StatusBar style="dark" />
        {session?.user ? (
          <MainApp
            userId={session.user.id}
            userEmail={session.user.email ?? ""}
            onSignOut={() => setSession(null)}
          />
        ) : (
          <LoginScreen />
        )}
      </FeedbackProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: 24,
  },
  configError: {
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
});