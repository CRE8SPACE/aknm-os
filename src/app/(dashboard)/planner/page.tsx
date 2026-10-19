
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ListFilter,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./planner.css";

export const dynamic = "force-dynamic";

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "deferred"
  | "cancelled";

type Priority = "low" | "medium" | "high" | "critical";
type TaskSource = "routine" | "strategic" | "ad_hoc";

type Task = {
  id: string;
  user_id: string;
  venture_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  template_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  scheduled_date: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  completion_note: string | null;
  outcome: string | null;
  completed_at: string | null;
  task_source: TaskSource;
  created_at: string;
  updated_at: string;
};

type Venture = { id: string; name: string };
type Project = { id: string; name: string; venture_id: string | null };
type Milestone = {
  id: string;
  title: string;
  project_id: string;
  due_date: string | null;
};

type Routine = {
  id: string;
  title: string;
  description: string;
  recurrence_type: string;
  weekdays: number[];
  time_of_day: string | null;
  duration_minutes: number;
  priority: Priority;
  venture_id: string | null;
  project_id: string | null;
  active_from: string;
  active_until: string | null;
  is_active: boolean;
};

type TaskForm = {
  title: string;
  description: string;
  scheduled_date: string;
  due_date: string;
  start_time: string;
  end_time: string;
  estimated_minutes: string;
  priority: Priority;
  task_source: TaskSource;
  venture_id: string;
  project_id: string;
  milestone_id: string;
};

type GeneratedTask = {
  user_id: string;
  template_id: string;
  title: string;
  description: string;
  scheduled_date: string;
  due_date: string;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number;
  priority: Priority;
  task_source: "routine";
  venture_id: string | null;
  project_id: string | null;
  status: "pending";
};

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function shiftDate(date: string, amount: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);

  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function formatDate(
  date: string,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!date) return "Not set";

  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(`${date}T12:00:00`));
}

function getWeekday(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

function startOfWeek(date: string) {
  const weekday = getWeekday(date);
  return shiftDate(date, weekday === 0 ? -6 : 1 - weekday);
}

function emptyForm(date: string): TaskForm {
  return {
    title: "",
    description: "",
    scheduled_date: date,
    due_date: "",
    start_time: "",
    end_time: "",
    estimated_minutes: "30",
    priority: "medium",
    task_source: "ad_hoc",
    venture_id: "",
    project_id: "",
    milestone_id: "",
  };
}

function readableError(message: string) {
  if (message.includes("task_source")) {
    return "Run the Planner database migration first. The tasks.task_source field is missing.";
  }

  if (message.includes("due_date")) {
    return "Run the Planner database migration first. The tasks.due_date field is missing.";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "Supabase denied this action. Check the signed-in user's task policies.";
  }

  return message;
}

/**
 * Calculate the end clock time and deadline for a scheduled routine.
 * A block ending at or before midnight is due on its scheduled date.
 * A block crossing midnight is due on the following calendar date.
 */
function calculateSchedule(
  scheduledDate: string,
  startTime: string | null,
  durationMinutes: number,
) {
  const normalizedDuration = Math.max(
    1,
    Math.min(1440, Math.floor(Number(durationMinutes) || 30)),
  );

  if (!startTime) {
    return {
      endTime: null,
      dueDate: scheduledDate,
      duration: normalizedDuration,
    };
  }

  const match = startTime.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return {
      endTime: null,
      dueDate: scheduledDate,
      duration: normalizedDuration,
    };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return {
      endTime: null,
      dueDate: scheduledDate,
      duration: normalizedDuration,
    };
  }

  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + normalizedDuration;
  const crossesMidnight = endMinutes >= 1440;
  const clockMinutes = endMinutes % 1440;

  return {
    endTime: `${String(Math.floor(clockMinutes / 60)).padStart(2, "0")}:${String(clockMinutes % 60).padStart(2, "0")}:00`,
    dueDate: crossesMidnight
      ? shiftDate(scheduledDate, Math.floor(endMinutes / 1440))
      : scheduledDate,
    duration: normalizedDuration,
  };
}

function routineWeekdays(routine: Routine) {
  if (routine.recurrence_type === "daily") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  return Array.isArray(routine.weekdays)
    ? routine.weekdays
    : [];
}

/**
 * Generate routine occurrences for a date range.
 *
 * Existing tasks are checked by template_id + scheduled_date.
 * Existing records are never overwritten, so completed tasks and user edits
 * are preserved when the schedule is refreshed.
 */
async function generateRoutineOccurrences(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  templates: Routine[],
  rangeStart: string,
  rangeEnd: string,
) {
  const eligibleTemplates = templates.filter(
    (routine) =>
      routine.is_active &&
      routine.active_from <= rangeEnd &&
      (!routine.active_until || routine.active_until >= rangeStart),
  );

  if (!eligibleTemplates.length) {
    return { inserted: 0 };
  }

  const templateIds = eligibleTemplates.map((routine) => routine.id);

  const { data: existingTasks, error: existingError } = await supabase
    .from("tasks")
    .select("template_id, scheduled_date")
    .eq("user_id", userId)
    .in("template_id", templateIds)
    .gte("scheduled_date", rangeStart)
    .lte("scheduled_date", rangeEnd);

  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existingTasks ?? []).map(
      (task) => `${task.template_id}:${task.scheduled_date}`,
    ),
  );

  const generated: GeneratedTask[] = [];

  for (const routine of eligibleTemplates) {
    const weekdays = routineWeekdays(routine);
    const firstDate =
      routine.active_from > rangeStart
        ? routine.active_from
        : rangeStart;

    const lastDate =
      routine.active_until && routine.active_until < rangeEnd
        ? routine.active_until
        : rangeEnd;

    let cursor = firstDate;

    while (cursor <= lastDate) {
      const key = `${routine.id}:${cursor}`;

      if (
        weekdays.includes(getWeekday(cursor)) &&
        !existingKeys.has(key)
      ) {
        const schedule = calculateSchedule(
          cursor,
          routine.time_of_day,
          routine.duration_minutes,
        );

        generated.push({
          user_id: userId,
          template_id: routine.id,
          title: routine.title,
          description: routine.description ?? "",
          scheduled_date: cursor,
          due_date: schedule.dueDate,
          start_time: routine.time_of_day,
          end_time: schedule.endTime,
          estimated_minutes: schedule.duration,
          priority: routine.priority,
          task_source: "routine",
          venture_id: routine.venture_id,
          project_id: routine.project_id,
          status: "pending",
        });

        // Prevent duplicates within this generation run as well.
        existingKeys.add(key);
      }

      cursor = shiftDate(cursor, 1);
    }
  }

  if (!generated.length) {
    return { inserted: 0 };
  }

  // Insert only missing occurrences. This avoids relying on a particular
  // unique-index definition for Supabase's upsert conflict inference.
  const { error: insertError } = await supabase
    .from("tasks")
    .insert(generated);

  if (insertError) throw insertError;

  return { inserted: generated.length };
}

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [view, setView] = useState<"day" | "week">("day");
  const [activeTab, setActiveTab] = useState<"agenda" | "routines">("agenda");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyForm(todayISO()));
  const [completionNote, setCompletionNote] = useState("");
  const [actualMinutes, setActualMinutes] = useState("");
  const [routineForm, setRoutineForm] = useState({
    title: "",
    description: "",
    recurrence_type: "weekly",
    weekdays: [1, 2, 3, 4, 5] as number[],
    time_of_day: "09:00",
    duration_minutes: "30",
    priority: "medium" as Priority,
    venture_id: "",
    project_id: "",
    active_from: todayISO(),
    active_until: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          "Your session has expired. Sign in again to use Planner.",
        );
      }

      const [
        taskResult,
        ventureResult,
        projectResult,
        milestoneResult,
        routineResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", authData.user.id)
          .gte("scheduled_date", shiftDate(todayISO(), -90))
          .lte("scheduled_date", shiftDate(todayISO(), 180))
          .order("scheduled_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("ventures")
          .select("id, name")
          .order("name"),
        supabase
          .from("projects")
          .select("id, name, venture_id")
          .order("name"),
        supabase
          .from("project_milestones")
          .select("id, title, project_id, due_date")
          .order("due_date"),
        supabase
          .from("task_templates")
          .select("*")
          .eq("user_id", authData.user.id)
          .order("title"),
      ]);

      if (taskResult.error) throw taskResult.error;
      if (ventureResult.error) throw ventureResult.error;
      if (projectResult.error) throw projectResult.error;
      if (milestoneResult.error) throw milestoneResult.error;
      if (routineResult.error) throw routineResult.error;

      setTasks((taskResult.data ?? []) as Task[]);
      setVentures((ventureResult.data ?? []) as Venture[]);
      setProjects((projectResult.data ?? []) as Project[]);
      setMilestones((milestoneResult.data ?? []) as Milestone[]);
      setRoutines((routineResult.data ?? []) as Routine[]);
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not load Planner.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const weekDates = useMemo(() => {
    const monday = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) =>
      shiftDate(monday, index),
    );
  }, [selectedDate]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const inDateRange =
        view === "day"
          ? task.scheduled_date === selectedDate
          : weekDates.includes(task.scheduled_date);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;
      const matchesSource =
        sourceFilter === "all" || task.task_source === sourceFilter;

      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query);

      return (
        inDateRange &&
        matchesStatus &&
        matchesPriority &&
        matchesSource &&
        matchesSearch
      );
    });
  }, [
    tasks,
    view,
    selectedDate,
    weekDates,
    statusFilter,
    priorityFilter,
    sourceFilter,
    search,
  ]);

  const dayTasks = useMemo(
    () => tasks.filter((task) => task.scheduled_date === selectedDate),
    [tasks, selectedDate],
  );

  const completedCount = dayTasks.filter(
    (task) => task.status === "completed",
  ).length;

  const pendingCount = dayTasks.filter(
    (task) =>
      task.status === "pending" || task.status === "in_progress",
  ).length;

  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      Boolean(task.due_date) &&
      task.due_date! < todayISO(),
  );

  const completionRate = dayTasks.length
    ? Math.round((completedCount / dayTasks.length) * 100)
    : 0;

  const openNewTask = (date = selectedDate) => {
    setEditingTask(null);
    setTaskForm(emptyForm(date));
    setError("");
    setTaskModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description ?? "",
      scheduled_date: task.scheduled_date,
      due_date: task.due_date ?? "",
      start_time: task.start_time?.slice(0, 5) ?? "",
      end_time: task.end_time?.slice(0, 5) ?? "",
      estimated_minutes: task.estimated_minutes?.toString() ?? "30",
      priority: task.priority,
      task_source: task.task_source ?? "ad_hoc",
      venture_id: task.venture_id ?? "",
      project_id: task.project_id ?? "",
      milestone_id: task.milestone_id ?? "",
    });
    setError("");
    setTaskModalOpen(true);
  };

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskForm.title.trim()) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const payload = {
        user_id: authData.user.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        scheduled_date: taskForm.scheduled_date,
        due_date: taskForm.due_date || null,
        start_time: taskForm.start_time || null,
        end_time: taskForm.end_time || null,
        estimated_minutes: taskForm.estimated_minutes
          ? Number(taskForm.estimated_minutes)
          : null,
        priority: taskForm.priority,
        task_source: taskForm.task_source,
        venture_id: taskForm.venture_id || null,
        project_id: taskForm.project_id || null,
        milestone_id: taskForm.milestone_id || null,
        status: editingTask?.status ?? "pending",
        updated_at: new Date().toISOString(),
      };

      if (editingTask) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editingTask.id)
          .eq("user_id", authData.user.id);

        if (updateError) throw updateError;
        setNotice("Task updated.");
      } else {
        const { error: insertError } = await supabase
          .from("tasks")
          .insert(payload);

        if (insertError) throw insertError;
        setNotice("Task added to your agenda.");
      }

      setTaskModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not save task.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(
    task: Task,
    changes: Partial<Task>,
    successMessage: string,
  ) {
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          ...changes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", authData.user.id);

      if (updateError) throw updateError;

      setNotice(successMessage);
      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not update task.",
        ),
      );
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("user_id", authData.user.id);

      if (deleteError) throw deleteError;

      setNotice("Task deleted.");
      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not delete task.",
        ),
      );
    }
  }

  async function saveCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completionTask) return;

    setSaving(true);

    try {
      await updateTask(
        completionTask,
        {
          status: "completed",
          completed_at: new Date().toISOString(),
          completion_note: completionNote.trim() || null,
          actual_minutes: actualMinutes
            ? Number(actualMinutes)
            : null,
        },
        "Task marked as complete.",
      );

      setCompletionTask(null);
      setCompletionNote("");
      setActualMinutes("");
    } finally {
      setSaving(false);
    }
  }

  async function createRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!routineForm.title.trim()) return;

    if (
      routineForm.recurrence_type === "weekly" &&
      routineForm.weekdays.length === 0
    ) {
      setError("Choose at least one weekday for this routine.");
      return;
    }

    if (
      routineForm.active_until &&
      routineForm.active_until < routineForm.active_from
    ) {
      setError("'Active until' cannot be earlier than 'Active from'.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const templatePayload = {
        user_id: authData.user.id,
        title: routineForm.title.trim(),
        description: routineForm.description.trim(),
        recurrence_type: routineForm.recurrence_type,
        weekdays:
          routineForm.recurrence_type === "daily"
            ? [0, 1, 2, 3, 4, 5, 6]
            : routineForm.weekdays,
        time_of_day: routineForm.time_of_day || null,
        duration_minutes: Math.max(
          1,
          Math.min(1440, Number(routineForm.duration_minutes) || 30),
        ),
        priority: routineForm.priority,
        venture_id: routineForm.venture_id || null,
        project_id: routineForm.project_id || null,
        active_from: routineForm.active_from,
        active_until: routineForm.active_until || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: template, error: templateError } = await supabase
        .from("task_templates")
        .insert(templatePayload)
        .select("*")
        .single();

      if (templateError) throw templateError;

      const endDate = shiftDate(todayISO(), 13);

      const result = await generateRoutineOccurrences(
        supabase,
        authData.user.id,
        [template as Routine],
        todayISO(),
        endDate,
      );

      setRoutineModalOpen(false);
      setRoutineForm({
        title: "",
        description: "",
        recurrence_type: "weekly",
        weekdays: [1, 2, 3, 4, 5],
        time_of_day: "09:00",
        duration_minutes: "30",
        priority: "medium",
        venture_id: "",
        project_id: "",
        active_from: todayISO(),
        active_until: "",
      });

      setNotice(
        result.inserted
          ? `Routine created. ${result.inserted} task${result.inserted === 1 ? "" : "s"} scheduled.`
          : "Routine created. Its active dates contain no upcoming occurrences in the next two weeks.",
      );

      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not create routine.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoutine(routine: Routine) {
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      const { error: updateError } = await supabase
        .from("task_templates")
        .update({
          is_active: !routine.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", routine.id)
        .eq("user_id", authData.user.id);

      if (updateError) throw updateError;

      setNotice(
        routine.is_active
          ? "Routine paused. Existing tasks have been preserved."
          : "Routine activated. Refresh the schedule to generate missing tasks.",
      );

      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error ? err.message : "Could not update routine.",
        ),
      );
    }
  }

  async function generateRoutineTasks() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in again.");
      }

      // Fetch active templates directly from Supabase so the operation does
      // not depend on possibly stale React state.
      const { data: activeTemplates, error: routineError } = await supabase
        .from("task_templates")
        .select("*")
        .eq("user_id", authData.user.id)
        .eq("is_active", true);

      if (routineError) throw routineError;

      const result = await generateRoutineOccurrences(
        supabase,
        authData.user.id,
        (activeTemplates ?? []) as Routine[],
        todayISO(),
        shiftDate(todayISO(), 13),
      );

      setNotice(
        result.inserted
          ? `Schedule refreshed. ${result.inserted} missing task${result.inserted === 1 ? "" : "s"} added; existing tasks were preserved.`
          : "Schedule is up to date. No missing routine tasks were found.",
      );

      await loadData();
    } catch (err) {
      setError(
        readableError(
          err instanceof Error
            ? err.message
            : "Could not refresh routines.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const changeDate = (amount: number) =>
    setSelectedDate((date) => shiftDate(date, amount));

  return (
    <main className="planner-page">
      <section className="planner-heading">
        <div>
          <div className="planner-eyebrow">
            <span className="planner-live-dot" /> PERSONAL OPERATING SYSTEM
          </div>
          <h2>
            Plan with intention<span>.</span>
          </h2>
          <p>
            Turn priorities into action. Keep your day, routines and long-term
            goals moving.
          </p>
        </div>

        <div className="planner-heading-actions">
          <button
            className="planner-button planner-button-secondary"
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? "planner-spinning" : ""}
            />{" "}
            Refresh
          </button>

          <button
            className="planner-button planner-button-primary"
            type="button"
            onClick={() => openNewTask()}
          >
            <Plus size={17} /> Add task
          </button>
        </div>
      </section>

      {error && (
        <div className="planner-alert planner-alert-error">
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
        <div className="planner-alert planner-alert-success">
          <CheckCircle2 size={16} />
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

      <section className="planner-stats">
        <article className="planner-stat-card planner-stat-featured">
          <div className="planner-stat-top">
            <span>Today's progress</span>
            <Activity size={17} />
          </div>
          <div className="planner-stat-number">
            {completionRate}
            <small>%</small>
          </div>
          <div className="planner-progress-track">
            <span style={{ width: `${completionRate}%` }} />
          </div>
          <div className="planner-stat-foot">
            {completedCount} completed of {dayTasks.length} tasks
          </div>
        </article>

        <article className="planner-stat-card">
          <div className="planner-stat-top">
            <span>On your agenda</span>
            <CalendarDays size={17} />
          </div>
          <div className="planner-stat-number">
            {pendingCount}
            <small> tasks</small>
          </div>
          <div className="planner-stat-foot">
            Scheduled for{" "}
            {selectedDate === todayISO() ? "today" : formatDate(selectedDate)}
          </div>
        </article>

        <article className="planner-stat-card">
          <div className="planner-stat-top">
            <span>Overdue</span>
            <Clock3 size={17} />
          </div>
          <div
            className={`planner-stat-number ${overdueTasks.length ? "planner-number-warning" : ""}`}
          >
            {overdueTasks.length}
            <small> tasks</small>
          </div>
          <div className="planner-stat-foot">
            {overdueTasks.length
              ? "Need your attention"
              : "You're up to date"}
          </div>
        </article>

        <article className="planner-stat-card">
          <div className="planner-stat-top">
            <span>Active routines</span>
            <RefreshCw size={17} />
          </div>
          <div className="planner-stat-number">
            {routines.filter((routine) => routine.is_active).length}
            <small> routines</small>
          </div>
          <div className="planner-stat-foot">
            Habits that keep you consistent
          </div>
        </article>
      </section>

      <section className="planner-workspace">
        <div className="planner-main-panel">
          <div className="planner-panel-header">
            <div>
              <span className="planner-section-label">YOUR SCHEDULE</span>
              <h3>
                {activeTab === "agenda" ? "Agenda" : "Recurring routines"}
              </h3>
            </div>

            <div className="planner-tab-switch">
              <button
                type="button"
                className={activeTab === "agenda" ? "is-active" : ""}
                onClick={() => setActiveTab("agenda")}
              >
                Agenda
              </button>
              <button
                type="button"
                className={activeTab === "routines" ? "is-active" : ""}
                onClick={() => setActiveTab("routines")}
              >
                Routines
              </button>
            </div>
          </div>

          {activeTab === "agenda" ? (
            <>
              <div className="planner-calendar-bar">
                <div className="planner-date-controls">
                  <button
                    type="button"
                    className="planner-square-button"
                    onClick={() => changeDate(view === "day" ? -1 : -7)}
                    aria-label="Previous date"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    className="planner-today-button"
                    onClick={() => setSelectedDate(todayISO())}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    className="planner-square-button"
                    onClick={() => changeDate(view === "day" ? 1 : 7)}
                    aria-label="Next date"
                  >
                    <ChevronRight size={18} />
                  </button>

                  <strong>
                    {view === "day"
                      ? formatDate(selectedDate, {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : `${formatDate(weekDates[0], { day: "numeric", month: "short" })} – ${formatDate(weekDates[6], { day: "numeric", month: "short", year: "numeric" })}`}
                  </strong>
                </div>

                <div className="planner-view-switch">
                  <button
                    type="button"
                    className={view === "day" ? "is-active" : ""}
                    onClick={() => setView("day")}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    className={view === "week" ? "is-active" : ""}
                    onClick={() => setView("week")}
                  >
                    Week
                  </button>
                </div>
              </div>

              {view === "week" && (
                <div className="planner-week-strip">
                  {weekDates.map((date) => {
                    const dateTasks = tasks.filter(
                      (task) => task.scheduled_date === date,
                    );

                    return (
                      <button
                        type="button"
                        key={date}
                        className={`planner-week-day ${date === selectedDate ? "is-selected" : ""} ${date === todayISO() ? "is-today" : ""}`}
                        onClick={() => {
                          setSelectedDate(date);
                          setView("day");
                        }}
                      >
                        <span>{formatDate(date, { weekday: "short" })}</span>
                        <strong>
                          {new Date(`${date}T12:00:00`).getDate()}
                        </strong>
                        <i>{dateTasks.length ? dateTasks.length : ""}</i>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="planner-filter-row">
                <label className="planner-search">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a task..."
                  />
                </label>

                <label className="planner-filter">
                  <ListFilter size={14} />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="deferred">Deferred</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <ChevronDown size={13} />
                </label>

                <label className="planner-filter">
                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(event.target.value)
                    }
                  >
                    <option value="all">All priorities</option>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority[0].toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>

                <label className="planner-filter">
                  <select
                    value={sourceFilter}
                    onChange={(event) =>
                      setSourceFilter(event.target.value)
                    }
                  >
                    <option value="all">All task types</option>
                    <option value="routine">Routine</option>
                    <option value="strategic">Strategic</option>
                    <option value="ad_hoc">Ad hoc</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>

              {loading ? (
                <div className="planner-loading">
                  <LoaderCircle
                    size={22}
                    className="planner-spinning"
                  />
                  <span>Loading your agenda...</span>
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="planner-empty">
                  <span className="planner-empty-icon">
                    <CalendarDays size={24} />
                  </span>
                  <h4>Your schedule is clear</h4>
                  <p>
                    Add a task or adjust your filters to see more here.
                  </p>
                  <button
                    className="planner-button planner-button-primary"
                    type="button"
                    onClick={() => openNewTask()}
                  >
                    <Plus size={16} /> Add your first task
                  </button>
                </div>
              ) : (
                <div className="planner-task-list">
                  {visibleTasks.map((task) => {
                    const linkedProject = projects.find(
                      (project) => project.id === task.project_id,
                    );
                    const linkedVenture = ventures.find(
                      (venture) => venture.id === task.venture_id,
                    );
                    const isDone = task.status === "completed";
                    const isOverdue =
                      Boolean(task.due_date) &&
                      task.due_date! < todayISO() &&
                      !isDone &&
                      task.status !== "cancelled";

                    return (
                      <article
                        className={`planner-task-row ${isDone ? "is-complete" : ""}`}
                        key={task.id}
                      >
                        <button
                          type="button"
                          className={`planner-task-check ${isDone ? "is-checked" : ""}`}
                          onClick={() =>
                            isDone
                              ? void updateTask(
                                  task,
                                  {
                                    status: "pending",
                                    completed_at: null,
                                  },
                                  "Task reopened.",
                                )
                              : (setCompletionTask(task),
                                setCompletionNote(""),
                                setActualMinutes(
                                  task.estimated_minutes?.toString() ?? "",
                                ))
                          }
                          aria-label={
                            isDone ? "Reopen task" : "Complete task"
                          }
                        >
                          {isDone ? (
                            <Check size={15} />
                          ) : (
                            <Circle size={18} />
                          )}
                        </button>

                        <div className="planner-task-content">
                          <div className="planner-task-title-line">
                            <h4>{task.title}</h4>
                            {task.task_source === "routine" && (
                              <span className="planner-task-type">
                                <RefreshCw size={11} /> Routine
                              </span>
                            )}
                            {task.task_source === "strategic" && (
                              <span className="planner-task-type planner-task-type-strategic">
                                <Target size={11} /> Strategic
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="planner-task-description">
                              {task.description}
                            </p>
                          )}

                          <div className="planner-task-meta">
                            {task.start_time && (
                              <span>
                                <Clock3 size={12} />{" "}
                                {task.start_time.slice(0, 5)}
                                {task.end_time
                                  ? ` – ${task.end_time.slice(0, 5)}`
                                  : ""}
                              </span>
                            )}

                            {task.estimated_minutes && (
                              <span>{task.estimated_minutes} min</span>
                            )}

                            {linkedVenture && (
                              <span className="planner-link-chip">
                                {linkedVenture.name}
                              </span>
                            )}

                            {linkedProject && (
                              <span className="planner-link-chip">
                                {linkedProject.name}
                              </span>
                            )}

                            {task.due_date && (
                              <span
                                className={
                                  isOverdue ? "planner-overdue-label" : ""
                                }
                              >
                                {isOverdue ? "Overdue · " : "Due · "}
                                {formatDate(task.due_date, {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            )}
                          </div>

                          {isDone &&
                            (task.completion_note ||
                              task.actual_minutes ||
                              task.outcome) && (
                              <div className="planner-completion-record">
                                <CheckCircle2 size={13} />
                                {task.actual_minutes
                                  ? `${task.actual_minutes} min spent`
                                  : ""}
                                {task.completion_note
                                  ? ` · ${task.completion_note}`
                                  : ""}
                                {task.outcome ? ` · ${task.outcome}` : ""}
                              </div>
                            )}
                        </div>

                        <span
                          className={`planner-priority planner-priority-${task.priority}`}
                        >
                          {task.priority}
                        </span>

                        <div className="planner-task-actions">
                          <button
                            type="button"
                            onClick={() => openEditTask(task)}
                            title="Edit task"
                            aria-label="Edit task"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void updateTask(
                                task,
                                {
                                  scheduled_date: shiftDate(
                                    task.scheduled_date,
                                    1,
                                  ),
                                  due_date: task.due_date
                                    ? shiftDate(task.due_date, 1)
                                    : null,
                                },
                                "Task moved to the next day.",
                              )
                            }
                            title="Move to next day"
                            aria-label="Move to next day"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTask(task)}
                            title="Delete task"
                            aria-label="Delete task"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <button
                className="planner-add-inline"
                type="button"
                onClick={() => openNewTask()}
              >
                <Plus size={15} /> Add a task to this day
              </button>
            </>
          ) : (
            <div className="planner-routines-panel">
              <div className="planner-routine-intro">
                <div>
                  <span className="planner-section-label">
                    CONSISTENCY COMPOUNDS
                  </span>
                  <h4>Build routines that run your life.</h4>
                  <p>
                    Schedule repeatable actions so your important work
                    doesn't depend on memory.
                  </p>
                </div>

                <button
                  className="planner-button planner-button-secondary"
                  type="button"
                  onClick={() => void generateRoutineTasks()}
                  disabled={saving}
                >
                  <RefreshCw size={14} /> Refresh schedule
                </button>
              </div>

              {loading ? (
                <div className="planner-loading">
                  <LoaderCircle
                    size={22}
                    className="planner-spinning"
                  />{" "}
                  Loading routines...
                </div>
              ) : routines.length === 0 ? (
                <div className="planner-empty planner-empty-compact">
                  <span className="planner-empty-icon">
                    <RefreshCw size={22} />
                  </span>
                  <h4>No routines yet</h4>
                  <p>
                    Create a daily or weekly routine to start building
                    consistency.
                  </p>
                </div>
              ) : (
                routines.map((routine) => (
                  <article
                    className={`planner-routine-row ${!routine.is_active ? "is-paused" : ""}`}
                    key={routine.id}
                  >
                    <span className="planner-routine-icon">
                      <RefreshCw size={17} />
                    </span>

                    <div className="planner-routine-content">
                      <h4>{routine.title}</h4>
                      <p>
                        {routine.recurrence_type === "daily"
                          ? "Every day"
                          : routineWeekdays(routine)
                              .map(
                                (day) =>
                                  WEEKDAYS.find(
                                    (item) => item.value === day,
                                  )?.label,
                              )
                              .filter(Boolean)
                              .join(", ") || "Weekly"}
                        {routine.time_of_day
                          ? ` · ${routine.time_of_day.slice(0, 5)}`
                          : ""}
                        {" · "}
                        {routine.duration_minutes} min
                      </p>
                    </div>

                    <span
                      className={`planner-routine-state ${routine.is_active ? "is-active" : ""}`}
                    >
                      {routine.is_active ? "Active" : "Paused"}
                    </span>

                    <button
                      type="button"
                      className="planner-icon-action"
                      onClick={() => void toggleRoutine(routine)}
                      title={
                        routine.is_active
                          ? "Pause routine"
                          : "Activate routine"
                      }
                    >
                      {routine.is_active ? (
                        <Circle size={16} />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                    </button>
                  </article>
                ))
              )}

              <button
                className="planner-add-inline"
                type="button"
                onClick={() => setRoutineModalOpen(true)}
              >
                <Plus size={15} /> Create another routine
              </button>
            </div>
          )}
        </div>

        <aside className="planner-side-panel">
          <div className="planner-side-card planner-focus-card">
            <span className="planner-side-icon">
              <Zap size={18} />
            </span>
            <span className="planner-section-label">DAILY FOCUS</span>
            <h3>Make today count.</h3>
            <p>
              Progress comes from completing the right actions consistently.
            </p>

            <div className="planner-focus-metric">
              <span>Tasks completed</span>
              <strong>
                {completedCount}
                <small> / {dayTasks.length}</small>
              </strong>
            </div>

            <div className="planner-progress-track">
              <span style={{ width: `${completionRate}%` }} />
            </div>

            <button
              type="button"
              className="planner-text-button"
              onClick={() => {
                setStatusFilter("pending");
                setActiveTab("agenda");
                setView("day");
              }}
            >
              Focus on pending tasks <ArrowRight size={14} />
            </button>
          </div>

          <div className="planner-side-card">
            <div className="planner-side-card-heading">
              <div>
                <span className="planner-section-label">
                  NEEDS ATTENTION
                </span>
                <h3>Overdue tasks</h3>
              </div>
              <span
                className={`planner-count-badge ${overdueTasks.length ? "has-items" : ""}`}
              >
                {overdueTasks.length}
              </span>
            </div>

            {overdueTasks.length === 0 ? (
              <div className="planner-side-empty">
                <CheckCircle2 size={17} />
                <span>Nothing overdue. Keep it that way.</span>
              </div>
            ) : (
              overdueTasks.slice(0, 4).map((task) => (
                <button
                  type="button"
                  className="planner-overdue-item"
                  key={task.id}
                  onClick={() => openEditTask(task)}
                >
                  <span className="planner-overdue-dot" />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      Due{" "}
                      {formatDate(task.due_date!, {
                        day: "numeric",
                        month: "short",
                      })}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            )}
          </div>

          <div className="planner-side-card planner-routine-quick-card">
            <div className="planner-side-card-heading">
              <div>
                <span className="planner-section-label">YOUR SYSTEM</span>
                <h3>Recurring routines</h3>
              </div>
              <RefreshCw size={16} />
            </div>

            <p>
              Make essential work automatic with a repeatable schedule.
            </p>

            <button
              type="button"
              className="planner-button planner-button-secondary planner-button-full"
              onClick={() => setRoutineModalOpen(true)}
            >
              <Plus size={15} /> Create a routine
            </button>

            <button
              type="button"
              className="planner-text-button"
              onClick={() => setActiveTab("routines")}
            >
              Manage all routines <ArrowRight size={14} />
            </button>
          </div>
        </aside>
      </section>

      {taskModalOpen && (
        <div
          className="planner-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTaskModalOpen(false);
            }
          }}
        >
          <section
            className="planner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-task-modal-title"
          >
            <header className="planner-modal-header">
              <div>
                <span className="planner-section-label">
                  {editingTask ? "UPDATE YOUR PLAN" : "MAKE IT HAPPEN"}
                </span>
                <h3 id="planner-task-modal-title">
                  {editingTask ? "Edit task" : "Add a task"}
                </h3>
              </div>
              <button
                type="button"
                className="planner-square-button"
                onClick={() => setTaskModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            <form className="planner-form" onSubmit={saveTask}>
              <label className="planner-field planner-field-full">
                <span>Task title *</span>
                <input
                  required
                  autoFocus
                  maxLength={180}
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      title: event.target.value,
                    })
                  }
                  placeholder="What needs to get done?"
                />
              </label>

              <label className="planner-field planner-field-full">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Add context or the intended outcome..."
                />
              </label>

              <div className="planner-form-grid">
                <label className="planner-field">
                  <span>Scheduled date *</span>
                  <input
                    type="date"
                    required
                    value={taskForm.scheduled_date}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        scheduled_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Deadline</span>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        due_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={taskForm.start_time}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        start_time: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>End time</span>
                  <input
                    type="time"
                    value={taskForm.end_time}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        end_time: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Estimated minutes</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={taskForm.estimated_minutes}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        estimated_minutes: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Priority</span>
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        priority: event.target.value as Priority,
                      })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority[0].toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Task type</span>
                  <select
                    value={taskForm.task_source}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        task_source: event.target.value as TaskSource,
                      })
                    }
                  >
                    <option value="ad_hoc">Ad hoc</option>
                    <option value="strategic">Strategic</option>
                    <option value="routine">Routine</option>
                  </select>
                </label>

                <label className="planner-field">
                  <span>Business venture</span>
                  <select
                    value={taskForm.venture_id}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        venture_id: event.target.value,
                        project_id: "",
                        milestone_id: "",
                      })
                    }
                  >
                    <option value="">No venture linked</option>
                    {ventures.map((venture) => (
                      <option key={venture.id} value={venture.id}>
                        {venture.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Project</span>
                  <select
                    value={taskForm.project_id}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        project_id: event.target.value,
                        milestone_id: "",
                      })
                    }
                  >
                    <option value="">No project linked</option>
                    {projects
                      .filter(
                        (project) =>
                          !taskForm.venture_id ||
                          project.venture_id === taskForm.venture_id,
                      )
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Project milestone</span>
                  <select
                    value={taskForm.milestone_id}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        milestone_id: event.target.value,
                      })
                    }
                  >
                    <option value="">No milestone linked</option>
                    {milestones
                      .filter(
                        (milestone) =>
                          !taskForm.project_id ||
                          milestone.project_id === taskForm.project_id,
                      )
                      .map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {error && <p className="planner-form-error">{error}</p>}

              <footer className="planner-modal-footer">
                <button
                  className="planner-button planner-button-secondary"
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="planner-button planner-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle
                      size={15}
                      className="planner-spinning"
                    />
                  ) : (
                    <Check size={16} />
                  )}
                  {editingTask ? "Save changes" : "Create task"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {completionTask && (
        <div
          className="planner-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCompletionTask(null);
            }
          }}
        >
          <section
            className="planner-modal planner-modal-small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-completion-title"
          >
            <header className="planner-modal-header">
              <div>
                <span className="planner-section-label">CLOSE THE LOOP</span>
                <h3 id="planner-completion-title">Complete task</h3>
                <p className="planner-modal-subtitle">
                  {completionTask.title}
                </p>
              </div>
              <button
                type="button"
                className="planner-square-button"
                onClick={() => setCompletionTask(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            <form className="planner-form" onSubmit={saveCompletion}>
              <label className="planner-field planner-field-full">
                <span>Actual time spent (minutes)</span>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={actualMinutes}
                  onChange={(event) =>
                    setActualMinutes(event.target.value)
                  }
                  placeholder="How long did it take?"
                />
              </label>

              <label className="planner-field planner-field-full">
                <span>Completion note</span>
                <textarea
                  rows={3}
                  value={completionNote}
                  onChange={(event) =>
                    setCompletionNote(event.target.value)
                  }
                  placeholder="What did you accomplish? Any important details?"
                />
              </label>

              <footer className="planner-modal-footer">
                <button
                  className="planner-button planner-button-secondary"
                  type="button"
                  onClick={() => setCompletionTask(null)}
                >
                  Cancel
                </button>
                <button
                  className="planner-button planner-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  <CheckCircle2 size={16} /> Mark complete
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {routineModalOpen && (
        <div
          className="planner-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRoutineModalOpen(false);
            }
          }}
        >
          <section
            className="planner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-routine-modal-title"
          >
            <header className="planner-modal-header">
              <div>
                <span className="planner-section-label">
                  DESIGN YOUR RHYTHM
                </span>
                <h3 id="planner-routine-modal-title">Create a routine</h3>
                <p className="planner-modal-subtitle">
                  Build a repeatable habit into your operating system.
                </p>
              </div>
              <button
                type="button"
                className="planner-square-button"
                onClick={() => setRoutineModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            <form className="planner-form" onSubmit={createRoutine}>
              <label className="planner-field planner-field-full">
                <span>Routine title *</span>
                <input
                  required
                  value={routineForm.title}
                  onChange={(event) =>
                    setRoutineForm({
                      ...routineForm,
                      title: event.target.value,
                    })
                  }
                  placeholder="e.g. Review business performance"
                />
              </label>

              <label className="planner-field planner-field-full">
                <span>Description</span>
                <textarea
                  rows={2}
                  value={routineForm.description}
                  onChange={(event) =>
                    setRoutineForm({
                      ...routineForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="What does this routine involve?"
                />
              </label>

              <div className="planner-form-grid">
                <label className="planner-field">
                  <span>Repeat</span>
                  <select
                    value={routineForm.recurrence_type}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        recurrence_type: event.target.value,
                      })
                    }
                  >
                    <option value="daily">Every day</option>
                    <option value="weekly">Selected weekdays</option>
                  </select>
                </label>

                <label className="planner-field">
                  <span>Time</span>
                  <input
                    type="time"
                    value={routineForm.time_of_day}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        time_of_day: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Duration (minutes)</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={routineForm.duration_minutes}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        duration_minutes: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Priority</span>
                  <select
                    value={routineForm.priority}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        priority: event.target.value as Priority,
                      })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority[0].toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Business venture</span>
                  <select
                    value={routineForm.venture_id}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        venture_id: event.target.value,
                        project_id: "",
                      })
                    }
                  >
                    <option value="">No venture linked</option>
                    {ventures.map((venture) => (
                      <option key={venture.id} value={venture.id}>
                        {venture.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Project</span>
                  <select
                    value={routineForm.project_id}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        project_id: event.target.value,
                      })
                    }
                  >
                    <option value="">No project linked</option>
                    {projects
                      .filter(
                        (project) =>
                          !routineForm.venture_id ||
                          project.venture_id === routineForm.venture_id,
                      )
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Active from</span>
                  <input
                    required
                    type="date"
                    value={routineForm.active_from}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        active_from: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="planner-field">
                  <span>Active until (optional)</span>
                  <input
                    type="date"
                    value={routineForm.active_until}
                    min={routineForm.active_from}
                    onChange={(event) =>
                      setRoutineForm({
                        ...routineForm,
                        active_until: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              {routineForm.recurrence_type === "weekly" && (
                <fieldset className="planner-weekday-field">
                  <legend>Repeat on</legend>
                  <div className="planner-weekday-options">
                    {WEEKDAYS.map((day) => (
                      <button
                        type="button"
                        key={day.value}
                        className={
                          routineForm.weekdays.includes(day.value)
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setRoutineForm({
                            ...routineForm,
                            weekdays: routineForm.weekdays.includes(
                              day.value,
                            )
                              ? routineForm.weekdays.filter(
                                  (value) => value !== day.value,
                                )
                              : [...routineForm.weekdays, day.value],
                          })
                        }
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {error && <p className="planner-form-error">{error}</p>}

              <footer className="planner-modal-footer">
                <button
                  className="planner-button planner-button-secondary"
                  type="button"
                  onClick={() => setRoutineModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="planner-button planner-button-primary"
                  type="submit"
                  disabled={
                    saving ||
                    (routineForm.recurrence_type === "weekly" &&
                      routineForm.weekdays.length === 0)
                  }
                >
                  {saving ? (
                    <LoaderCircle
                      size={15}
                      className="planner-spinning"
                    />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Create routine
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
