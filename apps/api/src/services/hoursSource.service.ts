import * as XLSX from 'xlsx';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import type { ResourceLocation } from '@prisma/client';

export interface ParsedDepartmentHours {
  name: string;
  hours: number;
  roleId?: string;
  roleName?: string;
  location?: ResourceLocation;
  hourlyCost?: number;
  hourlyBilling?: number;
  matched: boolean;
}

export interface ParseHoursSourceResult {
  projectTitle: string | null;
  sheetName: string;
  departments: ParsedDepartmentHours[];
  totalHours: number;
  warnings: string[];
}

const DEPT_ALIASES: Record<string, string[]> = {
  mobile: ['mobile', 'mobile developer', 'mobile app development'],
  qa: ['qa', 'quality assurance'],
  pm: ['pm', 'project management', 'project manager'],
  solutions: ['solutions', 'solution architect', 'solutions architect', 'code development'],
  design: ['design', 'creative design', 'ui designer', 'ux designer'],
  marketing: ['marketing', 'digital marketing'],
  web: ['web', 'frontend developer', 'full stack developer', 'code development'],
  devops: ['devops', 'devops / it support'],
  'account management': ['account management', 'account manager'],
  'solution architect': ['solution architect', 'solutions'],
  'creative design': ['creative design', 'design'],
  'project management': ['project management', 'pm', 'project manager'],
  'quality assurance': ['quality assurance', 'qa'],
};

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchRoleName(deptName: string, roleNames: string[]): string | null {
  const key = normalize(deptName);
  const aliases = DEPT_ALIASES[key] || [key];

  for (const role of roleNames) {
    const rn = normalize(role);
    if (aliases.some((a) => rn === a || rn.includes(a) || a.includes(rn))) return role;
  }
  // fuzzy contains
  for (const role of roleNames) {
    const rn = normalize(role);
    if (rn.includes(key) || key.includes(rn.split(' ')[0] || '')) return role;
  }
  return null;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse Boxer-style "Hours Breakdown" sheet:
 * Header: Module(s) | Functionality/Tasks | Dept1 | Dept2 | ... | Total
 * Totals row aggregates department hours.
 */
export function parseHoursBreakdownBuffer(buffer: Buffer): {
  projectTitle: string | null;
  sheetName: string;
  departments: Array<{ name: string; hours: number }>;
  totalHours: number;
  warnings: string[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const warnings: string[] = [];

  const sheetName =
    workbook.SheetNames.find((n) => /hours\s*breakdown/i.test(n)) ||
    workbook.SheetNames.find((n) => /hours/i.test(n)) ||
    workbook.SheetNames[0];

  if (!sheetName) throw new AppError('No sheets found in workbook', 400);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  if (!rows.length) throw new AppError('Hours sheet is empty', 400);

  const projectTitle = cellStr(rows[0]?.[0]) || null;

  // Find header row containing department columns (skip Module/Task/Total)
  let headerRowIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = (rows[i] || []).map(cellStr);
    const joined = row.join(' ').toLowerCase();
    if (
      (joined.includes('module') || joined.includes('functionality') || joined.includes('task')) &&
      row.length >= 4
    ) {
      headerRowIdx = i;
      header = row;
      break;
    }
  }

  if (headerRowIdx < 0) {
    // Fallback: treat first row with multiple text headers as header
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = (rows[i] || []).map(cellStr);
      const textCells = row.filter((c) => c && Number.isNaN(Number(c)));
      if (textCells.length >= 3) {
        headerRowIdx = i;
        header = row;
        break;
      }
    }
  }

  if (headerRowIdx < 0) throw new AppError('Could not find department header row in Hours Breakdown', 400);

  const skipHeaders = new Set([
    'module(s)',
    'modules',
    'module',
    'functionality/tasks',
    'functionality',
    'tasks',
    'task',
    'total',
    'totals',
    '',
  ]);

  const deptCols: Array<{ index: number; name: string }> = [];
  header.forEach((h, index) => {
    const n = normalize(h);
    if (!skipHeaders.has(n) && h) {
      deptCols.push({ index, name: h.trim() });
    }
  });

  if (!deptCols.length) {
    throw new AppError('No department columns found in Hours Breakdown header', 400);
  }

  // Prefer explicit Totals row
  let totalsRow: unknown[] | null = null;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const first = normalize(cellStr(rows[i]?.[0]));
    if (first === 'totals' || first === 'total') {
      totalsRow = rows[i];
      break;
    }
  }

  const departments: Array<{ name: string; hours: number }> = [];

  if (totalsRow) {
    for (const col of deptCols) {
      const hours = cellNum(totalsRow[col.index]);
      departments.push({ name: col.name, hours });
    }
  } else {
    warnings.push('No Totals row found — summing each department column instead');
    for (const col of deptCols) {
      let sum = 0;
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const first = normalize(cellStr(rows[i]?.[0]));
        if (!first || first.startsWith('note')) continue;
        sum += cellNum(rows[i]?.[col.index]);
      }
      departments.push({ name: col.name, hours: Math.round(sum * 100) / 100 });
    }
  }

  // Also try Cost Breakdown if Hours produced all zeros
  const allZero = departments.every((d) => d.hours === 0);
  if (allZero) {
    const costSheetName = workbook.SheetNames.find((n) => /cost\s*breakdown/i.test(n));
    if (costSheetName) {
      warnings.push('Hours Breakdown totals were empty — falling back to Cost Breakdown effort hours');
      const costSheet = workbook.Sheets[costSheetName];
      const costRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(costSheet, {
        header: 1,
        defval: null,
        raw: true,
      }) as unknown[][];
      const fromCost: Array<{ name: string; hours: number }> = [];
      for (let i = 1; i < costRows.length; i++) {
        const name = cellStr(costRows[i]?.[0]);
        const hours = cellNum(costRows[i]?.[1]);
        if (!name || normalize(name) === 'total' || !hours) continue;
        // Skip section headers with no hours in col B sometimes
        fromCost.push({ name, hours });
      }
      if (fromCost.length) {
        return {
          projectTitle,
          sheetName: costSheetName,
          departments: fromCost,
          totalHours: fromCost.reduce((s, d) => s + d.hours, 0),
          warnings,
        };
      }
    }
  }

  const withHours = departments.filter((d) => d.hours > 0);
  const totalHours = departments.reduce((s, d) => s + d.hours, 0);

  return {
    projectTitle,
    sheetName,
    departments: withHours.length ? withHours : departments,
    totalHours: Math.round(totalHours * 100) / 100,
    warnings,
  };
}

export async function parseHoursSourceAndMapRoles(
  buffer: Buffer,
): Promise<ParseHoursSourceResult> {
  const parsed = parseHoursBreakdownBuffer(buffer);
  const roles = await prisma.employeeRole.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  const roleNames = roles.map((r) => r.name);

  const departments: ParsedDepartmentHours[] = parsed.departments.map((d) => {
    const matchedName = matchRoleName(d.name, roleNames);
    const role = matchedName ? roles.find((r) => r.name === matchedName) : null;
    return {
      name: d.name,
      hours: d.hours,
      roleId: role?.id,
      roleName: role?.name ?? d.name,
      location: role?.defaultLocation,
      hourlyCost: role ? Number(role.hourlyCostRate) : undefined,
      hourlyBilling: role ? Number(role.hourlyBillingRate) : undefined,
      matched: Boolean(role),
    };
  });

  if (departments.some((d) => !d.matched)) {
    parsed.warnings.push(
      'Some departments could not be matched to employee roles — rates may need manual selection',
    );
  }

  return {
    projectTitle: parsed.projectTitle,
    sheetName: parsed.sheetName,
    departments,
    totalHours: parsed.totalHours,
    warnings: parsed.warnings,
  };
}
