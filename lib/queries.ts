import type { DateRange } from "./dates";
import { supabase } from "./supabase";
import type { CategoryRow } from "./types";
import type {
  AdminCategory,
  AdminProduct,
  DayTransactionRow,
  ExpenseCategoryRow,
  ExpenseListRow,
  IncomeListRow,
  PeriodTotals,
  ProductRow,
  ShopSettings,
  TodayRow,
  UserProfile,
} from "./types";

function pickName(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    return (rel[0] as { name?: string } | undefined)?.name ?? null;
  }
  return (rel as { name?: string }).name ?? null;
}

function sum(rows: { amount?: number; total_amount?: number }[]): number {
  return rows.reduce(
    (acc, r) => acc + Number(r.amount ?? r.total_amount ?? 0),
    0
  );
}

export async function loadActiveProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, selling_price")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export type SaleWithItems = {
  sale: {
    id: string;
    sale_date: string;
    payment_method_id: string | null;
    notes: string | null;
    total_amount: number;
  };
  items: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

export async function getSaleWithItems(id: string): Promise<SaleWithItems> {
  const [saleRes, itemsRes] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sale_items")
      .select("id, product_id, product_name, quantity, unit_price")
      .eq("sale_id", id)
      .order("created_at"),
  ]);

  if (saleRes.error) throw saleRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!saleRes.data) throw new Error("Sale not found.");

  return {
    sale: {
      id: saleRes.data.id,
      sale_date: saleRes.data.sale_date,
      payment_method_id: saleRes.data.payment_method_id,
      notes: saleRes.data.notes,
      total_amount: Number(saleRes.data.total_amount),
    },
    items: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
    })),
  };
}

export async function loadPaymentMethods() {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getPeriodTotals(range: DateRange): Promise<PeriodTotals> {
  const [salesRes, incomeRes, expensesRes] = await Promise.all([
    supabase
      .from("sales")
      .select("total_amount")
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),
    supabase
      .from("income_entries")
      .select("amount")
      .gte("income_date", range.from)
      .lte("income_date", range.to),
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (incomeRes.error) throw incomeRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const sales = salesRes.data ?? [];
  const income = incomeRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const salesTotal = sum(sales);
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);

  return {
    salesTotal,
    salesCount: sales.length,
    incomeTotal,
    incomeCount: income.length,
    expensesTotal,
    expensesCount: expenses.length,
    netTotal: salesTotal + incomeTotal - expensesTotal,
  };
}

export async function getExpenseByCategory(
  range: DateRange
): Promise<ExpenseCategoryRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category:categories(name)")
    .gte("expense_date", range.from)
    .lte("expense_date", range.to);

  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const name = pickName(row.category) ?? "Uncategorized";
    map.set(name, (map.get(name) ?? 0) + Number(row.amount));
  }

  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getIncomeList(range: DateRange): Promise<IncomeListRow[]> {
  const [salesRes, incomeRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_date, total_amount, payment_method:payment_methods(name)")
      .gte("sale_date", range.from)
      .lte("sale_date", range.to)
      .order("sale_date", { ascending: false }),
    supabase
      .from("income_entries")
      .select(
        "id, income_date, title, amount, payment_method:payment_methods(name), category:categories(name)"
      )
      .gte("income_date", range.from)
      .lte("income_date", range.to)
      .order("income_date", { ascending: false }),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (incomeRes.error) throw incomeRes.error;

  const sales: IncomeListRow[] = (salesRes.data ?? []).map((row) => ({
    id: row.id,
    kind: "sale" as const,
    at: row.sale_date,
    title: "Product sale",
    amount: Number(row.total_amount),
    paymentName: pickName(row.payment_method),
    categoryName: "Sale",
  }));

  const manual: IncomeListRow[] = (incomeRes.data ?? []).map((row) => ({
    id: row.id,
    kind: "manual" as const,
    at: row.income_date,
    title: row.title,
    amount: Number(row.amount),
    paymentName: pickName(row.payment_method),
    categoryName: pickName(row.category),
  }));

  return [...sales, ...manual].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export async function getExpenseList(
  range: DateRange
): Promise<ExpenseListRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, expense_date, title, amount, category:categories(name), payment_method:payment_methods(name)"
    )
    .gte("expense_date", range.from)
    .lte("expense_date", range.to)
    .order("expense_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    at: row.expense_date,
    title: row.title,
    amount: Number(row.amount),
    categoryName: pickName(row.category),
    paymentName: pickName(row.payment_method),
  }));
}

export async function getTodayRows(range: DateRange): Promise<TodayRow[]> {
  const [income, expenses] = await Promise.all([
    getIncomeList(range),
    getExpenseList(range),
  ]);

  const rows: TodayRow[] = [
    ...income.map((r) => ({
      id: r.id,
      kind: r.kind === "sale" ? ("sale" as const) : ("income" as const),
      at: r.at,
      title: r.title,
      amount: r.amount,
    })),
    ...expenses.map((r) => ({
      id: r.id,
      kind: "expense" as const,
      at: r.at,
      title: r.title,
      amount: r.amount,
    })),
  ];

  return rows.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export async function getDayTransactions(
  range: DateRange
): Promise<DayTransactionRow[]> {
  const [income, expenses] = await Promise.all([
    getIncomeList(range),
    getExpenseList(range),
  ]);

  const rows: DayTransactionRow[] = [
    ...income.map((r) => ({
      id: r.id,
      kind: (r.kind === "sale" ? "sale" : "income") as "sale" | "income",
      at: r.at,
      title: r.title,
      amount: r.amount,
      categoryName: r.categoryName,
      paymentName: r.paymentName,
    })),
    ...expenses.map((r) => ({
      id: r.id,
      kind: "expense" as const,
      at: r.at,
      title: r.title,
      amount: r.amount,
      categoryName: r.categoryName,
      paymentName: r.paymentName,
    })),
  ];

  return rows.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, selling_price, cost_price, category_id, description, is_active, category:categories(name)"
    )
    .order("name");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    selling_price: Number(row.selling_price),
    cost_price: row.cost_price != null ? Number(row.cost_price) : null,
    category_id: row.category_id,
    categoryName: pickName(row.category),
    description: row.description,
    is_active: row.is_active,
  }));
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, description, is_active")
    .order("name");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as AdminCategory["type"],
    description: row.description,
    is_active: row.is_active,
  }));
}

export async function listProductCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function getShopSettings(): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("id, shop_name, phone, address, currency, timezone")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ShopSettings | null;
}

export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}