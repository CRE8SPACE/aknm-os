"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./achievements.css";

type Significance = "standard" | "major" | "milestone";

type Achievement = {
  id: string;
  user_id: string;
  venture_id: string | null;
  project_id: string | null;
  task_id: string | null;
  title: string;
  description: string;
  achieved_on: string;
  significance: string;
  created_at: string;
};

type Venture = { id: string; name: string };
type Project = { id: string; name: string; venture_id: string | null };
type CompletedTask = { id: string; title: string; completed_at: string | null };

type AchievementForm = {
  title: string;
  description: string;
  achieved_on: string;
  significance: Significance;
  venture_id: string;
  project_id: string;
  task_id: string;
};

const SIGNIFICANCE_OPTIONS: { value: Significance; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "major", label: "Major milestone" },
  { value: "milestone", label: "Milestone" },
];

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyForm(): AchievementForm {
  return {
    title: "",
    description: "",
    achieved_on: todayISO(),
    significance: "standard",
    venture_id: "",
    project_id: "",
    task_id: "",
  };
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-GB", options ?? {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (message.toLowerCase().includes("row-level security")) {
    return "Supabase denied this action. Check the achievements table's user access policies.";
  }
  if (message.toLowerCase().includes("sign in")) return message;
  return message;
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [significanceFilter, setSignificanceFilter] = useState("all");
  const [ventureFilter, setVentureFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [form, setForm] = useState<AchievementForm>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const [achievementResult, ventureResult, projectResult, taskResult] = await Promise.all([
        supabase
          .from("achievements")
          .select("*")
          .eq("user_id", authData.user.id)
          .order("achieved_on", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("ventures").select("id, name").order("name"),
        supabase.from("projects").select("id, name, venture_id").order("name"),
        supabase
          .from("tasks")
          .select("id, title, completed_at")
          .eq("status", "completed")
          .order("completed_at", { ascending: false }),
      ]);

      if (achievementResult.error) throw achievementResult.error;
      if (ventureResult.error) throw ventureResult.error;
      if (projectResult.error) throw projectResult.error;
      if (taskResult.error) throw taskResult.error;

      setAchievements((achievementResult.data ?? []) as Achievement[]);
      setVentures((ventureResult.data ?? []) as Venture[]);
      setProjects((projectResult.data ?? []) as Project[]);
      setCompletedTasks((taskResult.data ?? []) as CompletedTask[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentMonth = todayISO().slice(0, 7);
  const currentYear = todayISO().slice(0, 4);

  const thisMonthCount = achievements.filter((item) => item.achieved_on.slice(0, 7) === currentMonth).length;
  const thisYearCount = achievements.filter((item) => item.achieved_on.slice(0, 4) === currentYear).length;
  const exceptionalCount = achievements.filter((item) => item.significance === "exceptional").length;

  const filteredAchievements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return achievements.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);

      const matchesSignificance =
        significanceFilter === "all" || item.significance === significanceFilter;

      const matchesVenture =
        ventureFilter === "all" ||
        (ventureFilter === "unlinked" ? !item.venture_id : item.venture_id === ventureFilter);

      const matchesPeriod =
        periodFilter === "all" ||
        (periodFilter === "month" && item.achieved_on.slice(0, 7) === currentMonth) ||
        (periodFilter === "year" && item.achieved_on.slice(0, 4) === currentYear);

      return matchesSearch && matchesSignificance && matchesVenture && matchesPeriod;
    });
  }, [achievements, search, significanceFilter, ventureFilter, periodFilter, currentMonth, currentYear]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEdit(item: Achievement) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      achieved_on: item.achieved_on,
      significance: (item.significance as Significance) || "standard",
      venture_id: item.venture_id ?? "",
      project_id: item.project_id ?? "",
      task_id: item.task_id ?? "",
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  async function saveAchievement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Enter an achievement title.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) throw new Error("Please sign in again.");

      const payload = {
        user_id: authData.user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        achieved_on: form.achieved_on,
        significance: form.significance,
        venture_id: form.venture_id || null,
        project_id: form.project_id || null,
        task_id: form.task_id || null,
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from("achievements")
          .update(payload)
          .eq("id", editing.id)
          .eq("user_id", authData.user.id);

        if (updateError) throw updateError;
        setNotice("Achievement updated.");
      } else {
        const { error: insertError } = await supabase.from("achievements").insert(payload);
        if (insertError) throw insertError;
        setNotice("Achievement recorded.");
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAchievement(item: Achievement) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;

    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) throw new Error("Please sign in again.");

      const { error: deleteError } = await supabase
        .from("achievements")
        .delete()
        .eq("id", item.id)
        .eq("user_id", authData.user.id);

      if (deleteError) throw deleteError;

      setNotice("Achievement deleted.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function significanceLabel(value: string) {
    return SIGNIFICANCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  return (
    <main className="achievements-page">
      <section className="achievements-heading">
        <div>
          <div className="achievements-eyebrow">
            <span className="achievements-live-dot" />
            PROGRESS AND MILESTONES
          </div>
          <h1>Make progress <span>visible.</span></h1>
          <p>Keep a record of what you accomplish, what it took, and how far your ventures have come.</p>
        </div>

        <div className="achievements-heading-actions">
          <button className="achievements-button achievements-button-secondary" type="button" onClick={() => void loadData()} disabled={loading}>
            {loading ? <LoaderCircle size={16} className="achievements-spin" /> : <Clock3 size={16} />}
            Refresh
          </button>
          <button className="achievements-button achievements-button-primary" type="button" onClick={openCreate}>
            <Plus size={17} />
            Record achievement
          </button>
        </div>
      </section>

      {error && (
        <div className="achievements-alert achievements-alert-error" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      {notice && (
        <div className="achievements-alert achievements-alert-success" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button>
        </div>
      )}

      <section className="achievements-stats">
        <article className="achievements-stat achievements-stat-featured">
          <div className="achievements-stat-top"><span>Total recorded</span><Trophy size={18} /></div>
          <div className="achievements-stat-value">{achievements.length}</div>
          <p>Your personal record of progress</p>
        </article>
        <article className="achievements-stat">
          <div className="achievements-stat-top"><span>This month</span><CalendarDays size={18} /></div>
          <div className="achievements-stat-value">{thisMonthCount}</div>
          <p>Achievements recorded this month</p>
        </article>
        <article className="achievements-stat">
          <div className="achievements-stat-top"><span>This year</span><Target size={18} /></div>
          <div className="achievements-stat-value">{thisYearCount}</div>
          <p>Progress made this year</p>
        </article>
        <article className="achievements-stat">
          <div className="achievements-stat-top"><span>Exceptional</span><Sparkles size={18} /></div>
          <div className="achievements-stat-value">{exceptionalCount}</div>
          <p>Standout moments worth remembering</p>
        </article>
      </section>

      <section className="achievements-content-panel">
        <div className="achievements-panel-heading">
          <div>
            <span className="achievements-section-label">YOUR HISTORY</span>
            <h2>Achievement timeline</h2>
            <p>Every meaningful win, collected in one place.</p>
          </div>
          <span className="achievements-result-count">{filteredAchievements.length} {filteredAchievements.length === 1 ? "record" : "records"}</span>
        </div>

        <div className="achievements-filters">
          <label className="achievements-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search achievements..." />
          </label>

          <label className="achievements-select-wrap">
            <Filter size={14} />
            <select value={significanceFilter} onChange={(event) => setSignificanceFilter(event.target.value)} aria-label="Filter by significance">
              <option value="all">All significance</option>
              {SIGNIFICANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>

          <label className="achievements-select-wrap">
            <select value={ventureFilter} onChange={(event) => setVentureFilter(event.target.value)} aria-label="Filter by venture">
              <option value="all">All ventures</option>
              <option value="unlinked">Not linked to a venture</option>
              {ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>

          <label className="achievements-select-wrap">
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Filter by period">
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>

        {loading ? (
          <div className="achievements-loading">
            <LoaderCircle size={24} className="achievements-spin" />
            <span>Loading your achievements...</span>
          </div>
        ) : filteredAchievements.length === 0 ? (
          <div className="achievements-empty">
            <span className="achievements-empty-icon"><Trophy size={26} /></span>
            <h3>{achievements.length ? "No matching achievements" : "Your next win belongs here."}</h3>
            <p>{achievements.length ? "Try changing your search or filters." : "Record a milestone, a meaningful result, or a moment that shows your progress."}</p>
            {achievements.length === 0 && (
              <button className="achievements-button achievements-button-primary" type="button" onClick={openCreate}>
                <Plus size={16} /> Record your first achievement
              </button>
            )}
          </div>
        ) : (
          <div className="achievements-timeline">
            {filteredAchievements.map((item) => {
              const venture = ventures.find((entry) => entry.id === item.venture_id);
              const project = projects.find((entry) => entry.id === item.project_id);
              const task = completedTasks.find((entry) => entry.id === item.task_id);

              return (
                <article className="achievement-card" key={item.id}>
                  <div className={`achievement-marker achievement-marker-${item.significance}`}>
                    {item.significance === "exceptional" ? <Sparkles size={19} /> : item.significance === "major" ? <Award size={19} /> : <Star size={18} />}
                  </div>

                  <div className="achievement-card-body">
                    <div className="achievement-card-topline">
                      <span className={`achievement-significance achievement-significance-${item.significance}`}>
                        {significanceLabel(item.significance)}
                      </span>
                      <time dateTime={item.achieved_on}>{formatDate(item.achieved_on)}</time>
                    </div>

                    <h3>{item.title}</h3>
                    {item.description && <p className="achievement-description">{item.description}</p>}

                    {(venture || project || task) && (
                      <div className="achievement-links">
                        {venture && <span>{venture.name}</span>}
                        {project && <span>{project.name}</span>}
                        {task && <span className="achievement-task-link"><CheckCircle2 size={12} /> {task.title}</span>}
                      </div>
                    )}
                  </div>

                  <div className="achievement-card-actions">
                    <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`} title="Edit achievement"><Pencil size={15} /></button>
                    <button type="button" onClick={() => void deleteAchievement(item)} aria-label={`Delete ${item.title}`} title="Delete achievement"><Trash2 size={15} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="achievements-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className="achievements-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
            <header className="achievements-modal-header">
              <div>
                <span className="achievements-section-label">{editing ? "PRESERVE YOUR PROGRESS" : "MARK THE MOMENT"}</span>
                <h2 id="achievement-modal-title">{editing ? "Edit achievement" : "Record an achievement"}</h2>
                <p>Capture the result while the details are fresh.</p>
              </div>
              <button className="achievements-close-button" type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close modal"><X size={18} /></button>
            </header>

            <form className="achievements-form" onSubmit={saveAchievement}>
              <label className="achievements-field achievements-field-full">
                <span>Achievement title <b>*</b></span>
                <input required maxLength={180} autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What did you accomplish?" />
              </label>

              <label className="achievements-field achievements-field-full">
                <span>Description and context</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Record the outcome, why it mattered, and any useful details..." />
              </label>

              <div className="achievements-form-grid">
                <label className="achievements-field">
                  <span>Date achieved <b>*</b></span>
                  <input required type="date" value={form.achieved_on} onChange={(event) => setForm({ ...form, achieved_on: event.target.value })} />
                </label>

                <label className="achievements-field">
                  <span>Significance</span>
                  <select value={form.significance} onChange={(event) => setForm({ ...form, significance: event.target.value as Significance })}>
                    {SIGNIFICANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <label className="achievements-field">
                  <span>Business venture</span>
                  <select value={form.venture_id} onChange={(event) => setForm({ ...form, venture_id: event.target.value, project_id: "" })}>
                    <option value="">No venture linked</option>
                    {ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}
                  </select>
                </label>

                <label className="achievements-field">
                  <span>Project</span>
                  <select value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}>
                    <option value="">No project linked</option>
                    {projects.filter((project) => !form.venture_id || project.venture_id === form.venture_id).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>

                <label className="achievements-field achievements-field-full">
                  <span>Completed task (optional)</span>
                  <select value={form.task_id} onChange={(event) => setForm({ ...form, task_id: event.target.value })}>
                    <option value="">No task linked</option>
                    {completedTasks.map((task) => <option key={task.id} value={task.id}>{task.title}{task.completed_at ? ` · ${formatDate(task.completed_at)}` : ""}</option>)}
                  </select>
                  <small>Link this achievement to a task you have already completed.</small>
                </label>
              </div>

              {error && <p className="achievements-form-error"><CircleAlert size={15} /> {error}</p>}

              <footer className="achievements-modal-footer">
                <button className="achievements-button achievements-button-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="achievements-button achievements-button-primary" type="submit" disabled={saving}>
                  {saving ? <LoaderCircle size={16} className="achievements-spin" /> : <CheckCircle2 size={16} />}
                  {editing ? "Save changes" : "Save achievement"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}