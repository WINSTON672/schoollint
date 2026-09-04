import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runAudit } from "../lib/auditor";

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const startUrl = arg("url");
if (!startUrl) {
  console.error("Usage: npm run audit -- --url https://school.edu --name \"School\" --slug school-name [--pages 35] [--ai]");
  process.exit(1);
}

const parsed = new URL(startUrl);
const slug = arg("slug", parsed.hostname.replace(/^www\./, "").replace(/\W+/g, "-"))!;
const organization = arg("name", parsed.hostname.replace(/^www\./, ""))!;
const maxPages = Number(arg("pages", "35"));
const useAi = process.argv.includes("--ai");

const report = await runAudit({
  startUrl,
  slug,
  organization,
  maxPages,
  useAi,
  onProgress: (message) => console.log(message),
});

const outputDirectory = resolve(process.cwd(), "public", "reports");
await mkdir(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, `${slug}.json`);
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${output}`);
console.log(`${report.stats.findings} findings · score ${report.score}/100`);
