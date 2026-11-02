export type Currency = "USD" | "CDF";
export type Flow = "income" | "expense" | "transfer";
export interface User {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  usd_cdf_rate: number | null;
  month_start: number;
  number_format: string;
  theme: string;
}
export interface Account {
  id: string;
  name: string;
  type: string;
  currency: Currency;
  opening_cents: number;
  balance_cents: number;
  icon: string;
  active: number;
}
export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}
export interface Transaction {
  id: string;
  type: Flow;
  amount_cents: number;
  currency: Currency;
  category_id: string | null;
  account_id: string;
  target_account_id: string | null;
  description: string;
  transaction_date: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  account_name: string;
  target_account_name: string | null;
}
export interface Budget {
  id: string;
  category_id: string | null;
  amount_cents: number;
  currency: Currency;
  period: "monthly" | "global";
  start_date: string;
  end_date: string | null;
}
export interface Goal {
  id: string;
  name: string;
  target_cents: number;
  current_cents: number;
  currency: Currency;
  target_date: string | null;
  status: string;
}
export interface Recurring {
  id: string;
  account_id: string;
  category_id: string;
  type: "income" | "expense";
  amount_cents: number;
  currency: Currency;
  description: string;
  frequency: string;
  next_date: string;
  active: number;
}
export interface Analytics {
  totals: { type: string; amount_cents: number }[];
  categories: { name: string; color: string; amount_cents: number }[];
  monthly: { month: string; type: string; amount_cents: number }[];
  from: string;
  to: string;
  currency: Currency;
}
