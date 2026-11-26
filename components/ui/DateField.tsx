import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dateToShopYmd,
  formatDayShortFromYmd,
  shopTodayYmd,
  ymdToDate,
} from "../../lib/dates";
import { colors, radius } from "../../lib/theme";

type Props = {
  label: string;
  valueYmd: string;
  onChangeYmd: (ymd: string) => void;
  minimumDate?: string;
  maximumDate?: string;
};

export function DateField({
  label,
  valueYmd,
  onChangeYmd,
  minimumDate,
  maximumDate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [draft, setDraft] = useState(ymdToDate(valueYmd));

  const minDate = minimumDate ? ymdToDate(minimumDate) : undefined;
  const maxDate = maximumDate
    ? ymdToDate(maximumDate)
    : ymdToDate(shopTodayYmd());

  function open() {
    setDraft(ymdToDate(valueYmd));
    if (Platform.OS === "android") {
      setAndroidOpen(true);
    } else {
      setIosOpen(true);
    }
  }

  function commitFromAndroid(event: DateTimePickerEvent, date?: Date) {
    setAndroidOpen(false);
    if (event.type === "set" && date) {
      onChangeYmd(dateToShopYmd(date));
    }
  }

  function commitIos() {
    onChangeYmd(dateToShopYmd(draft));
    setIosOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        <Text style={styles.value}>{formatDayShortFromYmd(valueYmd)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      {androidOpen ? (
        <DateTimePicker
          value={ymdToDate(valueYmd)}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={commitFromAndroid}
        />
      ) : null}

      <Modal
        visible={iosOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setIosOpen(false)}
      >
        <View style={[styles.sheet, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setIosOpen(false)} hitSlop={12}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Pressable onPress={commitIos} hitSlop={12}>
              <Text style={styles.doneBtn}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            minimumDate={minDate}
            maximumDate={maxDate}
            onChange={(_, date) => {
              if (date) setDraft(date);
            }}
            themeVariant="light"
            style={styles.iosPicker}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  triggerPressed: { backgroundColor: colors.tagNeutral },
  value: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  cancelBtn: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  doneBtn: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.primary,
  },
  iosPicker: { alignSelf: "center" },
});