import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFeedback } from "./feedback/FeedbackProvider";
import { BRAND_NAME } from "../lib/config";
import { supabase } from "../lib/supabase";
import { colors, shared } from "../lib/theme";

export function LoginScreen() {
  const feedback = useFeedback();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      feedback.error("Missing fields", "Enter email and password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setBusy(false);

    if (error) {
      feedback.error("Sign in failed", error.message);
      return;
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "android" ? "padding" : undefined}
      >
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logo}
            accessibilityLabel="Shop logo"
          />
          <Text style={styles.brandName}>{BRAND_NAME}</Text>
        </View>
        <Text style={styles.subtitle}>Sign in with your shop account.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
        />

        <Pressable
          style={[shared.primaryBtn, busy && shared.btnDisabled, styles.signInBtn]}
          onPress={signIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={shared.primaryBtnText}>Sign in</Text>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  brandRow: {
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: "#fafafa",
  },
  signInBtn: { marginTop: 16, borderRadius: 12 },
});