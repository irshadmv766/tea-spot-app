import { StyleSheet } from "react-native";

/** Design tokens from billing UI mock */
export const colors = {
  bg: "#f6f7f9",
  card: "#ffffff",
  primary: "#1b5e43",
  primaryDark: "#144a35",
  text: "#1a1a1a",
  textSecondary: "#6b7280",
  border: "#e5e7eb",
  borderLight: "#eceff3",
  income: "#1b5e43",
  incomeMuted: "#e8f0e4",
  expense: "#8b2332",
  expenseMuted: "#f3e4e7",
  expenseTint: "#fdf4f5",
  expenseBorder: "#d4a5ad",
  sale: "#1b5e43",
  badgeText: "#8b2332",
  badgeBg: "#ffffff",
  tabActiveBg: "#e8f0e4",
  link: "#1b5e43",
  tagNeutral: "#f3f4f6",
  tagNeutralText: "#4b5563",
};

export const categoryColors = ["#e8a04c", "#5b8def", "#6bbf6b", "#c77dff", "#f472b6"];

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  hero: 24,
  pill: 24,
};

/** Home net summary card — gradient, border, and text by sign */
export const netHero = {
  negative: {
    gradient: ["#ffffff", "#fff0f0"] as const,
    border: "#fad7d7",
    amount: "#8b2332",
    badgeBorder: "#e8b4b8",
    badgeText: "#8b2332",
  },
  positive: {
    gradient: ["#ffffff", "#eef5ea"] as const,
    border: "#d4e5cc",
    amount: "#1b5e43",
    badgeBorder: "#c5d9bc",
    badgeText: "#1b5e43",
  },
  balanced: {
    gradient: ["#ffffff", "#f3f4f6"] as const,
    border: "#e8eaed",
    amount: "#1a1a1a",
    badgeBorder: "#e5e7eb",
    badgeText: "#6b7280",
  },
} as const;

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  muted: { fontSize: 13, color: colors.textSecondary },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.7 },
});