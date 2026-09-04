# Blair Academy: first evidence pass

On September 4, 2026, SchoolLint audited 20 public Blair Academy pages, compared
six candidate claim pairs, and checked 80 internal links. It produced one
reviewable finding: a link on Blair's “Why Blair” page returned a reproducible
HTTP 404.

## What the first run got wrong

The first prototype treated rate limits and model commentary as evidence. That
created 62 noisy findings and a meaningless score of zero. None were shipped.

The audit was changed to report only reproducible HTTP 404 or 410 responses,
require an explicit high-confidence model conflict, reject self-negating model
answers, and stop manufacturing “missing year” findings for normal evergreen
admission copy. Regression tests cover those boundaries.

## Result

- 20 public pages read
- 80 internal links checked
- 6 factual claim pairs reviewed locally
- 1 reproducible broken route retained
- 0 unsupported contradictions published
- Source-health score: 94/100

The report is stored at
[`public/reports/blair-academy.json`](./public/reports/blair-academy.json). This
is a prototype audit, not an allegation of negligence, and it is not affiliated
with Blair Academy.
