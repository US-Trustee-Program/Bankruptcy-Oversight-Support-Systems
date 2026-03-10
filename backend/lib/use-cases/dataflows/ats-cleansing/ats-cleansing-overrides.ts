import { ApplicationContext } from '../../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';
import { TrusteeOverride, CleansingResult, CleansingClassification } from './ats-cleansing-types';
import { getCamsError } from '../../../common-errors/error-utilities';
import { MaybeData } from '../queue-types';
import { normalizeForComparison } from './ats-cleansing-utils';
import * as fs from 'fs';
import * as path from 'path';

const MODULE_NAME = 'ATS-CLEANSING-OVERRIDES';
const OVERRIDE_FILE = path.join(__dirname, 'trustee-appointment-overrides.tsv');

/**
 * Load trustee appointment overrides from TSV file.
 * Returns a map keyed by truId for O(1) lookup.
 */
export async function loadTrusteeOverrides(
  context: ApplicationContext,
): Promise<MaybeData<Map<string, TrusteeOverride[]>>> {
  try {
    // Check if override file exists
    if (!fs.existsSync(OVERRIDE_FILE)) {
      context.logger.info(MODULE_NAME, 'No override file found - proceeding without overrides');
      return { data: new Map<string, TrusteeOverride[]>() };
    }

    const content = fs.readFileSync(OVERRIDE_FILE, 'utf-8');
    const lines = content.split('\n');

    const overridesMap = new Map<string, TrusteeOverride[]>();
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Skip header and empty lines
      if (lineNumber === 1 || !line.trim()) continue;

      const parts = line.split('\t');
      if (parts.length < 12) {
        context.logger.warn(
          MODULE_NAME,
          `Invalid override line ${lineNumber}: insufficient columns (expected 12, got ${parts.length})`,
        );
        continue;
      }

      const override: TrusteeOverride = {
        trusteeId: parts[0],
        status: parts[1],
        district: parts[2],
        state: parts[3],
        chapter: parts[4],
        action: parts[5] as 'SKIP' | 'MAP',
        overrideStatus: parts[6] !== 'NULL' ? parts[6] : undefined,
        overrideDistrict: parts[7] !== 'NULL' ? parts[7] : undefined,
        overrideState: parts[8] !== 'NULL' ? parts[8] : undefined,
        overrideChapter: parts[9] !== 'NULL' ? parts[9] : undefined,
        overrideCourtId: parts[10] !== 'NULL' ? parts[10] : undefined,
        notes: parts[11] !== 'NULL' ? parts[11] : undefined,
      };

      // Group by trusteeId
      const existing = overridesMap.get(override.trusteeId) || [];
      existing.push(override);
      overridesMap.set(override.trusteeId, existing);
    }

    context.logger.info(
      MODULE_NAME,
      `Loaded ${overridesMap.size} trustee override entries from ${OVERRIDE_FILE}`,
    );
    return { data: overridesMap };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to load trustee overrides'),
    };
  }
}

/**
 * Check if an appointment has a manual override.
 * Returns CleansingResult if override applies, null otherwise.
 */
export function checkOverride(
  truId: string,
  atsAppointment: AtsAppointmentRecord,
  overridesCache: Map<string, TrusteeOverride[]>,
): CleansingResult | null {
  const overrides = overridesCache.get(truId);
  if (!overrides || overrides.length === 0) {
    return null;
  }

  // Match ALL overrides by status, district, state, chapter
  const matchingOverrides = overrides.filter((override) => {
    const statusMatch =
      normalizeForComparison(override.status) === normalizeForComparison(atsAppointment.STATUS);
    const districtMatch =
      normalizeForComparison(override.district) === normalizeForComparison(atsAppointment.DISTRICT);
    const stateMatch =
      normalizeForComparison(override.state) === normalizeForComparison(atsAppointment.STATE);
    const chapterMatch =
      normalizeForComparison(override.chapter) === normalizeForComparison(atsAppointment.CHAPTER);

    return statusMatch && districtMatch && stateMatch && chapterMatch;
  });

  if (matchingOverrides.length === 0) {
    return null;
  }

  // Handle SKIP action (first matching override)
  const firstOverride = matchingOverrides[0];
  if (firstOverride.action === 'SKIP') {
    return {
      classification: CleansingClassification.SKIP,
      courtIds: [],
      mapType: 'OVERRIDE:SKIP',
      notes: [firstOverride.notes || 'Skipped per override directive'],
      skip: true,
    };
  }

  // Handle MAP action - collect ALL court IDs from matching overrides
  const mapOverrides = matchingOverrides.filter((o) => o.action === 'MAP' && o.overrideCourtId);
  if (mapOverrides.length > 0) {
    const courtIds = mapOverrides.map((o) => o.overrideCourtId!);
    const notes = mapOverrides.map((o) => o.notes).filter((n): n is string => !!n);

    // Classify as AUTO_RECOVERABLE when override is needed (indicates data issue that required manual fix)
    const classification = CleansingClassification.AUTO_RECOVERABLE;
    const mapType = mapOverrides.length > 1 ? `OVERRIDE_1:${courtIds.length}` : 'OVERRIDE';

    return {
      classification,
      courtIds,
      mapType,
      notes: notes.length > 0 ? notes : ['Manual override applied'],
      skip: false,
    };
  }

  return null;
}
