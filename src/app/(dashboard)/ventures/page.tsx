"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Globe,
  Layers3,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./ventures.css";

type VentureStatus = "idea" | "active" | "paused" | "closed";

type Venture = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  status: VentureStatus;
  website_url: string | null;
  base_currency: string;
  objectives: string | null;
  created_at: string;
  updated_at: string;
};

type VentureForm = {
  name: string;
  description: string;
  category: string;
  status: VentureStatus;
  website_url: string;
  base_currency: string;
  objectives: string;
};

const STATUS_OPTIONS: { value: VentureStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_OPTIONS = [
  "business",
  "technology",
  "real estate",
  "hospitality",
  "media",
  "investment",
  "education",
  "personal",
  "other",
];

const EMPTY_FORM: VentureForm = {
  name: "",
  description: "",
  category: "business",
  status: "idea",
  website_url: "",
  base_currency: "NGN",
  objectives: "",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function normaliseWebsite(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  return /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

function getWebsiteHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default function VenturesPage() {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenture, setEditingVenture] = useState<Venture | null>(null);
  const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);
  const [form, setForm] = useState<VentureForm>(EMPTY_FORM);
  const [menuId, setMenuId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadVentures = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setVentures([]);
        setError("Your session could not be verified. Please sign in again.");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("ventures")
        .select(
          "id, user_id, name, description, category, status, website_url, base_currency, objectives, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (queryError) throw queryError;

      setVentures((data ?? []) as Venture[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadVentures();
  }, [loadVentures]);

  const filteredVentures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ventures.filter((venture) => {
      const matchesSearch =
        !query ||
        venture.name.toLowerCase().includes(query) ||
        venture.description.toLowerCase().includes(query) ||
        venture.category.toLowerCase().includes(query) ||
        (venture.objectives ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || venture.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || venture.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [ventures, search, statusFilter, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: ventures.length,
      active: ventures.filter((venture) => venture.status === "active").length,
      ideas: ventures.filter((venture) => venture.status === "idea").length,
      paused: ventures.filter((venture) => venture.status === "paused").length,
    }),
    [ventures]
  );

  function openCreateModal() {
    setEditingVenture(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setModalOpen(true);
    setMenuId(null);
  }

  function openEditModal(venture: Venture) {
    setEditingVenture(venture);
    setForm({
      name: venture.name,
      description: venture.description ?? "",
      category: venture.category || "business",
      status: venture.status,
      website_url: venture.website_url ?? "",
      base_currency: venture.base_currency || "NGN",
      objectives: venture.objectives ?? "",
    });
    setError("");
    setSuccess("");
    setSelectedVenture(null);
    setModalOpen(true);
    setMenuId(null);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingVenture(null);
    setForm(EMPTY_FORM);
  }

  function updateField<K extends keyof VentureForm>(
    field: K,
    value: VentureForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const currency = form.base_currency.trim().toUpperCase();

    if (!name) {
      setError("Enter a name for this venture.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      setError("Currency must be a three-letter code, such as NGN, USD or EUR.");
      return;
    }

    const website = normaliseWebsite(form.website_url);

    if (website) {
      try {
        const parsed = new URL(website);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Invalid website protocol");
        }
      } catch {
        setError("Enter a valid website address.");
        return;
      }
    }

    setSaving(true);

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
        user_id: user.id,
        name,
        description: form.description.trim(),
        category: form.category,
        status: form.status,
        website_url: website,
        base_currency: currency,
        objectives: form.objectives.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingVenture) {
        const { error: updateError } = await supabase
          .from("ventures")
          .update(payload)
          .eq("id", editingVenture.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;

        setSuccess("Venture updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("ventures")
          .insert(payload);

        if (insertError) throw insertError;

        setSuccess("Venture created successfully.");
      }

      setModalOpen(false);
      setEditingVenture(null);
      setForm(EMPTY_FORM);
      await loadVentures();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteVenture(venture: Venture) {
    setMenuId(null);

    const confirmed = window.confirm(
      `Delete "${venture.name}"?\n\nThis removes the venture record. Review any related projects, tasks, or financial records before proceeding.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: deleteError } = await supabase
        .from("ventures")
        .delete()
        .eq("id", venture.id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setVentures((current) =>
        current.filter((item) => item.id !== venture.id)
      );

      if (selectedVenture?.id === venture.id) setSelectedVenture(null);

      setSuccess(`"${venture.name}" was deleted.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function statusLabel(status: VentureStatus) {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label ??
      status;
  }

  return (
    <main className="ventures-page">
      <header className="ventures-heading">
        <div>
          <div className="ventures-eyebrow">
            <span className="ventures-eyebrow-dot" />
            YOUR BUSINESS PORTFOLIO
          </div>
          <h1>Ventures</h1>
          <p>
            Keep your businesses, products, investments and personal initiatives
            organised in one place.
          </p>
        </div>

        <button
          type="button"
          className="ventures-primary-button"
          onClick={openCreateModal}
        >
          <Plus size={17} />
          <span>Add venture</span>
        </button>
      </header>

      {error && !modalOpen && (
        <div className="ventures-alert ventures-alert-error" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="ventures-alert ventures-alert-success" role="status">
          <Check size={17} />
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="ventures-stats" aria-label="Venture overview">
        <article className="ventures-stat-card ventures-stat-total">
          <div className="ventures-stat-top">
            <span className="ventures-stat-icon">
              <Layers3 size={19} />
            </span>
            <span className="ventures-stat-caption">Portfolio</span>
          </div>
          <strong>{stats.total}</strong>
          <span className="ventures-stat-label">Total ventures</span>
        </article>

        <article className="ventures-stat-card">
          <div className="ventures-stat-top">
            <span className="ventures-stat-icon ventures-icon-active">
              <BriefcaseBusiness size={19} />
            </span>
            <span className="ventures-stat-caption">In operation</span>
          </div>
          <strong>{stats.active}</strong>
          <span className="ventures-stat-label">Active ventures</span>
        </article>

        <article className="ventures-stat-card">
          <div className="ventures-stat-top">
            <span className="ventures-stat-icon ventures-icon-idea">
              <Target size={19} />
            </span>
            <span className="ventures-stat-caption">In development</span>
          </div>
          <strong>{stats.ideas}</strong>
          <span className="ventures-stat-label">Ideas to develop</span>
        </article>

        <article className="ventures-stat-card">
          <div className="ventures-stat-top">
            <span className="ventures-stat-icon ventures-icon-paused">
              <MoreHorizontal size={19} />
            </span>
            <span className="ventures-stat-caption">On hold</span>
          </div>
          <strong>{stats.paused}</strong>
          <span className="ventures-stat-label">Paused ventures</span>
        </article>
      </section>

      <section className="ventures-content">
        <div className="ventures-content-heading">
          <div>
            <h2>Your ventures</h2>
            <p>
              {filteredVentures.length}{" "}
              {filteredVentures.length === 1 ? "venture" : "ventures"} shown
            </p>
          </div>

          <div className="ventures-view-note">
            <span />
            Private portfolio
          </div>
        </div>

        <div className="ventures-toolbar">
          <label className="ventures-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search ventures, objectives..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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

          <label className="ventures-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>

          <label className="ventures-filter">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {Array.from(
                new Set([
                  ...CATEGORY_OPTIONS,
                  ...ventures.map((venture) => venture.category),
                ])
              )
                .sort()
                .map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>

        {loading ? (
          <div className="ventures-state">
            <LoaderCircle className="ventures-spinner" size={25} />
            <strong>Loading your portfolio</strong>
            <span>Retrieving your ventures from Supabase.</span>
          </div>
        ) : filteredVentures.length === 0 ? (
          <div className="ventures-empty">
            <div className="ventures-empty-icon">
              {ventures.length === 0 ? (
                <BriefcaseBusiness size={26} />
              ) : (
                <Search size={25} />
              )}
            </div>
            <h3>
              {ventures.length === 0
                ? "Your portfolio starts here"
                : "No matching ventures"}
            </h3>
            <p>
              {ventures.length === 0
                ? "Add a business, product, investment or personal initiative to start building your portfolio."
                : "Try a different search term or change your filters."}
            </p>
            {ventures.length === 0 ? (
              <button
                type="button"
                className="ventures-primary-button"
                onClick={openCreateModal}
              >
                <Plus size={16} />
                Add your first venture
              </button>
            ) : (
              <button
                type="button"
                className="ventures-secondary-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="ventures-grid">
            {filteredVentures.map((venture) => (
              <article className="venture-card" key={venture.id}>
                <div className="venture-card-top">
                  <div className="venture-card-identity">
                    <div className="venture-card-monogram">
                      {venture.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="venture-card-title-wrap">
                      <span className="venture-card-category">
                        {venture.category}
                      </span>
                      <h3>{venture.name}</h3>
                    </div>
                  </div>

                  <div className="venture-menu-wrap">
                    <button
                      type="button"
                      className="venture-icon-button"
                      aria-label={`Actions for ${venture.name}`}
                      aria-expanded={menuId === venture.id}
                      onClick={() =>
                        setMenuId((current) =>
                          current === venture.id ? null : venture.id
                        )
                      }
                    >
                      <MoreHorizontal size={19} />
                    </button>

                    {menuId === venture.id && (
                      <div className="venture-action-menu">
                        <button
                          type="button"
                          onClick={() => openEditModal(venture)}
                        >
                          <Pencil size={15} />
                          Edit venture
                        </button>
                        <button
                          type="button"
                          className="venture-delete-action"
                          onClick={() => void deleteVenture(venture)}
                        >
                          <Trash2 size={15} />
                          Delete venture
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="venture-card-badges">
                  <span className={`venture-status venture-status-${venture.status}`}>
                    <span />
                    {statusLabel(venture.status)}
                  </span>
                  <span className="venture-currency">
                    {venture.base_currency}
                  </span>
                </div>

                <p className="venture-card-description">
                  {venture.description || "No description added yet."}
                </p>

                <div className="venture-objectives">
                  <div className="venture-objectives-heading">
                    <Target size={15} />
                    <span>Primary objectives</span>
                  </div>
                  <p>
                    {venture.objectives ||
                      "Add objectives to define what success looks like."}
                  </p>
                </div>

                <div className="venture-card-footer">
                  {venture.website_url ? (
                    <a
                      href={venture.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="venture-website-link"
                    >
                      <Globe size={15} />
                      <span>{getWebsiteHost(venture.website_url)}</span>
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span className="venture-no-website">
                      <Globe size={15} />
                      No website added
                    </span>
                  )}

                  <button
                    type="button"
                    className="venture-view-button"
                    onClick={() => setSelectedVenture(venture)}
                  >
                    Details
                    <ArrowUpRight size={15} />
                  </button>
                </div>

                <div className="venture-card-updated">
                  Last updated {formatDate(venture.updated_at)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="ventures-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="ventures-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venture-modal-title"
          >
            <header className="ventures-modal-header">
              <div>
                <span className="ventures-modal-eyebrow">
                  PORTFOLIO MANAGEMENT
                </span>
                <h2 id="venture-modal-title">
                  {editingVenture ? "Edit venture" : "Add a venture"}
                </h2>
                <p>
                  Capture the identity, direction and operating status of this
                  venture.
                </p>
              </div>
              <button
                type="button"
                className="venture-icon-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </header>

            {error && (
              <div className="ventures-alert ventures-alert-error" role="alert">
                <CircleAlert size={17} />
                <span>{error}</span>
              </div>
            )}

            <form className="ventures-form" onSubmit={handleSubmit}>
              <div className="ventures-form-section">
                <h3>Venture information</h3>

                <label className="ventures-field">
                  <span>Venture name <b>*</b></span>
                  <input
                    autoFocus
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="e.g. CRETESPACE"
                  />
                </label>

                <label className="ventures-field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="What is this venture, and what does it do?"
                  />
                </label>

                <div className="ventures-form-row">
                  <label className="ventures-field">
                    <span>Category</span>
                    <select
                      value={form.category}
                      onChange={(event) =>
                        updateField("category", event.target.value)
                      }
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() +
                            category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ventures-field">
                    <span>Status</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateField(
                          "status",
                          event.target.value as VentureStatus
                        )
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="ventures-form-section">
                <h3>Direction and identity</h3>

                <label className="ventures-field">
                  <span>Primary objectives</span>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={form.objectives}
                    onChange={(event) =>
                      updateField("objectives", event.target.value)
                    }
                    placeholder="What outcomes should this venture achieve?"
                  />
                </label>

                <label className="ventures-field">
                  <span>Website URL</span>
                  <div className="ventures-input-with-icon">
                    <Globe size={16} />
                    <input
                      type="text"
                      value={form.website_url}
                      onChange={(event) =>
                        updateField("website_url", event.target.value)
                      }
                      placeholder="https://example.com"
                    />
                  </div>
                  <small>You can enter a domain without https://.</small>
                </label>

                <label className="ventures-field">
                  <span>Base currency <b>*</b></span>
                  <input
                    required
                    minLength={3}
                    maxLength={3}
                    value={form.base_currency}
                    onChange={(event) =>
                      updateField(
                        "base_currency",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="NGN"
                  />
                  <small>
                    Use a three-letter currency code, such as NGN, USD or EUR.
                  </small>
                </label>
              </div>

              <footer className="ventures-modal-footer">
                <button
                  type="button"
                  className="ventures-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ventures-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle className="ventures-spinner" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingVenture
                      ? "Save changes"
                      : "Create venture"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {selectedVenture && !modalOpen && (
        <div
          className="ventures-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedVenture(null);
            }
          }}
        >
          <section
            className="ventures-modal ventures-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venture-details-title"
          >
            <header className="ventures-modal-header">
              <div className="venture-details-identity">
                <div className="venture-card-monogram venture-details-monogram">
                  {selectedVenture.name.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="ventures-modal-eyebrow">VENTURE DETAILS</span>
                  <h2 id="venture-details-title">{selectedVenture.name}</h2>
                  <span
                    className={`venture-status venture-status-${selectedVenture.status}`}
                  >
                    <span />
                    {statusLabel(selectedVenture.status)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="venture-icon-button"
                onClick={() => setSelectedVenture(null)}
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </header>

            <div className="venture-details-body">
              <div className="venture-detail-item">
                <span>Category</span>
                <strong>{selectedVenture.category}</strong>
              </div>
              <div className="venture-detail-item">
                <span>Base currency</span>
                <strong>{selectedVenture.base_currency}</strong>
              </div>
              <div className="venture-detail-item">
                <span>Created</span>
                <strong>{formatDate(selectedVenture.created_at)}</strong>
              </div>
              <div className="venture-detail-item">
                <span>Last updated</span>
                <strong>{formatDate(selectedVenture.updated_at)}</strong>
              </div>

              <div className="venture-detail-block">
                <h3>Description</h3>
                <p>
                  {selectedVenture.description || "No description provided."}
                </p>
              </div>

              <div className="venture-detail-block">
                <h3>Primary objectives</h3>
                <p>
                  {selectedVenture.objectives ||
                    "No objectives have been recorded."}
                </p>
              </div>

              {selectedVenture.website_url && (
                <a
                  className="venture-details-website"
                  href={selectedVenture.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe size={16} />
                  {getWebsiteHost(selectedVenture.website_url)}
                  <ExternalLink size={14} />
                </a>
              )}
            </div>

            <footer className="ventures-modal-footer">
              <button
                type="button"
                className="ventures-secondary-button"
                onClick={() => setSelectedVenture(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="ventures-primary-button"
                onClick={() => openEditModal(selectedVenture)}
              >
                <Pencil size={15} />
                Edit venture
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}