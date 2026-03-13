import { ApplicationContext } from '../../../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import {
  CleansingResult,
  CleansingClassification,
  CleansingWorkRecord,
  TrusteeOverride,
} from './ats-cleansing-types';
import { checkOverride } from './ats-cleansing-overrides';
import { precleanse } from './ats-cleansing-precleanse';
import { expand } from './ats-cleansing-expansion';
import { mapToCourtId } from './ats-cleansing-mapping';
import { classify } from './ats-cleansing-classification';
import { transformAppointmentRecord } from './ats-cleansing-transform';
import { copyAppointmentRecord } from './ats-cleansing-utils';

const MODULE_NAME = 'ATS-CLEANSING-PIPELINE';

/**
 * Run a single ATS appointment through the complete cleansing pipeline.
 *
 * Pipeline stages:
 * 0. Override check - manual corrections or skip directives
 * 1. Pre-cleanse - typo fixes, column reversals, delimiter artifacts
 * 2. Expansion - multi-value splitting, regional patterns
 * 3. Mapping - district+state → courtId
 * 4. Classification - assign final classification
 * 5. Transform - convert to CAMS format (only for CLEAN/AUTO_RECOVERABLE)
 *
 * @param context - Application context for logging
 * @param truId - ATS TRU_ID for override lookup
 * @param atsAppointment - Raw appointment from ATS
 * @param overridesCache - Pre-loaded override map
 * @returns Cleansing result with classification and optional appointment data
 */
export function cleanseAndMapAppointment(
  context: ApplicationContext,
  truId: string,
  atsAppointment: AtsAppointmentRecord,
  overridesCache: Map<string, TrusteeOverride[]>,
): CleansingResult {
  try {
    // Stage 0: Check for manual override
    const overrideResult = checkOverride(truId, atsAppointment, overridesCache);
    if (overrideResult) {
      context.logger.debug(MODULE_NAME, `Applied override for trustee ${truId}`, {
        action: overrideResult.skip ? 'SKIP' : 'MAP',
      });

      // For MAP overrides, transform the record
      if (!overrideResult.skip && overrideResult.courtIds.length > 0) {
        try {
          const appointment = transformAppointmentRecord(
            atsAppointment,
            overrideResult.courtIds[0],
          );
          return {
            ...overrideResult,
            appointment,
          };
        } catch (transformError) {
          context.logger.error(MODULE_NAME, `Failed to transform overridden appointment`, {
            error:
              transformError instanceof Error ? transformError.message : String(transformError),
            truId,
          });
          return {
            classification: CleansingClassification.UNCLEANSABLE,
            courtIds: [],
            mapType: 'UNMAPPED',
            notes: [
              ...overrideResult.notes,
              `Transform error: ${transformError instanceof Error ? transformError.message : String(transformError)}`,
            ],
            skip: false,
          };
        }
      }

      return overrideResult;
    }

    // Initialize working record
    let workRecord: CleansingWorkRecord = {
      records: [copyAppointmentRecord(atsAppointment)],
      classification: CleansingClassification.CLEAN, // Provisional
      courtIds: [],
      mapType: '',
      notes: [],
      skip: false,
      expanded: false,
    };

    // Stage 1: Pre-cleanse
    workRecord = precleanse(workRecord, atsAppointment);

    // Stage 2: Expansion
    workRecord = expand(workRecord, atsAppointment);

    // Stage 3: Mapping
    workRecord = mapToCourtId(workRecord);

    // Stage 4: Classification
    workRecord = classify(workRecord, atsAppointment);

    // Stage 5: Transform to CAMS format (only for successful cleansing)
    if (
      workRecord.classification === CleansingClassification.CLEAN ||
      workRecord.classification === CleansingClassification.AUTO_RECOVERABLE
    ) {
      // For 1:1 mappings, transform to a single appointment
      // For 1:N mappings (expansions), return courtIds without appointment (migration will create multiple)
      if (workRecord.records.length === 1 && workRecord.courtIds.length === 1) {
        const cleanedRecord = workRecord.records[0];

        try {
          const appointment = transformAppointmentRecord(cleanedRecord, workRecord.courtIds[0]);

          return {
            classification: workRecord.classification,
            appointment,
            courtIds: workRecord.courtIds,
            mapType: workRecord.mapType,
            notes: workRecord.notes,
            skip: false,
          };
        } catch (transformError) {
          context.logger.error(MODULE_NAME, `Failed to transform cleansed appointment`, {
            error:
              transformError instanceof Error ? transformError.message : String(transformError),
            truId,
          });
          return {
            classification: CleansingClassification.UNCLEANSABLE,
            courtIds: [],
            mapType: 'UNMAPPED',
            notes: [
              ...workRecord.notes,
              `Transform error: ${transformError instanceof Error ? transformError.message : String(transformError)}`,
            ],
            skip: false,
          };
        }
      }

      // Multi-expansion: return courtIds without appointment
      // Migration code will create multiple appointments
      return {
        classification: workRecord.classification,
        courtIds: workRecord.courtIds,
        mapType: workRecord.mapType,
        notes: workRecord.notes,
        skip: false,
      };
    }

    // Failed cleansing - return classification and notes
    return {
      classification: workRecord.classification,
      courtIds: workRecord.courtIds,
      mapType: workRecord.mapType,
      notes: workRecord.notes,
      skip: false,
    };
  } catch (error) {
    // Catch-all for unexpected errors
    context.logger.error(MODULE_NAME, `Unexpected error in cleansing pipeline`, {
      error: error instanceof Error ? error.message : String(error),
      truId,
      atsAppointment,
    });

    return {
      classification: CleansingClassification.UNCLEANSABLE,
      courtIds: [],
      mapType: 'UNMAPPED',
      notes: [`Pipeline error: ${error instanceof Error ? error.message : String(error)}`],
      skip: false,
    };
  }
}
