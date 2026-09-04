# SchoolLint

SchoolLint audits the public information surface of a school. It crawls public
web pages and PDFs, extracts dated and numeric claims, retrieves likely
conflicts, and asks a local language model to reject false matches. Every
surviving finding retains the source URLs and remains a candidate until a human
confirms it.

The first objective is a falsifiable one: produce useful, correctly cited
audit reports for real schools before building integrations or charging them.

## Run it

Requirement: Node.js 20+. Local AI review is optional and uses Ollama with
`llama3.2:3b` by default, or another model named in `OLLAMA_MODEL`.

```bash
npm install
npm run audit -- --url https://www.blair.edu/ --name "Blair Academy" --slug blair-academy --pages 35
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The audit writes a versioned
JSON report to `public/reports/<slug>.json`; the interface never manufactures a
finding when the evidence threshold returns none.

The default audit is deterministic and does not load a local model. Add `--ai`
to review high-overlap factual claim pairs with Ollama. AI candidates still
require two sources, at least 90% confidence, and human confirmation.

The first public case study is documented in [CASE_STUDY.md](./CASE_STUDY.md).
To request a free pilot audit, [open an audit request](https://github.com/WINSTON672/schoollint/issues/new?title=Audit%20request%3A%20School%20name&body=School%20website%3A%0AWhat%20should%20be%20checked%3A%0A).

## Guardrails

- Public sources only; `robots.txt` is respected.
- A descriptive user agent identifies the crawler.
- Crawling is rate-limited and same-origin.
- Local Ollama review is the default; source text is not sent to a cloud model.
- AI findings require two source excerpts and a confidence threshold.
- Findings are allegations only after a human confirms them.

## Commercial test

1. Audit 20 independent schools from their public information.
2. Manually review every candidate and measure precision.
3. Send five schools a free evidence report.
4. Continue only if a communications or admissions team requests monitoring.

This repository is an independent prototype and is not affiliated with any
school appearing in a report.
