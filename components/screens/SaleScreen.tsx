import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createSaleFromCart, updateSaleFromCart } from "../../lib/actions";
import {
  getSaleWithItems,
  loadActiveProducts,
  loadPaymentMethods,
} from "../../lib/queries";
import type { CartLine, ProductRow } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { productImagePublicUrl } from "../../lib/product-image";
import {
  applyManualSaleTotal,
  cartLinesTotal,
} from "../../lib/sale-total";
import { useSafeLayout } from "../../lib/safe-layout";
import { colors, shared } from "../../lib/theme";
import { useFeedback } from "../feedback/FeedbackProvider";
import { ScreenHeader } from "../ui/ScreenHeader";

type Props = {
  refreshKey: number;
  editSaleId?: string | null;
  onSaleDone: () => void;
  onBack?: () => void;
};

export function SaleScreen({
  refreshKey,
  editSaleId = null,
  onSaleDone,
  onBack,
}: Props) {
  const feedback = useFeedback();
  const { scrollBottom } = useSafeLayout();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [payments, setPayments] = useState<{ id: string; name: string }[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleDate, setSaleDate] = useState<string | null>(null);
  const [totalInput, setTotalInput] = useState("");
  const [manualTotalLocked, setManualTotalLocked] = useState(false);
  const isEdit = Boolean(editSaleId);

  const itemsSubtotal = useMemo(() => cartLinesTotal(cart), [cart]);

  useEffect(() => {
    if (!manualTotalLocked) {
      setTotalInput(itemsSubtotal > 0 ? String(itemsSubtotal) : "");
    }
  }, [itemsSubtotal, manualTotalLocked]);

  const load = useCallback(async () => {
    const [prods, pays] = await Promise.all([
      loadActiveProducts(),
      loadPaymentMethods(),
    ]);
    setProducts(prods);
    setPayments(pays);
    setPaymentId((prev) => prev || pays[0]?.id || "");
  }, []);

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      await load();
      if (!editSaleId) {
        setCart([]);
        setSaleDate(null);
        setManualTotalLocked(false);
        return;
      }
      const data = await getSaleWithItems(editSaleId);
      setSaleDate(data.sale.sale_date);
      setPaymentId(data.sale.payment_method_id ?? "");
      const loadedCart = data.items.map((item) => ({
        productId: item.product_id ?? `line-${item.id}`,
        name: item.product_name,
        unitPrice: item.unit_price,
        qty: item.quantity,
      }));
      setCart(loadedCart);
      const lineSum = cartLinesTotal(loadedCart);
      if (Math.abs(lineSum - data.sale.total_amount) >= 0.01) {
        setManualTotalLocked(true);
        setTotalInput(String(data.sale.total_amount));
      } else {
        setManualTotalLocked(false);
      }
    };
    run()
      .catch((e) =>
        feedback.error(
          "Couldn't load",
          e instanceof Error ? e.message : "Load failed"
        )
      )
      .finally(() => setLoading(false));
  }, [load, refreshKey, editSaleId]);

  function changeLinePrice(productId: string, raw: string) {
    const parsed = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setManualTotalLocked(false);
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, unitPrice: parsed } : l
      )
    );
  }

  function addProduct(product: ProductRow) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.selling_price),
          qty: 1,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setManualTotalLocked(false);
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, qty: Math.max(0, l.qty + delta) }
            : l
        )
        .filter((l) => l.qty > 0)
    );
  }

  function linesForSave(): CartLine[] {
    const raw = totalInput.replace(/,/g, "").trim();
    const target = raw ? Number(raw) : itemsSubtotal;
    if (!Number.isFinite(target) || target < 0) {
      throw new Error("Enter a valid total.");
    }
    if (Math.abs(target - itemsSubtotal) < 0.005) {
      return cart;
    }
    return applyManualSaleTotal(cart, target);
  }

  function displayTotal(): number {
    const raw = totalInput.replace(/,/g, "").trim();
    const n = raw ? Number(raw) : itemsSubtotal;
    return Number.isFinite(n) ? n : itemsSubtotal;
  }

  async function completeSale() {
    if (cart.length === 0) {
      feedback.error("Empty cart", "Tap a product to add it.");
      return;
    }
    let lines: CartLine[];
    try {
      lines = linesForSave();
    } catch (e) {
      feedback.error(
        "Invalid total",
        e instanceof Error ? e.message : "Check the total amount."
      );
      return;
    }

    setSaving(true);
    try {
      const charged = cartLinesTotal(lines);
      if (editSaleId && saleDate) {
        await updateSaleFromCart(
          editSaleId,
          saleDate,
          paymentId || null,
          lines
        );
        feedback.success(`Sale updated · ${formatMoney(charged)}`);
      } else {
        await createSaleFromCart(paymentId || null, lines);
        setCart([]);
        setManualTotalLocked(false);
        feedback.success(`Sale recorded · ${formatMoney(charged)}`);
      }
      onSaleDone();
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Sale failed",
        { onRetry: () => completeSale() }
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[shared.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={shared.screen}>
      <ScreenHeader
        title={isEdit ? "Edit sale" : "Quick sale"}
        subtitle={isEdit ? "Update cart and payment" : "Tap a product to add"}
        onBack={onBack}
      />

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={[
          styles.productList,
          { paddingBottom: scrollBottom },
        ]}
        ListHeaderComponent={
          cart.length > 0 ? (
            <View style={[shared.card, styles.cartCard]} key="cart">
              <Text style={styles.cartTitle}>Cart</Text>
              {cart.map((line) => (
                <View key={line.productId} style={styles.cartLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{line.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={shared.muted}>₹</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={String(line.unitPrice)}
                        onChangeText={(v) => changeLinePrice(line.productId, v)}
                        keyboardType="decimal-pad"
                      />
                      <Text style={shared.muted}>each</Text>
                    </View>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => changeQty(line.productId, -1)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qty}>{line.qty}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => changeQty(line.productId, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={shared.muted}>Items subtotal</Text>
                <Text style={styles.subtotalValue}>
                  {formatMoney(itemsSubtotal)}
                </Text>
              </View>
              <Text style={styles.totalLabel}>Total to charge</Text>
              <TextInput
                style={styles.totalInput}
                value={totalInput}
                onChangeText={(v) => {
                  setManualTotalLocked(true);
                  setTotalInput(v);
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              {manualTotalLocked &&
              Math.abs(displayTotal() - itemsSubtotal) >= 0.01 ? (
                <Pressable
                  onPress={() => {
                    setManualTotalLocked(false);
                    setTotalInput(
                      itemsSubtotal > 0 ? String(itemsSubtotal) : ""
                    );
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.resetTotal}>Reset to items subtotal</Text>
                </Pressable>
              ) : null}
              <Text style={styles.totalHint}>
                Edit total or line prices — amounts are saved on the sale lines.
              </Text>

              <Text style={[shared.muted, { marginTop: 12 }]}>Payment</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={paymentId}
                  onValueChange={(v) => setPaymentId(String(v))}
                >
                  {payments.map((p) => (
                    <Picker.Item key={p.id} label={p.name} value={p.id} />
                  ))}
                </Picker>
              </View>

              <Pressable
                style={[shared.primaryBtn, saving && shared.btnDisabled, { marginTop: 12 }]}
                onPress={completeSale}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={shared.primaryBtnText}>
                    {isEdit ? "Save changes" : "Complete sale"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <SaleProductTile product={item} onPress={() => addProduct(item)} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No active products in the catalog.</Text>
        }
      />
    </View>
  );
}

function SaleProductTile({
  product,
  onPress,
}: {
  product: ProductRow;
  onPress: () => void;
}) {
  const imageUrl = productImagePublicUrl(product.image_path);

  if (imageUrl) {
    return (
      <Pressable
        style={[styles.productChip, styles.productChipWithPhoto]}
        onPress={onPress}
      >
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.productPhotoBg}
          imageStyle={styles.productPhotoImage}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.9)", "rgba(232,240,228,0.55)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.productPhotoContent}>
            <Text style={styles.productNameOnPhoto} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.pricePill}>
              <Text style={styles.productPriceOnPhoto}>
                {formatMoney(Number(product.selling_price))}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.productChip} onPress={onPress}>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.productPrice}>
        {formatMoney(Number(product.selling_price))}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center" },
  productList: { paddingHorizontal: 16 },
  productRow: { gap: 10, marginBottom: 10 },
  productChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8ecef",
    minHeight: 100,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: 14,
  },
  productChipWithPhoto: {
    padding: 0,
    minHeight: 108,
  },
  productPhotoBg: {
    flex: 1,
    minHeight: 106,
    justifyContent: "flex-end",
  },
  productPhotoImage: {
    borderRadius: 11,
  },
  productPhotoContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  productNameOnPhoto: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    textShadowColor: "rgba(255,255,255,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pricePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(27,94,67,0.15)",
  },
  productPriceOnPhoto: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  productName: { fontSize: 15, fontWeight: "600", color: colors.text },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 6,
  },
  cartCard: { marginHorizontal: 0, marginBottom: 16 },
  cartTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  priceInput: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    backgroundColor: "#fff",
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e8ecef",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qty: { fontSize: 17, fontWeight: "700", minWidth: 24, textAlign: "center" },
  totalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
    fontWeight: "600",
  },
  totalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: "#fff",
    marginTop: 6,
  },
  resetTotal: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  totalHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
});