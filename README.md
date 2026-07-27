# Project Estimation & Profitability System

Internal pre-sales estimation platform for software services companies. Migrates the Excel/HTML **API Cost Calculator** formulas into a configurable SaaS product used by Sales, Pre-Sales, Solution Architects, Delivery, and Management.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, TailwindCSS, React Hook Form, TanStack Table, Recharts |
| Backend | Node.js, Express, Prisma, Zod, JWT |
| Database | PostgreSQL (Docker on host port **5434**) |
| Auth | JWT + role-based access |

## Quick start

```bash
# 1. Start Postgres (port 5434 — avoids chatbot on 5432/5433)
docker compose up -d postgres

# 2. Install dependencies
npm install

# 3. Migrate + seed
cp .env.example .env   # if needed
npm run db:generate -w @estimation/api
npm run db:migrate:dev -w @estimation/api -- --name init
npm run db:seed -w @estimation/api

# 4. Run API + Web
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4001/health  
- Demo login: `admin@estimation.local` / `Password123!`

### Other demo users

| Email | Role |
|-------|------|
| admin@estimation.local | ADMIN |
| sales@estimation.local | SALES |
| architect@estimation.local | SOLUTION_ARCHITECT |
| delivery@estimation.local | DELIVERY_MANAGER |
| finance@estimation.local | FINANCE |
| viewer@estimation.local | READ_ONLY |

Password for all: `Password123!`

## Modules

- **Dashboard** — KPIs, revenue pipeline, margin health, resource utilization, charts
- **Estimates** — resource planning, expenses, proposal mode, scenarios, versions, approval workflow, CSV export
- **Clients** — industry, country, currency, ownership
- **Templates** — Web CMS, Retainer, FSD, Digital Marketing + extended catalog
- **Settings** — target margin, taxes, commission, COGS, risk, capacity, roles & rates, payment terms

## Calculation engine

All math runs on the **backend** (`apps/api/src/calculation/engine.ts`), ported from the Excel workbook and `api_cost_calculator.html`. The frontend only displays results.

See [docs/CALCULATION_ENGINE.md](docs/CALCULATION_ENGINE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API specification](docs/API.md)
- [ER diagram](docs/ERD.md)
- [UI wireframes](docs/WIREFRAMES.md)
- [Roadmap](docs/ROADMAP.md)
- [Calculation engine](docs/CALCULATION_ENGINE.md)

## Docker (full stack)

```bash
docker compose up -d --build
```

Postgres: `localhost:5434` · API: `4001` · Web: `5173`
