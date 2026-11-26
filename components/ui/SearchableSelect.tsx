import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius } from "../../lib/theme";

export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

type Props<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Show search field when there are more than this many options (default 5). Set to 0 to always show. */
  searchThreshold?: number;
  disabled?: boolean;
};

export function SearchableSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchThreshold = 5,
  disabled = false,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const showSearch =
    searchThreshold === 0 || options.length > searchThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function openModal() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function pick(option: SelectOption<T>) {
    onValueChange(option.value);
    setOpen(false);
    setQuery("");
  }

  return (
  <>
    <Pressable
      onPress={openModal}
      disabled={disabled}
      style={({ pressed }) => [
        styles.trigger,
        disabled && styles.triggerDisabled,
        pressed && !disabled && styles.triggerPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded: open }}
    >
      <Text
        style={[styles.triggerText, !selected && styles.triggerPlaceholder]}
        numberOfLines={1}
      >
        {selected?.label ?? placeholder}
      </Text>
      <Ionicons
        name="chevron-down"
        size={20}
        color={colors.textSecondary}
        style={styles.chevron}
      />
    </Pressable>

    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setOpen(false)}
    >
      <View style={[styles.sheet, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Choose</Text>
          <Pressable onPress={() => setOpen(false)} hitSlop={12}>
            <Text style={styles.doneBtn}>Done</Text>
          </Pressable>
        </View>

        {showSearch ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {query.length > 0 && Platform.OS === "android" ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 16,
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No matches.</Text>
          }
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text
                  style={[styles.rowLabel, active && styles.rowLabelActive]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={22}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    minHeight: 50,
  },
  triggerPressed: { backgroundColor: colors.tagNeutral },
  triggerDisabled: { opacity: 0.55 },
  triggerText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    color: colors.text,
  },
  triggerPlaceholder: {
    color: colors.textSecondary,
    fontWeight: "400",
  },
  chevron: { marginLeft: 8 },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  doneBtn: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.primary,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  rowActive: { backgroundColor: colors.incomeMuted },
  rowPressed: { backgroundColor: colors.tagNeutral },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginRight: 12,
  },
  rowLabelActive: {
    fontWeight: "600",
    color: colors.primary,
  },
  empty: {
    textAlign: "center",
    marginTop: 24,
    fontSize: 15,
    color: colors.textSecondary,
  },
});