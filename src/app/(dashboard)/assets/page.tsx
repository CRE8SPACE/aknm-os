"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
   ArrowDownLeft,
   Banknote,
   BriefcaseBusiness,
   CalendarDays,
   Check,
   CircleDollarSign,
   FileText,
   Landmark,
   LoaderCircle,
   Pencil,
   Plus,
   RefreshCw,
   Search,
   ShieldCheck,
   Trash2,
   TrendingDown,
   TrendingUp,
   Wallet,
   X,
   Clock3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./assets.css";
type Venture = {
   id: string;
   name: string;
   base_currency: string;
};
type Asset = {
   id: string;
   user_id: string;
   venture_id: string | null;
   name: string;
   description: string;
   category: string;
   ownership_type: "personal" | "business" | "joint";
   acquisition_date: string | null;
   acquisition_cost: number | null;
   current_value: number;
   currency: string;
   valuation_date: string | null;
   image_paths: string[];
   notes: string | null;
   created_at: string;
   updated_at: string;
};
type Liability = {
   id: string;
   user_id: string;
   venture_id: string | null;
   name: string;
   description: string;
   liability_type: string;
   original_amount: number;
   outstanding_amount: number;
   currency: string;
   start_date: string | null;
   due_date: string | null;
   created_at: string;
   updated_at: string;
};
type AssetForm = {
   name: string;
   description: string;
   category: string;
   ownership_type: "personal" | "business" | "joint";
   venture_id: string;
   acquisition_date: string;
   acquisition_cost: string;
   current_value: string;
   currency: string;
   valuation_date: string;
   notes: string;
};
type LiabilityForm = {
   name: string;
   description: string;
   liability_type: string;
   venture_id: string;
   original_amount: string;
   outstanding_amount: string;
   currency: string;
   start_date: string;
   due_date: string;
};
type ModalMode =
   | { kind: "asset"; item: Asset | null }
   | { kind: "liability"; item: Liability | null }
   | null;
const ASSET_CATEGORIES = [
   "property",
   "land",
   "vehicle",
   "equipment",
   "technology",
   "investment",
   "cash",
   "furniture",
   "business",
   "other",
];
const LIABILITY_TYPES = [
   "loan",
   "mortgage",
   "business_debt",
   "personal_debt",
   "credit",
   "tax",
   "other",
];
const CURRENCIES = ["NGN", "USD", "EUR", "GBP", "CAD", "XOF"];
const EMPTY_ASSET: AssetForm = {
   name: "",
   description: "",
   category: "other",
   ownership_type: "personal",
   venture_id: "",
   acquisition_date: "",
   acquisition_cost: "",
   current_value: "0",
   currency: "NGN",
   valuation_date: "",
   notes: "",
};
const EMPTY_LIABILITY: LiabilityForm = {
   name: "",
   description: "",
   liability_type: "other",
   venture_id: "",
   original_amount: "",
   outstanding_amount: "",
   currency: "NGN",
   start_date: "",
   due_date: "",
};
function money(value: number, currency = "NGN") {
   try {
      return new Intl.NumberFormat("en", {
         style: "currency",
         currency,
         maximumFractionDigits: 2,
      }).format(Number(value) || 0);
   } catch {
      return `${currency} ${(Number(value) || 0).toLocaleString()}`;
   }
}
function dateLabel(value: string | null) {
   if (!value) return "Not set";
   const date = new Date(`${value.slice(0, 10)}T00:00:00`);
   return Number.isNaN(date.getTime())
      ? "Not set"
      : date.toLocaleDateString("en", {
            day: "numeric",
            month: "short",
            year: "numeric",
         });
}
function label(value: string) {
   return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function errorMessage(error: unknown) {
   if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
   ) {
      const details =
         "details" in error && typeof error.details === "string"
            ? error.details
            : "";
      const hint =
         "hint" in error && typeof error.hint === "string"
            ? error.hint
            : "";
      return [error.message, details, hint].filter(Boolean).join(" — ");
   }
   return error instanceof Error
      ? error.message
      : "An unexpected error occurred.";
}
export default function AssetsPage() {
   const supabase = useMemo(() => createClient(), []);
   const [assets, setAssets] = useState<Asset[]>([]);
   const [liabilities, setLiabilities] = useState<Liability[]>([]);
   const [ventures, setVentures] = useState<Venture[]>([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [deletingId, setDeletingId] = useState<string | null>(null);
   const [error, setError] = useState("");
   const [notice, setNotice] = useState("");
   const [modal, setModal] = useState<ModalMode>(null);
   const [activeTab, setActiveTab] = useState<"assets" | "liabilities">("assets");
   const [search, setSearch] = useState("");
   const [ownershipFilter, setOwnershipFilter] = useState("all");
   const [ventureFilter, setVentureFilter] = useState("all");
   const [currencyFilter, setCurrencyFilter] = useState("all");
   const [assetForm, setAssetForm] = useState<AssetForm>(EMPTY_ASSET);
   const [liabilityForm, setLiabilityForm] =
      useState<LiabilityForm>(EMPTY_LIABILITY);
   const loadData = useCallback(async () => {
      setLoading(true);
      setError("");
      try {
         const [
            { data: userData, error: authError },
            assetResult,
            liabilityResult,
            ventureResult,
         ] = await Promise.all([
            supabase.auth.getUser(),
            supabase.from("assets").select("*").order("updated_at", { ascending: false }),
            supabase
               .from("liabilities")
               .select("*")
               .order("updated_at", { ascending: false }),
            supabase
               .from("ventures")
               .select("id, name, base_currency")
               .order("name", { ascending: true }),
         ]);
         if (authError) throw authError;
         if (!userData.user) {
            throw new Error("Your session has expired. Please sign in again.");
         }
         if (assetResult.error) throw assetResult.error;
         if (liabilityResult.error) throw liabilityResult.error;
         if (ventureResult.error) throw ventureResult.error;
         setAssets((assetResult.data ?? []) as Asset[]);
         setLiabilities((liabilityResult.data ?? []) as Liability[]);
         setVentures((ventureResult.data ?? []) as Venture[]);
      } catch (loadError) {
         setError(errorMessage(loadError));
      } finally {
         setLoading(false);
      }
   }, [supabase]);
   useEffect(() => {
      void loadData();
   }, [loadData]);
   const ventureName = (ventureId: string | null) =>
      ventures.find((venture) => venture.id === ventureId)?.name ?? "Personal";
   const allCurrencies = useMemo(
      () =>
         Array.from(
            new Set([
               ...assets.map((asset) => asset.currency),
               ...liabilities.map((item) => item.currency),
            ]),
         ).sort(),
      [assets, liabilities],
   );
   const filteredAssets = useMemo(() => {
      const query = search.trim().toLowerCase();
      return assets.filter((asset) => {
         const matchesSearch =
            !query ||
            [
               asset.name,
               asset.description,
               asset.category,
               asset.notes ?? "",
               ventureName(asset.venture_id),
            ]
               .join(" ")
               .toLowerCase()
               .includes(query);
         return (
            matchesSearch &&
            (ownershipFilter === "all" ||
               asset.ownership_type === ownershipFilter) &&
            (ventureFilter === "all" ||
               (ventureFilter === "personal"
                  ? !asset.venture_id
                  : asset.venture_id === ventureFilter)) &&
            (currencyFilter === "all" || asset.currency === currencyFilter)
         );
      });
   }, [
      assets,
      search,
      ownershipFilter,
      ventureFilter,
      currencyFilter,
      ventures,
   ]);
   const filteredLiabilities = useMemo(() => {
      const query = search.trim().toLowerCase();
      return liabilities.filter((item) => {
         const matchesSearch =
            !query ||
            [
               item.name,
               item.description,
               item.liability_type,
               ventureName(item.venture_id),
            ]
               .join(" ")
               .toLowerCase()
               .includes(query);
         return (
            matchesSearch &&
            (ventureFilter === "all" ||
               (ventureFilter === "personal"
                  ? !item.venture_id
                  : item.venture_id === ventureFilter)) &&
            (currencyFilter === "all" || item.currency === currencyFilter)
         );
      });
   }, [liabilities, search, ventureFilter, currencyFilter, ventures]);
   const assetTotals = useMemo(() => {
      const currencies = Array.from(new Set(assets.map((asset) => asset.currency)));
      return currencies.map((currency) => {
         const rows = assets.filter((asset) => asset.currency === currency);
         return {
            currency,
            value: rows.reduce(
               (sum, asset) => sum + Number(asset.current_value || 0),
               0,
            ),
            cost: rows.reduce(
               (sum, asset) => sum + Number(asset.acquisition_cost || 0),
               0,
            ),
            count: rows.length,
         };
      });
   }, [assets]);
   const liabilityTotals = useMemo(() => {
      const currencies = Array.from(
         new Set(liabilities.map((item) => item.currency)),
      );
      return currencies.map((currency) => {
         const rows = liabilities.filter((item) => item.currency === currency);
         return {
            currency,
            original: rows.reduce(
               (sum, item) => sum + Number(item.original_amount || 0),
               0,
            ),
            outstanding: rows.reduce(
               (sum, item) => sum + Number(item.outstanding_amount || 0),
               0,
            ),
            count: rows.length,
         };
      });
   }, [liabilities]);
   const openNewAsset = () => {
      setAssetForm(EMPTY_ASSET);
      setError("");
      setNotice("");
      setModal({ kind: "asset", item: null });
   };
   const openEditAsset = (asset: Asset) => {
      setAssetForm({
         name: asset.name,
         description: asset.description ?? "",
         category: asset.category,
         ownership_type: asset.ownership_type,
         venture_id: asset.venture_id ?? "",
         acquisition_date: asset.acquisition_date ?? "",
         acquisition_cost:
            asset.acquisition_cost === null ? "" : String(asset.acquisition_cost),
         current_value: String(asset.current_value ?? 0),
         currency: asset.currency,
         valuation_date: asset.valuation_date ?? "",
         notes: asset.notes ?? "",
      });
      setError("");
      setNotice("");
      setModal({ kind: "asset", item: asset });
   };
   const openNewLiability = () => {
      setLiabilityForm(EMPTY_LIABILITY);
      setError("");
      setNotice("");
      setModal({ kind: "liability", item: null });
   };
   const openEditLiability = (item: Liability) => {
      setLiabilityForm({
         name: item.name,
         description: item.description ?? "",
         liability_type: item.liability_type,
         venture_id: item.venture_id ?? "",
         original_amount: String(item.original_amount),
         outstanding_amount: String(item.outstanding_amount),
         currency: item.currency,
         start_date: item.start_date ?? "",
         due_date: item.due_date ?? "",
      });
      setError("");
      setNotice("");
      setModal({ kind: "liability", item });
   };
   const saveAsset = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true);
      setError("");
      setNotice("");
      const currentValue = Number(assetForm.current_value);
      const acquisitionCost =
         assetForm.acquisition_cost.trim() === ""
            ? null
            : Number(assetForm.acquisition_cost);
      if (
         !assetForm.name.trim() ||
         !/^[A-Z]{3}$/.test(assetForm.currency) ||
         !Number.isFinite(currentValue) ||
         currentValue < 0 ||
         (acquisitionCost !== null &&
            (!Number.isFinite(acquisitionCost) || acquisitionCost < 0))
      ) {
         setError("Enter a valid asset name, currency, and non-negative amounts.");
         setSaving(false);
         return;
      }
      try {
         const {
            data: { user },
            error: authError,
         } = await supabase.auth.getUser();
         if (authError) throw authError;
         if (!user) {
            throw new Error("Your session has expired. Please sign in again.");
         }
         const payload = {
            name: assetForm.name.trim(),
            description: assetForm.description.trim(),
            category: assetForm.category,
            ownership_type: assetForm.ownership_type,
            venture_id: assetForm.venture_id || null,
            acquisition_date: assetForm.acquisition_date || null,
            acquisition_cost: acquisitionCost,
            current_value: currentValue,
            currency: assetForm.currency,
            valuation_date: assetForm.valuation_date || null,
            notes: assetForm.notes.trim() || null,
         };
         const existingAsset = modal?.kind === "asset" ? modal.item : null;
         const isEditing = existingAsset !== null;
         const result = existingAsset
            ? await supabase
                  .from("assets")
                  .update(payload)
                  .eq("id", existingAsset.id)
                  .eq("user_id", user.id)
                  .select("*")
                  .single()
            : await supabase
                  .from("assets")
                  .insert({ ...payload, user_id: user.id })
                  .select("*")
                  .single();
         if (result.error) throw result.error;
         setModal(null);
         setNotice(isEditing ? "Asset updated successfully." : "Asset added successfully.");
         await loadData();
      } catch (saveError) {
         setError(`Could not save asset: ${errorMessage(saveError)}`);
      } finally {
         setSaving(false);
      }
   };
   const saveLiability = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true);
      setError("");
      setNotice("");
      const originalAmount = Number(liabilityForm.original_amount);
      const outstandingAmount = Number(liabilityForm.outstanding_amount);
      if (
         !liabilityForm.name.trim() ||
         !/^[A-Z]{3}$/.test(liabilityForm.currency) ||
         !Number.isFinite(originalAmount) ||
         !Number.isFinite(outstandingAmount) ||
         originalAmount < 0 ||
         outstandingAmount < 0
      ) {
         setError("Enter a valid liability name, currency, and non-negative amounts.");
         setSaving(false);
         return;
      }
      if (outstandingAmount > originalAmount) {
         setError("Outstanding amount cannot exceed the original amount.");
         setSaving(false);
         return;
      }
      try {
         const {
            data: { user },
            error: authError,
         } = await supabase.auth.getUser();
         if (authError) throw authError;
         if (!user) {
            throw new Error("Your session has expired. Please sign in again.");
         }
         const payload = {
            name: liabilityForm.name.trim(),
            description: liabilityForm.description.trim(),
            liability_type: liabilityForm.liability_type,
            venture_id: liabilityForm.venture_id || null,
            original_amount: originalAmount,
            outstanding_amount: outstandingAmount,
            currency: liabilityForm.currency,
            start_date: liabilityForm.start_date || null,
            due_date: liabilityForm.due_date || null,
         };
         const existingLiability =
            modal?.kind === "liability" ? modal.item : null;
         const isEditing = existingLiability !== null;
         const result = existingLiability
            ? await supabase
                  .from("liabilities")
                  .update(payload)
                  .eq("id", existingLiability.id)
                  .eq("user_id", user.id)
                  .select("*")
                  .single()
            : await supabase
                  .from("liabilities")
                  .insert({ ...payload, user_id: user.id })
                  .select("*")
                  .single();
         if (result.error) throw result.error;
         setModal(null);
         setNotice(
            isEditing
               ? "Liability updated successfully."
               : "Liability added successfully.",
         );
         await loadData();
      } catch (saveError) {
         setError(`Could not save liability: ${errorMessage(saveError)}`);
      } finally {
         setSaving(false);
      }
   };
   const deleteRecord = async (
      kind: "asset" | "liability",
      id: string,
   ) => {
      const confirmed = window.confirm(
         `Delete this ${kind}? This action cannot be undone.`,
      );
      if (!confirmed) return;
      setDeletingId(id);
      setError("");
      setNotice("");
      try {
         const {
            data: { user },
            error: authError,
         } = await supabase.auth.getUser();
         if (authError) throw authError;
         if (!user) throw new Error("Please sign in again.");
         const result =
            kind === "asset"
               ? await supabase
                     .from("assets")
                     .delete()
                     .eq("id", id)
                     .eq("user_id", user.id)
               : await supabase
                     .from("liabilities")
                     .delete()
                     .eq("id", id)
                     .eq("user_id", user.id);
         if (result.error) throw result.error;
         setNotice(`${kind === "asset" ? "Asset" : "Liability"} deleted.`);
         await loadData();
      } catch (deleteError) {
         setError(`Could not delete record: ${errorMessage(deleteError)}`);
      } finally {
         setDeletingId(null);
      }
   };
   const updateOutstanding = async (item: Liability) => {
      const input = window.prompt(
         `Enter the current outstanding amount (${item.currency}).`,
         String(item.outstanding_amount),
      );
      if (input === null) return;
      const amount = Number(input);
      if (!Number.isFinite(amount) || amount < 0) {
         setError("Outstanding amount must be a valid non-negative number.");
         return;
      }
      if (amount > Number(item.original_amount)) {
         setError("Outstanding amount cannot exceed the original amount.");
         return;
      }
      setError("");
      setNotice("");
      try {
         const {
            data: { user },
            error: authError,
         } = await supabase.auth.getUser();
         if (authError) throw authError;
         if (!user) throw new Error("Please sign in again.");
         const { error: updateError } = await supabase
            .from("liabilities")
            .update({ outstanding_amount: amount })
            .eq("id", item.id)
            .eq("user_id", user.id);
         if (updateError) throw updateError;
         setNotice("Outstanding balance updated.");
         await loadData();
      } catch (updateError) {
         setError(`Could not update balance: ${errorMessage(updateError)}`);
      }
   };
   const clearFilters = () => {
      setSearch("");
      setOwnershipFilter("all");
      setVentureFilter("all");
      setCurrencyFilter("all");
   };
   const activeCount =
      activeTab === "assets"
         ? filteredAssets.length
         : filteredLiabilities.length;
   return (
      <main className="assets-page">
         <header className="assets-header">
            <div>
               <div className="assets-eyebrow">
                  <span className="assets-eyebrow-dot" />
                  PERSONAL FINANCE / BALANCE SHEET
               </div>
               <h1>Assets & liabilities</h1>
               <p className="assets-header-copy">
                  Know what you own, what you owe, and how your position is changing.
               </p>
            </div>
            <div className="assets-header-actions">
               <button
                  type="button"
                  className="assets-button assets-button-secondary"
                  onClick={() => void loadData()}
                  disabled={loading}
               >
                  <RefreshCw size={16} className={loading ? "assets-spin" : ""} />
                  Refresh
               </button>
               <button
                  type="button"
                  className="assets-button assets-button-primary"
                  onClick={activeTab === "assets" ? openNewAsset : openNewLiability}
               >
                  <Plus size={17} />
                  Add {activeTab === "assets" ? "asset" : "liability"}
               </button>
            </div>
         </header>
         {error && (
            <div className="assets-alert assets-alert-error" role="alert">
               <span>{error}</span>
               <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
               >
                  <X size={16} />
               </button>
            </div>
         )}
         {notice && (
            <div className="assets-alert assets-alert-success" role="status">
               <Check size={16} />
               <span>{notice}</span>
               <button
                  type="button"
                  onClick={() => setNotice("")}
                  aria-label="Dismiss message"
               >
                  <X size={16} />
               </button>
            </div>
         )}
         <section className="assets-metrics">
            <article className="assets-metric-card assets-metric-primary">
               <div className="assets-metric-top">
                  <span className="assets-metric-label">Assets under management</span>
                  <span className="assets-metric-icon">
                     <Landmark size={18} />
                  </span>
               </div>
               <div className="assets-metric-value">
                  {assets.length.toLocaleString()}
                  <span className="assets-metric-unit">records</span>
               </div>
               <div className="assets-metric-foot">
                  {assetTotals.length
                     ? assetTotals.map((total) => (
                           <span key={total.currency}>
                              {money(total.value, total.currency)}
                           </span>
                        ))
                     : <span>No assets recorded yet</span>}
               </div>
            </article>
            <article className="assets-metric-card">
               <div className="assets-metric-top">
                  <span className="assets-metric-label">Outstanding liabilities</span>
                  <span className="assets-metric-icon assets-icon-warm">
                     <TrendingDown size={18} />
                  </span>
               </div>
               <div className="assets-metric-value">
                  {liabilities.length.toLocaleString()}
                  <span className="assets-metric-unit">records</span>
               </div>
               <div className="assets-metric-foot">
                  {liabilityTotals.length
                     ? liabilityTotals.map((total) => (
                           <span key={total.currency}>
                              {money(total.outstanding, total.currency)}
                           </span>
                        ))
                     : <span>No liabilities recorded</span>}
               </div>
            </article>
            <article className="assets-metric-card">
               <div className="assets-metric-top">
                  <span className="assets-metric-label">Asset acquisition cost</span>
                  <span className="assets-metric-icon">
                     <Wallet size={18} />
                  </span>
               </div>
               <div className="assets-metric-value assets-metric-value-small">
                  {assetTotals.length
                     ? assetTotals.map((total) => (
                           <span key={total.currency}>
                              {money(total.cost, total.currency)}
                           </span>
                        ))
                     : "—"}
               </div>
               <div className="assets-metric-foot">
                  Recorded purchase cost, by currency
               </div>
            </article>
            <article className="assets-metric-card">
               <div className="assets-metric-top">
                  <span className="assets-metric-label">Ventures linked</span>
                  <span className="assets-metric-icon">
                     <BriefcaseBusiness size={18} />
                  </span>
               </div>
               <div className="assets-metric-value">
                  {ventures.length.toLocaleString()}
               </div>
               <div className="assets-metric-foot">
                  Available venture associations
               </div>
            </article>
         </section>
         <section className="assets-overview-note">
            <span className="assets-overview-note-icon">
               <ShieldCheck size={18} />
            </span>
            <div>
               <strong>Balance sheet overview</strong>
               <p>
                  Values are grouped by currency. They are not converted into a
                  single net-worth figure because exchange rates are not stored in
                  the assets and liabilities tables.
               </p>
            </div>
         </section>
         <section className="assets-records-panel">
            <div className="assets-records-heading">
               <div>
                  <h2>Your records</h2>
                  <p>Keep ownership and outstanding balances up to date.</p>
               </div>
               <div className="assets-tabs" role="tablist" aria-label="Record type">
                  <button
                     type="button"
                     role="tab"
                     aria-selected={activeTab === "assets"}
                     className={activeTab === "assets" ? "active" : ""}
                     onClick={() => setActiveTab("assets")}
                  >
                     <TrendingUp size={15} />
                     Assets <span>{assets.length}</span>
                  </button>
                  <button
                     type="button"
                     role="tab"
                     aria-selected={activeTab === "liabilities"}
                     className={activeTab === "liabilities" ? "active" : ""}
                     onClick={() => setActiveTab("liabilities")}
                  >
                     <TrendingDown size={15} />
                     Liabilities <span>{liabilities.length}</span>
                  </button>
               </div>
            </div>
            <div className="assets-toolbar">
               <label className="assets-search">
                  <Search size={17} />
                  <input
                     value={search}
                     onChange={(event) => setSearch(event.target.value)}
                     placeholder={`Search ${activeTab}...`}
                     aria-label={`Search ${activeTab}`}
                  />
                  {search && (
                     <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                     >
                        <X size={15} />
                     </button>
                  )}
               </label>
               {activeTab === "assets" && (
                  <select
                     value={ownershipFilter}
                     onChange={(event) => setOwnershipFilter(event.target.value)}
                     aria-label="Filter by ownership"
                     className="assets-filter"
                  >
                     <option value="all">All ownership</option>
                     <option value="personal">Personal</option>
                     <option value="business">Business</option>
                     <option value="joint">Joint</option>
                  </select>
               )}
               <select
                  value={ventureFilter}
                  onChange={(event) => setVentureFilter(event.target.value)}
                  aria-label="Filter by venture"
                  className="assets-filter"
               >
                  <option value="all">All ventures</option>
                  <option value="personal">No venture / personal</option>
                  {ventures.map((venture) => (
                     <option value={venture.id} key={venture.id}>
                        {venture.name}
                     </option>
                  ))}
               </select>
               <select
                  value={currencyFilter}
                  onChange={(event) => setCurrencyFilter(event.target.value)}
                  aria-label="Filter by currency"
                  className="assets-filter"
               >
                  <option value="all">All currencies</option>
                  {allCurrencies.map((currency) => (
                     <option value={currency} key={currency}>
                        {currency}
                     </option>
                  ))}
               </select>
               {(search ||
                  ownershipFilter !== "all" ||
                  ventureFilter !== "all" ||
                  currencyFilter !== "all") && (
                  <button
                     type="button"
                     className="assets-clear-filters"
                     onClick={clearFilters}
                  >
                     Clear filters
                  </button>
               )}
            </div>
            <div className="assets-table-meta">
               <span>
                  {activeCount} {activeTab === "assets" ? "assets" : "liabilities"} shown
               </span>
               <span>{loading ? "Updating records…" : "Synced with Supabase"}</span>
            </div>
            {loading ? (
               <div className="assets-state">
                  <LoaderCircle size={25} className="assets-spin" />
                  <strong>Loading your records</strong>
                  <span>Fetching assets, liabilities, and ventures.</span>
               </div>
            ) : activeTab === "assets" ? (
               filteredAssets.length === 0 ? (
                  <div className="assets-state">
                     <div className="assets-empty-icon">
                        <Landmark size={25} />
                     </div>
                     <strong>
                        {assets.length
                           ? "No matching assets"
                           : "Start building your asset register"}
                     </strong>
                     <span>
                        {assets.length
                           ? "Try changing your search or filters."
                           : "Record property, equipment, investments, vehicles, and other assets."}
                     </span>
                     {!assets.length && (
                        <button
                           type="button"
                           className="assets-button assets-button-primary"
                           onClick={openNewAsset}
                        >
                           <Plus size={16} /> Add your first asset
                        </button>
                     )}
                  </div>
               ) : (
                  <div className="assets-table-wrap">
                     <table className="assets-table">
                        <thead>
                           <tr>
                              <th>Asset</th>
                              <th>Ownership</th>
                              <th>Venture</th>
                              <th>Acquisition cost</th>
                              <th>Current value</th>
                              <th>Valuation date</th>
                              <th aria-label="Actions" />
                           </tr>
                        </thead>
                        <tbody>
                           {filteredAssets.map((asset) => (
                              <tr key={asset.id}>
                                 <td>
                                    <div className="assets-record-name">
                                       <span className="assets-record-icon">
                                          <CircleDollarSign size={17} />
                                       </span>
                                       <span>
                                          <strong>{asset.name}</strong>
                                          <small>
                                             {label(asset.category)}
                                             {asset.description ? ` · ${asset.description}` : ""}
                                          </small>
                                       </span>
                                    </div>
                                 </td>
                                 <td>
                                    <span className={`assets-tag ownership-${asset.ownership_type}`}>
                                       {label(asset.ownership_type)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-secondary-text">
                                       {ventureName(asset.venture_id)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-money">
                                       {asset.acquisition_cost === null
                                          ? "—"
                                          : money(Number(asset.acquisition_cost), asset.currency)}
                                    </span>
                                    <small className="assets-cell-subtext">
                                       {dateLabel(asset.acquisition_date)}
                                    </small>
                                 </td>
                                 <td>
                                    <span className="assets-money assets-money-highlight">
                                       {money(Number(asset.current_value), asset.currency)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-secondary-text">
                                       {dateLabel(asset.valuation_date)}
                                    </span>
                                 </td>
                                 <td>
                                    <div className="assets-row-actions">
                                       <button
                                          type="button"
                                          title="Edit asset"
                                          aria-label={`Edit ${asset.name}`}
                                          onClick={() => openEditAsset(asset)}
                                       >
                                          <Pencil size={15} />
                                       </button>
                                       <button
                                          type="button"
                                          title="Delete asset"
                                          aria-label={`Delete ${asset.name}`}
                                          className="assets-delete-action"
                                          disabled={deletingId === asset.id}
                                          onClick={() => void deleteRecord("asset", asset.id)}
                                       >
                                          {deletingId === asset.id ? (
                                             <LoaderCircle size={15} className="assets-spin" />
                                          ) : (
                                             <Trash2 size={15} />
                                          )}
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )
            ) : filteredLiabilities.length === 0 ? (
               <div className="assets-state">
                  <div className="assets-empty-icon assets-empty-warm">
                     <Banknote size={25} />
                  </div>
                  <strong>
                     {liabilities.length
                        ? "No matching liabilities"
                        : "Keep track of what you owe"}
                  </strong>
                  <span>
                     {liabilities.length
                        ? "Try changing your search or filters."
                        : "Record loans, mortgages, debts, and other outstanding obligations."}
                  </span>
                  {!liabilities.length && (
                     <button
                        type="button"
                        className="assets-button assets-button-primary"
                        onClick={openNewLiability}
                     >
                        <Plus size={16} /> Add your first liability
                     </button>
                  )}
               </div>
            ) : (
               <div className="assets-table-wrap">
                  <table className="assets-table">
                     <thead>
                        <tr>
                           <th>Liability</th>
                           <th>Type</th>
                           <th>Venture</th>
                           <th>Original amount</th>
                           <th>Outstanding</th>
                           <th>Due date</th>
                           <th aria-label="Actions" />
                        </tr>
                     </thead>
                     <tbody>
                        {filteredLiabilities.map((item) => {
                           const paid = Math.max(
                              0,
                              Number(item.original_amount) -
                                 Number(item.outstanding_amount),
                           );
                           const progress =
                              Number(item.original_amount) > 0
                                 ? Math.min(
                                       100,
                                       (paid / Number(item.original_amount)) * 100,
                                    )
                                 : 0;
                           const overdue =
                              item.due_date &&
                              Number(item.outstanding_amount) > 0 &&
                              item.due_date < new Date().toISOString().slice(0, 10);
                           return (
                              <tr key={item.id}>
                                 <td>
                                    <div className="assets-record-name">
                                       <span className="assets-record-icon assets-liability-icon">
                                          <FileText size={17} />
                                       </span>
                                       <span>
                                          <strong>{item.name}</strong>
                                          <small>
                                             {item.description || `Started ${dateLabel(item.start_date)}`}
                                          </small>
                                       </span>
                                    </div>
                                 </td>
                                 <td>
                                    <span className="assets-tag ownership-joint">
                                       {label(item.liability_type)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-secondary-text">
                                       {ventureName(item.venture_id)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-money">
                                       {money(Number(item.original_amount), item.currency)}
                                    </span>
                                 </td>
                                 <td>
                                    <span className="assets-money assets-money-warm">
                                       {money(Number(item.outstanding_amount), item.currency)}
                                    </span>
                                    <div className="assets-progress-track">
                                       <span style={{ width: `${progress}%` }} />
                                    </div>
                                    <small className="assets-cell-subtext">
                                       {Math.round(progress)}% repaid
                                    </small>
                                 </td>
                                 <td>
                                    <span className={overdue ? "assets-overdue" : "assets-secondary-text"}>
                                       {overdue && <Clock3 size={13} />}
                                       {dateLabel(item.due_date)}
                                    </span>
                                 </td>
                                 <td>
                                    <div className="assets-row-actions">
                                       <button
                                          type="button"
                                          title="Update outstanding balance"
                                          aria-label={`Update balance for ${item.name}`}
                                          onClick={() => void updateOutstanding(item)}
                                       >
                                          <Banknote size={15} />
                                       </button>
                                       <button
                                          type="button"
                                          title="Edit liability"
                                          aria-label={`Edit ${item.name}`}
                                          onClick={() => openEditLiability(item)}
                                       >
                                          <Pencil size={15} />
                                       </button>
                                       <button
                                          type="button"
                                          title="Delete liability"
                                          aria-label={`Delete ${item.name}`}
                                          className="assets-delete-action"
                                          disabled={deletingId === item.id}
                                          onClick={() => void deleteRecord("liability", item.id)}
                                       >
                                          {deletingId === item.id ? (
                                             <LoaderCircle size={15} className="assets-spin" />
                                          ) : (
                                             <Trash2 size={15} />
                                          )}
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </section>
         <section className="assets-bottom-grid">
            <article className="assets-breakdown-card">
               <div className="assets-breakdown-heading">
                  <span className="assets-breakdown-icon">
                     <TrendingUp size={17} />
                  </span>
                  <div>
                     <h3>Asset valuation</h3>
                     <p>Current value by currency</p>
                  </div>
               </div>
               {assetTotals.length ? (
                  <div className="assets-breakdown-list">
                     {assetTotals.map((total) => {
                        const max = Math.max(
                           ...assetTotals.map((row) => row.value),
                           1,
                        );
                        return (
                           <div className="assets-breakdown-row" key={total.currency}>
                              <div className="assets-breakdown-row-top">
                                 <span>{total.currency}</span>
                                 <strong>{money(total.value, total.currency)}</strong>
                              </div>
                              <div className="assets-progress-track">
                                 <span style={{ width: `${(total.value / max) * 100}%` }} />
                              </div>
                              <small>
                                 {total.count} {total.count === 1 ? "asset" : "assets"}
                              </small>
                           </div>
                        );
                     })}
                  </div>
               ) : (
                  <p className="assets-breakdown-empty">
                     Add assets to see your valuation breakdown.
                  </p>
               )}
            </article>
            <article className="assets-breakdown-card">
               <div className="assets-breakdown-heading">
                  <span className="assets-breakdown-icon assets-breakdown-warm">
                     <ArrowDownLeft size={17} />
                  </span>
                  <div>
                     <h3>Liability position</h3>
                     <p>Outstanding balance by currency</p>
                  </div>
               </div>
               {liabilityTotals.length ? (
                  <div className="assets-breakdown-list">
                     {liabilityTotals.map((total) => {
                        const max = Math.max(
                           ...liabilityTotals.map((row) => row.outstanding),
                           1,
                        );
                        return (
                           <div className="assets-breakdown-row" key={total.currency}>
                              <div className="assets-breakdown-row-top">
                                 <span>{total.currency}</span>
                                 <strong>{money(total.outstanding, total.currency)}</strong>
                              </div>
                              <div className="assets-progress-track assets-progress-warm">
                                 <span
                                    style={{
                                       width: `${(total.outstanding / max) * 100}%`,
                                    }}
                                 />
                              </div>
                              <small>
                                 {total.count}{" "}
                                 {total.count === 1 ? "liability" : "liabilities"} ·
                                 original {money(total.original, total.currency)}
                              </small>
                           </div>
                        );
                     })}
                  </div>
               ) : (
                  <p className="assets-breakdown-empty">
                     Add liabilities to see your outstanding position.
                  </p>
               )}
            </article>
         </section>
         <footer className="assets-footer-note">
            <CalendarDays size={15} />
            Asset values and outstanding balances reflect the latest saved records.
            Update valuations and liability balances as your position changes.
         </footer>
         {modal && (
            <div
               className="assets-modal-backdrop"
               role="presentation"
               onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !saving) {
                     setModal(null);
                  }
               }}
            >
               <section
                  className="assets-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="assets-modal-title"
               >
                  <div className="assets-modal-header">
                     <div>
                        <span className="assets-modal-kicker">
                           {modal.kind === "asset" ? "ASSET REGISTER" : "LIABILITY REGISTER"}
                        </span>
                        <h2 id="assets-modal-title">
                           {modal.item ? "Edit " : "Add "}
                           {modal.kind === "asset" ? "asset" : "liability"}
                        </h2>
                        <p>
                           {modal.kind === "asset"
                              ? "Capture ownership, acquisition, and valuation details."
                              : "Record the original amount and the current outstanding balance."}
                        </p>
                     </div>
                     <button
                        type="button"
                        className="assets-modal-close"
                        onClick={() => setModal(null)}
                        disabled={saving}
                        aria-label="Close modal"
                     >
                        <X size={19} />
                     </button>
                  </div>
                  {modal.kind === "asset" ? (
                     <form className="assets-form" onSubmit={saveAsset}>
                        <div className="assets-form-section-title">Asset details</div>
                        <label className="assets-field assets-field-full">
                           <span>Asset name <i>*</i></span>
                           <input
                              required
                              maxLength={150}
                              value={assetForm.name}
                              onChange={(event) =>
                                 setAssetForm({ ...assetForm, name: event.target.value })
                              }
                              placeholder="e.g. Office building, MacBook Pro"
                           />
                        </label>
                        <label className="assets-field assets-field-full">
                           <span>Description</span>
                           <textarea
                              rows={2}
                              value={assetForm.description}
                              onChange={(event) =>
                                 setAssetForm({
                                    ...assetForm,
                                    description: event.target.value,
                                 })
                              }
                              placeholder="What is this asset? Include identifying details."
                           />
                        </label>
                        <div className="assets-form-grid">
                           <label className="assets-field">
                              <span>Category</span>
                              <select
                                 value={assetForm.category}
                                 onChange={(event) =>
                                    setAssetForm({ ...assetForm, category: event.target.value })
                                 }
                              >
                                 {ASSET_CATEGORIES.map((category) => (
                                    <option value={category} key={category}>
                                       {label(category)}
                                    </option>
                                 ))}
                              </select>
                           </label>
                           <label className="assets-field">
                              <span>Ownership</span>
                              <select
                                 value={assetForm.ownership_type}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       ownership_type: event.target.value as AssetForm["ownership_type"],
                                    })
                                 }
                              >
                                 <option value="personal">Personal</option>
                                 <option value="business">Business</option>
                                 <option value="joint">Joint</option>
                              </select>
                           </label>
                           <label className="assets-field assets-field-full">
                              <span>Associated venture</span>
                              <select
                                 value={assetForm.venture_id}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       venture_id: event.target.value,
                                    })
                                 }
                              >
                                 <option value="">No venture / personal</option>
                                 {ventures.map((venture) => (
                                    <option key={venture.id} value={venture.id}>
                                       {venture.name}
                                    </option>
                                 ))}
                              </select>
                           </label>
                        </div>
                        <div className="assets-form-section-title">
                           Acquisition & valuation
                        </div>
                        <div className="assets-form-grid">
                           <label className="assets-field">
                              <span>Currency <i>*</i></span>
                              <select
                                 value={assetForm.currency}
                                 onChange={(event) =>
                                    setAssetForm({ ...assetForm, currency: event.target.value })
                                 }
                              >
                                 {CURRENCIES.map((currency) => (
                                    <option key={currency} value={currency}>
                                       {currency}
                                    </option>
                                 ))}
                                 {!CURRENCIES.includes(assetForm.currency) && (
                                    <option value={assetForm.currency}>
                                       {assetForm.currency}
                                    </option>
                                 )}
                              </select>
                           </label>
                           <label className="assets-field">
                              <span>Acquisition date</span>
                              <input
                                 type="date"
                                 value={assetForm.acquisition_date}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       acquisition_date: event.target.value,
                                    })
                                 }
                              />
                           </label>
                           <label className="assets-field">
                              <span>Acquisition cost</span>
                              <input
                                 type="number"
                                 min="0"
                                 step="0.01"
                                 value={assetForm.acquisition_cost}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       acquisition_cost: event.target.value,
                                    })
                                 }
                                 placeholder="0.00"
                              />
                           </label>
                           <label className="assets-field">
                              <span>Current value <i>*</i></span>
                              <input
                                 required
                                 type="number"
                                 min="0"
                                 step="0.01"
                                 value={assetForm.current_value}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       current_value: event.target.value,
                                    })
                                 }
                              />
                           </label>
                           <label className="assets-field assets-field-full">
                              <span>Valuation date</span>
                              <input
                                 type="date"
                                 value={assetForm.valuation_date}
                                 onChange={(event) =>
                                    setAssetForm({
                                       ...assetForm,
                                       valuation_date: event.target.value,
                                    })
                                 }
                              />
                           </label>
                           <label className="assets-field assets-field-full">
                              <span>Notes</span>
                              <textarea
                                 rows={3}
                                 value={assetForm.notes}
                                 onChange={(event) =>
                                    setAssetForm({ ...assetForm, notes: event.target.value })
                                 }
                                 placeholder="Additional details, location, serial number, or valuation notes."
                              />
                           </label>
                        </div>
                        <div className="assets-modal-footer">
                           <button
                              type="button"
                              className="assets-button assets-button-secondary"
                              disabled={saving}
                              onClick={() => setModal(null)}
                           >
                              Cancel
                           </button>
                           <button
                              type="submit"
                              className="assets-button assets-button-primary"
                              disabled={saving}
                           >
                              {saving ? (
                                 <LoaderCircle size={16} className="assets-spin" />
                              ) : (
                                 <Check size={16} />
                              )}
                              {saving
                                 ? "Saving…"
                                 : modal.item
                                    ? "Save changes"
                                    : "Add asset"}
                           </button>
                        </div>
                     </form>
                  ) : (
                     <form className="assets-form" onSubmit={saveLiability}>
                        <div className="assets-form-section-title">
                           Liability details
                        </div>
                        <label className="assets-field assets-field-full">
                           <span>Liability name <i>*</i></span>
                           <input
                              required
                              maxLength={150}
                              value={liabilityForm.name}
                              onChange={(event) =>
                                 setLiabilityForm({
                                    ...liabilityForm,
                                    name: event.target.value,
                                 })
                              }
                              placeholder="e.g. Business loan, property mortgage"
                           />
                        </label>
                        <label className="assets-field assets-field-full">
                           <span>Description</span>
                           <textarea
                              rows={2}
                              value={liabilityForm.description}
                              onChange={(event) =>
                                 setLiabilityForm({
                                    ...liabilityForm,
                                    description: event.target.value,
                                 })
                              }
                              placeholder="Lender, purpose, terms, or other details."
                           />
                        </label>
                        <div className="assets-form-grid">
                           <label className="assets-field">
                              <span>Liability type</span>
                              <select
                                 value={liabilityForm.liability_type}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       liability_type: event.target.value,
                                    })
                                 }
                              >
                                 {LIABILITY_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                       {label(type)}
                                    </option>
                                 ))}
                              </select>
                           </label>
                           <label className="assets-field">
                              <span>Currency <i>*</i></span>
                              <select
                                 value={liabilityForm.currency}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       currency: event.target.value,
                                    })
                                 }
                              >
                                 {CURRENCIES.map((currency) => (
                                    <option key={currency} value={currency}>
                                       {currency}
                                    </option>
                                 ))}
                                 {!CURRENCIES.includes(liabilityForm.currency) && (
                                    <option value={liabilityForm.currency}>
                                       {liabilityForm.currency}
                                    </option>
                                 )}
                              </select>
                           </label>
                           <label className="assets-field assets-field-full">
                              <span>Associated venture</span>
                              <select
                                 value={liabilityForm.venture_id}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       venture_id: event.target.value,
                                    })
                                 }
                              >
                                 <option value="">No venture / personal</option>
                                 {ventures.map((venture) => (
                                    <option key={venture.id} value={venture.id}>
                                       {venture.name}
                                    </option>
                                 ))}
                              </select>
                           </label>
                        </div>
                        <div className="assets-form-section-title">Amounts & dates</div>
                        <div className="assets-form-grid">
                           <label className="assets-field">
                              <span>Original amount <i>*</i></span>
                              <input
                                 required
                                 type="number"
                                 min="0"
                                 step="0.01"
                                 value={liabilityForm.original_amount}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       original_amount: event.target.value,
                                    })
                                 }
                                 placeholder="0.00"
                              />
                           </label>
                           <label className="assets-field">
                              <span>Outstanding amount <i>*</i></span>
                              <input
                                 required
                                 type="number"
                                 min="0"
                                 step="0.01"
                                 value={liabilityForm.outstanding_amount}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       outstanding_amount: event.target.value,
                                    })
                                 }
                                 placeholder="0.00"
                              />
                           </label>
                           <label className="assets-field">
                              <span>Start date</span>
                              <input
                                 type="date"
                                 value={liabilityForm.start_date}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       start_date: event.target.value,
                                    })
                                 }
                              />
                           </label>
                           <label className="assets-field">
                              <span>Due date</span>
                              <input
                                 type="date"
                                 value={liabilityForm.due_date}
                                 onChange={(event) =>
                                    setLiabilityForm({
                                       ...liabilityForm,
                                       due_date: event.target.value,
                                    })
                                 }
                              />
                           </label>
                        </div>
                        <p className="assets-form-hint">
                           Outstanding balance should reflect the amount still owed.
                           Repayment history is not stored by the current database schema.
                        </p>
                        <div className="assets-modal-footer">
                           <button
                              type="button"
                              className="assets-button assets-button-secondary"
                              disabled={saving}
                              onClick={() => setModal(null)}
                           >
                              Cancel
                           </button>
                           <button
                              type="submit"
                              className="assets-button assets-button-primary"
                              disabled={saving}
                           >
                              {saving ? (
                                 <LoaderCircle size={16} className="assets-spin" />
                              ) : (
                                 <Check size={16} />
                              )}
                              {saving
                                 ? "Saving…"
                                 : modal.item
                                    ? "Save changes"
                                    : "Add liability"}
                           </button>
                        </div>
                     </form>
                  )}
               </section>
            </div>
         )}
      </main>
   );
}