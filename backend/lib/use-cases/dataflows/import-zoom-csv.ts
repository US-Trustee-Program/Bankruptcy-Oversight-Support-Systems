import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { ZoomInfo } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import * as fs from 'fs';
import * as path from 'path';

const MODULE_NAME = 'IMPORT-ZOOM-CSV';
const CSV_FILE = path.join(__dirname, 'zoom-info.tsv');

export type FileOperations = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, encoding: BufferEncoding) => string;
};

const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

type ZoomCsvRow = {
  fullName: string;
  accountEmail: string;
  meetingId: string;
  passcode: string;
  phone: string;
  link: string;
};

export type ZoomImportResult = {
  total: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  errors: number;
};

export function parseZoomCsvFile(content: string): ZoomCsvRow[] {
  const lines = content.split('\n');
  const rows: ZoomCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 8) {
      continue;
    }

    rows.push({
      fullName: parts[2],
      accountEmail: parts[3],
      meetingId: parts[4],
      passcode: parts[5],
      phone: parts[6],
      link: parts[7],
    });
  }

  return rows;
}

export async function processZoomCsvRow(
  context: ApplicationContext,
  row: ZoomCsvRow,
): Promise<'matched' | 'unmatched' | 'ambiguous' | 'error'> {
  try {
    const repo = factory.getTrusteesRepository(context);
    const normalizedName = normalizeName(row.fullName);
    const trustees = await repo.findTrusteesByName(normalizedName);

    if (trustees.length === 0) {
      context.logger.info(MODULE_NAME, `UNMATCHED: "${normalizedName}"`);
      return 'unmatched';
    }

    if (trustees.length > 1) {
      context.logger.warn(
        MODULE_NAME,
        `AMBIGUOUS: "${normalizedName}" matched ${trustees.length} trustees`,
      );
      return 'ambiguous';
    }

    const trustee = trustees[0];
    const zoomInfo: ZoomInfo = {
      link: row.link,
      phone: row.phone,
      meetingId: row.meetingId,
      passcode: row.passcode,
      accountEmail: row.accountEmail,
    };

    await repo.updateTrustee(trustee.trusteeId, { ...trustee, zoomInfo }, SYSTEM_USER);
    return 'matched';
  } catch (originalError) {
    const camsError = getCamsError(
      originalError as Error,
      MODULE_NAME,
      `Failed to process row for "${row.fullName}"`,
    );
    context.logger.error(MODULE_NAME, camsError.message, camsError);
    return 'error';
  }
}

export async function importZoomCsv(
  context: ApplicationContext,
  filePath?: string,
  fileOps: FileOperations = fs,
): Promise<MaybeData<ZoomImportResult>> {
  const resolvedPath = filePath ?? CSV_FILE;

  try {
    if (!fileOps.existsSync(resolvedPath)) {
      context.logger.info(MODULE_NAME, `No CSV file found at ${resolvedPath} — skipping import`);
      return { data: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 } };
    }

    const content = fileOps.readFileSync(resolvedPath, 'utf-8');
    const rows = parseZoomCsvFile(content);

    const result: ZoomImportResult = {
      total: rows.length,
      matched: 0,
      unmatched: 0,
      ambiguous: 0,
      errors: 0,
    };

    for (const row of rows) {
      const outcome = await processZoomCsvRow(context, row);
      result[outcome === 'error' ? 'errors' : outcome]++;
    }

    return { data: result };
  } catch (originalError) {
    return {
      error: getCamsError(originalError as Error, MODULE_NAME, 'Failed to import Zoom CSV'),
    };
  }
}
