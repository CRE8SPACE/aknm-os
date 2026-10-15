
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  FolderKanban,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./projects.css";

type ProjectStatus =
  | "idea"
  | "planned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

type Priority = "low" | "medium" | "high" | "critical";
type MilestoneStatus = "pending" | "in_progress" | "completed" | "blocked";

type Venture = {
  id: string;
  name: string;
  base_currency: string;
};

type Project = {
  id: string;
  user_id: string;
  venture_id: string | null;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  success_criteria: string | null;
  created_at: string;
  updated_at: string;
};

type Milestone = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: MilestoneStatus;
  completed_at: string | null;
  created_at: string;
};

type ProjectForm = {
  name: string;
  description: string;
  venture_id: string;
  status: ProjectStatus;
  priority: Priority;
  start_date: string;
  due_date: string;
  success_criteria: string;
};

type MilestoneForm = {
  title: string;
  description: string;
  due_date: string;
  status: MilestoneStatus;
};

type ModalState =
  | { type: "project"; item: Project | null }
  | { type: "milestone"; project: Project; item: Milestone | null }
  | null;

const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

const MILESTONE_STATUSES: MilestoneStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "blocked",
];

const EMPTY_PROJECT: ProjectForm = {
  name: "",
  description: "",
  venture_id: "",
  status: "planned",
  priority: "medium",
  start_date: "",
  due_date: "",
  success_criteria: "",
};

const EMPTY_MILESTONE: MilestoneForm = {
  title: "",
  description: "",
  due_date: "",
  status: "pending",
};

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayISO() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
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
      "hint" in error && typeof error.hint === "string" ? error.hint : "";
    return [error.message, details, hint].filter(Boolean).join(" — ");
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function isPastDue(date: string | null, completed: boolean) {
  return Boolean(date && date < todayISO() && !completed);
}

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [ventureFilter, setVentureFilter] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectForm, setProjectForm] =
    useState<ProjectForm>(EMPTY_PROJECT);
  const [milestoneForm, setMilestoneForm] =
    useState<MilestoneForm>(EMPTY_MILESTONE);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      const [projectResult, milestoneResult, ventureResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("project_milestones")
          .select("*")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("ventures")
          .select("id, name, base_currency")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (milestoneResult.error) throw milestoneResult.error;
      if (ventureResult.error) throw ventureResult.error;

      const nextProjects = (projectResult.data ?? []) as Project[];
      setProjects(nextProjects);
      setMilestones((milestoneResult.data ?? []) as Milestone[]);
      setVentures((ventureResult.data ?? []) as Venture[]);

      setSelectedProjectId((current) => {
        if (current && nextProjects.some((item) => item.id === current)) {
          return current;
        }
        return nextProjects[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ventureName = useCallback(
    (ventureId: string | null) =>
      ventureId
        ? ventures.find((venture) => venture.id === ventureId)?.name ??
          "Venture unavailable"
        : "Personal / independent",
    [ventures],
  );

  const milestoneStats = useMemo(() => {
    const completed = milestones.filter(
      (item) => item.status === "completed",
    ).length;
    const blocked = milestones.filter(
      (item) => item.status === "blocked",
    ).length;

    return { total: milestones.length, completed, blocked };
  }, [milestones]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        (project.success_criteria ?? "").toLowerCase().includes(query) ||
        ventureName(project.venture_id).toLowerCase().includes(query);

      return (
        matchesSearch &&
        (statusFilter === "all" || project.status === statusFilter) &&
        (priorityFilter === "all" || project.priority === priorityFilter) &&
        (ventureFilter === "all" || project.venture_id === ventureFilter)
      );
    });
  }, [
    projects,
    search,
    statusFilter,
    priorityFilter,
    ventureFilter,
    ventureName,
  ]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  const selectedMilestones = useMemo(
    () =>
      selectedProject
        ? milestones.filter((item) => item.project_id === selectedProject.id)
        : [],
    [milestones, selectedProject],
  );

  const projectProgress = useCallback(
    (projectId: string) => {
      const items = milestones.filter(
        (item) => item.project_id === projectId,
      );
      if (!items.length) {
        const project = projects.find((item) => item.id === projectId);
        return project?.status === "completed" ? 100 : 0;
      }
      return Math.round(
        (items.filter((item) => item.status === "completed").length /
          items.length) *
          100,
      );
    },
    [milestones, projects],
  );

  const stats = useMemo(() => {
    const active = projects.filter(
      (item) => item.status === "in_progress",
    ).length;
    const completed = projects.filter(
      (item) => item.status === "completed",
    ).length;
    const overdue = projects.filter((item) =>
      isPastDue(item.due_date, item.status === "completed"),
    ).length;
    const critical = projects.filter(
      (item) =>
        item.priority === "critical" &&
        !["completed", "cancelled"].includes(item.status),
    ).length;

    return { total: projects.length, active, completed, overdue, critical };
  }, [projects]);

  function openNewProject() {
    setProjectForm(EMPTY_PROJECT);
    setModal({ type: "project", item: null });
    setError("");
    setNotice("");
  }

  function openEditProject(project: Project) {
    setProjectForm({
      name: project.name,
      description: project.description ?? "",
      venture_id: project.venture_id ?? "",
      status: project.status,
      priority: project.priority,
      start_date: project.start_date ?? "",
      due_date: project.due_date ?? "",
      success_criteria: project.success_criteria ?? "",
    });
    setModal({ type: "project", item: project });
    setError("");
    setNotice("");
  }

  function openNewMilestone(project: Project) {
    setMilestoneForm(EMPTY_MILESTONE);
    setModal({ type: "milestone", project, item: null });
    setError("");
    setNotice("");
  }

  function openEditMilestone(project: Project, item: Milestone) {
    setMilestoneForm({
      title: item.title,
      description: item.description ?? "",
      due_date: item.due_date ?? "",
      status: item.status,
    });
    setModal({ type: "milestone", project, item });
    setError("");
    setNotice("");
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== "project") return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      if (
        projectForm.start_date &&
        projectForm.due_date &&
        projectForm.due_date < projectForm.start_date
      ) {
        throw new Error("The due date cannot be earlier than the start date.");
      }

      const completedAt =
        projectForm.status === "completed"
          ? modal.item?.completed_at ?? new Date().toISOString()
          : null;

      const payload = {
        user_id: user.id,
        venture_id: projectForm.venture_id || null,
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
        status: projectForm.status,
        priority: projectForm.priority,
        start_date: projectForm.start_date || null,
        due_date: projectForm.due_date || null,
        success_criteria: projectForm.success_criteria.trim() || null,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      };

      if (modal.item) {
        const { error: updateError } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", modal.item.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
        setNotice("Project updated.");
        setSelectedProjectId(modal.item.id);
      } else {
        const { data, error: insertError } = await supabase
          .from("projects")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) throw insertError;
        if (data?.id) setSelectedProjectId(data.id);
        setNotice("Project created.");
      }

      setModal(null);
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveMilestone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== "milestone") return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const completedAt =
        milestoneForm.status === "completed"
          ? modal.item?.completed_at ?? new Date().toISOString()
          : null;

      const payload = {
        user_id: user.id,
        project_id: modal.project.id,
        title: milestoneForm.title.trim(),
        description: milestoneForm.description.trim(),
        due_date: milestoneForm.due_date || null,
        status: milestoneForm.status,
        completed_at: completedAt,
      };

      if (modal.item) {
        const { error: updateError } = await supabase
          .from("project_milestones")
          .update(payload)
          .eq("id", modal.item.id)
          .eq("project_id", modal.project.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
        setNotice("Milestone updated.");
      } else {
        const { error: insertError } = await supabase
          .from("project_milestones")
          .insert(payload);

        if (insertError) throw insertError;
        setNotice("Milestone added.");
      }

      setSelectedProjectId(modal.project.id);
      setModal(null);
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    if (
      !window.confirm(
        `Delete "${project.name}" and all its milestones? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(project.id);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setNotice("Project deleted.");
      await loadData();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteMilestone(item: Milestone) {
    if (!window.confirm(`Delete milestone "${item.title}"?`)) return;

    setDeletingId(item.id);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: deleteError } = await supabase
        .from("project_milestones")
        .delete()
        .eq("id", item.id)
        .eq("project_id", item.project_id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setNotice("Milestone deleted.");
      await loadData();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  async function updateMilestoneStatus(
    item: Milestone,
    status: MilestoneStatus,
  ) {
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
        .from("project_milestones")
        .update({
          status,
          completed_at:
            status === "completed"
              ? item.completed_at ?? new Date().toISOString()
              : null,
        })
        .eq("id", item.id)
        .eq("project_id", item.project_id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setNotice("Milestone status updated.");
      await loadData();
    } catch (updateError) {
      setError(errorMessage(updateError));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setVentureFilter("all");
  }

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <div className="projects-eyebrow">
            <span className="projects-live-dot" />
            PERSONAL OPERATING SYSTEM / EXECUTION
          </div>
          <h1>Projects<span>.</span></h1>
          <p className="projects-header-copy">
            Turn ambitions into deliverables. Track the work, milestones and
            deadlines that move your plans forward.
          </p>
        </div>

        <div className="projects-header-actions">
          <button
            type="button"
            className="projects-button projects-button-secondary"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "projects-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            className="projects-button projects-button-primary"
            onClick={openNewProject}
          >
            <Plus size={17} />
            New project
          </button>
        </div>
      </header>

      {error && (
        <div className="projects-alert projects-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="projects-alert projects-alert-success" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="projects-stats">
        <article className="projects-stat-card projects-stat-featured">
          <div className="projects-stat-top">
            <span>All projects</span>
            <FolderKanban size={18} />
          </div>
          <div className="projects-stat-number">{stats.total}</div>
          <div className="projects-stat-foot">Your complete project portfolio</div>
        </article>

        <article className="projects-stat-card">
          <div className="projects-stat-top">
            <span>In progress</span>
            <Activity size={18} />
          </div>
          <div className="projects-stat-number">{stats.active}</div>
          <div className="projects-stat-foot">Projects currently moving forward</div>
        </article>

        <article className="projects-stat-card">
          <div className="projects-stat-top">
            <span>Completed</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="projects-stat-number">{stats.completed}</div>
          <div className="projects-stat-foot">Projects marked as completed</div>
        </article>

        <article className="projects-stat-card">
          <div className="projects-stat-top">
            <span>Need attention</span>
            <Clock3 size={18} />
          </div>
          <div className={`projects-stat-number ${stats.overdue || stats.critical ? "projects-number-warning" : ""}`}>
            {stats.overdue + stats.critical}
          </div>
          <div className="projects-stat-foot">
            {stats.overdue} overdue · {stats.critical} critical priority
          </div>
        </article>
      </section>

      <section className="projects-workspace">
        <div className="projects-list-panel">
          <div className="projects-panel-heading">
            <div>
              <h2>Project portfolio</h2>
              <p>Choose a project to inspect its milestones and progress.</p>
            </div>
            <span className="projects-count">{filteredProjects.length}</span>
          </div>

          <div className="projects-toolbar">
            <label className="projects-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects..."
              />
            </label>

            <div className="projects-filters">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>{titleCase(status)}</option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{titleCase(priority)}</option>
                ))}
              </select>
              <select
                value={ventureFilter}
                onChange={(event) => setVentureFilter(event.target.value)}
                aria-label="Filter by venture"
              >
                <option value="all">All ventures</option>
                <option value="personal">Personal / independent</option>
                {ventures.map((venture) => (
                  <option key={venture.id} value={venture.id}>{venture.name}</option>
                ))}
              </select>
            </div>

            {(search || statusFilter !== "all" || priorityFilter !== "all" || ventureFilter !== "all") && (
              <button type="button" className="projects-clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="projects-state">
              <LoaderCircle size={25} className="projects-spin" />
              <span>Loading your projects…</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="projects-empty">
              <span className="projects-empty-icon"><FolderKanban size={25} /></span>
              <h3>{projects.length ? "No matching projects" : "Your next chapter starts here"}</h3>
              <p>
                {projects.length
                  ? "Try changing your search or filters."
                  : "Create a project to define the outcome, set a deadline and track each milestone."}
              </p>
              {projects.length ? (
                <button type="button" className="projects-button projects-button-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <button type="button" className="projects-button projects-button-primary" onClick={openNewProject}>
                  <Plus size={16} /> Create first project
                </button>
              )}
            </div>
          ) : (
            <div className="projects-list">
              {filteredProjects.map((project) => {
                const count = milestones.filter((item) => item.project_id === project.id).length;
                const completed = milestones.filter(
                  (item) => item.project_id === project.id && item.status === "completed",
                ).length;
                const progress = projectProgress(project.id);
                const overdue = isPastDue(project.due_date, project.status === "completed");

                return (
                  <button
                    type="button"
                    key={project.id}
                    className={`projects-list-item ${selectedProjectId === project.id ? "selected" : ""}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="projects-list-item-top">
                      <span className={`projects-project-symbol priority-${project.priority}`}>
                        <FolderKanban size={18} />
                      </span>
                      <span className={`projects-status status-${project.status}`}>
                        {titleCase(project.status)}
                      </span>
                    </div>
                    <div className="projects-list-item-title">{project.name}</div>
                    <div className="projects-list-item-description">
                      {project.description || "No project description yet."}
                    </div>
                    <div className="projects-list-meta">
                      <span><Flag size={13} /> {titleCase(project.priority)}</span>
                      <span><CalendarDays size={13} /> {dateLabel(project.due_date)}</span>
                      {overdue && <span className="projects-overdue-label">Overdue</span>}
                    </div>
                    <div className="projects-mini-progress">
                      <div className="projects-progress-track">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <span>{progress}%</span>
                    </div>
                    <div className="projects-list-footer">
                      <span>{ventureName(project.venture_id)}</span>
                      <span><ListChecks size={13} /> {completed}/{count} milestones</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="projects-detail-panel">
          {!selectedProject ? (
            <div className="projects-detail-empty">
              <Target size={32} />
              <h2>Select a project</h2>
              <p>Your project details and milestones will appear here.</p>
            </div>
          ) : (
            <>
              <div className="projects-detail-heading">
                <div className="projects-detail-heading-top">
                  <span className="projects-detail-kicker">PROJECT OVERVIEW</span>
                  <div className="projects-icon-actions">
                    <button
                      type="button"
                      className="projects-icon-button"
                      onClick={() => openEditProject(selectedProject)}
                      aria-label="Edit project"
                      title="Edit project"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="projects-icon-button projects-icon-danger"
                      onClick={() => void deleteProject(selectedProject)}
                      disabled={deletingId === selectedProject.id}
                      aria-label="Delete project"
                      title="Delete project"
                    >
                      {deletingId === selectedProject.id ? <LoaderCircle size={16} className="projects-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
                <h2>{selectedProject.name}</h2>
                <p>{selectedProject.description || "No description has been added to this project."}</p>
                <div className="projects-detail-tags">
                  <span className={`projects-status status-${selectedProject.status}`}>
                    {titleCase(selectedProject.status)}
                  </span>
                  <span className={`projects-priority priority-text-${selectedProject.priority}`}>
                    <Flag size={13} /> {titleCase(selectedProject.priority)} priority
                  </span>
                </div>
              </div>

              <div className="projects-progress-card">
                <div className="projects-progress-card-top">
                  <div>
                    <span className="projects-section-label">OVERALL PROGRESS</span>
                    <strong>{projectProgress(selectedProject.id)}<small>%</small></strong>
                  </div>
                  <div className="projects-progress-ring">
                    <CheckCircle2 size={21} />
                  </div>
                </div>
                <div className="projects-progress-track projects-progress-track-large">
                  <span style={{ width: `${projectProgress(selectedProject.id)}%` }} />
                </div>
                <div className="projects-progress-foot">
                  <span>{selectedMilestones.filter((item) => item.status === "completed").length} of {selectedMilestones.length} milestones complete</span>
                  <span>{selectedProject.status === "completed" ? "Project completed" : selectedProject.due_date ? `Due ${dateLabel(selectedProject.due_date)}` : "No deadline set"}</span>
                </div>
              </div>

              <div className="projects-detail-facts">
                <div className="projects-fact">
                  <span className="projects-fact-icon"><FolderKanban size={16} /></span>
                  <div><small>Linked venture</small><strong>{ventureName(selectedProject.venture_id)}</strong></div>
                </div>
                <div className="projects-fact">
                  <span className="projects-fact-icon"><CalendarDays size={16} /></span>
                  <div><small>Start date</small><strong>{dateLabel(selectedProject.start_date)}</strong></div>
                </div>
                <div className="projects-fact">
                  <span className="projects-fact-icon"><Clock3 size={16} /></span>
                  <div><small>Deadline</small><strong className={isPastDue(selectedProject.due_date, selectedProject.status === "completed") ? "projects-text-danger" : ""}>{dateLabel(selectedProject.due_date)}</strong></div>
                </div>
                <div className="projects-fact">
                  <span className="projects-fact-icon"><CheckCircle2 size={16} /></span>
                  <div><small>Completed on</small><strong>{dateLabel(selectedProject.completed_at)}</strong></div>
                </div>
              </div>

              {selectedProject.success_criteria && (
                <div className="projects-criteria">
                  <div className="projects-subsection-title"><Target size={16} /> Success criteria</div>
                  <p>{selectedProject.success_criteria}</p>
                </div>
              )}

              <div className="projects-milestones-heading">
                <div>
                  <h3>Milestones</h3>
                  <p>Break the outcome into measurable steps.</p>
                </div>
                <button
                  type="button"
                  className="projects-button projects-button-primary projects-button-small"
                  onClick={() => openNewMilestone(selectedProject)}
                >
                  <Plus size={15} /> Add milestone
                </button>
              </div>

              <div className="projects-milestone-summary">
                <span><CheckCircle2 size={14} /> {selectedMilestones.filter((item) => item.status === "completed").length} completed</span>
                <span><Circle size={14} /> {selectedMilestones.filter((item) => item.status === "pending").length} pending</span>
                <span><AlertCircle size={14} /> {selectedMilestones.filter((item) => item.status === "blocked").length} blocked</span>
              </div>

              {selectedMilestones.length === 0 ? (
                <div className="projects-milestones-empty">
                  <ListChecks size={23} />
                  <strong>No milestones yet</strong>
                  <p>Add the first deliverable or checkpoint for this project.</p>
                  <button type="button" className="projects-text-button" onClick={() => openNewMilestone(selectedProject)}>
                    Add your first milestone <ArrowUpRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="projects-milestone-list">
                  {selectedMilestones.map((item) => {
                    const overdue = isPastDue(item.due_date, item.status === "completed");
                    return (
                      <article className="projects-milestone" key={item.id}>
                        <button
                          type="button"
                          className={`projects-milestone-check ${item.status === "completed" ? "is-complete" : ""}`}
                          onClick={() => void updateMilestoneStatus(item, item.status === "completed" ? "pending" : "completed")}
                          aria-label={item.status === "completed" ? "Mark milestone pending" : "Complete milestone"}
                          title={item.status === "completed" ? "Mark pending" : "Mark completed"}
                        >
                          {item.status === "completed" ? <Check size={14} /> : <Circle size={15} />}
                        </button>
                        <div className="projects-milestone-content">
                          <strong className={item.status === "completed" ? "milestone-completed-title" : ""}>{item.title}</strong>
                          {item.description && <p>{item.description}</p>}
                          <div className="projects-milestone-meta">
                            <span className={`projects-status status-${item.status}`}>{titleCase(item.status)}</span>
                            <span className={overdue ? "projects-text-danger" : ""}><CalendarDays size={12} /> {dateLabel(item.due_date)}</span>
                            {overdue && <span className="projects-overdue-label">Overdue</span>}
                          </div>
                        </div>
                        <div className="projects-milestone-actions">
                          <button type="button" className="projects-icon-button" onClick={() => openEditMilestone(selectedProject, item)} aria-label={`Edit ${item.title}`} title="Edit milestone"><Pencil size={14} /></button>
                          <button type="button" className="projects-icon-button projects-icon-danger" onClick={() => void deleteMilestone(item)} disabled={deletingId === item.id} aria-label={`Delete ${item.title}`} title="Delete milestone">
                            {deletingId === item.id ? <LoaderCircle size={14} className="projects-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="projects-bottom-summary">
        <div className="projects-summary-icon"><ListChecks size={18} /></div>
        <div>
          <strong>Execution snapshot</strong>
          <p>
            {milestoneStats.completed} of {milestoneStats.total} milestones completed across your projects.
            {milestoneStats.blocked > 0 ? ` ${milestoneStats.blocked} blocked milestone${milestoneStats.blocked === 1 ? "" : "s"} need attention.` : " Keep milestones current to maintain an accurate progress picture."}
          </p>
        </div>
      </section>

      {modal && (
        <div className="projects-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModal(null);
        }}>
          <section className="projects-modal" role="dialog" aria-modal="true" aria-labelledby="projects-modal-title">
            <div className="projects-modal-heading">
              <div>
                <span className="projects-modal-kicker">{modal.type === "project" ? "PROJECT MANAGEMENT" : "PROJECT DELIVERY"}</span>
                <h2 id="projects-modal-title">
                  {modal.type === "project"
                    ? modal.item ? "Edit project" : "Create a project"
                    : modal.item ? "Edit milestone" : "Add a milestone"}
                </h2>
                <p>
                  {modal.type === "project"
                    ? "Define the outcome and how you will deliver it."
                    : `Milestone for ${modal.project.name}`}
                </p>
              </div>
              <button type="button" className="projects-icon-button" onClick={() => setModal(null)} disabled={saving} aria-label="Close modal"><X size={18} /></button>
            </div>

            {modal.type === "project" ? (
              <form className="projects-form" onSubmit={saveProject}>
                <label className="projects-field projects-field-full">
                  <span>Project name <i>*</i></span>
                  <input required maxLength={180} value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="e.g. Launch the new product" />
                </label>

                <label className="projects-field projects-field-full">
                  <span>Description</span>
                  <textarea rows={3} value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} placeholder="What is this project about?" />
                </label>

                <label className="projects-field">
                  <span>Linked venture</span>
                  <select value={projectForm.venture_id} onChange={(event) => setProjectForm({ ...projectForm, venture_id: event.target.value })}>
                    <option value="">Personal / independent</option>
                    {ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}
                  </select>
                </label>

                <label className="projects-field">
                  <span>Status</span>
                  <select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value as ProjectStatus })}>
                    {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                  </select>
                </label>

                <label className="projects-field">
                  <span>Priority</span>
                  <select value={projectForm.priority} onChange={(event) => setProjectForm({ ...projectForm, priority: event.target.value as Priority })}>
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
                  </select>
                </label>

                <label className="projects-field">
                  <span>Start date</span>
                  <input type="date" value={projectForm.start_date} onChange={(event) => setProjectForm({ ...projectForm, start_date: event.target.value })} />
                </label>

                <label className="projects-field">
                  <span>Due date</span>
                  <input type="date" min={projectForm.start_date || undefined} value={projectForm.due_date} onChange={(event) => setProjectForm({ ...projectForm, due_date: event.target.value })} />
                </label>

                <label className="projects-field projects-field-full">
                  <span>Success criteria</span>
                  <textarea rows={3} value={projectForm.success_criteria} onChange={(event) => setProjectForm({ ...projectForm, success_criteria: event.target.value })} placeholder="What must be true for this project to count as successful?" />
                </label>

                <div className="projects-form-hint">
                  <Target size={15} />
                  Clear success criteria make it easier to judge whether the project achieved its purpose.
                </div>

                <div className="projects-modal-footer">
                  <button type="button" className="projects-button projects-button-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
                  <button type="submit" className="projects-button projects-button-primary" disabled={saving}>
                    {saving ? <LoaderCircle size={16} className="projects-spin" /> : <Check size={16} />}
                    {saving ? "Saving…" : modal.item ? "Save changes" : "Create project"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="projects-form" onSubmit={saveMilestone}>
                <label className="projects-field projects-field-full">
                  <span>Milestone title <i>*</i></span>
                  <input required maxLength={180} value={milestoneForm.title} onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })} placeholder="e.g. Approve final designs" />
                </label>

                <label className="projects-field projects-field-full">
                  <span>Description</span>
                  <textarea rows={3} value={milestoneForm.description} onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })} placeholder="Describe the deliverable or checkpoint." />
                </label>

                <label className="projects-field">
                  <span>Due date</span>
                  <input type="date" value={milestoneForm.due_date} onChange={(event) => setMilestoneForm({ ...milestoneForm, due_date: event.target.value })} />
                </label>

                <label className="projects-field">
                  <span>Status</span>
                  <select value={milestoneForm.status} onChange={(event) => setMilestoneForm({ ...milestoneForm, status: event.target.value as MilestoneStatus })}>
                    {MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                  </select>
                </label>

                <div className="projects-form-hint">
                  <CheckCircle2 size={15} />
                  Mark a milestone completed when its deliverable is finished. Completion time is recorded automatically.
                </div>

                <div className="projects-modal-footer">
                  <button type="button" className="projects-button projects-button-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
                  <button type="submit" className="projects-button projects-button-primary" disabled={saving}>
                    {saving ? <LoaderCircle size={16} className="projects-spin" /> : <Check size={16} />}
                    {saving ? "Saving…" : modal.item ? "Save changes" : "Add milestone"}
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
