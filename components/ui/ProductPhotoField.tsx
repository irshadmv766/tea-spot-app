import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  pickProductImage,
  productImagePublicUrl,
} from "../../lib/product-image";
import { colors, radius } from "../../lib/theme";

type Props = {
  localUri: string | null;
  storedPath: string | null;
  removed: boolean;
  onPick: (uri: string) => void;
  onRemove: () => void;
  onError: (message: string) => void;
  picking?: boolean;
  onPickingChange?: (busy: boolean) => void;
};

export function ProductPhotoField({
  localUri,
  storedPath,
  removed,
  onPick,
  onRemove,
  onError,
  picking = false,
  onPickingChange,
}: Props) {
  const previewUri =
    localUri ??
    (!removed && storedPath ? productImagePublicUrl(storedPath) : null);

  async function pick() {
    onPickingChange?.(true);
    try {
      const uri = await pickProductImage();
      if (uri) onPick(uri);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not pick image.");
    } finally {
      onPickingChange?.(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photo (optional)</Text>
      {previewUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} />
          <View style={styles.previewActions}>
            <Pressable style={styles.secondaryBtn} onPress={pick} disabled={picking}>
              {picking ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryBtnText}>Change</Text>
              )}
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={onRemove} disabled={picking}>
              <Text style={styles.ghostBtnText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.addBtn}
          onPress={pick}
          disabled={picking}
        >
          {picking ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.addBtnText}>+ Add photo</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  previewWrap: { gap: 10 },
  preview: {
    width: "100%",
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.tagNeutral,
  },
  previewActions: { flexDirection: "row", gap: 10 },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: "dashed",
    paddingVertical: 22,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.incomeMuted,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  ghostBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});