# ER Diagram

```mermaid
erDiagram
  User ||--o{ Client : "sales/account"
  User ||--o{ Estimate : creates
  User ||--o{ EstimateVersion : authors
  User ||--o{ Approval : acts
  User ||--o{ AuditLog : logs

  Currency ||--o{ Client : prices
  Currency ||--o{ Estimate : prices
  Currency ||--o{ EmployeeRole : rates
  Country ||--o{ Client : located

  EmployeeRole ||--o{ TemplateRole : included
  EmployeeRole ||--o{ EstimateResource : used
  ServiceTemplate ||--o{ TemplateRole : defines
  ServiceTemplate ||--o{ Estimate : applies

  Client ||--o{ Estimate : owns
  Estimate ||--o{ EstimateResource : plans
  Estimate ||--o{ EstimateExpense : costs
  Estimate ||--|| EstimateCalculation : results
  Estimate ||--o{ EstimateScenario : compares
  Estimate ||--o{ EstimateVersion : history
  Estimate ||--o{ Approval : workflow

  GlobalSetting }o--|| GlobalSetting : versioned
  PaymentTerm }o--|| PaymentTerm : bands
  AiSuggestion }o--o| Estimate : future
```

## Core tables

- **users** — JWT principals + RBAC roles
- **employee_roles** — cost/billing rates (configurable)
- **global_settings** — target margin, taxes, capacity, market rates
- **service_templates** / **template_roles** — defaults from Excel services
- **clients** — commercial accounts
- **estimates** — draft → review → approved → won/lost
- **estimate_resources** / **estimate_expenses** — inputs
- **estimate_calculations** — persisted engine output
- **estimate_scenarios** / **estimate_versions** — comparison + audit
- **approvals** / **audit_logs** — workflow + system trail
- **ai_suggestions** — reserved for future AI features
