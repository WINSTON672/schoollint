import * as cheerio from "cheerio";
import pLimit from "p-limit";
import robotsParser from "robots-parser";
import { createHash } from "node:crypto";
import type { AuditReport, Evidence, Finding } from "./report";

const USER_AGENT = "SchoolLintAudit/0.1 (+https://github.com/WINSTON672/schoollint)";
const MONTH = "January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Sept\\.?|Oct\\.?|Nov\\.?|Dec\\.?";
const DATE_RE = new RegExp(`\\b(?:${MONTH})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+20\\d{2})?`, "gi");
const TIME_RE = /\b(?:1[0-2]|0?[1-9]):[0-5]\d\s?(?:a\.?m\.?|p\.?m\.?)\b/gi;
const MONEY_RE = /(?:\$|USD\s?)\d[\d,]*(?:\.\d{2})?/gi;
const YEAR_RE = /\b20\d{2}(?:[–—-]\d{2,4})?\b/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?%?\b/g;
const FACT_TOPIC_RE = /\b(?:admission|application|apply|deadline|tuition|fee|deposit|financial aid|boarding|curfew|class|term|semester|school year|visit|tour|registration|enroll|office|phone|contact|email|graduation|commencement|orientation|return|arrival|break)\b/i;

type Page = {
  url: string;
  title: string;
  text: string;
  sentences: string[];
  links: string[];
  status: number;
  contentType: string;
  fetchedAt: string;
};

type Candidate = {
  a: { sentence: string; page: Page };
  b: { sentence: string; page: Page };
  rank: number;
};

export type AuditOptions = {
  startUrl: string;
  organization: string;
  slug: string;
  maxPages?: number;
  useAi?: boolean;
  onProgress?: (message: string) => void;
};

const stopwords = new Set(
  "a an and are as at be by for from has have in into is it its of on or our that the their this to was were will with you your more about than can students school academy page information".split(" "),
);

function canonical(raw: string, base?: string) {
  try {
    const url = new URL(raw, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    if ([...url.searchParams.keys()].length === 0) url.search = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
}

function isCrawlable(url: string, host: string) {
  const parsed = new URL(url);
  if (parsed.host !== host) return false;
  if (/\.(?:jpe?g|png|gif|webp|svg|ico|mp4|mp3|zip|docx?|xlsx?|pptx?|css|js|xml)$/i.test(parsed.pathname)) return false;
  return !/(?:\/login|\/signin|\/search|\/calendar\/day|\/calendar\/month)/i.test(parsed.pathname);
}

function cleanText(input: string) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentenceList(text: string) {
  const chunks = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter((sentence) => sentence.length >= 32 && sentence.length <= 700);
  return [...new Set(chunks)].slice(0, 500);
}

async function pdfText(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= Math.min(document.numPages, 160); number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return cleanText(pages.join("\n"));
}

async function fetchPage(url: string): Promise<Page> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf;q=0.9,*/*;q=0.2" },
    redirect: "follow",
    signal: AbortSignal.timeout(18_000),
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const fetchedAt = new Date().toISOString();
  if (!response.ok) {
    return { url, title: new URL(url).pathname, text: "", sentences: [], links: [], status: response.status, contentType, fetchedAt };
  }
  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    const text = await pdfText(await response.arrayBuffer());
    return { url, title: new URL(url).pathname.split("/").pop() || "PDF document", text, sentences: sentenceList(text), links: [], status: response.status, contentType: "application/pdf", fetchedAt };
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,template,iframe,form,nav,footer").remove();
  const title = cleanText($("title").first().text()) || cleanText($("h1").first().text()) || new URL(url).pathname;
  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const text = cleanText(root.text().replace(/\s*\n\s*/g, "\n"));
  const links = [...new Set(
    $("a[href]")
      .map((_, element) => canonical($(element).attr("href") || "", url))
      .get()
      .filter((href): href is string => Boolean(href)),
  )];
  return { url, title, text, sentences: sentenceList(text), links, status: response.status, contentType, fetchedAt };
}

function words(sentence: string) {
  return new Set(
    (sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])
      .filter((word) => !stopwords.has(word)),
  );
}

function values(sentence: string) {
  return [...new Set([
    ...(sentence.match(DATE_RE) ?? []),
    ...(sentence.match(TIME_RE) ?? []),
    ...(sentence.match(MONEY_RE) ?? []),
    ...(sentence.match(YEAR_RE) ?? []),
    ...(sentence.match(NUMBER_RE) ?? []),
  ].map((value) => value.toLowerCase()))];
}

function overlap(a: Set<string>, b: Set<string>) {
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection || 1;
  return { intersection, jaccard: intersection / union };
}

function candidatesFor(pages: Page[]) {
  const claims = pages.flatMap((page) => page.sentences
    .filter((sentence) => FACT_TOPIC_RE.test(sentence) && values(sentence).length)
    .map((sentence) => ({ sentence, page, words: words(sentence), values: values(sentence) })));
  const candidates: Candidate[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.page.url === b.page.url) continue;
      if (a.values.join("|") === b.values.join("|")) continue;
      const match = overlap(a.words, b.words);
      if (match.intersection < 2 || match.jaccard < 0.12) continue;
      const topicBoost = FACT_TOPIC_RE.test(a.sentence) && FACT_TOPIC_RE.test(b.sentence) ? .15 : 0;
      candidates.push({ a, b, rank: match.jaccard + topicBoost });
    }
  }
  return candidates.sort((a, b) => b.rank - a.rank).slice(0, 90);
}

function evidence(page: Page, excerpt: string): Evidence {
  return { url: page.url, pageTitle: page.title, excerpt };
}

function findingId(kind: string, ...parts: string[]) {
  return createHash("sha1").update([kind, ...parts].join("|")).digest("hex").slice(0, 10);
}

async function reviewWithOllama(candidates: Candidate[], onProgress: (message: string) => void) {
  const endpoint = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
  const findings: Finding[] = [];
  for (let offset = 0; offset < candidates.length; offset += 12) {
    const batch = candidates.slice(offset, offset + 12);
    onProgress(`AI review ${Math.min(offset + batch.length, candidates.length)}/${candidates.length}`);
    const pairs = batch.map((candidate, index) => ({
      pairIndex: index,
      sourceA: { url: candidate.a.page.url, text: candidate.a.sentence },
      sourceB: { url: candidate.b.page.url, text: candidate.b.sentence },
    }));
    const prompt = `You are a meticulous public-information auditor. Review the candidate pairs below.
Return a JSON object with a single key "findings". Include only genuine conflicts where both passages discuss the same subject and cannot both be current. Different years, audiences, programs, hypothetical examples, historical facts, and compatible details are NOT conflicts. Prefer returning nothing to making a false accusation.
Each finding must contain: pairIndex, isConflict (true), title (plain factual question), explanation, severity (high|medium|low), confidence (0 to 1).
Candidates:\n${JSON.stringify(pairs)}`;
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          options: { temperature: 0.05, num_ctx: 8192 },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
      const payload = await response.json() as { message?: { content?: string } };
      const parsed = JSON.parse(payload.message?.content ?? "{}") as {
        findings?: Array<{ pairIndex?: number; isConflict?: boolean; title?: string; explanation?: string; severity?: string; confidence?: number }>;
      };
      for (const item of parsed.findings ?? []) {
        const candidate = batch[item.pairIndex ?? -1];
        if (!candidate || !passesAiFindingGuard(item)) continue;
        const severity = ["high", "medium", "low"].includes(item.severity ?? "")
          ? item.severity as Finding["severity"] : "medium";
        findings.push({
          id: findingId("contradiction", candidate.a.sentence, candidate.b.sentence),
          kind: "contradiction",
          severity,
          confidence: Math.min(1, Math.max(0, item.confidence ?? .90)),
          title: item.title?.trim() || "Which published detail is current?",
          explanation: item.explanation?.trim() || "Two public sources appear to disagree.",
          evidence: [evidence(candidate.a.page, candidate.a.sentence), evidence(candidate.b.page, candidate.b.sentence)],
          status: "needs-review",
        });
      }
    } catch (error) {
      onProgress(`AI review unavailable: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }
  return { findings, model };
}

export function passesAiFindingGuard(item: {
  isConflict?: boolean;
  confidence?: number;
  title?: string;
  explanation?: string;
}) {
  if (item.isConflict !== true || (item.confidence ?? 0) < .90) return false;
  const language = `${item.title ?? ""} ${item.explanation ?? ""}`.toLowerCase();
  return !/\b(?:no|not)\s+(?:a\s+)?(?:genuine\s+)?conflict\b|\bcompatible\b|\bdifferent (?:years?|programs?|audiences?|topics?)\b/.test(language);
}

export function reportableBrokenStatus(status: number) {
  // Auth walls, throttling and server errors say nothing about whether a link
  // is published incorrectly. Only definitive absence is reportable.
  return status === 404 || status === 410;
}

async function checkLinks(sourcePages: Page[], crawledPages: Page[], host: string, onProgress: (message: string) => void) {
  const pageStatus = new Map(crawledPages.map((page) => [page.url, page.status]));
  const links = [...new Set(sourcePages.flatMap((page) => page.links))]
    .filter((url) => new URL(url).host === host)
    .slice(0, 80);
  const limit = pLimit(2);
  let checked = 0;
  const results: Array<Finding | null> = await Promise.all(links.map((url) => limit(async (): Promise<Finding | null> => {
    try {
      let status = pageStatus.get(url);
      if (status === undefined) {
        let response = await fetch(url, {
          method: "HEAD",
          headers: { "user-agent": USER_AGENT },
          redirect: "follow",
          signal: AbortSignal.timeout(10_000),
        });
        // A surprising number of CMS routes reject HEAD even though the page
        // is healthy. Verify every apparent absence with a small GET before
        // accusing the publisher.
        if ([403, 405, 404, 410].includes(response.status)) {
          response = await fetch(url, {
            method: "GET",
            headers: { "user-agent": USER_AGENT, range: "bytes=0-2048" },
            redirect: "follow",
            signal: AbortSignal.timeout(10_000),
          });
        }
        status = response.status;
        await new Promise((resolve) => setTimeout(resolve, 140));
      }
      checked++;
      if (checked % 10 === 0) onProgress(`Checked ${checked}/${links.length} linked pages`);
      if (!reportableBrokenStatus(status)) return null;
      const source = sourcePages.find((page) => page.links.includes(url));
      if (!source) return null;
      return {
        id: findingId("broken-link", url),
        kind: "broken-link" as const,
        severity: "medium" as const,
        confidence: .99,
        title: `Linked page returns ${status}`,
        explanation: "A visitor following this internal link does not reach a working page.",
        evidence: [evidence(source, url)],
        status: "needs-review" as const,
      } satisfies Finding;
    } catch {
      checked++;
      return null;
    }
  })));
  const findings = results.filter((finding): finding is Finding => finding !== null);
  return { findings, checked };
}

export async function runAudit(options: AuditOptions): Promise<AuditReport> {
  const startUrl = canonical(options.startUrl);
  if (!startUrl) throw new Error("The audit target must be an http(s) URL.");
  const origin = new URL(startUrl).origin;
  const host = new URL(startUrl).host;
  const maxPages = Math.min(120, Math.max(3, options.maxPages ?? 35));
  const onProgress = options.onProgress ?? (() => undefined);

  let robots = robotsParser(`${origin}/robots.txt`, "");
  try {
    const response = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(8_000) });
    if (response.ok) robots = robotsParser(`${origin}/robots.txt`, await response.text());
  } catch {
    // An absent robots file means normal public crawling rules apply.
  }

  const queue = [startUrl];
  const queued = new Set(queue);
  const pages: Page[] = [];
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (!robots.isAllowed(url, USER_AGENT)) continue;
    onProgress(`Reading ${pages.length + 1}/${maxPages}: ${new URL(url).pathname || "/"}`);
    try {
      const page = await fetchPage(url);
      pages.push(page);
      for (const href of page.links) {
        if (queued.has(href) || !isCrawlable(href, host)) continue;
        queued.add(href);
        queue.push(href);
      }
    } catch (error) {
      onProgress(`Skipped ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
  }

  const healthyPages = pages.filter((page) => page.status < 400 && page.sentences.length);
  const candidates = candidatesFor(healthyPages);
  onProgress(`Prepared ${candidates.length} evidence pairs`);
  const ai = options.useAi === false
    ? { findings: [] as Finding[], model: "deterministic-only" }
    : await reviewWithOllama(candidates, onProgress);
  const checked = await checkLinks(healthyPages, pages, host, onProgress);
  const severityRank: Record<Finding["severity"], number> = { high: 0, medium: 1, low: 2 };
  const findings = [...ai.findings, ...checked.findings]
    .filter((finding, index, all) => all.findIndex((item) => item.id === finding.id) === index)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const penalty = findings.reduce((sum, finding) => sum + ({ high: 12, medium: 6, low: 2 }[finding.severity]), 0);

  return {
    schemaVersion: 1,
    slug: options.slug,
    organization: options.organization,
    startUrl,
    generatedAt: new Date().toISOString(),
    engine: options.useAi === false ? "Deterministic evidence pass" : `${ai.model} · local review`,
    score: Math.max(0, 100 - penalty),
    stats: {
      pagesScanned: pages.filter((page) => !page.contentType.includes("pdf")).length,
      documentsScanned: pages.filter((page) => page.contentType.includes("pdf")).length,
      linksChecked: checked.checked,
      claimsCompared: candidates.length,
      findings: findings.length,
    },
    findings,
    pages: pages.map(({ url, title, fetchedAt, status }) => ({ url, title, fetchedAt, status })),
  };
}
