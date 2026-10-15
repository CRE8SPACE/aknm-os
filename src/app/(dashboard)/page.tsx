
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import OverviewCards from "@/components/dashboard/OverviewCards";
import { useDashboardSearch } from "@/components/layout/DashboardSearchContext";
import { createClient } from "@/lib/supabase/client";
import "./command-centre.css";

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "deferred";

type Priority = "low" | "medium" | "high" | "critical";

type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  scheduled_date: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  task_source: "routine" | "strategic" | "ad_hoc";
  venture_id: string | null;
  project_id: string | null;
  created_at: string;
};

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getLocalDateISO() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getLocalDateLabel() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatTime(value: string | null) {
  if (!value) return "Anytime";

  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTaskColor(task: Task) {
  const text = `${task.title} ${task.description}`.toLowerCase();

  if (
    text.includes("akstep") ||
    text.includes("property") ||
    text.includes("listing") ||
    text.includes("real estate")
  ) {
    return "orange";
  }

  if (
    text.includes("aknm.pro") ||
    text.includes("aknm pro") ||
    text.includes("content") ||
    text.includes("publish")
  ) {
    return "purple";
  }

  if (
    text.includes("creva") ||
    text.includes("bicen") ||
    text.includes("cretespace")
  ) {
    return "green";
  }

  return "blue";
}

function getTaskTag(task: Task) {
  if (task.task_source === "routine") return "ROUTINE";
  if (task.task_source === "strategic") return "STRATEGIC";

  if (task.venture_id) return "VENTURE";
  if (task.project_id) return "PROJECT";

  return task.priority.toUpperCase();
}

function getStatusLabel(status: TaskStatus) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "deferred":
      return "Deferred";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function getReadableError(error: string) {
  if (error.toLowerCase().includes("jwt")) {
    return "Your session may have expired. Please sign in again.";
  }

  return error;
}

/**
 * Supabase's inferred query result currently resolves to GenericStringError[].
 * Validate the selected fields before using the rows as dashboard tasks.
 */
function normalizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];

  const validStatuses: TaskStatus[] = [
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    "deferred",
  ];

  const validPriorities: Priority[] = [
    "low",
    "medium",
    "high",
    "critical",
  ];

  const validSources: Task["task_source"][] = [
    "routine",
    "strategic",
    "ad_hoc",
  ];

  return value.filter((item): item is Task => {
    if (!item || typeof item !== "object") return false;

    const row = item as Record<string, unknown>;

    return (
      typeof row.id === "string" &&
      typeof row.user_id === "string" &&
      typeof row.title === "string" &&
      typeof row.description === "string" &&
      typeof row.scheduled_date === "string" &&
      typeof row.created_at === "string" &&
      validStatuses.includes(row.status as TaskStatus) &&
      validPriorities.includes(row.priority as Priority) &&
      validSources.includes(row.task_source as Task["task_source"]) &&
      (row.due_date === null || typeof row.due_date === "string") &&
      (row.start_time === null || typeof row.start_time === "string") &&
      (row.end_time === null || typeof row.end_time === "string") &&
      (row.estimated_minutes === null ||
        typeof row.estimated_minutes === "number") &&
      (row.venture_id === null || typeof row.venture_id === "string") &&
      (row.project_id === null || typeof row.project_id === "string")
    );
  }) as Task[];
}

export default function CommandCentrePage() {
  const { searchQuery } = useDashboardSearch();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayKey, setTodayKey] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again to load your daily agenda.");
      }

      const date = getLocalDateISO();

      const { data, error: queryError } = await supabase
        .from("tasks")
        .select(
          [
            "id",
            "user_id",
            "title",
            "description",
            "status",
            "priority",
            "scheduled_date",
            "due_date",
            "start_time",
            "end_time",
            "estimated_minutes",
            "task_source",
            "venture_id",
            "project_id",
            "created_at",
          ].join(","),
        )
        .eq("user_id", authData.user.id)
        .eq("scheduled_date", date)
        .neq("status", "cancelled")
        .order("start_time", {
          ascending: true,
          nullsFirst: false,
        });

      if (queryError) throw queryError;

      setTasks(normalizeTasks(data));
      setTodayKey(date);
      setTodayLabel(getLocalDateLabel());
    } catch (err) {
      setError(
        getReadableError(
          err instanceof Error
            ? err.message
            : "Could not load today's tasks.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return tasks;

    return tasks.filter((task) =>
      [
        task.title,
        task.description,
        task.status,
        task.priority,
        task.task_source,
        task.start_time ?? "",
        task.end_time ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [tasks, searchQuery]);

  const agendaTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }

      if (a.start_time) return -1;
      if (b.start_time) return 1;

      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }, [filteredTasks]);

  const focusTasks = useMemo(() => {
    return [...filteredTasks]
      .filter((task) => task.status !== "cancelled")
      .sort((a, b) => {
        const aCompleted = a.status === "completed" ? 1 : 0;
        const bCompleted = b.status === "completed" ? 1 : 0;

        if (aCompleted !== bCompleted) {
          return aCompleted - bCompleted;
        }

        const priorityDifference =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];

        if (priorityDifference !== 0) return priorityDifference;

        if (a.start_time && b.start_time) {
          return a.start_time.localeCompare(b.start_time);
        }

        if (a.start_time) return -1;
        if (b.start_time) return 1;

        return a.title.localeCompare(b.title);
      })
      .slice(0, 3);
  }, [filteredTasks]);

  const completedCount = focusTasks.filter(
    (task) => task.status === "completed",
  ).length;

  const focusCount = focusTasks.length;

  async function toggleTask(task: Task) {
    if (updatingTaskId) return;

    setUpdatingTaskId(task.id);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const nextStatus: TaskStatus =
        task.status === "completed" ? "pending" : "completed";

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: nextStatus,
          completed_at:
            nextStatus === "completed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", authData.user.id);

      if (updateError) throw updateError;

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, status: nextStatus }
            : item,
        ),
      );

      setNotice(
        nextStatus === "completed"
          ? "Task marked as completed."
          : "Task reopened.",
      );
    } catch (err) {
      setError(
        getReadableError(
          err instanceof Error ? err.message : "Could not update this task.",
        ),
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="command-centre-page">
      <section className="command-welcome">
        <div className="welcome-copy">
          <div className="welcome-date">
            {todayLabel || "Your daily briefing"}
          </div>

          <h2>
            Build with purpose,
            <br />
            <span>execute with discipline.</span>
          </h2>

          <p>
            Your executive overview for the day. Work from your real schedule,
            focus on the right tasks, and keep your ventures moving forward.
          </p>
        </div>

        <div className="welcome-emblem" aria-hidden="true">
          <div className="emblem-orbit orbit-one" />
          <div className="emblem-orbit orbit-two" />
          <div className="emblem-core">
            <Target size={32} strokeWidth={1.5} />
          </div>
          <span className="emblem-dot dot-one" />
          <span className="emblem-dot dot-two" />
        </div>

        <div className="welcome-footer">
          <span>
            <Sparkles size={15} />
            YOUR NEXT LEVEL STARTS WITH TODAY
          </span>
          <span className="welcome-footer-mark">AKNM / OS</span>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <div className="section-kicker">AT A GLANCE</div>
          <h2>Executive overview</h2>
        </div>
        <span className="preview-label">LIVE TASK DATA</span>
      </div>

      <OverviewCards />

      <div className="command-main-grid">
        <section className="panel agenda-panel">
          <div className="panel-heading">
            <div className="panel-heading-icon">
              <CalendarClock size={19} />
            </div>

            <div className="panel-heading-copy">
              <h3>Today's agenda</h3>
              <p>
                {todayKey
                  ? `${agendaTasks.length} scheduled ${
                      agendaTasks.length === 1 ? "task" : "tasks"
                    }`
                  : "Your live daily schedule"}
              </p>
            </div>

            <button
              type="button"
              className="panel-text-link"
              onClick={() => void loadTasks()}
              disabled={loading}
              aria-label="Refresh today's agenda"
            >
              <RefreshCw size={15} />
              Refresh
            </button>

            <Link href="/planner" className="panel-text-link">
              Planner <ArrowRight size={15} />
            </Link>
          </div>

          {error && (
            <div className="agenda-empty" role="alert">
              <strong>Unable to load your agenda</strong>
              <p>{error}</p>
              <button
                type="button"
                className="panel-text-link"
                onClick={() => void loadTasks()}
              >
                Try again
              </button>
            </div>
          )}

          {!error && notice && (
            <p className="agenda-footer" role="status">
              <CheckCircle2 size={15} />
              <span>{notice}</span>
            </p>
          )}

          <div className="agenda-list">
            {loading ? (
              <div className="agenda-empty">
                <LoaderCircle size={24} className="animate-spin" />
                <strong>Loading your schedule</strong>
                <p>Fetching tasks from your Planner.</p>
              </div>
            ) : !error && agendaTasks.length > 0 ? (
              agendaTasks.map((task) => {
                const color = getTaskColor(task);
                const isComplete = task.status === "completed";

                return (
                  <article className="agenda-item" key={task.id}>
                    <div className="agenda-time">
                      <span>{formatTime(task.start_time)}</span>
                      <span>
                        {task.end_time
                          ? formatTime(task.end_time)
                          : task.estimated_minutes
                            ? `${task.estimated_minutes} min`
                            : " "}
                      </span>
                    </div>

                    <div className={`agenda-marker marker-${color}`}>
                      <span />
                    </div>

                    <div className="agenda-item-content">
                      <div className="agenda-item-title-row">
                        <h4 className={isComplete ? "task-completed-title" : ""}>
                          {task.title}
                        </h4>
                        <span className={`agenda-tag tag-${color}`}>
                          {getTaskTag(task)}
                        </span>
                      </div>

                      <p>
                        {task.description?.trim() ||
                          getStatusLabel(task.status)}
                      </p>

                      <div className="agenda-task-actions">
                        <span className="agenda-task-status">
                          {getStatusLabel(task.status)}
                        </span>

                        {task.status !== "deferred" && (
                          <button
                            type="button"
                            className="agenda-task-toggle"
                            onClick={() => void toggleTask(task)}
                            disabled={updatingTaskId === task.id}
                          >
                            {updatingTaskId === task.id ? (
                              <LoaderCircle size={14} />
                            ) : isComplete ? (
                              <Circle size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            {isComplete ? "Reopen" : "Complete"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : !error ? (
              <div className="agenda-empty">
                {searchQuery.trim() ? (
                  <>
                    <Search size={24} />
                    <strong>No matching agenda items</strong>
                    <p>Try a different search term.</p>
                  </>
                ) : (
                  <>
                    <CalendarClock size={24} />
                    <strong>Your schedule is clear</strong>
                    <p>
                      You have no tasks scheduled for today. Add your next
                      actions in the Planner.
                    </p>
                    <Link href="/planner" className="panel-text-link">
                      <Plus size={15} />
                      Schedule a task
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="agenda-footer">
            <Clock3 size={15} />
            <span>
              Your agenda is loaded from your saved Planner tasks. Update the
              schedule in the Planner whenever your commitments change.
            </span>
          </div>
        </section>

        <section className="panel priorities-panel">
          <div className="panel-heading">
            <div className="panel-heading-icon priority-heading-icon">
              <Target size={19} />
            </div>

            <div className="panel-heading-copy">
              <h3>Focus for today</h3>
              <p>Your highest-priority scheduled tasks</p>
            </div>
          </div>

          <div className="priority-progress">
            <div className="priority-progress-label">
              <span>Progress</span>
              <strong>
                {completedCount} of {focusCount}
              </strong>
            </div>

            <div
              className="priority-progress-track"
              role="progressbar"
              aria-label="Today's focus completion"
              aria-valuemin={0}
              aria-valuemax={focusCount}
              aria-valuenow={completedCount}
            >
              <span
                style={{
                  width: `${
                    focusCount > 0
                      ? (completedCount / focusCount) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="priority-list">
            {!loading && !error && focusTasks.length === 0 ? (
              <div className="agenda-empty">
                <Target size={24} />
                <strong>No focus tasks yet</strong>
                <p>
                  Schedule your key outcomes in the Planner and they will
                  appear here automatically.
                </p>
              </div>
            ) : (
              focusTasks.map((task) => {
                const isComplete = task.status === "completed";

                return (
                  <button
                    type="button"
                    className={`priority-item ${
                      isComplete ? "is-complete" : ""
                    }`}
                    key={task.id}
                    onClick={() => void toggleTask(task)}
                    disabled={updatingTaskId === task.id}
                    aria-pressed={isComplete}
                  >
                    <span className="priority-check">
                      {updatingTaskId === task.id ? (
                        <LoaderCircle size={20} />
                      ) : isComplete ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Circle size={20} />
                      )}
                    </span>

                    <span className="priority-copy">
                      <strong>{task.title}</strong>
                      <span>
                        {task.description?.trim() ||
                          `${task.priority.toUpperCase()} priority · ${getStatusLabel(
                            task.status,
                          )}`}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <Link href="/planner" className="panel-bottom-link">
            Manage all tasks <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <section className="quick-actions-section">
        <div className="section-heading quick-actions-heading">
          <div>
            <div className="section-kicker">MOVE WITH INTENTION</div>
            <h2>Quick actions</h2>
          </div>
        </div>

        <div className="quick-actions-grid">
          <Link href="/planner" className="quick-action-card">
            <span className="quick-action-icon action-green">
              <Plus size={20} />
            </span>
            <span>
              <strong>Plan a task</strong>
              <small>Schedule your next action</small>
            </span>
            <ArrowRight size={16} />
          </Link>

          <Link href="/finance" className="quick-action-card">
            <span className="quick-action-icon action-blue">
              <Plus size={20} />
            </span>
            <span>
              <strong>Record a transaction</strong>
              <small>Keep your finances current</small>
            </span>
            <ArrowRight size={16} />
          </Link>

          <Link href="/achievements" className="quick-action-card">
            <span className="quick-action-icon action-purple">
              <Plus size={20} />
            </span>
            <span>
              <strong>Record an achievement</strong>
              <small>Capture a meaningful result</small>
            </span>
            <ArrowRight size={16} />
          </Link>

          <Link href="/projects" className="quick-action-card">
            <span className="quick-action-icon action-orange">
              <Plus size={20} />
            </span>
            <span>
              <strong>Capture a project idea</strong>
              <small>Save it for prioritisation</small>
            </span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
