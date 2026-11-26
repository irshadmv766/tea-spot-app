import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  changePassword,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  saveShopSettings,
  saveUserProfile,
  setCategoryActive,
  setProductActive,
  updateCategory,
  updateProduct,
} from "../../lib/actions";
import { formatMoney } from "../../lib/format";
import {
  getShopSettings,
  getUserProfile,
  listAdminCategories,
  listAdminProducts,
  listProductCategories,
} from "../../lib/queries";
import { useSafeLayout } from "../../lib/safe-layout";
import { colors, radius, shared } from "../../lib/theme";
import type {
  AdminCategory,
  AdminProduct,
  EntryKind,
  ShopSettings,
} from "../../lib/types";
import { useFeedback } from "../feedback/FeedbackProvider";
import {
  deleteProductImageFile,
  uploadProductImage,
} from "../../lib/product-image";
import { ProductPhotoField } from "../ui/ProductPhotoField";
import { ScreenHeader } from "../ui/ScreenHeader";
import { SearchableSelect } from "../ui/SearchableSelect";

const CATEGORY_TYPE_OPTIONS: { label: string; value: EntryKind }[] = [
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
];

const SHOP_PHASE_OPTIONS = [
  { label: "Pre-opening (setup)", value: "pre_opening" as const },
  { label: "Open for sales", value: "open" as const },
];

type Section = "products" | "categories" | "shop" | "account";

type Props = {
  userId: string;
  userEmail: string;
  refreshKey: number;
  onBack: () => void;
  onSignOut: () => void;
  onChanged: () => void;
};

export function SettingsScreen({
  userId,
  userEmail,
  refreshKey,
  onBack,
  onSignOut,
  onChanged,
}: Props) {
  const feedback = useFeedback();
  const { bottom } = useSafeLayout();
  const [section, setSection] = useState<Section>("products");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [productCategories, setProductCategories] = useState<
    { id: string; name: string }[]
  >([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [fullName, setFullName] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<EntryKind>("expense");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");

  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopInitialInvestment, setShopInitialInvestment] = useState("");
  const [shopPhase, setShopPhase] = useState<"pre_opening" | "open">(
    "pre_opening"
  );

  const [savingShop, setSavingShop] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProductForm, setSavingProductForm] = useState(false);
  const [savingCategoryForm, setSavingCategoryForm] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editProductActive, setEditProductActive] = useState(true);
  const [editCategoryActive, setEditCategoryActive] = useState(true);
  const [productImageLocalUri, setProductImageLocalUri] = useState<string | null>(
    null
  );
  const [productImagePath, setProductImagePath] = useState<string | null>(null);
  const [productImageRemoved, setProductImageRemoved] = useState(false);
  const [pickingProductPhoto, setPickingProductPhoto] = useState(false);

  const productCategoryOptions = useMemo(
    () => [
      { label: "— None —", value: "" },
      ...productCategories.map((c) => ({ label: c.name, value: c.id })),
    ],
    [productCategories]
  );

  function resetProductFields() {
    setNewProductName("");
    setNewProductPrice("");
    setNewProductCost("");
    setNewProductCategoryId("");
    setNewProductDesc("");
    setEditProductActive(true);
    setProductImageLocalUri(null);
    setProductImagePath(null);
    setProductImageRemoved(false);
  }

  async function resolveProductImagePath(
    productId: string
  ): Promise<string | null> {
    if (productImageLocalUri) {
      if (productImagePath) {
        await deleteProductImageFile(productImagePath).catch(() => {});
      }
      return uploadProductImage(productId, productImageLocalUri);
    }
    if (productImageRemoved) {
      if (productImagePath) {
        await deleteProductImageFile(productImagePath).catch(() => {});
      }
      return null;
    }
    return productImagePath;
  }

  function resetCategoryFields() {
    setNewCategoryName("");
    setNewCategoryType("expense");
    setNewCategoryDesc("");
    setEditCategoryActive(true);
  }

  function closeProductForm() {
    setShowAddProduct(false);
    setEditingProductId(null);
    resetProductFields();
  }

  function closeCategoryForm() {
    setShowAddCategory(false);
    setEditingCategoryId(null);
    resetCategoryFields();
  }

  function openAddProduct() {
    closeCategoryForm();
    resetProductFields();
    setEditingProductId(null);
    setShowAddProduct(true);
  }

  function openAddCategory() {
    closeProductForm();
    resetCategoryFields();
    setEditingCategoryId(null);
    setShowAddCategory(true);
  }

  function openEditProduct(p: AdminProduct) {
    setShowAddProduct(false);
    setEditingProductId(p.id);
    setNewProductName(p.name);
    setNewProductPrice(String(p.selling_price));
    setNewProductCost(p.cost_price != null ? String(p.cost_price) : "");
    setNewProductCategoryId(p.category_id ?? "");
    setNewProductDesc(p.description ?? "");
    setEditProductActive(p.is_active);
    setProductImagePath(p.image_path);
    setProductImageLocalUri(null);
    setProductImageRemoved(false);
  }

  function openEditCategory(c: AdminCategory) {
    setShowAddCategory(false);
    setEditingCategoryId(c.id);
    setNewCategoryName(c.name);
    setNewCategoryType(c.type);
    setNewCategoryDesc(c.description ?? "");
    setEditCategoryActive(c.is_active);
  }

  useEffect(() => {
    closeProductForm();
    closeCategoryForm();
    setShowChangePassword(false);
  }, [section]);

  const load = useCallback(async () => {
    const [prods, cats, pCats, settings, profile] = await Promise.all([
      listAdminProducts(),
      listAdminCategories(),
      listProductCategories(),
      getShopSettings(),
      getUserProfile(userId),
    ]);
    setProducts(prods);
    setCategories(cats);
    setProductCategories(pCats);
    setShop(settings);
    setFullName(profile?.full_name ?? "");
    if (settings) {
      setShopName(settings.shop_name);
      setShopPhone(settings.phone ?? "");
      setShopAddress(settings.address ?? "");
      const inv = Number(settings.initial_investment ?? 0);
      setShopInitialInvestment(inv > 0 ? String(inv) : "");
      setShopPhase(settings.shop_phase === "open" ? "open" : "pre_opening");
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) =>
        feedback.error(
          "Couldn't load",
          e instanceof Error ? e.message : "Load failed"
        )
      )
      .finally(() => setLoading(false));
  }, [load, refreshKey]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddProduct() {
    const price = Number(newProductPrice);
    const cost = newProductCost ? Number(newProductCost) : null;
    setSavingProductForm(true);
    try {
      const id = await createProduct({
        name: newProductName,
        selling_price: price,
        cost_price: cost,
        category_id: newProductCategoryId || null,
        description: newProductDesc || null,
      });
      if (productImageLocalUri) {
        const imagePath = await resolveProductImagePath(id);
        await updateProduct(id, {
          name: newProductName,
          selling_price: price,
          cost_price: cost,
          category_id: newProductCategoryId || null,
          description: newProductDesc || null,
          image_path: imagePath,
          is_active: true,
        });
      }
      setNewProductName("");
      setNewProductPrice("");
      setNewProductCost("");
      setNewProductCategoryId("");
      setNewProductDesc("");
      closeProductForm();
      await load();
      onChanged();
      feedback.success("Product added");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingProductForm(false);
    }
  }

  async function handleAddCategory() {
    setSavingCategoryForm(true);
    try {
      await createCategory({
        name: newCategoryName,
        type: newCategoryType,
        description: newCategoryDesc || null,
      });
      setNewCategoryName("");
      setNewCategoryDesc("");
      closeCategoryForm();
      await load();
      onChanged();
      feedback.success("Category added");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingCategoryForm(false);
    }
  }

  async function handleUpdateProduct() {
    if (!editingProductId) return;
    const price = Number(newProductPrice);
    const cost = newProductCost ? Number(newProductCost) : null;
    setSavingProductForm(true);
    try {
      const imagePath = await resolveProductImagePath(editingProductId);
      await updateProduct(editingProductId, {
        name: newProductName,
        selling_price: price,
        cost_price: cost,
        category_id: newProductCategoryId || null,
        description: newProductDesc || null,
        image_path: imagePath,
        is_active: editProductActive,
      });
      closeProductForm();
      await load();
      onChanged();
      feedback.success("Product updated");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingProductForm(false);
    }
  }

  function confirmDeleteProduct(id: string, name: string) {
    feedback.confirmDelete({
      title: "Delete this product?",
      message: `'${name}' will be removed from your catalog.`,
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          closeProductForm();
          await load();
          onChanged();
          feedback.success("Product deleted");
        } catch (e) {
          feedback.error(
            "Couldn't delete",
            e instanceof Error ? e.message : "Could not delete."
          );
        }
      },
    });
  }

  async function handleUpdateCategory() {
    if (!editingCategoryId) return;
    setSavingCategoryForm(true);
    try {
      await updateCategory(editingCategoryId, {
        name: newCategoryName,
        type: newCategoryType,
        description: newCategoryDesc || null,
        is_active: editCategoryActive,
      });
      closeCategoryForm();
      await load();
      onChanged();
      feedback.success("Category updated");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingCategoryForm(false);
    }
  }

  function confirmDeleteCategory(id: string, name: string) {
    feedback.confirmDelete({
      title: "Delete this category?",
      message: `'${name}' will be removed. Existing entries keep their history.`,
      onConfirm: async () => {
        try {
          await deleteCategory(id);
          closeCategoryForm();
          await load();
          onChanged();
          feedback.success("Category deleted");
        } catch (e) {
          feedback.error(
            "Couldn't delete",
            e instanceof Error ? e.message : "Could not delete."
          );
        }
      },
    });
  }

  async function handleSaveShop() {
    const trimmed = shopInitialInvestment.trim();
    const initial_investment = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isFinite(initial_investment) || initial_investment < 0) {
      feedback.error("Invalid amount", "Startup investment must be 0 or more.");
      return;
    }
    setSavingShop(true);
    try {
      await saveShopSettings({
        shop_name: shopName,
        phone: shopPhone,
        address: shopAddress,
        currency: shop?.currency ?? "INR",
        timezone: shop?.timezone ?? "Asia/Kolkata",
        initial_investment,
        shop_phase: shopPhase,
      });
      onChanged();
      feedback.success("Shop details updated");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingShop(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await saveUserProfile(userId, fullName);
      feedback.success("Profile updated");
    } catch (e) {
      feedback.error(
        "Couldn't save right now",
        e instanceof Error ? e.message : "Could not save."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setSavingPassword(true);
    try {
      await changePassword(newPassword, confirmPassword);
      setNewPassword("");
      setConfirmPassword("");
      setShowChangePassword(false);
      feedback.success("Password updated");
    } catch (e) {
      feedback.error(
        "Couldn't update",
        e instanceof Error ? e.message : "Could not update."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <View style={shared.screen}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <View style={styles.tabs}>
        {(
          [
            ["products", "Products"],
            ["categories", "Categories"],
            ["shop", "Shop"],
            ["account", "Account"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, section === key && styles.tabActive]}
            onPress={() => setSection(key)}
          >
            <Text
              style={[styles.tabText, section === key && styles.tabTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {section === "products" ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>
                  All products ({products.length})
                </Text>
                {!showAddProduct && !editingProductId ? (
                  <Pressable onPress={openAddProduct} hitSlop={8}>
                    <Text style={styles.addLink}>+ Add product</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={closeProductForm} hitSlop={8}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </Pressable>
                )}
              </View>

              {showAddProduct || editingProductId ? (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    {editingProductId ? "Edit product" : "New product"}
                  </Text>
                  <Field
                    label="Name"
                    value={newProductName}
                    onChange={setNewProductName}
                  />
                  <Field
                    label="Selling price (₹)"
                    value={newProductPrice}
                    onChange={setNewProductPrice}
                    keyboardType="decimal-pad"
                  />
                  <Field
                    label="Cost (optional)"
                    value={newProductCost}
                    onChange={setNewProductCost}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.fieldLabel}>Category (optional)</Text>
                  <SearchableSelect
                    value={newProductCategoryId}
                    onValueChange={setNewProductCategoryId}
                    options={productCategoryOptions}
                    placeholder="— None —"
                  />
                  <Field
                    label="Description (optional)"
                    value={newProductDesc}
                    onChange={setNewProductDesc}
                    multiline
                  />
                  <ProductPhotoField
                    localUri={productImageLocalUri}
                    storedPath={productImagePath}
                    removed={productImageRemoved}
                    picking={pickingProductPhoto}
                    onPickingChange={setPickingProductPhoto}
                    onPick={(uri) => {
                      setProductImageLocalUri(uri);
                      setProductImageRemoved(false);
                    }}
                    onRemove={() => {
                      setProductImageLocalUri(null);
                      setProductImageRemoved(true);
                    }}
                    onError={(message) =>
                      feedback.error("Photo", message)
                    }
                  />
                  {editingProductId ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Active</Text>
                      <Switch
                        value={editProductActive}
                        onValueChange={setEditProductActive}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>
                  ) : null}
                  <Pressable
                    style={[
                      shared.primaryBtn,
                      savingProductForm && shared.btnDisabled,
                    ]}
                    onPress={
                      editingProductId ? handleUpdateProduct : handleAddProduct
                    }
                    disabled={savingProductForm}
                  >
                    {savingProductForm ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={shared.primaryBtnText}>
                        {editingProductId ? "Save changes" : "Save product"}
                      </Text>
                    )}
                  </Pressable>
                  {editingProductId ? (
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() =>
                        confirmDeleteProduct(
                          editingProductId,
                          newProductName || "Product"
                        )
                      }
                    >
                      <Text style={styles.deleteBtnText}>Delete product</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {products.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.listCard,
                    editingProductId === p.id && styles.listCardSelected,
                  ]}
                >
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => openEditProduct(p)}
                  >
                    <Text style={styles.listTitle}>{p.name}</Text>
                    <Text style={shared.muted}>
                      {formatMoney(p.selling_price)}
                      {p.categoryName ? ` · ${p.categoryName}` : ""}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => openEditProduct(p)} hitSlop={8}>
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                  <Switch
                    value={p.is_active}
                    onValueChange={async (v) => {
                      try {
                        await setProductActive(p.id, v);
                        await load();
                        onChanged();
                      } catch (e) {
                        feedback.error(
                          "Couldn't update",
                          e instanceof Error ? e.message : "Update failed"
                        );
                      }
                    }}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              ))}
            </>
          ) : null}

          {section === "categories" ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>
                  All categories ({categories.length})
                </Text>
                {!showAddCategory && !editingCategoryId ? (
                  <Pressable onPress={openAddCategory} hitSlop={8}>
                    <Text style={styles.addLink}>+ Add category</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={closeCategoryForm} hitSlop={8}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </Pressable>
                )}
              </View>

              {showAddCategory || editingCategoryId ? (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    {editingCategoryId ? "Edit category" : "New category"}
                  </Text>
                  <Field
                    label="Name"
                    value={newCategoryName}
                    onChange={setNewCategoryName}
                  />
                  <Text style={styles.fieldLabel}>Type</Text>
                  <SearchableSelect
                    value={newCategoryType}
                    onValueChange={setNewCategoryType}
                    options={CATEGORY_TYPE_OPTIONS}
                  />
                  <Field
                    label="Description (optional)"
                    value={newCategoryDesc}
                    onChange={setNewCategoryDesc}
                  />
                  {editingCategoryId ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Active</Text>
                      <Switch
                        value={editCategoryActive}
                        onValueChange={setEditCategoryActive}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>
                  ) : null}
                  <Pressable
                    style={[
                      shared.primaryBtn,
                      savingCategoryForm && shared.btnDisabled,
                    ]}
                    onPress={
                      editingCategoryId
                        ? handleUpdateCategory
                        : handleAddCategory
                    }
                    disabled={savingCategoryForm}
                  >
                    {savingCategoryForm ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={shared.primaryBtnText}>
                        {editingCategoryId ? "Save changes" : "Save category"}
                      </Text>
                    )}
                  </Pressable>
                  {editingCategoryId ? (
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() =>
                        confirmDeleteCategory(
                          editingCategoryId,
                          newCategoryName || "Category"
                        )
                      }
                    >
                      <Text style={styles.deleteBtnText}>Delete category</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {categories.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.listCard,
                    editingCategoryId === c.id && styles.listCardSelected,
                  ]}
                >
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => openEditCategory(c)}
                  >
                    <Text style={styles.listTitle}>{c.name}</Text>
                    <Text style={shared.muted}>
                      {c.type === "income" ? "Income" : "Expense"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => openEditCategory(c)} hitSlop={8}>
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                  <Switch
                    value={c.is_active}
                    onValueChange={async (v) => {
                      try {
                        await setCategoryActive(c.id, v);
                        await load();
                        onChanged();
                      } catch (e) {
                        feedback.error(
                          "Couldn't update",
                          e instanceof Error ? e.message : "Update failed"
                        );
                      }
                    }}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              ))}
            </>
          ) : null}

          {section === "shop" ? (
            <View style={styles.formCard}>
              <Field label="Shop name" value={shopName} onChange={setShopName} />
              <Field label="Phone" value={shopPhone} onChange={setShopPhone} />
              <Field
                label="Address"
                value={shopAddress}
                onChange={setShopAddress}
                multiline
              />
              <Text style={styles.fieldLabel}>Shop status</Text>
              <SearchableSelect
                value={shopPhase}
                onValueChange={setShopPhase}
                options={SHOP_PHASE_OPTIONS}
              />
              <Text style={shared.muted}>
                Pre-opening: log setup expenses now. Switch to open when you
                start selling.
              </Text>
              <Field
                label="Startup investment (₹)"
                value={shopInitialInvestment}
                onChange={setShopInitialInvestment}
                keyboardType="decimal-pad"
              />
              <Text style={shared.muted}>
                Record only — not included in income, expense, or net totals.
              </Text>
              <Text style={[shared.muted, { marginTop: 8 }]}>
                Currency: {shop?.currency ?? "INR"} · Timezone:{" "}
                {shop?.timezone ?? "Asia/Kolkata"}
              </Text>
              <Pressable
                style={[
                  shared.primaryBtn,
                  { marginTop: 16 },
                  savingShop && shared.btnDisabled,
                ]}
                onPress={handleSaveShop}
                disabled={savingShop}
              >
                {savingShop ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={shared.primaryBtnText}>Save shop</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {section === "account" ? (
            <>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.readOnly}>{userEmail}</Text>
                <Field label="Full name" value={fullName} onChange={setFullName} />
                <Pressable
                  style={[
                    shared.primaryBtn,
                    { marginTop: 8 },
                    savingProfile && shared.btnDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={shared.primaryBtnText}>Save profile</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.formCard}>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionLabel, { marginTop: 0 }]}>
                    Password
                  </Text>
                  {!showChangePassword ? (
                    <Pressable
                      onPress={() => setShowChangePassword(true)}
                      hitSlop={8}
                    >
                      <Text style={styles.addLink}>Change</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setShowChangePassword(false)}
                      hitSlop={8}
                    >
                      <Text style={styles.cancelLink}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
                {showChangePassword ? (
                  <>
                    <Field
                      label="New password"
                      value={newPassword}
                      onChange={setNewPassword}
                      secure
                    />
                    <Field
                      label="Confirm"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      secure
                    />
                    <Pressable
                      style={[
                        shared.primaryBtn,
                        savingPassword && shared.btnDisabled,
                      ]}
                      onPress={handleChangePassword}
                      disabled={savingPassword}
                    >
                      {savingPassword ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={shared.primaryBtnText}>Update password</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Text style={shared.muted}>
                    Tap Change to set a new password.
                  </Text>
                )}
              </View>

              <Pressable style={styles.signOutBtn} onPress={onSignOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
  secure?: boolean;
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secure}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.tagNeutral,
  },
  tabActive: { backgroundColor: colors.tabActiveBg },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  scroll: { paddingHorizontal: 20 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  addLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  cancelLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  editLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    paddingHorizontal: 4,
  },
  deleteBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.expenseBorder,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.expense,
  },
  listCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  listTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  readOnly: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },
  signOutBtn: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.expenseBorder,
    backgroundColor: colors.card,
    marginBottom: 24,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.expense,
  },
});