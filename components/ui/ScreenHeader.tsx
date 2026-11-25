import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeLayout } from "../../lib/safe-layout";
import { colors } from "../../lib/theme";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export function ScreenHeader({ title, subtitle, onBack }: Props) {
  const { top } = useSafeLayout();

  return (
    <View style={[styles.wrap, { paddingTop: top + 8 }]}>
      {onBack ? (
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={colors.text}
          />
        </Pressable>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.backPlaceholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  backPlaceholder: { width: 40 },
  center: { flex: 1, alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});