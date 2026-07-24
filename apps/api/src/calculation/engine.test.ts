import { calculateEstimate, DEFAULT_CALC_SETTINGS } from './engine.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('calculateEstimate (Excel/HTML parity)', () => {
  it('computes labour, commission, COGS, margin for negotiated fee', () => {
    const result = calculateEstimate({
      resources: [
        {
          roleName: 'Code Development',
          location: 'OFFSHORE',
          hours: 100,
          hourlyCost: 8,
          hourlyBilling: 45,
        },
      ],
      expenses: [{ category: 'SUBCONTRACTOR', name: 'Sub', amount: 35000 }],
      negotiatedPrice: 100000,
      settings: {
        ...DEFAULT_CALC_SETTINGS,
        commissionRate: 0.04,
        cogsRate: 0.036,
        riskPct: 0,
        contingencyPct: 0,
        infrastructurePct: 0,
        overheadPct: 0,
        supportPct: 0,
        warrantyPct: 0,
        maintenancePct: 0,
      },
      paymentTerms: [
        { label: 'Projects < $4k', minAmount: 0, maxAmount: 3999.99, warrantyDays: 7, terms: 'Net 3 Days' },
        { label: 'Projects $4k–$10k', minAmount: 4000, maxAmount: 10999.99, warrantyDays: 15, terms: 'Net 7 Days' },
        { label: 'Projects $11k–$30k', minAmount: 11000, maxAmount: 29999.99, warrantyDays: 30, terms: 'Net 7 Days' },
        { label: 'Projects > $30k', minAmount: 30000, maxAmount: null, warrantyDays: 45, terms: 'Net 14 Days' },
      ],
    });

    assert.equal(result.labourRevenue, 4500);
    assert.equal(result.labourCost, 800);
    assert.equal(result.salesCommission, 4000);
    assert.equal(result.cogs, 3600);
    assert.equal(result.engagementFee, 100000);
    assert.equal(result.directCosts, 800 + 4000 + 3600 + 35000);
    assert.equal(result.paymentTerms, 'Net 14 Days');
    assert.equal(result.marginHealth, 'GREEN');
  });

  it('falls back to labour revenue when no negotiated fee', () => {
    const result = calculateEstimate({
      resources: [
        {
          roleName: 'Code Development',
          location: 'OFFSHORE',
          hours: 10,
          hourlyCost: 8,
          hourlyBilling: 45,
        },
      ],
      expenses: [],
      negotiatedPrice: null,
      settings: {
        ...DEFAULT_CALC_SETTINGS,
        commissionRate: 0.04,
        cogsRate: 0.036,
        riskPct: 0,
        contingencyPct: 0,
        infrastructurePct: 0,
        overheadPct: 0,
        supportPct: 0,
        warrantyPct: 0,
        maintenancePct: 0,
      },
      paymentTerms: [
        { label: 'Projects < $4k', minAmount: 0, maxAmount: 3999.99, warrantyDays: 7, terms: 'Net 3 Days' },
      ],
    });

    assert.equal(result.engagementFee, 450);
    assert.equal(result.salesCommission, 18);
    assert.equal(result.cogs, 16.2);
  });
});
