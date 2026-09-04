"use client";

import { useMemo, useState } from "react";
import type { AuditReport, Finding } from "@/lib/report";

type ReviewStatus = Finding["status"];

const severityLabel = { high: "High", medium: "Medium", low: "Low" } as const;
const kindLabel = {
  contradiction: "Conflicting claims",
  "stale-date": "Possibly stale",
  "broken-link": "Broken route",
  "missing-context": "Missing year",
} as const;

function shortHost(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

export function AuditWorkbench({ initialReport }: { initialReport: AuditReport }) {
  const [statusById, setStatusById] = useState<Record<string, ReviewStatus>>({});
  const [severity, setSeverity] = useState<"all" | Finding["severity"]>("all");
  const findings = useMemo(
    () => initialReport.findings
      .map((finding) => ({ ...finding, status: statusById[finding.id] ?? finding.status }))
      .filter((finding) => severity === "all" || finding.severity === severity),
    [initialReport.findings, severity, statusById],
  );
  const [selectedId, setSelectedId] = useState(initialReport.findings[0]?.id ?? "");
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0];
  const generated = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(initialReport.generatedAt));

  const setStatus = (status: ReviewStatus) => {
    if (!selected) return;
    setStatusById((current) => ({ ...current, [selected.id]: status }));
  };

  return (
    <div className="workbench">
      <div className="report-bar">
        <div>
          <span className="report-label">Organization</span>
          <strong>{initialReport.organization}</strong>
          <a href={initialReport.startUrl} target="_blank" rel="noreferrer">{shortHost(initialReport.startUrl)}</a>
        </div>
        <div>
          <span className="report-label">Checked</span>
          <strong>{generated}</strong>
          <small>{initialReport.engine}</small>
        </div>
        <div className="score-cell">
          <span className="report-label">Source health</span>
          <strong>{initialReport.score}<small>/100</small></strong>
        </div>
      </div>

      <div className="stat-line" aria-label="Audit statistics">
        <span><strong>{initialReport.stats.pagesScanned}</strong> pages</span>
        <span><strong>{initialReport.stats.documentsScanned}</strong> documents</span>
        <span><strong>{initialReport.stats.claimsCompared}</strong> claim pairs</span>
        <span><strong>{initialReport.stats.linksChecked}</strong> links checked</span>
      </div>

      <div className="desk">
        <aside className="finding-list" aria-label="Findings">
          <div className="queue-head">
            <div>
              <span>Review queue</span>
              <strong>{findings.length}</strong>
            </div>
            <label>
              <span className="sr-only">Filter by severity</span>
              <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
                <option value="all">All levels</option>
                <option value="high">High only</option>
                <option value="medium">Medium only</option>
                <option value="low">Low only</option>
              </select>
            </label>
          </div>
          {findings.length ? (
            <ul>
              {findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    className={finding.id === selected?.id ? "selected" : ""}
                    onClick={() => setSelectedId(finding.id)}
                    aria-pressed={finding.id === selected?.id}
                  >
                    <span className={`severity ${finding.severity}`}>{severityLabel[finding.severity]}</span>
                    <strong>{finding.title}</strong>
                    <span className="finding-meta">{kindLabel[finding.kind]} · {Math.round(finding.confidence * 100)}% confidence</span>
                    <span className={`review-state ${finding.status}`}>{finding.status.replace("-", " ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-queue">
              <strong>No findings in this view.</strong>
              <p>The audit does not invent a problem to make the report look busy.</p>
            </div>
          )}
        </aside>

        <article className="evidence-desk" aria-live="polite">
          {selected ? (
            <>
              <header>
                <span className={`severity ${selected.severity}`}>{severityLabel[selected.severity]}</span>
                <p>{kindLabel[selected.kind]}</p>
                <h3>{selected.title}</h3>
                <p className="explanation">{selected.explanation}</p>
              </header>
              <div className={`source-grid ${selected.evidence.length === 1 ? "single" : ""}`}>
                {selected.evidence.map((item, index) => (
                  <figure key={`${selected.id}-${index}`}>
                    <figcaption>
                      <span>Source {String.fromCharCode(65 + index)}</span>
                      <strong>{item.pageTitle}</strong>
                    </figcaption>
                    <blockquote>{item.excerpt}</blockquote>
                    <a href={item.url} target="_blank" rel="noreferrer">Open {shortHost(item.url)}</a>
                  </figure>
                ))}
              </div>
              <div className="decision-bar">
                <div>
                  <span>Reviewer decision</span>
                  <strong>{selected.status.replace("-", " ")}</strong>
                </div>
                <div className="decision-actions">
                  <button onClick={() => setStatus("dismissed")}>Dismiss</button>
                  <button onClick={() => setStatus("needs-review")}>Keep open</button>
                  <button className="confirm" onClick={() => setStatus("confirmed")}>Confirm issue</button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-evidence">
              <span aria-hidden="true">✓</span>
              <h3>No unsupported accusation.</h3>
              <p>The engine found no evidence pair above its review threshold. That is a valid audit result.</p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
