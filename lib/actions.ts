import { SHOP_SETTINGS_ID } from "./config";
import { supabase } from "./supabase";
import type {
  CartLine,
  CategoryRow,
  EntryKind,
  PaymentRow,
} from "./types";

export async function loadEntryCatalog(kind: EntryKind) {
  const [categories, payments] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("type", kind)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("payment_methods")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (categories.error) throw categories.error;
  if (payments.error) throw payments.error;

  return {
    categories: (categories.data ?? []) as CategoryRow[],
    payments: (payments.data ?? []) as PaymentRow[],
  };
}

export async function createManualEntry(
  kind: EntryKind,
  userId: string,
  input: {
    title: string;
    amount: number;
    categoryId: string | null;
    paymentMethodId: string | null;
    note: string | null;
  }
) {
  const at = new Date().toISOString();
  const base = {
    title: input.title.trim(),
    amount: input.amount,
    category_id: input.categoryId,
    payment_method_id: input.paymentMethodId,
    description: input.note?.trim() || null,
    created_by: userId,
  };

  if (kind === "expense") {
    const { error } = await supabase.from("expenses").insert({
      ...base,
      expense_date: at,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("income_entries").insert({
    ...base,
    income_date: at,
  });
  if (error) throw error;
}

export type ManualEntryRecord = {
  id: string;
  title: string;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  description: string | null;
  entry_date: string;
};

export async function getExpenseEntry(id: string): Promise<ManualEntryRecord> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, title, amount, category_id, payment_method_id, description, expense_date"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    amount: Number(data.amount),
    category_id: data.category_id,
    payment_method_id: data.payment_method_id,
    description: data.description,
    entry_date: data.expense_date,
  };
}

export async function getManualIncomeEntry(id: string): Promise<ManualEntryRecord> {
  const { data, error } = await supabase
    .from("income_entries")
    .select(
      "id, title, amount, category_id, payment_method_id, description, income_date"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    amount: Number(data.amount),
    category_id: data.category_id,
    payment_method_id: data.payment_method_id,
    description: data.description,
    entry_date: data.income_date,
  };
}

export async function updateManualEntry(
  kind: EntryKind,
  id: string,
  input: {
    title: string;
    amount: number;
    categoryId: string | null;
    paymentMethodId: string | null;
    note: string | null;
    entryDate: string;
  }
) {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount.");
  }

  const base = {
    title,
    amount: input.amount,
    category_id: input.categoryId,
    payment_method_id: input.paymentMethodId,
    description: input.note?.trim() || null,
  };

  if (kind === "expense") {
    const { error } = await supabase
      .from("expenses")
      .update({ ...base, expense_date: input.entryDate })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("income_entries")
    .update({ ...base, income_date: input.entryDate })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteManualIncome(id: string) {
  const { error } = await supabase
    .from("income_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSale(id: string) {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((acc, line) => acc + line.qty * line.unitPrice, 0);
}

export async function createSaleFromCart(
  paymentMethodId: string | null,
  lines: CartLine[]
): Promise<string> {
  if (lines.length === 0) {
    throw new Error("Add at least one product.");
  }

  const { data, error } = await supabase.rpc("create_sale", {
    p_sale_date: new Date().toISOString(),
    p_payment_method_id: paymentMethodId,
    p_notes: null,
    p_items: lines.map((line) => ({
      product_id: line.productId,
      product_name: line.name,
      quantity: line.qty,
      unit_price: line.unitPrice,
    })),
  });

  if (error) throw error;
  return String(data);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cartToRpcItems(lines: CartLine[]) {
  return lines.map((line) => ({
    product_id: isUuid(line.productId) ? line.productId : null,
    product_name: line.name,
    quantity: line.qty,
    unit_price: line.unitPrice,
  }));
}

export async function updateSaleFromCart(
  saleId: string,
  saleDate: string,
  paymentMethodId: string | null,
  lines: CartLine[],
  notes?: string | null
): Promise<string> {
  if (lines.length === 0) {
    throw new Error("Add at least one product.");
  }

  const { data, error } = await supabase.rpc("update_sale", {
    p_sale_id: saleId,
    p_sale_date: saleDate,
    p_payment_method_id: paymentMethodId,
    p_notes: notes ?? null,
    p_items: cartToRpcItems(lines),
  });

  if (error) throw error;
  return String(data);
}

export async function createProduct(input: {
  name: string;
  selling_price: number;
  cost_price?: number | null;
  category_id?: string | null;
  description?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required.");
  if (!Number.isFinite(input.selling_price) || input.selling_price < 0) {
    throw new Error("Enter a valid selling price.");
  }

  const { error } = await supabase.from("products").insert({
    name,
    selling_price: input.selling_price,
    cost_price: input.cost_price ?? null,
    category_id: input.category_id ?? null,
    description: input.description?.trim() || null,
    is_active: true,
  });
  if (error) throw error;
}

export async function setProductActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProduct(
  id: string,
  input: {
    name: string;
    selling_price: number;
    cost_price?: number | null;
    category_id?: string | null;
    description?: string | null;
    is_active: boolean;
  }
) {
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required.");
  if (!Number.isFinite(input.selling_price) || input.selling_price < 0) {
    throw new Error("Enter a valid selling price.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      name,
      selling_price: input.selling_price,
      cost_price: input.cost_price ?? null,
      category_id: input.category_id ?? null,
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function createCategory(input: {
  name: string;
  type: EntryKind;
  description?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase.from("categories").insert({
    name,
    type: input.type,
    description: input.description?.trim() || null,
    is_active: true,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this name and type already exists.");
    }
    throw error;
  }
}

export async function setCategoryActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  input: {
    name: string;
    type: EntryKind;
    description?: string | null;
    is_active: boolean;
  }
) {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      type: input.type,
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this name and type already exists.");
    }
    throw error;
  }
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function saveShopSettings(input: {
  shop_name: string;
  phone?: string | null;
  address?: string | null;
  currency: string;
  timezone: string;
}) {
  const shop_name = input.shop_name.trim();
  if (!shop_name) throw new Error("Shop name is required.");

  const { error } = await supabase
    .from("shop_settings")
    .update({
      shop_name,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      currency: input.currency.trim(),
      timezone: input.timezone.trim(),
    })
    .eq("id", SHOP_SETTINGS_ID);

  if (error) throw error;
}

export async function saveUserProfile(userId: string, fullName: string) {
  const full_name = fullName.trim() || null;
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    full_name,
  });
  if (error) throw error;
}

export async function changePassword(password: string, confirm: string) {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (password !== confirm) {
    throw new Error("Passwords do not match.");
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}