
import Link from "next/link";
import {
  CheckSquare,
  Wallet,
  BriefcaseBusiness,
  Rocket,
  ArrowUpRight,
} from "lucide-react";

const cards = [
  {
    label: "Tasks completed",
    value: "0 / 0",
    description: "Your daily execution",
    icon: CheckSquare,
    accent: "green",
    href: "/planner",
  },
  {
    label: "Cash position",
    value: "₦0.00",
    description: "Connect your accounts",
    icon: Wallet,
    accent: "blue",
    href: "/finance",
  },
  {
    label: "Active ventures",
    value: "0",
    description: "Your business portfolio",
    icon: BriefcaseBusiness,
    accent: "purple",
    href: "/ventures",
  },
  {
    label: "Active projects",
    value: "0",
    description: "Your execution pipeline",
    icon: Rocket,
    accent: "orange",
    href: "/projects",
  },
];

export default function OverviewCards() {
  return (
    <section className="overview-grid" aria-label="Executive overview">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            href={card.href}
            className={`overview-card accent-${card.accent}`}
            key={card.label}
          >
            <div className="overview-card-top">
              <span className="overview-card-icon">
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <ArrowUpRight size={17} className="overview-card-arrow" />
            </div>

            <div className="overview-card-label">{card.label}</div>
            <div className="overview-card-value">{card.value}</div>
            <div className="overview-card-description">
              {card.description}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
