"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Download,
  Filter,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./finance.css";

type AccountType = "bank" | "cash" | "mobile_money" | "savings" | "other";
type Flow = "inflow" | "outflow";
type TransactionType =
  | "revenue"
  | "expense"
  | "transfer"
  | "owner_contribution"
  | "owner_withdrawal"
  | "loan_received"
  | "loan_repayment"
  | "asset_purchase"
  | "asset_sale"
  | "liability_payment"
  | "adjustment";

type FinancialAccount = {
  id: string;
  user_id: string;
  venture_id: string | null;
  name: string;
  account_type: AccountType;
  currency: string;
  opening_balance: number | string;
  opening_balance_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FinancialTransaction = {
  id: string;
  user_id: string;
  venture_id: string | null;
  account_id: string;
  transfer_group_id: string | null;
  transaction_type: TransactionType;
  flow: Flow;
  amount: number | string;
  currency: string;
  base_amount: number | string;
  fx_rate_to_base: number | string;
  category: string;
  description: string;
  transaction_date: string;
  counterparty: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Venture = {
  id: string;
  name: string;
};

type AccountForm = {
  name: string;
  account_type: AccountType;
  currency: string;
  opening_balance: string;
  opening_balance_date: string;
  venture_id: string;
  is_active: boolean;
};

type TransactionForm = {
  account_id: string;
  venture_id: string;
  transaction_type: Exclude<TransactionType, "transfer">;
  flow: Flow;
  amount: string;
  currency: string;
  fx_rate_to_base: string;
  category: string;
  description: string;
  transaction_date: string;
  counterparty: string;
  notes: string;
};

type TransferForm = {
  source_account_id: string;
  destination_account_id: string;
  venture_id: string;
  amount: string;
  exchange_rate: string;
  source_fx_rate: string;
  destination_fx_rate: string;
  category: string;
  description: string;
  transaction_date: string;
  counterparty: string;
  notes: string;
};

type LedgerEntry = {
  id: string;
  account_id: string;
  transaction_type: TransactionType;
  flow: Flow;
  amount: number;
  currency: string;
  base_amount: number;
  fx_rate_to_base: number;
  category: string;
  description: string;
  transaction_date: string;
  counterparty: string | null;
  notes: string | null;
  venture_id: string | null;
  transfer_group_id: string | null;
  created_at: string;
  updated_at: string;
};

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

const TRANSACTION_TYPES: {
  value: Exclude<TransactionType, "transfer">;
  label: string;
  flow: Flow | "choose";
}[] = [
  { value: "revenue", label: "Revenue / income", flow: "inflow" },
  { value: "expense", label: "Expense", flow: "outflow" },
  { value: "owner_contribution", label: "Owner contribution", flow: "inflow" },
  { value: "owner_withdrawal", label: "Owner withdrawal", flow: "outflow" },
  { value: "loan_received", label: "Loan received", flow: "inflow" },
  { value: "loan_repayment", label: "Loan repayment", flow: "outflow" },
  { value: "asset_purchase", label: "Asset purchase", flow: "outflow" },
  { value: "asset_sale", label: "Asset sale", flow: "inflow" },
  { value: "liability_payment", label: "Liability payment", flow: "outflow" },
  { value: "adjustment", label: "Balance adjustment", flow: "choose" },
];

const EMPTY_ACCOUNT: AccountForm = {
  name: "",
  account_type: "cash",
  currency: "NGN",
  opening_balance: "0",
  opening_balance_date: new Date().toISOString().slice(0, 10),
  venture_id: "",
  is_active: true,
};

const EMPTY_TRANSACTION: TransactionForm = {
  account_id: "",
  venture_id: "",
  transaction_type: "revenue",
  flow: "inflow",
  amount: "",
  currency: "NGN",
  fx_rate_to_base: "1",
  category: "",
  description: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  counterparty: "",
  notes: "",
};

const EMPTY_TRANSFER: TransferForm = {
  source_account_id: "",
  destination_account_id: "",
  venture_id: "",
  amount: "",
  exchange_rate: "1",
  source_fx_rate: "1",
  destination_fx_rate: "1",
  category: "transfer",
  description: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  counterparty: "",
  notes: "",
};

const INCOME_TYPES = new Set<TransactionType>([
  "revenue",
  "asset_sale",
]);

const EXPENSE_TYPES = new Set<TransactionType>([
  "expense",
  "asset_purchase",
  "liability_payment",
]);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function numberValue(value: number | string | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en", {
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAccountType(value: AccountType) {
  return ACCOUNT_TYPES.find((item) => item.value === value)?.label ?? value;
}

function formatTransactionType(value: TransactionType) {
  return (
    TRANSACTION_TYPES.find((item) => item.value === value)?.label ??
    (value === "transfer" ? "Account transfer" : value.replaceAll("_", " "))
  );
}

function formatAccountBalance(account: FinancialAccount, balance: number) {
  return formatMoney(balance, account.currency);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function signedAmount(transaction: FinancialTransaction | LedgerEntry) {
  const amount = numberValue(transaction.amount);
  return transaction.flow === "inflow" ? amount : -amount;
}

function getDefaultFlow(type: TransactionType): Flow {
  const option = TRANSACTION_TYPES.find((item) => item.value === type);
  return option?.flow === "outflow" ? "outflow" : "inflow";
}

export default function FinancePage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [ventureFilter, setVentureFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<"transactions" | "accounts">(
    "transactions"
  );

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<FinancialAccount | null>(null);
  const [accountForm, setAccountForm] =
    useState<AccountForm>(EMPTY_ACCOUNT);

  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<FinancialTransaction | null>(null);
  const [transactionForm, setTransactionForm] =
    useState<TransactionForm>(EMPTY_TRANSACTION);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] =
    useState<TransferForm>(EMPTY_TRANSFER);
  const [menuId, setMenuId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setAccounts([]);
        setTransactions([]);
        setVentures([]);
        setPageError("Your session could not be verified. Please sign in again.");
        return;
      }

      const [accountsResult, transactionsResult, venturesResult] =
        await Promise.all([
          supabase
            .from("financial_accounts")
            .select(
              "id, user_id, venture_id, name, account_type, currency, opening_balance, opening_balance_date, is_active, created_at, updated_at"
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_transactions")
            .select(
              "id, user_id, venture_id, account_id, transfer_group_id, transaction_type, flow, amount, currency, base_amount, fx_rate_to_base, category, description, transaction_date, counterparty, notes, created_at, updated_at"
            )
            .eq("user_id", user.id)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("ventures")
            .select("id, name")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
        ]);

      if (accountsResult.error) throw accountsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (venturesResult.error) throw venturesResult.error;

      setAccounts((accountsResult.data ?? []) as FinancialAccount[]);
      setTransactions(
        (transactionsResult.data ?? []) as FinancialTransaction[]
      );
      setVentures((venturesResult.data ?? []) as Venture[]);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const ventureById = useMemo(
    () => new Map(ventures.map((venture) => [venture.id, venture.name])),
    [ventures]
  );

  const balances = useMemo(() => {
    const result = new Map<string, number>();

    for (const account of accounts) {
      result.set(account.id, numberValue(account.opening_balance));
    }

    for (const transaction of transactions) {
      const current = result.get(transaction.account_id);
      if (current === undefined) continue;

      result.set(
        transaction.account_id,
        current + signedAmount(transaction)
      );
    }

    return result;
  }, [accounts, transactions]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.is_active),
    [accounts]
  );

  const accountCurrencyTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const account of activeAccounts) {
      totals.set(
        account.currency,
        (totals.get(account.currency) ?? 0) +
          (balances.get(account.id) ?? numberValue(account.opening_balance))
      );
    }

    return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeAccounts, balances]);

  const currentMonth = todayISO().slice(0, 7);

  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date.slice(0, 7) === currentMonth
      ),
    [transactions, currentMonth]
  );

  const metrics = useMemo(() => {
    const income = monthTransactions
      .filter((transaction) => INCOME_TYPES.has(transaction.transaction_type))
      .reduce(
        (sum, transaction) => sum + numberValue(transaction.base_amount),
        0
      );

    const expenses = monthTransactions
      .filter((transaction) => EXPENSE_TYPES.has(transaction.transaction_type))
      .reduce(
        (sum, transaction) => sum + numberValue(transaction.base_amount),
        0
      );

    const inflows = monthTransactions
      .filter(
        (transaction) =>
          transaction.flow === "inflow" &&
          transaction.transaction_type !== "transfer"
      )
      .reduce(
        (sum, transaction) => sum + numberValue(transaction.base_amount),
        0
      );

    const outflows = monthTransactions
      .filter(
        (transaction) =>
          transaction.flow === "outflow" &&
          transaction.transaction_type !== "transfer"
      )
      .reduce(
        (sum, transaction) => sum + numberValue(transaction.base_amount),
        0
      );

    return {
      income,
      expenses,
      net: income - expenses,
      inflows,
      outflows,
      monthCount: monthTransactions.length,
    };
  }, [monthTransactions]);

  const expenseBreakdown = useMemo(() => {
    const groups = new Map<string, number>();

    for (const transaction of transactions) {
      if (!EXPENSE_TYPES.has(transaction.transaction_type)) continue;

      const category = transaction.category.trim() || "uncategorised";
      groups.set(
        category,
        (groups.get(category) ?? 0) + numberValue(transaction.base_amount)
      );
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const accountName = accountById.get(transaction.account_id)?.name ?? "";
      const ventureName = transaction.venture_id
        ? ventureById.get(transaction.venture_id) ?? ""
        : "";

      const matchesSearch =
        !query ||
        transaction.description.toLowerCase().includes(query) ||
        transaction.category.toLowerCase().includes(query) ||
        (transaction.counterparty ?? "").toLowerCase().includes(query) ||
        (transaction.notes ?? "").toLowerCase().includes(query) ||
        accountName.toLowerCase().includes(query) ||
        ventureName.toLowerCase().includes(query);

      const matchesFlow =
        flowFilter === "all" || transaction.flow === flowFilter;

      const matchesType =
        typeFilter === "all" || transaction.transaction_type === typeFilter;

      const matchesAccount =
        accountFilter === "all" || transaction.account_id === accountFilter;

      const matchesVenture =
        ventureFilter === "all" ||
        transaction.venture_id === ventureFilter;

      const matchesFrom =
        !dateFrom || transaction.transaction_date >= dateFrom;

      const matchesTo =
        !dateTo || transaction.transaction_date <= dateTo;

      return (
        matchesSearch &&
        matchesFlow &&
        matchesType &&
        matchesAccount &&
        matchesVenture &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    transactions,
    accountById,
    ventureById,
    search,
    flowFilter,
    typeFilter,
    accountFilter,
    ventureFilter,
    dateFrom,
    dateTo,
  ]);

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountForm(EMPTY_ACCOUNT);
    setPageError("");
    setAccountModalOpen(true);
    setMenuId(null);
  }

  function openEditAccount(account: FinancialAccount) {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      account_type: account.account_type,
      currency: account.currency,
      opening_balance: String(account.opening_balance),
      opening_balance_date: account.opening_balance_date,
      venture_id: account.venture_id ?? "",
      is_active: account.is_active,
    });
    setPageError("");
    setAccountModalOpen(true);
    setMenuId(null);
  }

  function openCreateTransaction() {
    const firstAccount = activeAccounts[0];
    setEditingTransaction(null);
    setTransactionForm({
      ...EMPTY_TRANSACTION,
      account_id: firstAccount?.id ?? "",
      currency: firstAccount?.currency ?? "NGN",
    });
    setPageError("");
    setTransactionModalOpen(true);
    setMenuId(null);
  }

  function openEditTransaction(transaction: FinancialTransaction) {
    if (transaction.transaction_type === "transfer") {
      setPageError(
        "Transfers are linked ledger entries. Delete the transfer and record it again to correct it."
      );
      return;
    }

    setEditingTransaction(transaction);
    setTransactionForm({
      account_id: transaction.account_id,
      venture_id: transaction.venture_id ?? "",
      transaction_type: transaction.transaction_type as Exclude<
        TransactionType,
        "transfer"
      >,
      flow: transaction.flow,
      amount: String(transaction.amount),
      currency: transaction.currency,
      fx_rate_to_base: String(transaction.fx_rate_to_base),
      category: transaction.category,
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      counterparty: transaction.counterparty ?? "",
      notes: transaction.notes ?? "",
    });
    setPageError("");
    setTransactionModalOpen(true);
    setMenuId(null);
  }

  function openTransfer() {
    const source = activeAccounts[0];
    const destination = activeAccounts.find(
      (account) => account.id !== source?.id
    );

    setTransferForm({
      ...EMPTY_TRANSFER,
      source_account_id: source?.id ?? "",
      destination_account_id: destination?.id ?? "",
      exchange_rate:
        source && destination && source.currency === destination.currency
          ? "1"
          : "1",
      source_fx_rate: "1",
      destination_fx_rate: "1",
    });
    setPageError("");
    setTransferModalOpen(true);
  }

  async function handleAccountSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPageError("");
    setPageSuccess("");

    const name = accountForm.name.trim();
    const currency = accountForm.currency.trim().toUpperCase();
    const openingBalance = Number(accountForm.opening_balance);

    if (!name) {
      setPageError("Enter an account name.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      setPageError("Currency must be a three-letter code, such as NGN or USD.");
      return;
    }

    if (!Number.isFinite(openingBalance)) {
      setPageError("Enter a valid opening balance.");
      return;
    }

    if (!accountForm.opening_balance_date) {
      setPageError("Select the opening balance date.");
      return;
    }

    if (
      editingAccount &&
      editingAccount.currency !== currency &&
      transactions.some(
        (transaction) => transaction.account_id === editingAccount.id
      )
    ) {
      setPageError(
        "This account already has transactions. Its currency cannot be changed safely. Create a new account in the new currency instead."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const payload = {
        user_id: user.id,
        venture_id: accountForm.venture_id || null,
        name,
        account_type: accountForm.account_type,
        currency,
        opening_balance: openingBalance,
        opening_balance_date: accountForm.opening_balance_date,
        is_active: accountForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingAccount) {
        const { error: updateError } = await supabase
          .from("financial_accounts")
          .update(payload)
          .eq("id", editingAccount.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
        setPageSuccess("Account updated.");
      } else {
        const { error: insertError } = await supabase
          .from("financial_accounts")
          .insert(payload);

        if (insertError) throw insertError;
        setPageSuccess("Account created.");
      }

      setAccountModalOpen(false);
      await loadFinance();
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTransactionSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPageError("");
    setPageSuccess("");

    const account = accountById.get(transactionForm.account_id);
    const amount = Number(transactionForm.amount);
    const fxRate = Number(transactionForm.fx_rate_to_base);
    const currency = transactionForm.currency.trim().toUpperCase();

    if (!account) {
      setPageError("Select an account.");
      return;
    }

    if (!account.is_active) {
      setPageError("Select an active account.");
      return;
    }

    if (!(amount > 0) || !Number.isFinite(amount)) {
      setPageError("Amount must be greater than zero.");
      return;
    }

    if (!(fxRate > 0) || !Number.isFinite(fxRate)) {
      setPageError("The exchange rate to base currency must be greater than zero.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      setPageError("Currency must be a three-letter code.");
      return;
    }

    if (currency !== account.currency) {
      setPageError(
        `The selected account uses ${account.currency}. Record this transaction in that currency.`
      );
      return;
    }

    const selectedType = TRANSACTION_TYPES.find(
      (item) => item.value === transactionForm.transaction_type
    );

    const flow =
      transactionForm.transaction_type === "adjustment"
        ? transactionForm.flow
        : selectedType?.flow === "outflow"
          ? "outflow"
          : "inflow";

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const payload = {
        user_id: user.id,
        venture_id: transactionForm.venture_id || account.venture_id || null,
        account_id: account.id,
        transfer_group_id: null,
        transaction_type: transactionForm.transaction_type,
        flow,
        amount,
        currency,
        base_amount: amount * fxRate,
        fx_rate_to_base: fxRate,
        category: transactionForm.category.trim() || "uncategorised",
        description: transactionForm.description.trim(),
        transaction_date: transactionForm.transaction_date,
        counterparty: transactionForm.counterparty.trim() || null,
        notes: transactionForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingTransaction) {
        const { error: updateError } = await supabase
          .from("financial_transactions")
          .update(payload)
          .eq("id", editingTransaction.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
        setPageSuccess("Transaction updated.");
      } else {
        const { error: insertError } = await supabase
          .from("financial_transactions")
          .insert(payload);

        if (insertError) throw insertError;
        setPageSuccess("Transaction recorded.");
      }

      setTransactionModalOpen(false);
      setEditingTransaction(null);
      await loadFinance();
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPageError("");
    setPageSuccess("");

    const source = accountById.get(transferForm.source_account_id);
    const destination = accountById.get(transferForm.destination_account_id);
    const sourceAmount = Number(transferForm.amount);
    const exchangeRate = Number(transferForm.exchange_rate);
    const sourceFxRate = Number(transferForm.source_fx_rate);
    const destinationFxRate = Number(transferForm.destination_fx_rate);

    if (!source || !destination) {
      setPageError("Select both the source and destination accounts.");
      return;
    }

    if (source.id === destination.id) {
      setPageError("Source and destination accounts must be different.");
      return;
    }

    if (!source.is_active || !destination.is_active) {
      setPageError("Both accounts must be active.");
      return;
    }

    if (!(sourceAmount > 0) || !Number.isFinite(sourceAmount)) {
      setPageError("Transfer amount must be greater than zero.");
      return;
    }

    if (!(exchangeRate > 0) || !Number.isFinite(exchangeRate)) {
      setPageError("Transfer exchange rate must be greater than zero.");
      return;
    }

    if (
      !(sourceFxRate > 0) ||
      !Number.isFinite(sourceFxRate) ||
      !(destinationFxRate > 0) ||
      !Number.isFinite(destinationFxRate)
    ) {
      setPageError("Both base-currency conversion rates must be greater than zero.");
      return;
    }

    if (sourceAmount > (balances.get(source.id) ?? 0)) {
      const confirmed = window.confirm(
        "This transfer is greater than the recorded source account balance. Record it anyway?"
      );

      if (!confirmed) return;
    }

    const destinationAmount = sourceAmount * exchangeRate;

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const transferGroupId = crypto.randomUUID();
      const transactionDate = transferForm.transaction_date;
      const description =
        transferForm.description.trim() ||
        `Transfer: ${source.name} → ${destination.name}`;

      const common = {
        user_id: user.id,
        venture_id: transferForm.venture_id || source.venture_id || null,
        transfer_group_id: transferGroupId,
        transaction_type: "transfer" as const,
        category: transferForm.category.trim() || "transfer",
        description,
        transaction_date: transactionDate,
        counterparty: transferForm.counterparty.trim() || null,
        notes: transferForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const rows = [
        {
          ...common,
          account_id: source.id,
          flow: "outflow" as const,
          amount: sourceAmount,
          currency: source.currency,
          base_amount: sourceAmount * sourceFxRate,
          fx_rate_to_base: sourceFxRate,
        },
        {
          ...common,
          account_id: destination.id,
          flow: "inflow" as const,
          amount: destinationAmount,
          currency: destination.currency,
          base_amount: destinationAmount * destinationFxRate,
          fx_rate_to_base: destinationFxRate,
        },
      ];

      const { error: insertError } = await supabase
        .from("financial_transactions")
        .insert(rows);

      if (insertError) throw insertError;

      setTransferModalOpen(false);
      setPageSuccess("Transfer recorded in both accounts.");
      await loadFinance();
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(transaction: FinancialTransaction) {
    setMenuId(null);
    setPageError("");
    setPageSuccess("");

    const isTransfer = transaction.transaction_type === "transfer";

    const confirmed = window.confirm(
      isTransfer
        ? "Delete this transfer and its linked entry in the other account?"
        : `Delete "${transaction.description || formatTransactionType(transaction.transaction_type)}"?`
    );

    if (!confirmed) return;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      let deleteQuery = supabase
        .from("financial_transactions")
        .delete()
        .eq("user_id", user.id);

      if (isTransfer && transaction.transfer_group_id) {
        deleteQuery = deleteQuery.eq(
          "transfer_group_id",
          transaction.transfer_group_id
        );
      } else {
        deleteQuery = deleteQuery.eq("id", transaction.id);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      setPageSuccess(isTransfer ? "Transfer deleted." : "Transaction deleted.");
      await loadFinance();
    } catch (err) {
      setPageError(getErrorMessage(err));
    }
  }

  async function toggleAccountActive(account: FinancialAccount) {
    setMenuId(null);
    setPageError("");
    setPageSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: updateError } = await supabase
        .from("financial_accounts")
        .update({
          is_active: !account.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setPageSuccess(
        account.is_active ? "Account deactivated." : "Account activated."
      );
      await loadFinance();
    } catch (err) {
      setPageError(getErrorMessage(err));
    }
  }

  function exportTransactions() {
    const headers = [
      "Date",
      "Description",
      "Type",
      "Flow",
      "Account",
      "Currency",
      "Amount",
      "Base amount",
      "FX rate to base",
      "Category",
      "Venture",
      "Counterparty",
      "Notes",
      "Transfer group ID",
    ];

    const rows = filteredTransactions.map((transaction) => [
      transaction.transaction_date,
      transaction.description,
      formatTransactionType(transaction.transaction_type),
      transaction.flow,
      accountById.get(transaction.account_id)?.name ?? "",
      transaction.currency,
      String(transaction.amount),
      String(transaction.base_amount),
      String(transaction.fx_rate_to_base),
      transaction.category,
      transaction.venture_id
        ? ventureById.get(transaction.venture_id) ?? ""
        : "",
      transaction.counterparty ?? "",
      transaction.notes ?? "",
      transaction.transfer_group_id ?? "",
    ]);

    const escapeCSV = (value: string) =>
      `"${value.replaceAll('"', '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aknm-finance-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setFlowFilter("all");
    setTypeFilter("all");
    setAccountFilter("all");
    setVentureFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilters =
    Boolean(search) ||
    flowFilter !== "all" ||
    typeFilter !== "all" ||
    accountFilter !== "all" ||
    ventureFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <main className="finance-page">
      <header className="finance-heading">
        <div>
          <div className="finance-eyebrow">
            <span />
            FINANCIAL CONTROL CENTRE
          </div>
          <h1>Finance</h1>
          <p>
            Track money across your accounts, understand cash movement, and
            keep a reliable record of your financial activity.
          </p>
        </div>

        <div className="finance-heading-actions">
          <button
            type="button"
            className="finance-secondary-button"
            onClick={openTransfer}
            disabled={activeAccounts.length < 2}
            title={
              activeAccounts.length < 2
                ? "Create at least two active accounts to transfer funds"
                : "Transfer between accounts"
            }
          >
            <ArrowLeftRight size={16} />
            Transfer
          </button>
          <button
            type="button"
            className="finance-primary-button"
            onClick={openCreateTransaction}
            disabled={activeAccounts.length === 0}
          >
            <Plus size={16} />
            Record transaction
          </button>
        </div>
      </header>

      {pageError && (
        <div className="finance-alert finance-alert-error" role="alert">
          <CircleAlert size={17} />
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {pageSuccess && (
        <div className="finance-alert finance-alert-success" role="status">
          <Check size={17} />
          <span>{pageSuccess}</span>
          <button
            type="button"
            onClick={() => setPageSuccess("")}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="finance-overview">
        <div className="finance-overview-heading">
          <div>
            <span className="finance-section-kicker">MONTHLY SNAPSHOT</span>
            <h2>Financial overview</h2>
          </div>
          <span className="finance-month-label">
            <CalendarDays size={14} />
            {new Date().toLocaleDateString("en", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="finance-metrics">
          <article className="finance-metric finance-metric-primary">
            <div className="finance-metric-top">
              <span className="finance-metric-icon">
                <Wallet size={19} />
              </span>
              <span className="finance-metric-caption">Active accounts</span>
            </div>
            <strong>{activeAccounts.length}</strong>
            <span className="finance-metric-foot">
              {accounts.length - activeAccounts.length} inactive
            </span>
          </article>

          <article className="finance-metric">
            <div className="finance-metric-top">
              <span className="finance-metric-icon finance-icon-income">
                <ArrowDownLeft size={19} />
              </span>
              <span className="finance-metric-caption">Income this month</span>
            </div>
            <strong>{formatMoney(metrics.income, "NGN")}</strong>
            <span className="finance-metric-foot">
              Revenue and asset sales · base values
            </span>
          </article>

          <article className="finance-metric">
            <div className="finance-metric-top">
              <span className="finance-metric-icon finance-icon-expense">
                <ArrowUpRight size={19} />
              </span>
              <span className="finance-metric-caption">Expenses this month</span>
            </div>
            <strong>{formatMoney(metrics.expenses, "NGN")}</strong>
            <span className="finance-metric-foot">
              Expenses, asset purchases and liabilities
            </span>
          </article>

          <article className="finance-metric">
            <div className="finance-metric-top">
              <span className="finance-metric-icon finance-icon-net">
                <Banknote size={19} />
              </span>
              <span className="finance-metric-caption">Operating net</span>
            </div>
            <strong className={metrics.net < 0 ? "finance-negative" : ""}>
              {formatMoney(metrics.net, "NGN")}
            </strong>
            <span className="finance-metric-foot">
              Income minus recorded expenses
            </span>
          </article>
        </div>

        <div className="finance-movement-strip">
          <div>
            <span className="finance-movement-dot finance-movement-in" />
            <span>Non-transfer inflows</span>
            <strong>{formatMoney(metrics.inflows, "NGN")}</strong>
          </div>
          <div>
            <span className="finance-movement-dot finance-movement-out" />
            <span>Non-transfer outflows</span>
            <strong>{formatMoney(metrics.outflows, "NGN")}</strong>
          </div>
          <div>
            <span className="finance-movement-dot finance-movement-count" />
            <span>Transactions this month</span>
            <strong>{metrics.monthCount}</strong>
          </div>
        </div>
      </section>

      <section className="finance-balances-section">
        <div className="finance-section-heading">
          <div>
            <h2>Account balances</h2>
            <p>Current recorded balances by account currency.</p>
          </div>
          <button
            type="button"
            className="finance-text-button"
            onClick={() => setActiveTab("accounts")}
          >
            Manage accounts
            <ArrowUpRight size={15} />
          </button>
        </div>

        {accountCurrencyTotals.length > 0 && (
          <div className="finance-currency-summary">
            {accountCurrencyTotals.map(([currency, total]) => (
              <div className="finance-currency-total" key={currency}>
                <span>{currency} total</span>
                <strong>{formatMoney(total, currency)}</strong>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="finance-loading">
            <LoaderCircle size={22} className="finance-spinner" />
            Loading financial records...
          </div>
        ) : activeAccounts.length === 0 ? (
          <div className="finance-empty finance-empty-accounts">
            <span className="finance-empty-icon">
              <Wallet size={25} />
            </span>
            <h3>Set up your first account</h3>
            <p>
              Add a bank account, cash wallet, mobile money account or savings
              account before recording transactions.
            </p>
            <button
              type="button"
              className="finance-primary-button"
              onClick={openCreateAccount}
            >
              <Plus size={16} />
              Add account
            </button>
          </div>
        ) : (
          <div className="finance-account-grid">
            {activeAccounts.slice(0, 4).map((account) => (
              <article className="finance-account-card" key={account.id}>
                <div className="finance-account-top">
                  <span className="finance-account-icon">
                    {account.account_type === "bank" ? (
                      <Banknote size={18} />
                    ) : account.account_type === "mobile_money" ? (
                      <CreditCard size={18} />
                    ) : (
                      <Wallet size={18} />
                    )}
                  </span>
                  <span className="finance-account-type">
                    {formatAccountType(account.account_type)}
                  </span>
                  <button
                    type="button"
                    className="finance-account-menu"
                    aria-label={`Edit ${account.name}`}
                    onClick={() => openEditAccount(account)}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <h3>{account.name}</h3>
                <strong className="finance-account-balance">
                  {formatAccountBalance(
                    account,
                    balances.get(account.id) ??
                      numberValue(account.opening_balance)
                  )}
                </strong>
                <div className="finance-account-bottom">
                  <span>{account.currency}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountFilter(account.id);
                      setActiveTab("transactions");
                    }}
                  >
                    View activity
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {activeAccounts.length > 4 && (
          <button
            type="button"
            className="finance-more-accounts"
            onClick={() => setActiveTab("accounts")}
          >
            View all {activeAccounts.length} active accounts
            <ArrowUpRight size={14} />
          </button>
        )}
      </section>

      <section className="finance-ledger-section">
        <div className="finance-section-heading finance-ledger-heading">
          <div>
            <h2>Financial records</h2>
            <p>Review, filter, and export your transaction history.</p>
          </div>
          <button
            type="button"
            className="finance-secondary-button finance-export-button"
            onClick={exportTransactions}
            disabled={filteredTransactions.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        <div className="finance-tabs" role="tablist" aria-label="Finance views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "transactions"}
            className={activeTab === "transactions" ? "is-active" : ""}
            onClick={() => setActiveTab("transactions")}
          >
            Transactions
            <span>{transactions.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "accounts"}
            className={activeTab === "accounts" ? "is-active" : ""}
            onClick={() => setActiveTab("accounts")}
          >
            All accounts
            <span>{accounts.length}</span>
          </button>
        </div>

        {activeTab === "transactions" ? (
          <>
            <div className="finance-filters">
              <label className="finance-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search description, category, account..."
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <label className="finance-filter-select">
                <Filter size={14} />
                <select
                  value={flowFilter}
                  onChange={(event) => setFlowFilter(event.target.value)}
                  aria-label="Filter by cash flow"
                >
                  <option value="all">All flows</option>
                  <option value="inflow">Inflow</option>
                  <option value="outflow">Outflow</option>
                </select>
                <ChevronDown size={13} />
              </label>

              <label className="finance-filter-select">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  aria-label="Filter by transaction type"
                >
                  <option value="all">All types</option>
                  {[
                    ...TRANSACTION_TYPES.map((item) => ({
                      value: item.value,
                      label: item.label,
                    })),
                    { value: "transfer", label: "Account transfer" },
                  ].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>

              <label className="finance-filter-select">
                <select
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value)}
                  aria-label="Filter by account"
                >
                  <option value="all">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>

              <label className="finance-filter-select">
                <select
                  value={ventureFilter}
                  onChange={(event) => setVentureFilter(event.target.value)}
                  aria-label="Filter by venture"
                >
                  <option value="all">All ventures</option>
                  {ventures.map((venture) => (
                    <option key={venture.id} value={venture.id}>
                      {venture.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>

            <div className="finance-date-filters">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              {hasFilters && (
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
              <span className="finance-result-count">
                {filteredTransactions.length} records
              </span>
            </div>

            {loading ? (
              <div className="finance-loading">
                <LoaderCircle size={22} className="finance-spinner" />
                Loading transactions...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="finance-empty">
                <span className="finance-empty-icon">
                  <Banknote size={24} />
                </span>
                <h3>
                  {transactions.length === 0
                    ? "No transactions recorded"
                    : "No matching transactions"}
                </h3>
                <p>
                  {transactions.length === 0
                    ? "Record your first income, expense or transfer to begin building your financial history."
                    : "Adjust your search or filters to see more records."}
                </p>
                {transactions.length === 0 ? (
                  <button
                    type="button"
                    className="finance-primary-button"
                    onClick={openCreateTransaction}
                    disabled={activeAccounts.length === 0}
                  >
                    <Plus size={15} />
                    Record transaction
                  </button>
                ) : (
                  <button
                    type="button"
                    className="finance-secondary-button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Account</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => {
                      const account = accountById.get(transaction.account_id);
                      const isTransfer =
                        transaction.transaction_type === "transfer";

                      return (
                        <tr key={transaction.id}>
                          <td>
                            <div className="finance-transaction-cell">
                              <span
                                className={`finance-flow-icon ${
                                  transaction.flow === "inflow"
                                    ? "finance-flow-in"
                                    : "finance-flow-out"
                                }`}
                              >
                                {isTransfer ? (
                                  <ArrowLeftRight size={16} />
                                ) : transaction.flow === "inflow" ? (
                                  <ArrowDownLeft size={16} />
                                ) : (
                                  <ArrowUpRight size={16} />
                                )}
                              </span>
                              <div>
                                <strong>
                                  {transaction.description ||
                                    formatTransactionType(
                                      transaction.transaction_type
                                    )}
                                </strong>
                                <span>
                                  {formatTransactionType(
                                    transaction.transaction_type
                                  )}
                                  {transaction.counterparty
                                    ? ` · ${transaction.counterparty}`
                                    : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="finance-table-account">
                              <strong>{account?.name ?? "Unknown account"}</strong>
                              <span>{transaction.currency}</span>
                            </div>
                          </td>
                          <td className="finance-date-cell">
                            {formatDate(transaction.transaction_date)}
                          </td>
                          <td>
                            <span className="finance-category-pill">
                              {transaction.category || "uncategorised"}
                            </span>
                            {transaction.venture_id && (
                              <span className="finance-venture-label">
                                {ventureById.get(transaction.venture_id) ??
                                  "Venture"}
                              </span>
                            )}
                          </td>
                          <td>
                            <strong
                              className={`finance-amount ${
                                transaction.flow === "inflow"
                                  ? "finance-amount-in"
                                  : "finance-amount-out"
                              }`}
                            >
                              {transaction.flow === "inflow" ? "+" : "−"}
                              {formatMoney(
                                numberValue(transaction.amount),
                                transaction.currency
                              )}
                            </strong>
                            {numberValue(transaction.fx_rate_to_base) !== 1 && (
                              <span className="finance-base-amount">
                                Base:{" "}
                                {numberValue(transaction.base_amount).toLocaleString(
                                  "en",
                                  { maximumFractionDigits: 2 }
                                )}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="finance-row-menu-wrap">
                              <button
                                type="button"
                                className="finance-row-menu"
                                aria-label={`Actions for ${
                                  transaction.description || "transaction"
                                }`}
                                aria-expanded={menuId === transaction.id}
                                onClick={() =>
                                  setMenuId((current) =>
                                    current === transaction.id
                                      ? null
                                      : transaction.id
                                  )
                                }
                              >
                                <MoreHorizontal size={18} />
                              </button>
                              {menuId === transaction.id && (
                                <div className="finance-row-menu">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditTransaction(transaction)
                                    }
                                  >
                                    <Pencil size={14} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="finance-delete-action"
                                    onClick={() =>
                                      void deleteTransaction(transaction)
                                    }
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="finance-all-accounts">
            <div className="finance-all-accounts-heading">
              <span>Account</span>
              <span>Opening balance</span>
              <span>Current balance</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {accounts.length === 0 ? (
              <div className="finance-empty">
                <h3>No accounts yet</h3>
                <p>Create an account to begin tracking balances.</p>
              </div>
            ) : (
              accounts.map((account) => (
                <div className="finance-all-account-row" key={account.id}>
                  <div className="finance-all-account-name">
                    <span className="finance-account-icon">
                      <Wallet size={17} />
                    </span>
                    <div>
                      <strong>{account.name}</strong>
                      <span>
                        {formatAccountType(account.account_type)} ·{" "}
                        {account.currency}
                      </span>
                      {account.venture_id && (
                        <small>
                          {ventureById.get(account.venture_id) ?? "Venture"}
                        </small>
                      )}
                    </div>
                  </div>
                  <strong className="finance-opening-balance">
                    {formatMoney(
                      numberValue(account.opening_balance),
                      account.currency
                    )}
                  </strong>
                  <strong className="finance-current-balance">
                    {formatMoney(
                      balances.get(account.id) ??
                        numberValue(account.opening_balance),
                      account.currency
                    )}
                  </strong>
                  <span
                    className={`finance-account-status ${
                      account.is_active ? "is-active" : "is-inactive"
                    }`}
                  >
                    {account.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="finance-account-actions">
                    <button
                      type="button"
                      onClick={() => openEditAccount(account)}
                      aria-label={`Edit ${account.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleAccountActive(account)}
                    >
                      {account.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="finance-account-list-footer">
              <p>
                Accounts with transaction history should be deactivated rather
                than deleted, so your ledger remains intact.
              </p>
              <button
                type="button"
                className="finance-primary-button"
                onClick={openCreateAccount}
              >
                <Plus size={15} />
                Add account
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="finance-bottom-grid">
        <article className="finance-insight-card">
          <div className="finance-insight-heading">
            <div>
              <span className="finance-section-kicker">SPENDING PATTERNS</span>
              <h2>Expense categories</h2>
            </div>
            <span className="finance-insight-icon">
              <ArrowUpRight size={17} />
            </span>
          </div>

          {expenseBreakdown.length === 0 ? (
            <p className="finance-insight-empty">
              Expense categories will appear as you record expenses, asset
              purchases and liability payments.
            </p>
          ) : (
            <div className="finance-expense-list">
              {expenseBreakdown.map(([category, amount]) => {
                const total = expenseBreakdown.reduce(
                  (sum, item) => sum + item[1],
                  0
                );
                const percentage = total > 0 ? (amount / total) * 100 : 0;

                return (
                  <div className="finance-expense-item" key={category}>
                    <div className="finance-expense-item-top">
                      <span>{category}</span>
                      <strong>{formatMoney(amount, "NGN")}</strong>
                    </div>
                    <div className="finance-expense-track">
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="finance-insight-footnote">
                Based on recorded base amounts across all dates. Values are
                displayed in NGN as the current reporting convention.
              </p>
            </div>
          )}
        </article>

        <article className="finance-insight-card finance-accounting-note">
          <div className="finance-insight-heading">
            <div>
              <span className="finance-section-kicker">LEDGER PRINCIPLES</span>
              <h2>Keep your records reliable</h2>
            </div>
            <span className="finance-insight-icon">
              <RefreshCw size={17} />
            </span>
          </div>
          <ul>
            <li>
              <span className="finance-note-check">
                <Check size={13} />
              </span>
              Transfers are linked debit and credit entries, not income or
              expenses.
            </li>
            <li>
              <span className="finance-note-check">
                <Check size={13} />
              </span>
              Account balances use opening balance plus signed native-currency
              transactions.
            </li>
            <li>
              <span className="finance-note-check">
                <Check size={13} />
              </span>
              Each transaction stores its own exchange rate and base amount.
            </li>
            <li>
              <span className="finance-note-check">
                <Check size={13} />
              </span>
              Opening balances should reflect the starting balance on the
              selected opening date.
            </li>
          </ul>
        </article>
      </section>

      {accountModalOpen && (
        <div
          className="finance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setAccountModalOpen(false);
            }
          }}
        >
          <section
            className="finance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-account-modal-title"
          >
            <header className="finance-modal-header">
              <div>
                <span className="finance-modal-eyebrow">ACCOUNT MANAGEMENT</span>
                <h2 id="finance-account-modal-title">
                  {editingAccount ? "Edit account" : "Add financial account"}
                </h2>
                <p>
                  Record where money is held and establish the starting
                  balance.
                </p>
              </div>
              <button
                type="button"
                className="finance-close-button"
                onClick={() => setAccountModalOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            {pageError && (
              <div className="finance-alert finance-alert-error">
                <CircleAlert size={16} />
                <span>{pageError}</span>
              </div>
            )}

            <form
              className="finance-form"
              onSubmit={(event) => void handleAccountSubmit(event)}
            >
              <label className="finance-field">
                <span>Account name <b>*</b></span>
                <input
                  autoFocus
                  required
                  maxLength={150}
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Main business bank account"
                />
              </label>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Account type</span>
                  <select
                    value={accountForm.account_type}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        account_type: event.target.value as AccountType,
                      }))
                    }
                  >
                    {ACCOUNT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>Currency <b>*</b></span>
                  <input
                    required
                    minLength={3}
                    maxLength={3}
                    value={accountForm.currency}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="NGN"
                  />
                </label>
              </div>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Opening balance <b>*</b></span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={accountForm.opening_balance}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        opening_balance: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="finance-field">
                  <span>Opening balance date <b>*</b></span>
                  <input
                    type="date"
                    required
                    value={accountForm.opening_balance_date}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        opening_balance_date: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="finance-field">
                <span>Associated venture</span>
                <select
                  value={accountForm.venture_id}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      venture_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Personal / not linked to a venture</option>
                  {ventures.map((venture) => (
                    <option key={venture.id} value={venture.id}>
                      {venture.name}
                    </option>
                  ))}
                </select>
              </label>

              {editingAccount && (
                <label className="finance-checkbox-field">
                  <input
                    type="checkbox"
                    checked={accountForm.is_active}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  <span>Account is active and available for transactions</span>
                </label>
              )}

              <footer className="finance-modal-footer">
                <button
                  type="button"
                  className="finance-secondary-button"
                  onClick={() => setAccountModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="finance-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle size={15} className="finance-spinner" />
                  ) : (
                    <Check size={15} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingAccount
                      ? "Save changes"
                      : "Create account"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {transactionModalOpen && (
        <div
          className="finance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setTransactionModalOpen(false);
            }
          }}
        >
          <section
            className="finance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-transaction-modal-title"
          >
            <header className="finance-modal-header">
              <div>
                <span className="finance-modal-eyebrow">TRANSACTION LEDGER</span>
                <h2 id="finance-transaction-modal-title">
                  {editingTransaction ? "Edit transaction" : "Record transaction"}
                </h2>
                <p>
                  Capture the amount, date, category and exchange-rate details.
                </p>
              </div>
              <button
                type="button"
                className="finance-close-button"
                onClick={() => setTransactionModalOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            {pageError && (
              <div className="finance-alert finance-alert-error">
                <CircleAlert size={16} />
                <span>{pageError}</span>
              </div>
            )}

            <form
              className="finance-form"
              onSubmit={(event) => void handleTransactionSubmit(event)}
            >
              <label className="finance-field">
                <span>Transaction type <b>*</b></span>
                <select
                  value={transactionForm.transaction_type}
                  onChange={(event) => {
                    const type = event.target.value as Exclude<
                      TransactionType,
                      "transfer"
                    >;
                    const option = TRANSACTION_TYPES.find(
                      (item) => item.value === type
                    );

                    setTransactionForm((current) => ({
                      ...current,
                      transaction_type: type,
                      flow:
                        option?.flow === "outflow" ? "outflow" : "inflow",
                      category:
                        current.category ||
                        (type === "revenue"
                          ? "sales"
                          : type === "expense"
                            ? "operating"
                            : type.replaceAll("_", " ")),
                    }));
                  }}
                >
                  {TRANSACTION_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Account <b>*</b></span>
                  <select
                    required
                    value={transactionForm.account_id}
                    onChange={(event) => {
                      const account = accountById.get(event.target.value);

                      setTransactionForm((current) => ({
                        ...current,
                        account_id: event.target.value,
                        currency: account?.currency ?? "NGN",
                        venture_id:
                          current.venture_id || account?.venture_id || "",
                      }));
                    }}
                  >
                    <option value="">Select account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>Flow</span>
                  <select
                    value={transactionForm.flow}
                    disabled={transactionForm.transaction_type !== "adjustment"}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        flow: event.target.value as Flow,
                      }))
                    }
                  >
                    <option value="inflow">Inflow</option>
                    <option value="outflow">Outflow</option>
                  </select>
                </label>
              </div>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Amount <b>*</b></span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transactionForm.amount}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="finance-field">
                  <span>Currency</span>
                  <input
                    value={transactionForm.currency}
                    readOnly
                    aria-readonly="true"
                  />
                </label>
              </div>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Exchange rate to base <b>*</b></span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transactionForm.fx_rate_to_base}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        fx_rate_to_base: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Use 1 when the transaction currency is the base currency.
                  </small>
                </label>

                <label className="finance-field">
                  <span>Date <b>*</b></span>
                  <input
                    type="date"
                    required
                    value={transactionForm.transaction_date}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        transaction_date: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Category</span>
                  <input
                    maxLength={100}
                    value={transactionForm.category}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="e.g. sales, rent, transport"
                  />
                </label>

                <label className="finance-field">
                  <span>Counterparty</span>
                  <input
                    maxLength={200}
                    value={transactionForm.counterparty}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        counterparty: event.target.value,
                      }))
                    }
                    placeholder="Customer, supplier..."
                  />
                </label>
              </div>

              <label className="finance-field">
                <span>Description <b>*</b></span>
                <input
                  required
                  maxLength={250}
                  value={transactionForm.description}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What was this transaction for?"
                />
              </label>

              <label className="finance-field">
                <span>Associated venture</span>
                <select
                  value={transactionForm.venture_id}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      venture_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Personal / not linked to a venture</option>
                  {ventures.map((venture) => (
                    <option key={venture.id} value={venture.id}>
                      {venture.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>Notes</span>
                <textarea
                  rows={2}
                  maxLength={3000}
                  value={transactionForm.notes}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Reference, explanation or supporting notes"
                />
              </label>

              <footer className="finance-modal-footer">
                <button
                  type="button"
                  className="finance-secondary-button"
                  onClick={() => setTransactionModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="finance-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle size={15} className="finance-spinner" />
                  ) : (
                    <Check size={15} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingTransaction
                      ? "Save changes"
                      : "Record transaction"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {transferModalOpen && (
        <div
          className="finance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setTransferModalOpen(false);
            }
          }}
        >
          <section
            className="finance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-transfer-modal-title"
          >
            <header className="finance-modal-header">
              <div>
                <span className="finance-modal-eyebrow">INTERNAL MOVEMENT</span>
                <h2 id="finance-transfer-modal-title">Transfer between accounts</h2>
                <p>
                  The system records a source outflow and a linked destination
                  inflow.
                </p>
              </div>
              <button
                type="button"
                className="finance-close-button"
                onClick={() => setTransferModalOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            {pageError && (
              <div className="finance-alert finance-alert-error">
                <CircleAlert size={16} />
                <span>{pageError}</span>
              </div>
            )}

            <form
              className="finance-form"
              onSubmit={(event) => void handleTransferSubmit(event)}
            >
              <label className="finance-field">
                <span>From account <b>*</b></span>
                <select
                  required
                  value={transferForm.source_account_id}
                  onChange={(event) => {
                    const source = accountById.get(event.target.value);

                    setTransferForm((current) => ({
                      ...current,
                      source_account_id: event.target.value,
                      source_fx_rate: "1",
                      destination_fx_rate: "1",
                      exchange_rate:
                        source &&
                        accountById.get(current.destination_account_id)
                          ?.currency === source.currency
                          ? "1"
                          : current.exchange_rate,
                    }));
                  }}
                >
                  <option value="">Select source account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency} ·{" "}
                      {formatMoney(
                        balances.get(account.id) ??
                          numberValue(account.opening_balance),
                        account.currency
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>To account <b>*</b></span>
                <select
                  required
                  value={transferForm.destination_account_id}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      destination_account_id: event.target.value,
                      exchange_rate:
                        accountById.get(current.source_account_id)?.currency ===
                        accountById.get(event.target.value)?.currency
                          ? "1"
                          : current.exchange_rate,
                      source_fx_rate: "1",
                      destination_fx_rate: "1",
                    }))
                  }
                >
                  <option value="">Select destination account</option>
                  {activeAccounts
                    .filter(
                      (account) =>
                        account.id !== transferForm.source_account_id
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                </select>
              </label>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>
                    Amount ({accountById.get(transferForm.source_account_id)
                      ?.currency ?? "source currency"}) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transferForm.amount}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="finance-field">
                  <span>Destination amount rate <b>*</b></span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transferForm.exchange_rate}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        exchange_rate: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Destination currency units received per source unit.
                  </small>
                </label>
              </div>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Source FX rate to base <b>*</b></span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transferForm.source_fx_rate}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        source_fx_rate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="finance-field">
                  <span>Destination FX rate to base <b>*</b></span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={transferForm.destination_fx_rate}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        destination_fx_rate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              {(() => {
                const source = accountById.get(
                  transferForm.source_account_id
                );
                const destination = accountById.get(
                  transferForm.destination_account_id
                );
                const amount = Number(transferForm.amount);
                const rate = Number(transferForm.exchange_rate);

                if (
                  !source ||
                  !destination ||
                  !(amount > 0) ||
                  !(rate > 0)
                ) {
                  return null;
                }

                return (
                  <div className="finance-transfer-preview">
                    <div>
                      <span>Source debit</span>
                      <strong>
                        {formatMoney(amount, source.currency)}
                      </strong>
                    </div>
                    <ArrowLeftRight size={17} />
                    <div>
                      <span>Destination credit</span>
                      <strong>
                        {formatMoney(amount * rate, destination.currency)}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              <label className="finance-field">
                <span>Date <b>*</b></span>
                <input
                  type="date"
                  required
                  value={transferForm.transaction_date}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      transaction_date: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="finance-field">
                <span>Description</span>
                <input
                  maxLength={250}
                  value={transferForm.description}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="e.g. Move funds to savings"
                />
              </label>

              <div className="finance-form-row">
                <label className="finance-field">
                  <span>Associated venture</span>
                  <select
                    value={transferForm.venture_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        venture_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Personal / not linked</option>
                    {ventures.map((venture) => (
                      <option key={venture.id} value={venture.id}>
                        {venture.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>Counterparty (optional)</span>
                  <input
                    maxLength={200}
                    value={transferForm.counterparty}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        counterparty: event.target.value,
                      }))
                    }
                    placeholder="Recipient or reference"
                  />
                </label>
              </div>

              <label className="finance-field">
                <span>Notes</span>
                <textarea
                  rows={2}
                  maxLength={3000}
                  value={transferForm.notes}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional details"
                />
              </label>

              <footer className="finance-modal-footer">
                <button
                  type="button"
                  className="finance-secondary-button"
                  onClick={() => setTransferModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="finance-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle size={15} className="finance-spinner" />
                  ) : (
                    <ArrowLeftRight size={15} />
                  )}
                  {saving ? "Recording..." : "Record transfer"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}