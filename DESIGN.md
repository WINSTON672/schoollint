# Product and interface direction

SchoolLint is an evidence-review instrument for school communications teams.
Its primary job is to make a possible contradiction fast to understand and
safe to judge, without presenting a model's opinion as fact.

## Tokens

- Evidence paper — `#FFFFFF`
- Cool workspace — `#F3F6F8`
- Archive ink — `#112E40`
- Source blue — `#156486`
- Unresolved amber — `#A8610E`
- Confirmed conflict red — `#943B35`

The interface uses Avenir Next where available for a precise civic character,
with a restrained book face only inside quoted source evidence. Blue always
means provenance or navigation. Amber and red are reserved for review state.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ SchoolLint                                  Audit  Method     │
├──────────────────────────────────────────────────────────────┤
│ PUBLIC INFORMATION,                                        │
│ CROSS-CHECKED.                              evidence rules    │
├──────────────────────────────────────────────────────────────┤
│ organisation       checked                     score          │
├──────────────────┬───────────────────────────────────────────┤
│ review queue     │ question under review                      │
│ finding          │ ┌──────── source A ────────┐              │
│ finding          │ │ excerpt                  │ ≠ source B    │
│ finding          │ └──────────────────────────┘              │
│                  │                         reviewer decision  │
└──────────────────┴───────────────────────────────────────────┘
```

Alignment is left-led throughout because auditors scan titles, excerpts and
URLs. The one expressive gesture is the side-by-side evidence trace. The rest
uses straight rules and a small radius only where it communicates control.

## Self-critique

The first direction risked becoming a generic analytics dashboard with four
summary cards. The final structure replaces cards with one continuous evidence
sheet and makes source comparison—not a decorative metric—the visual centre.
It also avoids claiming that a model has found an error: every item begins as a
candidate and exposes its evidence before offering a human decision.
