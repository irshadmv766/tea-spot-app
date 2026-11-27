import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFeedback } from "../feedback/FeedbackProvider";
import { ScreenHeader } from "../ui/ScreenHeader";
import { SearchableSelect } from "../ui/SearchableSelect";
import {
  createManualEntry,
  deleteExpense,
  deleteManualIncome,
  getExpenseEntry,
  getManualIncomeEntry,
  loadEntryCatalog,
  updateManualEntry,
} from "../../lib/actions";
import type { ReceiptImageSource } from "../../lib/receipt-scanner";
import { scanReceiptFromImage } from "../../lib/receipt-scanner";
import { useSafeLayout } from "../../lib/safe-layout";
import { colors, shared } from "../../lib/theme";
import type {
  CategoryRow,
  EntryKind,
  PaymentRow,
} from "../../lib/types";

type ScanField = "title" | "amount" | "note";

type Props = {
  userId: string;
  initialKind?: EntryKind;
  editId?: string | null;
  onSaved: () => void;
  onBack?: () => void;
};

export function EntryScreen({
  userId,
  initialKind = "income",
  editId = null,
  onSaved,
  onBack,
}: Props) {
  const feedback = useFeedback();
  const { scrollBottom } = useSafeLayout();
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [note, setNote] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHints, setScanHints] = useState<Set<ScanField>>(new Set());
  const isEdit = Boolean(editId);
  const canScanReceipt = kind === "expense" && !isEdit;

  const categoryOptions = useMemo(
    () => [
      { label: "— None —", value: "" },
      ...categories.map((c) => ({ label: c.name, value: c.id })),
    ],
    [categories]
  );

  const paymentOptions = useMemo(
    () =>
      payments.length === 0
        ? [{ label: "— None —", value: "" }]
        : payments.map((p) => ({ label: p.name, value: p.id })),
    [payments]
  );

  const refreshCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const data = await loadEntryCatalog(kind);
      setCategories(data.categories);
      setPayments(data.payments);
      if (!isEdit) {
        setCategoryId("");
        setPaymentId(data.payments[0]?.id ?? "");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load options.";
      feedback.error("Couldn't load", message);
    } finally {
      setLoadingCatalog(false);
    }
  }, [kind, isEdit]);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (!editId) {
      setEntryDate(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      try {
        const record =
          kind === "expense"
            ? await getExpenseEntry(editId)
            : await getManualIncomeEntry(editId);
        if (cancelled) return;
        setTitle(record.title);
        setAmount(String(record.amount));
        setCategoryId(record.category_id ?? "");
        setPaymentId(record.payment_method_id ?? "");
        setNote(record.description ?? "");
        setEntryDate(record.entry_date);
      } catch (e) {
        if (!cancelled) {
          feedback.error(
            "Couldn't load",
            e instanceof Error ? e.message : "Could not load entry."
          );
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, kind, refreshCatalog]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setNote("");
    setCategoryId("");
    setScanHints(new Set());
    if (payments[0]) setPaymentId(payments[0].id);
  }

  function clearScanHint(field: ScanField) {
    setScanHints((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function applyScannedFields(parsed: {
    merchantName: string | null;
    totalAmount: number | null;
    description: string | null;
  }) {
    const hints = new Set<ScanField>();

    if (parsed.merchantName) {
      setTitle(parsed.merchantName);
      hints.add("title");
    }
    if (parsed.totalAmount != null) {
      setAmount(String(parsed.totalAmount));
      hints.add("amount");
    }
    if (parsed.description) {
      setNote(parsed.description);
      hints.add("note");
    }

    setScanHints(hints);

    if (hints.size === 0) {
      feedback.error(
        "Couldn't read receipt",
        "We found text but could not detect merchant, total, or notes. Enter details manually."
      );
      return;
    }

    feedback.success(
      "Receipt scanned — review highlighted fields before saving."
    );
  }

  async function runReceiptScan(source: ReceiptImageSource) {
    setScanning(true);
    try {
      const parsed = await scanReceiptFromImage(source);
      if (!parsed) return;
      applyScannedFields(parsed);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not process this receipt.";
      feedback.error("Scan failed", message);
    } finally {
      setScanning(false);
    }
  }

  function promptScanReceipt() {
    if (scanning) return;
    feedback.choose({
      title: "Scan receipt",
      subtitle:
        "Capture or choose a receipt photo. Text is recognized on your device only.",
      actions: [
        {
          label: "Take photo",
          onPress: () => {
            void runReceiptScan("camera");
          },
        },
        {
          label: "Choose from gallery",
          onPress: () => {
            void runReceiptScan("library");
          },
        },
      ],
    });
  }

  async function save() {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!title.trim()) {
      feedback.error("Title required", "Add a short description.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      feedback.error("Amount required", "Enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (editId && entryDate) {
        await updateManualEntry(kind, editId, {
          title,
          amount: parsed,
          categoryId: categoryId || null,
          paymentMethodId: paymentId || null,
          note: note || null,
          entryDate,
        });
        feedback.success(
          kind === "income" ? "Income updated" : "Expense updated"
        );
      } else {
        await createManualEntry(kind, userId, {
          title,
          amount: parsed,
          categoryId: categoryId || null,
          paymentMethodId: paymentId || null,
          note: note || null,
        });
        feedback.success(
          kind === "income" ? "Income recorded" : "Expense recorded"
        );
        resetForm();
      }
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save.";
      feedback.error("Couldn't save right now", message, {
        onRetry: () => save(),
      });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editId) return;
    feedback.confirmDelete({
      title: kind === "expense" ? "Delete this expense?" : "Delete this income?",
      message: title
        ? `'${title}' will be removed permanently.`
        : "This cannot be undone.",
      onConfirm: async () => {
        setSaving(true);
        try {
          if (kind === "expense") {
            await deleteExpense(editId);
          } else {
            await deleteManualIncome(editId);
          }
          feedback.success(
            kind === "expense" ? "Expense deleted" : "Income deleted"
          );
          onSaved();
        } catch (e) {
          feedback.error(
            "Couldn't delete",
            e instanceof Error ? e.message : "Could not delete."
          );
        } finally {
          setSaving(false);
        }
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === "android" ? "padding" : undefined}
    >
      <ScreenHeader
        title={isEdit ? "Edit entry" : "Add entry"}
        onBack={onBack}
      />

      <View style={styles.tabs}>
        {(["income", "expense"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, kind === tab && styles.tabActive]}
            onPress={() => !isEdit && setKind(tab)}
            disabled={isEdit}
          >
            <Text style={[styles.tabText, kind === tab && styles.tabTextActive]}>
              {tab === "income" ? "Income" : "Expense"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadingCatalog ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: scrollBottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {canScanReceipt ? (
            <View style={styles.scanSection}>
              <Pressable
                style={[styles.scanBtn, scanning && styles.btnDisabled]}
                onPress={promptScanReceipt}
                disabled={scanning || saving}
              >
                {scanning ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="receipt-text-outline"
                    size={22}
                    color={colors.primary}
                  />
                )}
                <Text style={styles.scanBtnText}>
                  {scanning ? "Reading receipt…" : "Scan receipt"}
                </Text>
              </Pressable>
              {scanHints.size > 0 ? (
                <Text style={styles.scanHint}>
                  Highlighted fields were filled from the receipt — please verify.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={[styles.input, scanHints.has("title") && styles.inputScanFilled]}
            value={title}
            onChangeText={(v) => {
              clearScanHint("title");
              setTitle(v);
            }}
            placeholder={kind === "income" ? "e.g. Cash sale" : "e.g. Milk"}
          />

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={[
              styles.input,
              styles.amountInput,
              scanHints.has("amount") && styles.inputScanFilled,
            ]}
            value={amount}
            onChangeText={(v) => {
              clearScanHint("amount");
              setAmount(v);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Text style={styles.label}>Category (optional)</Text>
          <SearchableSelect
            value={categoryId}
            onValueChange={setCategoryId}
            options={categoryOptions}
            placeholder="— None —"
          />

          <Text style={styles.label}>Payment</Text>
          <SearchableSelect
            value={paymentId}
            onValueChange={setPaymentId}
            options={paymentOptions}
            placeholder="Select payment"
          />

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.noteInput,
              scanHints.has("note") && styles.inputScanFilled,
            ]}
            value={note}
            onChangeText={(v) => {
              clearScanHint("note");
              setNote(v);
            }}
            multiline
            placeholder="Short note"
          />

          <Pressable
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEdit
                  ? "Save changes"
                  : `Save ${kind === "income" ? "income" : "expense"}`}
              </Text>
            )}
          </Pressable>

          {isEdit ? (
            <Pressable
              style={styles.deleteBtn}
              onPress={confirmDelete}
              disabled={saving}
            >
              <Text style={styles.deleteBtnText}>Delete entry</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#e8ecef",
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  form: { padding: 20, gap: 6 },
  scanSection: { marginBottom: 4, gap: 8 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#f4faf8",
  },
  scanBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  scanHint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inputScanFilled: {
    borderColor: colors.primary,
    backgroundColor: "#f4faf8",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    backgroundColor: "#fff",
  },
  amountInput: { fontSize: 28, fontWeight: "700" },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  deleteBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.expenseBorder,
    backgroundColor: "#fff",
  },
  deleteBtnText: {
    color: colors.expense,
    fontSize: 17,
    fontWeight: "700",
  },
});