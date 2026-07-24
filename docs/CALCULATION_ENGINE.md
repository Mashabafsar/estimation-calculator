# Calculation Engine

Source of truth: `API - Cost Calculator 1.xlsx` + `api_cost_calculator.html`.

Implemented in `apps/api/src/calculation/engine.ts`.

## Preserved formulas

```
labourRevenue     = Σ(hours × billRate)
labourCost        = Σ(hours × costRate)
feeBase           = negotiatedFee || labourRevenue
salesCommission   = feeBase × commissionRate
cogs              = feeBase × cogsRate
directCosts       = labourCost + salesCommission + cogs + expenses
engagementFee     = feeBase
directMargin      = engagementFee − directCosts
marginPct         = directMargin / engagementFee × 100
targetMargin      = engagementFee × targetMarginPct   (default 50%)
excessDeficit     = directMargin − targetMargin
marketRate        = 150×onshoreWeight + 35×offshoreWeight
apiRate           = labourRevenue / totalHours
recommendedPrice  = directCosts / (1 − targetMarginPct)
```

Commission/COGS rates come from the **service template** when present; otherwise global settings.

Payment terms bands (from Excel):

| Fee band | Warranty days | Terms |
|----------|---------------|-------|
| < $4k | 7 | Net 3 Days |
| $4k–$10k | 15 | Net 7 Days |
| $11k–$30k | 30 | Net 7 Days |
| > $30k | 45 | Net 14 Days |

## Additional metrics

Development/operating cost, gross/net profit & margin, break-even, markup, discount %, weighted hourly rates, risk/contingency buffers, infrastructure/support/warranty/maintenance, cash-flow projection, ROI, margin health (Green ≥50%, Yellow 40–50%, Red <40%), and recommendations.

## Tests

```bash
npm run test -w @estimation/api
```
