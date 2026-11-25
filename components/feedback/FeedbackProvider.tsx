import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_BASE_HEIGHT } from "../../lib/safe-layout";
import { feedbackColors, feedbackRadius } from "../../lib/feedback-theme";

type SuccessState = {
  kind: "success";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type UndoState = {
  kind: "undo";
  message: string;
  onUndo: () => void | Promise<void>;
};

type SnackbarState = SuccessState | UndoState;

type DeleteSheetState = {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
};

type ErrorState = {
  title: string;
  message: string;
  onRetry?: () => void;
};

type ChooseAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type ChooseState = {
  title: string;
  subtitle?: string;
  actions: ChooseAction[];
};

export type FeedbackApi = {
  success: (
    message: string,
    options?: { actionLabel?: string; onAction?: () => void }
  ) => void;
  undo: (message: string, onUndo: () => void | Promise<void>) => void;
  error: (
    title: string,
    message: string,
    options?: { onRetry?: () => void }
  ) => void;
  confirmDelete: (options: DeleteSheetState) => void;
  choose: (options: ChooseState) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

const SNACKBAR_MS = 4500;

type Props = {
  children: ReactNode;
  /** Extra offset so snackbars sit above the tab bar */
  snackbarBottomOffset?: number;
};

export function FeedbackProvider({
  children,
  snackbarBottomOffset = TAB_BAR_BASE_HEIGHT,
}: Props) {
  const insets = useSafeAreaInsets();
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [deleteSheet, setDeleteSheet] = useState<DeleteSheetState | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorState | null>(null);
  const [chooseSheet, setChooseSheet] = useState<ChooseState | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSnackTimer = useCallback(() => {
    if (snackTimer.current) {
      clearTimeout(snackTimer.current);
      snackTimer.current = null;
    }
  }, []);

  const dismissSnackbar = useCallback(() => {
    clearSnackTimer();
    setSnackbar(null);
  }, [clearSnackTimer]);

  const showSnackbar = useCallback(
    (next: SnackbarState) => {
      clearSnackTimer();
      setSnackbar(next);
      snackTimer.current = setTimeout(() => setSnackbar(null), SNACKBAR_MS);
    },
    [clearSnackTimer]
  );

  const api = useMemo<FeedbackApi>(
    () => ({
      success: (message, options) => {
        showSnackbar({
          kind: "success",
          message,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
        });
      },
      undo: (message, onUndo) => {
        showSnackbar({ kind: "undo", message, onUndo });
      },
      error: (title, message, options) => {
        setErrorDialog({
          title,
          message,
          onRetry: options?.onRetry,
        });
      },
      confirmDelete: (options) => {
        setDeleteSheet(options);
      },
      choose: (options) => {
        setChooseSheet(options);
      },
    }),
    [showSnackbar]
  );

  useEffect(() => () => clearSnackTimer(), [clearSnackTimer]);

  const snackBottom = insets.bottom + snackbarBottomOffset + 8;

  async function handleDeleteConfirm() {
    if (!deleteSheet) return;
    setDeleteBusy(true);
    try {
      await deleteSheet.onConfirm();
      setDeleteSheet(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {snackbar ? (
        <View
          pointerEvents="box-none"
          style={[styles.snackbarLayer, { bottom: snackBottom }]}
        >
          {snackbar.kind === "success" ? (
            <View style={styles.successSnack}>
              <View style={styles.snackLeft}>
                <View style={styles.successIconWrap}>
                  <MaterialCommunityIcons
                    name="check"
                    size={16}
                    color={feedbackColors.successBg}
                  />
                </View>
                <Text style={styles.successText} numberOfLines={2}>
                  {snackbar.message}
                </Text>
              </View>
              {snackbar.actionLabel && snackbar.onAction ? (
                <Pressable
                  onPress={() => {
                    snackbar.onAction?.();
                    dismissSnackbar();
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.successAction}>
                    {snackbar.actionLabel.toUpperCase()}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.undoSnack}>
              <View style={styles.snackLeft}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.undoText} numberOfLines={2}>
                  {snackbar.message}
                </Text>
              </View>
              <Pressable
                onPress={async () => {
                  clearSnackTimer();
                  try {
                    await snackbar.onUndo();
                  } finally {
                    setSnackbar(null);
                  }
                }}
                hitSlop={8}
              >
                <Text style={styles.undoAction}>UNDO</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      <Modal
        visible={deleteSheet != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteBusy) setDeleteSheet(null);
        }}
      >
        <Pressable
          style={styles.scrim}
          onPress={() => !deleteBusy && setDeleteSheet(null)}
        >
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.deleteIconCircle}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={28}
                color={feedbackColors.delete}
              />
            </View>
            <Text style={styles.sheetTitle}>{deleteSheet?.title}</Text>
            <Text style={styles.sheetMessage}>{deleteSheet?.message}</Text>
            <View style={styles.sheetBtnRow}>
              <Pressable
                style={[styles.sheetBtn, styles.cancelBtn]}
                disabled={deleteBusy}
                onPress={() => setDeleteSheet(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetBtn, styles.deleteBtn]}
                disabled={deleteBusy}
                onPress={handleDeleteConfirm}
              >
                {deleteBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </Pressable>
            </View>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={errorDialog != null}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorDialog(null)}
      >
        <Pressable
          style={styles.scrimCenter}
          onPress={() => setErrorDialog(null)}
        >
          <Pressable style={styles.errorCard} onPress={() => {}}>
            <View style={styles.warningIconCircle}>
              <MaterialCommunityIcons
                name="alert"
                size={28}
                color={feedbackColors.warningIcon}
              />
            </View>
            <Text style={styles.sheetTitle}>{errorDialog?.title}</Text>
            <Text style={styles.sheetMessage}>{errorDialog?.message}</Text>
            <View style={styles.sheetBtnRow}>
              <Pressable
                style={[
                  styles.sheetBtn,
                  styles.cancelBtn,
                  !errorDialog?.onRetry && { flex: 1 },
                ]}
                onPress={() => setErrorDialog(null)}
              >
                <Text style={styles.cancelBtnText}>Dismiss</Text>
              </Pressable>
              {errorDialog?.onRetry ? (
                <Pressable
                  style={[styles.sheetBtn, styles.primaryBtn]}
                  onPress={() => {
                    const retry = errorDialog.onRetry;
                    setErrorDialog(null);
                    retry?.();
                  }}
                >
                  <Text style={styles.primaryBtnText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={chooseSheet != null}
        transparent
        animationType="fade"
        onRequestClose={() => setChooseSheet(null)}
      >
        <Pressable style={styles.scrim} onPress={() => setChooseSheet(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{chooseSheet?.title}</Text>
            {chooseSheet?.subtitle ? (
              <Text style={[styles.sheetMessage, { marginBottom: 16 }]}>
                {chooseSheet.subtitle}
              </Text>
            ) : null}
            {chooseSheet?.actions.map((action) => (
              <Pressable
                key={action.label}
                style={styles.chooseRow}
                onPress={() => {
                  setChooseSheet(null);
                  action.onPress();
                }}
              >
                <Text
                  style={[
                    styles.chooseLabel,
                    action.destructive && styles.chooseDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chooseRow, styles.chooseCancel]}
              onPress={() => setChooseSheet(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  snackbarLayer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 12,
  },
  successSnack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: feedbackColors.successBg,
    borderRadius: feedbackRadius.snack,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  undoSnack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: feedbackColors.undoBg,
    borderRadius: feedbackRadius.snack,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  snackLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  successIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d8f3dc",
    alignItems: "center",
    justifyContent: "center",
  },
  successText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  successAction: {
    color: feedbackColors.successAction,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  undoText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  undoAction: {
    color: feedbackColors.undoAction,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  scrim: {
    flex: 1,
    backgroundColor: feedbackColors.scrim,
    justifyContent: "flex-end",
  },
  scrimCenter: {
    flex: 1,
    backgroundColor: feedbackColors.scrim,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheetWrap: {
    backgroundColor: feedbackColors.sheet,
    borderTopLeftRadius: feedbackRadius.sheet,
    borderTopRightRadius: feedbackRadius.sheet,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 20,
  },
  deleteIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: feedbackColors.deleteIconBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  warningIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: feedbackColors.warningIconBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  errorCard: {
    backgroundColor: feedbackColors.sheet,
    borderRadius: feedbackRadius.sheet,
    paddingHorizontal: 24,
    paddingVertical: 24,
    width: "100%",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
  },
  sheetMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: feedbackColors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  sheetBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 8,
  },
  sheetBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: feedbackRadius.btn,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  cancelBtn: {
    backgroundColor: feedbackColors.cancelBg,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: feedbackColors.cancelText,
  },
  deleteBtn: {
    backgroundColor: feedbackColors.delete,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  primaryBtn: {
    backgroundColor: feedbackColors.primaryBtn,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  chooseRow: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  chooseLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  chooseDestructive: {
    color: feedbackColors.delete,
  },
  chooseCancel: {
    marginTop: 4,
    borderTopWidth: 8,
    borderTopColor: feedbackColors.cancelBg,
  },
});