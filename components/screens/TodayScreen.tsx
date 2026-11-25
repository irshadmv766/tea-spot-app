import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { categoryAccent } from "../../lib/category-style";
import { getRangeForDayOffset } from "../../lib/dates";
import { formatMoney, formatSignedMoney } from "../../lib/format";
import {
  createManualEntry,
  deleteExpense,
  deleteManualIncome,
  deleteSale,
  getExpenseEntry,
  getManualIncomeEntry,
} from "../../lib/actions";
import { useFeedback } from "../feedback/FeedbackProvider";
import {
  getDayTransactions,
  getExpenseByCategory,
  getPeriodTotals,
} from "../../lib/queries";
import { useSafeLayout } from "../../lib/safe-layout";
import { categoryColors, colors, netHero, radius } from "../../lib/theme";
import type {
  DayTransactionRow,
  EntryKind,
  ExpenseCategoryRow,
} from "../../lib/types";

type Props = {
  userId: string;
  refreshKey: number;
  onOpenSale: () => void;
  onOpenExpense: () => void;
  onOpenReports: () => void;
  onOpenSettings: () => void;
  onEditEntry: (kind: EntryKind, id: string) => void;
  onEditSale: (id: string) => void;
  onDataChanged: () => void;
};

export function TodayScreen({
  userId,
  refreshKey,
  onOpenSale,
  onOpenExpense,
  onOpenReports,
  onOpenSettings,
  onEditEntry,
  onEditSale,
  onDataChanged,
}: Props) {
  const feedback = useFeedback();
  const { top, scrollBottom } = useSafeLayout();
  const [dayOffset, setDayOffset] = useState(0);
  const [rows, setRows] = useState<DayTransactionRow[]>([]);
  const [breakdown, setBreakdown] = useState<ExpenseCategoryRow[]>([]);
  const [net, setNet] = useState(0);
  const [incomeIn, setIncomeIn] = useState(0);
  const [expenseOut, setExpenseOut] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => getRangeForDayOffset(dayOffset), [dayOffset]);
  const dateLabel = range.label === "Today" ? range.label : range.label;
  const showDay =
    range.label === "Today"
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
        }).format(new Date())
      : range.label;

  const load = useCallback(async () => {
    const r = getRangeForDayOffset(dayOffset);
    const [list, totals, categories] = await Promise.all([
      getDayTransactions(r),
      getPeriodTotals(r),
      getExpenseByCategory(r),
    ]);
    setRows(list);
    setBreakdown(categories);
    setIncomeIn(totals.salesTotal + totals.incomeTotal);
    setExpenseOut(totals.expensesTotal);
    setNet(totals.netTotal);
    setSalesCount(totals.salesCount);
  }, [dayOffset]);

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

  const badgeText =
    net < 0
      ? "Spent more than earned"
      : net > 0
        ? "Earned more than spent"
        : "Balanced";

  const heroTheme =
    net < 0
      ? netHero.negative
      : net > 0
        ? netHero.positive
        : netHero.balanced;

  const netLabel = dayOffset === 0 ? "Net today" : "Net";

  const subtitle = `${rows.length} transaction${rows.length === 1 ? "" : "s"} · ${
    salesCount === 0 ? "no sales yet" : `${salesCount} sale${salesCount === 1 ? "" : "s"}`
  }`;

  const expenseTotal = breakdown.reduce((a, b) => a + b.total, 0);

  function entryDeleteCopy(item: DayTransactionRow) {
    const signed =
      item.kind === "expense"
        ? `(-${formatMoney(item.amount)})`
        : `(+${formatMoney(item.amount)})`;
    return `'${item.title}' ${signed} will be removed from today's total.`;
  }

  function openTransactionActions(item: DayTransactionRow) {
    if (item.kind === "sale") {
      feedback.choose({
        title: item.title,
        subtitle: formatMoney(item.amount),
        actions: [
          { label: "Edit", onPress: () => onEditSale(item.id) },
          {
            label: "Delete",
            destructive: true,
            onPress: () =>
              feedback.confirmDelete({
                title: "Delete this sale?",
                message: `${formatMoney(item.amount)} will be removed from today's total.`,
                onConfirm: async () => {
                  try {
                    await deleteSale(item.id);
                    await load();
                    onDataChanged();
                    feedback.success("Sale deleted");
                  } catch (e) {
                    feedback.error(
                      "Couldn't delete",
                      e instanceof Error ? e.message : "Could not delete."
                    );
                  }
                },
              }),
          },
        ],
      });
      return;
    }

    const kind: EntryKind = item.kind === "expense" ? "expense" : "income";
    feedback.choose({
      title: item.title,
      subtitle: formatMoney(item.amount),
      actions: [
        { label: "Edit", onPress: () => onEditEntry(kind, item.id) },
        {
          label: "Delete",
          destructive: true,
          onPress: () =>
            feedback.confirmDelete({
              title:
                kind === "expense"
                  ? "Delete this expense?"
                  : "Delete this income?",
              message: entryDeleteCopy(item),
              onConfirm: async () => {
                try {
                  const record =
                    kind === "expense"
                      ? await getExpenseEntry(item.id)
                      : await getManualIncomeEntry(item.id);
                  if (kind === "expense") {
                    await deleteExpense(item.id);
                  } else {
                    await deleteManualIncome(item.id);
                  }
                  await load();
                  onDataChanged();
                  feedback.undo(
                    kind === "expense" ? "Expense deleted" : "Income deleted",
                    async () => {
                      await createManualEntry(kind, userId, {
                        title: record.title,
                        amount: record.amount,
                        categoryId: record.category_id,
                        paymentMethodId: record.payment_method_id,
                        note: record.description,
                      });
                      await load();
                      onDataChanged();
                      feedback.success(
                        kind === "expense"
                          ? "Expense restored"
                          : "Income restored"
                      );
                    }
                  );
                } catch (e) {
                  feedback.error(
                    "Couldn't delete",
                    e instanceof Error ? e.message : "Could not delete."
                  );
                }
              },
            }),
        },
      ],
    });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Pressable
          style={styles.iconBtn}
          hitSlop={8}
          onPress={() => setDayOffset(0)}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={colors.text}
          />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{dateLabel}</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setDayOffset((d) => d - 1)}
              hitSlop={8}
              style={styles.dateChevron}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.dateText}>{showDay}</Text>
            <Pressable
              onPress={() => setDayOffset((d) => Math.min(0, d + 1))}
              hitSlop={8}
              style={styles.dateChevron}
              disabled={dayOffset >= 0}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={dayOffset >= 0 ? colors.border : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.iconBtn} onPress={onOpenSettings} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: scrollBottom },
          ]}
        >
          <LinearGradient
            colors={[...heroTheme.gradient]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.heroCard,
              {
                borderColor: heroTheme.border,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>{netLabel}</Text>
              <View
                style={[
                  styles.badge,
                  { borderColor: heroTheme.badgeBorder },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: heroTheme.badgeText }]}
                >
                  {badgeText}
                </Text>
              </View>
            </View>
            <Text style={[styles.netAmount, { color: heroTheme.amount }]}>
              {formatSignedMoney(net)}
            </Text>
            <Text style={styles.heroSub}>{subtitle}</Text>
          </LinearGradient>

          <View style={styles.inOutRow}>
            <InOutCard variant="in" amount={incomeIn} />
            <InOutCard variant="out" amount={expenseOut} />
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.saleBtn} onPress={onOpenSale}>
              <Text style={styles.saleBtnText}>+ Sale</Text>
            </Pressable>
            <Pressable style={styles.expenseBtn} onPress={onOpenExpense}>
              <Text style={styles.expenseBtnText}>+ Expense</Text>
            </Pressable>
          </View>

          {breakdown.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Where it went</Text>
              <View style={styles.breakdownBar}>
                {breakdown.map((item, i) => {
                  const pct =
                    expenseTotal > 0 ? (item.total / expenseTotal) * 100 : 0;
                  return (
                    <View
                      key={item.name}
                      style={[
                        styles.breakdownSegment,
                        {
                          flex: pct || 0.001,
                          backgroundColor:
                            categoryColors[i % categoryColors.length],
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.legend}>
                {breakdown.map((item, i) => {
                  const pct =
                    expenseTotal > 0
                      ? Math.round((item.total / expenseTotal) * 100)
                      : 0;
                  return (
                    <View key={item.name} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor:
                              categoryColors[i % categoryColors.length],
                          },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {item.name} {pct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Transactions ({rows.length})
            </Text>
            <Pressable onPress={onOpenReports}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.empty}>No transactions for this day.</Text>
          ) : (
            rows.map((item) => (
              <TransactionCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onLongPress={() => openTransactionActions(item)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function InOutCard({
  variant,
  amount,
}: {
  variant: "in" | "out";
  amount: number;
}) {
  const isIn = variant === "in";
  return (
    <View style={styles.inOutCard}>
      <View style={styles.inOutHeadRow}>
        <View
          style={[
            styles.inOutIconWrap,
            isIn ? styles.inOutIconIn : styles.inOutIconOut,
          ]}
        >
          <MaterialCommunityIcons
            name={isIn ? "arrow-top-right" : "arrow-bottom-left"}
            size={17}
            color={isIn ? colors.income : colors.expense}
          />
        </View>
        <Text style={styles.inOutLabel}>{isIn ? "In" : "Out"}</Text>
      </View>
      <Text
        style={[
          styles.inOutValue,
          { color: isIn ? colors.income : colors.expense },
        ]}
      >
        {formatMoney(amount)}
      </Text>
    </View>
  );
}

function TransactionCard({
  item,
  onLongPress,
}: {
  item: DayTransactionRow;
  onLongPress: () => void;
}) {
  const isExpense = item.kind === "expense";
  const accent = categoryAccent(item.categoryName);
  const tagLabel =
    item.categoryName ??
    (item.kind === "sale" ? "Sale" : item.kind === "income" ? "Income" : "—");

  return (
    <Pressable
      style={styles.txCard}
      onLongPress={onLongPress}
      delayLongPress={400}
      android_ripple={{ color: `${colors.border}44` }}
    >
      <View
        style={[
          styles.txIcon,
          { backgroundColor: `${accent.color}22` },
        ]}
      >
        <MaterialCommunityIcons
          name={accent.icon}
          size={22}
          color={accent.color}
        />
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle}>{item.title}</Text>
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: `${accent.color}1a` }]}>
            <Text style={[styles.tagText, { color: accent.color }]}>
              {tagLabel}
            </Text>
          </View>
          {item.paymentName ? (
            <View style={styles.tagNeutral}>
              <Text style={styles.tagNeutralText}>{item.paymentName}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: isExpense ? colors.expense : colors.income },
        ]}
      >
        {isExpense ? "−" : "+"}
        {formatMoney(item.amount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dateChevron: { padding: 4 },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    minWidth: 56,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 20 },
  heroCard: {
    borderRadius: radius.hero,
    padding: 22,
    marginBottom: 14,
    minHeight: 132,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  badge: {
    flexShrink: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  netAmount: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  inOutRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  inOutCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.hero,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "flex-start",
  },
  inOutHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inOutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  inOutIconIn: { backgroundColor: colors.incomeMuted },
  inOutIconOut: { backgroundColor: colors.expenseTint },
  inOutLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  inOutValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  saleBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    minHeight: 50,
  },
  saleBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  expenseBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 15,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#fad7d7",
  },
  expenseBtnText: { color: colors.expense, fontSize: 15, fontWeight: "700" },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.link,
    marginBottom: 10,
  },
  breakdownBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  breakdownSegment: { minWidth: 4 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, color: colors.textSecondary },
  empty: {
    textAlign: "center",
    color: colors.textSecondary,
    marginVertical: 24,
    fontSize: 15,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txBody: { flex: 1 },
  txTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  tagNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.tagNeutral,
  },
  tagNeutralText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.tagNeutralText,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
});