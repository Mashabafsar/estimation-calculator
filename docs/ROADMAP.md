# Implementation Roadmap

## Milestone 1 — Foundation (done)
- Monorepo, Docker Postgres on 5433
- Prisma schema + seed data (roles, templates, settings, payment terms, sample estimates)
- Calculation engine ported from Excel/HTML + unit tests
- JWT auth + RBAC middleware
- Core REST APIs

## Milestone 2 — Core product UI (done)
- Dashboard with Recharts
- Estimates list/create/detail
- Clients, templates, settings screens
- Dark/light theme
- CSV export + approval transitions

## Milestone 3 — Proposal polish
- PDF / printable proposal summary
- Excel export (xlsx)
- Rich scenario comparison matrix
- Inline role rate editing from Settings
- Email notification hooks on approval

## Milestone 4 — Delivery ops
- Resource utilization vs capacity calendar
- Won/lost analytics by industry & template
- Multi-currency FX conversion using settings exchange rate
- Audit log viewer for Admin

## Milestone 5 — AI (design only today)
- Effort estimation from requirements text → `AiSuggestion`
- Role/hour recommendations from historical estimates
- Margin optimization suggestions
- Proposal narrative generation

Architecture already includes `AiSuggestion` and versioned estimate snapshots to avoid major refactors.
