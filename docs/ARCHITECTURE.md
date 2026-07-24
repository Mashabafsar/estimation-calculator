# Backend & Frontend Architecture

## Monorepo

```
project-estimation/
├── apps/api          Express + Prisma API
├── apps/web          React + Vite SPA
├── docs/             Specs & diagrams
├── docker-compose.yml
└── package.json      npm workspaces
```

## Backend layers

```
Request → Routes (Zod DTOs) → Controllers/handlers → Services → Prisma repositories → PostgreSQL
                                      ↓
                            Calculation Engine (pure functions)
```

- **Routes** — auth, validation, RBAC middleware
- **Services** — business logic (estimates, settings, dashboard)
- **Calculation engine** — pure, testable, no I/O
- **Prisma** — persistence; `EstimateCalculation` stores result snapshots

## Auth flow

1. `POST /api/auth/login` → bcrypt verify → JWT (`id`, `email`, `role`)
2. Client stores token in `localStorage`
3. `Authorization: Bearer <token>` on subsequent calls
4. `authenticate` + `authorize(roles)` + `requireWrite` middleware

### Roles

| Role | Capabilities |
|------|----------------|
| ADMIN | Full access |
| FINANCE | Settings, rates, deals |
| SOLUTION_ARCHITECT | Templates, estimates |
| SALES | Clients, estimates, deals |
| DELIVERY_MANAGER | Estimates, deals |
| READ_ONLY | View only |

## Frontend architecture

```
App
├── AuthProvider / ThemeProvider
├── AppLayout (sidebar nav)
└── Pages
    ├── Dashboard (Recharts)
    ├── Estimates list (TanStack Table)
    ├── Estimate form (React Hook Form → preview API)
    ├── Estimate detail (workflow + versions)
    ├── Clients / Templates / Settings
```

Calculations are **never** recomputed in the browser for persistence — only displayed from API responses.

## Future AI extensibility

- `AiSuggestion` table ready for effort estimation, role recommendations, margin optimization
- Estimate versions + historical projects provide training corpus later
- Keep engine pure so AI can propose inputs without changing formula code
