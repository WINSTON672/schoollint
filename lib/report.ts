export type Evidence = {
  url: string;
  pageTitle: string;
  excerpt: string;
};

export type FindingKind =
  | "contradiction"
  | "stale-date"
  | "broken-link"
  | "missing-context";

export type Finding = {
  id: string;
  kind: FindingKind;
  severity: "high" | "medium" | "low";
  confidence: number;
  title: string;
  explanation: string;
  evidence: Evidence[];
  status: "needs-review" | "confirmed" | "dismissed";
};

export type AuditReport = {
  schemaVersion: 1;
  slug: string;
  organization: string;
  startUrl: string;
  generatedAt: string;
  engine: string;
  score: number;
  stats: {
    pagesScanned: number;
    documentsScanned: number;
    linksChecked: number;
    claimsCompared: number;
    findings: number;
  };
  findings: Finding[];
  pages: Array<{
    url: string;
    title: string;
    fetchedAt: string;
    status: number;
  }>;
};
