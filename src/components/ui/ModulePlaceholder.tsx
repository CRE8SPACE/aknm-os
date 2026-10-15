
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

type ModulePlaceholderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  capabilities: string[];
};

export default function ModulePlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  capabilities,
}: ModulePlaceholderProps) {
  return (
    <div className="module-placeholder">
      <Link href="/" className="module-back-link">
        <ArrowLeft size={15} />
        Command Centre
      </Link>

      <section className="module-placeholder-card">
        <div className="module-placeholder-icon">
          <Icon size={25} />
        </div>

        <div className="module-placeholder-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p className="module-placeholder-description">{description}</p>

        <div className="module-placeholder-divider" />

        <h3>Planned capabilities</h3>
        <ul>
          {capabilities.map((capability) => (
            <li key={capability}>
              <span>{capability}</span>
              <ArrowRight size={15} />
            </li>
          ))}
        </ul>

        <div className="module-placeholder-notice">
          This module is part of the implementation roadmap. Its database
          operations and interactive features will be built in a later stage.
        </div>
      </section>
    </div>
  );
}
