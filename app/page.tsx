import reportJson from "@/public/reports/blair-academy.json";
import type { AuditReport } from "@/lib/report";
import { AuditWorkbench } from "./ui/audit-workbench";

const report = reportJson as AuditReport;
const auditRequestUrl = "https://github.com/WINSTON672/schoollint/issues/new?title=Audit%20request%3A%20School%20name&body=School%20website%3A%0AWhat%20should%20be%20checked%3A%0A";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="SchoolLint home">
          <span className="mark" aria-hidden="true"><i /><i /><i /></span>
          SchoolLint
        </a>
        <nav aria-label="Primary navigation">
          <a href="#audit">Audit desk</a>
          <a href="#method">Method</a>
          <a href="https://github.com/WINSTON672/schoollint">Source</a>
          <a className="nav-request" href={auditRequestUrl}>Request an audit</a>
        </nav>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <h1>Public information,<br />cross-checked.</h1>
          <p>
            SchoolLint reads a school&apos;s public pages and documents as one body of evidence.
            It finds details that disagree, age badly, or lead visitors nowhere—then shows the
            exact sources so a person can decide what is true.
          </p>
        </div>
        <div className="audit-stamp" aria-label="Audit method summary">
          <strong>Evidence first</strong>
          <span>No private access</span>
          <span>No invented corrections</span>
          <span>Human decision required</span>
          <a className="stamp-action" href={auditRequestUrl}>Request this for a school</a>
        </div>
      </section>

      <section className="workbench-section" id="audit" aria-labelledby="audit-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">First evidence pass</p>
            <h2 id="audit-title">A real school, not sample copy.</h2>
          </div>
          <p>
            Every finding below links back to the public source. Candidate conflicts remain
            unresolved until a reviewer confirms them.
          </p>
        </div>
        <AuditWorkbench initialReport={report} />
      </section>

      <section className="method" id="method" aria-labelledby="method-title">
        <div className="method-title">
          <p className="section-kicker">How the audit works</p>
          <h2 id="method-title">A narrow machine with a visible chain of evidence.</h2>
        </div>
        <ol>
          <li>
            <span>Collect</span>
            <p>Respect robots.txt, stay on the public domain, and preserve each source URL.</p>
          </li>
          <li>
            <span>Compare</span>
            <p>Extract factual claims, retrieve likely matches, and review only the strongest pairs.</p>
          </li>
          <li>
            <span>Decide</span>
            <p>Show both excerpts. A human confirms the issue before anyone calls it an error.</p>
          </li>
        </ol>
        <aside>
          <strong>Why local AI?</strong>
          <p>The first engine runs through Ollama. Public school text stays on the auditor&apos;s machine, and an API bill cannot grow while nobody is watching.</p>
        </aside>
      </section>

      <footer>
        <span>SchoolLint, independent prototype</span>
        <span>Public sources only · {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
