import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ZoomInfo } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import ModuleNames from '../../../function-apps/dataflows/module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;

const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

export type ZoomCsvRow = {
  fullName: string;
  accountEmail: string;
  meetingId: string;
  passcode: string;
  phone: string;
  link: string;
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
