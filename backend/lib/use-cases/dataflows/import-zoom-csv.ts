import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ZoomInfo } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import ModuleNames from '../../../function-apps/dataflows/module-names';
import { ZoomCsvFailedRow, ZoomCsvImportState } from '../gateways.types';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;
const ZOOM_CSV_BLOB_NAME = 'zoom-info.tsv';

const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

type ZoomCsvRow = {
  fullName: string;
  accountEmail: string | undefined;
  meetingId: string;
  passcode: string;
  phone: string;
  link: string;
};

type ZoomImportResult = {
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

    const parts = line.split('\t').map((p) => p.trim());
    if (parts.length < 8) {
      continue;
    }

    rows.push({
      fullName: parts[2],
      accountEmail: parts[3] || undefined,
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
      accountEmail: row.accountEmail || undefined,
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

export async function importZoomCsv(context: ApplicationContext): Promise<ZoomImportResult> {
  const result: ZoomImportResult = { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 };

  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, ZOOM_CSV_BLOB_NAME);

  if (!content) {
    context.logger.info(MODULE_NAME, 'No zoom CSV found in object storage — skipping import');
    return result;
  }

  const rows = parseZoomCsvFile(content);
  result.total = rows.length;

  const failedRows: ZoomCsvFailedRow[] = [];

  for (const row of rows) {
    const outcome = await processZoomCsvRow(context, row);
    result[
      outcome === 'matched'
        ? 'matched'
        : outcome === 'unmatched'
          ? 'unmatched'
          : outcome === 'ambiguous'
            ? 'ambiguous'
            : 'errors'
    ]++;
    if (outcome !== 'matched') {
      failedRows.push({ ...row, reason: outcome });
    }
  }

  context.logger.info(MODULE_NAME, `Import complete: ${JSON.stringify(result)}`);

  const stateRepo = factory.getRuntimeStateRepository<ZoomCsvImportState>(context);
  const report: ZoomCsvImportState = {
    documentType: 'ZOOM_CSV_IMPORT_STATE',
    importedAt: new Date().toISOString(),
    ...result,
    failedRows,
  };
  await stateRepo.upsert(report);
  context.logger.info(MODULE_NAME, `Report saved: ${failedRows.length} failed rows`);

  return result;
}
