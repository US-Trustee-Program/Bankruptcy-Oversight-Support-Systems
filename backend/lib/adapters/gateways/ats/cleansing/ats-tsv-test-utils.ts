/**
 * Shared utilities for TSV-based cleansing tests
 *
 * This module provides common functions for loading and parsing TSV test data,
 * loading overrides, and running appointments through the cleansing pipeline.
 *
 * Used by both ats-cleansing-pipeline.test.ts and validate-tsv-parity.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { cleanseAndMapAppointment } from './ats-cleansing-pipeline';
import { AtsAppointmentRecord } from '../../../types/ats.types';
import { TrusteeOverride, CleansingResult } from './ats-cleansing-types';
import { ApplicationContext } from '../../../types/basic';

// Test-only type that includes DIVISION from TSV export (not used in production)
export type TsvAtsAppointmentRecord = AtsAppointmentRecord & {
  DIVISION?: string;
};

export type TsvRow = {
  trusteeid: string;
  status: string;
  district: string;
  serving_state: string;
  division: string;
  chapter: string;
  appointed_date: string;
  status_eff_date: string;
  classification: string;
  court_ids: string;
  map_type: string;
  cleansing_notes: string;
};

const TSV_PATH = path.join(__dirname, 'test-data/trustee_cross_reference_enriched_v4_ts.tsv');

const OVERRIDE_TSV_PATH = path.join(__dirname, 'test-data/trustee_appointment_overrides.tsv');

/**
 * Parse a single TSV line into a typed row object
 */
function parseTsvRow(line: string, headers: string[]): TsvRow {
  const values = line.split('\t');
  const row: Record<string, string | null> = {};
  headers.forEach((header, i) => {
    row[header.toLowerCase()] = values[i] === 'NULL' ? null : values[i];
  });
  return row as TsvRow;
}

/**
 * Parse a date string from TSV, handling NULL values
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === 'NULL') return null;
  return new Date(dateStr);
}

/**
 * Load override data from TSV file into a map by trustee ID
 */
export function loadOverrides(): Map<string, TrusteeOverride[]> {
  const overridesMap = new Map<string, TrusteeOverride[]>();

  if (!fs.existsSync(OVERRIDE_TSV_PATH)) {
    return overridesMap;
  }

  const content = fs.readFileSync(OVERRIDE_TSV_PATH, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  const headers = lines[0].split('\t').map((h) => h.toLowerCase());

  lines.slice(1).forEach((line) => {
    const values = line.split('\t');
    const row: Record<string, string | null> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] === 'NULL' ? null : values[i];
    });

    const override: TrusteeOverride = {
      trusteeId: row.trustee_id,
      status: row.status,
      district: row.district,
      state: row.state,
      chapter: row.chapter,
      action: row.action as 'SKIP' | 'MAP',
      overrideStatus: row.override_status,
      overrideDistrict: row.override_district,
      overrideState: row.override_state,
      overrideChapter: row.override_chapter,
      overrideCourtId: row.override_court_id,
      notes: row.notes,
    };

    const existing = overridesMap.get(override.trusteeId) || [];
    existing.push(override);
    overridesMap.set(override.trusteeId, existing);
  });

  return overridesMap;
}

/**
 * Mock context for test usage
 */
const mockContext: ApplicationContext = {
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
} as ApplicationContext;

/**
 * Convert TSV row into ATS appointment record and run through cleansing pipeline
 */
export function cleanseRow(
  row: TsvRow,
  overrides: Map<string, TrusteeOverride[]>,
): CleansingResult {
  const atsAppointment: TsvAtsAppointmentRecord = {
    TRU_ID: Number.parseInt(row.trusteeid),
    STATUS: row.status,
    DISTRICT: row.district,
    STATE: row.serving_state,
    DIVISION: row.division,
    CHAPTER: row.chapter,
    DATE_APPOINTED: parseDate(row.appointed_date),
    EFFECTIVE_DATE: parseDate(row.status_eff_date),
  };

  return cleanseAndMapAppointment(mockContext, row.trusteeid, atsAppointment, overrides);
}

/**
 * Load all TSV rows from the reference file
 */
export function loadTsvRows(): { headers: string[]; rows: TsvRow[] } {
  const tsvContent = fs.readFileSync(TSV_PATH, 'utf-8');
  const lines = tsvContent.split('\n').filter((line) => line.trim());
  const headers = lines[0].split('\t').map((h) => h.toLowerCase());
  const dataLines = lines.slice(1);

  const rows = dataLines.map((line) => parseTsvRow(line, headers));

  return { headers, rows };
}
