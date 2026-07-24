# API Specification

Base URL: `http://localhost:4001/api`  
Auth: `Authorization: Bearer <jwt>`

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Current user |

## Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | KPIs + chart series |

## Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | All global settings |
| PUT | `/settings` | `{ updates: [{ key, value }] }` |
| GET | `/settings/payment-terms` | Payment term bands |
| GET | `/currencies` | Currencies |
| GET | `/countries` | Countries |

## Roles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles` | Active roles (`?all=true` for inactive) |
| POST | `/roles` | Create role |
| PATCH | `/roles/:id` | Update role |

## Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List with default roles |
| GET | `/templates/:id` | Detail (id or slug) |
| PATCH | `/templates/:id` | Update rates/defaults |

## Clients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clients` | List |
| GET | `/clients/:id` | Detail + estimates |
| POST | `/clients` | Create |
| PATCH | `/clients/:id` | Update |

## Estimates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/estimates` | List (`?status=&clientId=`) |
| GET | `/estimates/:id` | Full detail |
| POST | `/estimates/preview` | Run calculation (no persist) |
| POST | `/estimates` | Create + calculate + version 1 |
| PUT | `/estimates/:id` | Update + recalculate + new version |
| POST | `/estimates/:id/transition` | `{ action: SUBMIT\|APPROVE\|REJECT\|REQUEST_CHANGES\|ARCHIVE }` |
| POST | `/estimates/:id/deal` | `{ outcome: WON\|LOST }` |
| POST | `/estimates/:id/scenarios` | Add scenario comparison |
| GET | `/estimates/:id/export` | `?format=json\|csv` |

## Users (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users |
| POST | `/users` | Create user |

## Health

`GET /health` → `{ ok: true }`
