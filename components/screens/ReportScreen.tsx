import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getExpenseByCategory,
  getExpenseList,
  getIncomeList,
  getPeriodTotals,
} from "../../lib/queries";
import type {
  ExpenseListRow,
  IncomeListRow,
  PeriodTotals,
} from "../../lib/types";
import {
  defaultCustomRangeYmd,
  formatDayLocal,
  formatTimeLocal,
  getReportRange,
  shopTodayYmd,
  type ReportPreset,
} from "../../lib/dates";
import { formatMoney } from "../../lib/format";
import { useSafeLayout } from "../../lib/safe-layout";
import { colors, shared } from "../../lib/theme";
import { DateField } from "../ui/DateField";
import { ScreenHeader } from "../ui/ScreenHeader";

type Props = {
  refreshKey: number;
  onBack?: () => void;
};

type ListTab = "summary" | "income" | "expense";

export function ReportScreen({ refreshKey, onBack }: Props) {
  const { scrollBottom } = useSafeLayout();
  const [preset, setPreset] = useState<ReportPreset>("today");
  const defaultCustom = useMemo(() => defaultCustomRangeYmd(), []);
  const [customFromYmd, setCustomFromYmd] = useState(defaultCustom.fromYmd);
  const [customToYmd, setCustomToYmd] = useState(defaultCustom.toYmd);
  const [listTab, setListTab] = useState<ListTab>("summary");
  const [totals, setTotals] = useState<PeriodTotals | null>(null);
  const [breakdown, setBreakdown] = useState<{ name: string; total: number }[]>(
    []
  );
  const [income, setIncome] = useState<IncomeListRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(
    () => getReportRange(preset, customFromYmd, customToYmd),
    [preset, customFromYmd, customToYmd]
  );

  const load = useCallback(async () => {
    const [t, b, inc, exp] = await Promise.all([
      getPeriodTotals(range),
      getExpenseByCategory(range),
      getIncomeList(range),
      getExpenseList(range),
    ]);
    setTotals(t);
    setBreakdown(b);
    setIncome(inc);
    setExpenses(exp);
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load, refreshKey]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const rangeLabel = range.label;
  const todayYmd = shopTodayYmd();

  function onCustomFromChange(ymd: string) {
    setCustomFromYmd(ymd);
    if (ymd > customToYmd) setCustomToYmd(ymd);
  }

  function onCustomToChange(ymd: string) {
    setCustomToYmd(ymd);
    if (ymd < customFromYmd) setCustomFromYmd(ymd);
  }

  return (
    <View style={shared.screen}>
      <ScreenHeader title="Reports" onBack={onBack} />

      <View style={styles.presetRow}>
        {(
          [
            ["today", "Today"],
            ["week", "7 days"],
            ["month", "Month"],
            ["custom", "Custom"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.presetChip, preset === key && styles.presetActive]}
            onPress={() => setPreset(key)}
          >
            <Text
              style={[
                styles.presetText,
                preset === key && styles.presetTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {preset === "custom" ? (
        <View style={styles.customRange}>
          <DateField
            label="From"
            valueYmd={customFromYmd}
            onChangeYmd={onCustomFromChange}
            maximumDate={customToYmd}
          />
          <Text style={styles.rangeDash}>–</Text>
          <DateField
            label="To"
            valueYmd={customToYmd}
            onChangeYmd={onCustomToChange}
            minimumDate={customFromYmd}
            maximumDate={todayYmd}
          />
        </View>
      ) : null}

      <View style={styles.listTabs}>
        {(
          [
            ["summary", "Summary"],
            ["income", "Income"],
            ["expense", "Expenses"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.listTab, listTab === key && styles.listTabActive]}
            onPress={() => setListTab(key)}
          >
            <Text
              style={[
                styles.listTabText,
                listTab === key && styles.listTabTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading || !totals ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : listTab === "summary" ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Text style={styles.rangeCaption}>{rangeLabel}</Text>
          <View style={shared.card}>
            <Row label="Product sales" value={formatMoney(totals.salesTotal)} />
            <Row
              label="Manual income"
              value={formatMoney(totals.incomeTotal)}
            />
            <Row
              label="Total in"
              value={formatMoney(totals.salesTotal + totals.incomeTotal)}
              bold
            />
            <Row label="Expenses" value={formatMoney(totals.expensesTotal)} />
            <Row label="Net" value={formatMoney(totals.netTotal)} bold />
          </View>

          <Text style={styles.sectionTitle}>Expenses by category</Text>
          {breakdown.length === 0 ? (
            <Text style={styles.empty}>No expenses in this period.</Text>
          ) : (
            breakdown.map((row) => (
              <View key={row.name} style={shared.card}>
                <View style={shared.rowBetween}>
                  <Text style={styles.itemTitle}>{row.name}</Text>
                  <Text style={styles.expenseAmount}>
                    {formatMoney(row.total)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : listTab === "income" ? (
        <FlatList
          data={income}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          ListEmptyComponent={
            <Text style={styles.empty}>No income in this period.</Text>
          }
          renderItem={({ item }) => (
            <View style={shared.card}>
              <View style={shared.rowBetween}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={shared.muted}>
                    {item.kind === "sale" ? "Sale" : "Manual"} ·{" "}
                    {formatDayLocal(item.at)} {formatTimeLocal(item.at)}
                    {item.paymentName ? ` · ${item.paymentName}` : ""}
                  </Text>
                </View>
                <Text style={styles.incomeAmount}>
                  +{formatMoney(item.amount)}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          ListEmptyComponent={
            <Text style={styles.empty}>No expenses in this period.</Text>
          }
          renderItem={({ item }) => (
            <View style={shared.card}>
              <View style={shared.rowBetween}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={shared.muted}>
                    {formatDayLocal(item.at)} {formatTimeLocal(item.at)}
                    {item.categoryName ? ` · ${item.categoryName}` : ""}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  −{formatMoney(item.amount)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={[shared.rowBetween, { marginBottom: 8 }]}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  customRange: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  rangeDash: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary,
    paddingBottom: 14,
  },
  presetChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e8ecef",
  },
  presetActive: { backgroundColor: colors.primary },
  presetText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  presetTextActive: { color: "#fff" },
  listTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#e8ecef",
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  listTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  listTabActive: { backgroundColor: "#fff" },
  listTabText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  listTabTextActive: { color: colors.primary },
  rangeCaption: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  empty: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  incomeAmount: { fontSize: 16, fontWeight: "700", color: colors.income },
  expenseAmount: { fontSize: 16, fontWeight: "700", color: colors.expense },
  rowLabel: { fontSize: 15, color: colors.textSecondary },
  rowValue: { fontSize: 15, color: colors.text },
  bold: { fontWeight: "700", color: colors.text },
});