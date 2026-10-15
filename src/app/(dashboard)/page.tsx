
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import OverviewCards from "@/components/dashboard/OverviewCards";
import { useDashboardSearch } from "@/components/layout/DashboardSearchContext";
import "./command-centre.css";

const agenda = [
  {
    time: "10:00 AM",
    end: "1:00 PM",
    title: "CREVA & BICEN OS",
    description: "Service growth, customer orders and operations",
    tag: "VENTURE",
    color: "green",
  },
  {
    time: "2:00 PM",
    end: "4:30 PM",
    title: "AKNM.PRO Studio",
    description: "Create, publish and distribute creative work",
    tag: "PERSONAL BRAND",
    color: "purple",
  },
  {
    time: "5:00 PM",
    end: "7:00 PM",
    title: "Audience development",
    description: "Distribution, engagement and collaboration",
    tag: "GROWTH",
    color: "blue",
  },
  {
    time: "8:00 PM",
    end: "10:30 PM",
    title: "AKSTEP Properties",
    description: "Property inventory, marketing and lead follow-up",
    tag: "VENTURE",
    color: "orange",
  },
];

const priorities = [
  {
    id: "catalogue",
    title: "Expand the CREVA service catalogue",
    description: "Identify gaps and prepare the next services to publish.",
  },
  {
    id: "content",
    title: "Publish one piece of AKNM content",
    description: "Move a prepared creative work from draft to published.",
  },
  {
    id: "properties",
    title: "Advance AKSTEP property inventory",
    description: "Prepare a verified listing or follow up on a qualified lead.",
  },
];

function getLocalDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function CommandCentrePage() {
  const { searchQuery } = useDashboardSearch();
  const [completed, setCompleted] = useState<string[]>([]);
  const [today, setToday] = useState("");

useEffect(() => {
  setToday(getLocalDate());
}, []);

  const filteredAgenda = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return agenda;

    return agenda.filter((item) =>
      [
        item.time,
        item.end,
        item.title,
        item.description,
        item.tag,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery]);

  const completedCount = completed.length;

  function togglePriority(id: string) {
    setCompleted((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  return (
    <div className="command-centre-page">
      <section className="command-welcome">
        <div className="welcome-copy">
          <div className="welcome-date">{today || "Your daily briefing"}</div>
          <h2>
            Build with purpose,
            <br />
            <span>execute with discipline.</span>
          </h2>
          <p>
            Your ambition deserves a system. Focus on the work that moves
            your ventures forward.
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
        <span className="preview-label">INITIAL PREVIEW DATA</span>
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
              <p>Your proposed daily operating rhythm</p>
            </div>
            <Link href="/planner" className="panel-text-link">
              Planner <ArrowRight size={15} />
            </Link>
          </div>

          <div className="agenda-list">
            {filteredAgenda.length > 0 ? (
              filteredAgenda.map((item) => (
                <article className="agenda-item" key={item.title}>
                  <div className="agenda-time">
                    <span>{item.time}</span>
                    <span>{item.end}</span>
                  </div>

                  <div className={`agenda-marker marker-${item.color}`}>
                    <span />
                  </div>

                  <div className="agenda-item-content">
                    <div className="agenda-item-title-row">
                      <h4>{item.title}</h4>
                      <span className={`agenda-tag tag-${item.color}`}>
                        {item.tag}
                      </span>
                    </div>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="agenda-empty">
                <SearchIcon />
                <strong>No matching agenda items</strong>
                <p>Try a different search term.</p>
              </div>
            )}
          </div>

          <div className="agenda-footer">
            <Clock3 size={15} />
            <span>
              This is your proposed template. Live scheduling and recurring
              tasks will be connected in the Planner implementation.
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
              <p>Three outcomes worth pursuing</p>
            </div>
          </div>

          <div className="priority-progress">
            <div className="priority-progress-label">
              <span>Progress</span>
              <strong>
                {completedCount} of {priorities.length}
              </strong>
            </div>
            <div
              className="priority-progress-track"
              role="progressbar"
              aria-label="Today's focus completion"
              aria-valuemin={0}
              aria-valuemax={priorities.length}
              aria-valuenow={completedCount}
            >
              <span
                style={{
                  width: `${(completedCount / priorities.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="priority-list">
            {priorities.map((priority) => {
              const isComplete = completed.includes(priority.id);

              return (
                <button
                  type="button"
                  className={`priority-item ${
                    isComplete ? "is-complete" : ""
                  }`}
                  key={priority.id}
                  onClick={() => togglePriority(priority.id)}
                  aria-pressed={isComplete}
                >
                  <span className="priority-check">
                    {isComplete ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Circle size={20} />
                    )}
                  </span>

                  <span className="priority-copy">
                    <strong>{priority.title}</strong>
                    <span>{priority.description}</span>
                  </span>
                </button>
              );
            })}
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
              <small>Capture your next action</small>
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

function SearchIcon() {
  return <Circle size={24} />;
}
