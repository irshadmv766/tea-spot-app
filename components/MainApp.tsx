import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeLayout } from "../lib/safe-layout";
import { supabase } from "../lib/supabase";
import { colors, radius } from "../lib/theme";
import type { EntryKind } from "../lib/types";
import { EntryScreen } from "./screens/EntryScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { SaleScreen } from "./screens/SaleScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodayScreen } from "./screens/TodayScreen";

type Tab = "today" | "sale" | "add" | "report" | "settings";

type Props = {
  userId: string;
  userEmail: string;
  onSignOut: () => void;
};

const TABS: {
  key: Tab;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { key: "today", label: "Today", icon: "home-outline" },
  { key: "sale", label: "Sale", icon: "cart-outline" },
  { key: "add", label: "Add", icon: "plus-circle-outline" },
  { key: "report", label: "Reports", icon: "chart-bar" },
];

export function MainApp({ userId, userEmail, onSignOut }: Props) {
  const { tabBarPaddingBottom } = useSafeLayout();
  const [tab, setTab] = useState<Tab>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [addKind, setAddKind] = useState<EntryKind>("income");
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);

  function openEditSale(id: string) {
    clearEditEntry();
    setEditSaleId(id);
    setTab("sale");
  }

  function clearEditSale() {
    setEditSaleId(null);
  }

  function openEditEntry(kind: EntryKind, id: string) {
    setAddKind(kind);
    setEditEntryId(id);
    setTab("add");
  }

  function clearEditEntry() {
    setEditEntryId(null);
  }

  function bumpRefresh() {
    setRefreshKey((k) => k + 1);
  }

  async function signOut() {
    await supabase.auth.signOut();
    onSignOut();
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {tab === "today" ? (
          <TodayScreen
            userId={userId}
            refreshKey={refreshKey}
            onOpenSale={() => {
              clearEditSale();
              setTab("sale");
            }}
            onEditSale={openEditSale}
            onOpenExpense={() => {
              setAddKind("expense");
              setTab("add");
            }}
            onOpenReports={() => setTab("report")}
            onOpenSettings={() => setTab("settings")}
            onEditEntry={openEditEntry}
            onDataChanged={bumpRefresh}
          />
        ) : tab === "settings" ? (
          <SettingsScreen
            userId={userId}
            userEmail={userEmail}
            refreshKey={refreshKey}
            onBack={() => setTab("today")}
            onSignOut={signOut}
            onChanged={bumpRefresh}
          />
        ) : tab === "sale" ? (
          <SaleScreen
            key={editSaleId ?? "new-sale"}
            refreshKey={refreshKey}
            editSaleId={editSaleId}
            onSaleDone={() => {
              clearEditSale();
              bumpRefresh();
              setTab("today");
            }}
            onBack={() => {
              clearEditSale();
              setTab("today");
            }}
          />
        ) : tab === "add" ? (
          <EntryScreen
            key={editEntryId ? `${addKind}-${editEntryId}` : addKind}
            userId={userId}
            initialKind={addKind}
            editId={editEntryId}
            onSaved={() => {
              clearEditEntry();
              bumpRefresh();
              setTab("today");
            }}
            onBack={() => {
              clearEditEntry();
              setTab("today");
            }}
          />
        ) : (
          <ReportScreen refreshKey={refreshKey} onBack={() => setTab("today")} />
        )}
      </View>

      {tab !== "settings" ? (
      <View style={[styles.tabBar, { paddingBottom: tabBarPaddingBottom }]}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              style={styles.tabItem}
              onPress={() => {
                if (item.key === "add") {
                  setAddKind("income");
                  clearEditEntry();
                }
                if (item.key === "sale") {
                  clearEditSale();
                }
                setTab(item.key);
              }}
            >
              <View
                style={[
                  styles.tabIconWrap,
                  active && styles.tabIconWrapActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={22}
                  color={active ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.card,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 4 },
  tabIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: { backgroundColor: colors.tabActiveBg },
  tabLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  tabLabelActive: { color: colors.primary },
});