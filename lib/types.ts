export type EntryKind = "income" | "expense";

export type CategoryRow = { id: string; name: string };
export type PaymentRow = { id: string; name: string };

export type ProductRow = {
  id: string;
  name: string;
  selling_price: number;
  image_path: string | null;
};

export type AdminProduct = {
  id: string;
  name: string;
  selling_price: number;
  cost_price: number | null;
  category_id: string | null;
  categoryName: string | null;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
};

export type AdminCategory = {
  id: string;
  name: string;
  type: EntryKind;
  description: string | null;
  is_active: boolean;
};

export type ShopSettings = {
  id: string;
  shop_name: string;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
};

export type UserProfile = {
  id: string;
  full_name: string | null;
};

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type PeriodTotals = {
  salesTotal: number;
  salesCount: number;
  incomeTotal: number;
  incomeCount: number;
  expensesTotal: number;
  expensesCount: number;
  netTotal: number;
};

export type ExpenseCategoryRow = { name: string; total: number };

export type IncomeListRow = {
  id: string;
  kind: "sale" | "manual";
  at: string;
  title: string;
  amount: number;
  paymentName: string | null;
  categoryName: string | null;
};

export type ExpenseListRow = {
  id: string;
  at: string;
  title: string;
  amount: number;
  categoryName: string | null;
  paymentName: string | null;
};

export type DayTransactionRow = {
  id: string;
  kind: "sale" | "income" | "expense";
  at: string;
  title: string;
  amount: number;
  categoryName: string | null;
  paymentName: string | null;
};

export type TodayRow =
  | {
      id: string;
      kind: "sale";
      at: string;
      title: string;
      amount: number;
    }
  | {
      id: string;
      kind: "income";
      at: string;
      title: string;
      amount: number;
    }
  | {
      id: string;
      kind: "expense";
      at: string;
      title: string;
      amount: number;
    };