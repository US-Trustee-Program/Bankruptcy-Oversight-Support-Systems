import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { parseChapterAndType, parseTodStatus, applyAppointmentOverrides } from './ats-mappings';

/**
 * Transform cleansed ATS appointment record to CAMS format.
 * This is called ONLY for CLEAN or AUTO_RECOVERABLE appointments.
 *
 * @param cleanedRecord - Cleansed ATS record (district/state validated)
 * @param courtId - Pre-mapped court ID from cleansing pipeline
 * @returns CAMS appointment input
 */
export function transformAppointmentRecord(
  cleanedRecord: AtsAppointmentRecord,
  courtId: string,
): TrusteeAppointmentInput {
  // Keep original chapter code for CBC lookup
  const originalChapter = cleanedRecord.CHAPTER?.trim().toUpperCase() || '';
  const statusCode = cleanedRecord.STATUS?.trim().toUpperCase() || '';

  // Parse chapter and get appointment type if specified
  const chapterMapping = parseChapterAndType(cleanedRecord.CHAPTER);

  // Parse status to get appointment type and status (flat map defaults)
  const statusMapping = parseTodStatus(cleanedRecord.STATUS);

  // Apply special-case overrides
  const { chapter, appointmentType, status } = applyAppointmentOverrides(
    chapterMapping,
    originalChapter,
    statusCode,
    statusMapping,
  );

  // Validate chapter type for CAMS
  if (!['7', '11', '11-subchapter-v', '12', '13'].includes(chapter)) {
    throw new Error(`Invalid chapter for CAMS: ${chapter}`);
  }

  // Format dates - relaxed validation for migration
  // Use EFFECTIVE_DATE as fallback, or use a placeholder if both are missing
  let appointedDate: string;
  let effectiveDate: string;

  if (cleanedRecord.DATE_APPOINTED) {
    appointedDate = cleanedRecord.DATE_APPOINTED.toISOString().split('T')[0];
    effectiveDate = cleanedRecord.EFFECTIVE_DATE
      ? cleanedRecord.EFFECTIVE_DATE.toISOString().split('T')[0]
      : appointedDate;
  } else if (cleanedRecord.EFFECTIVE_DATE) {
    // Use EFFECTIVE_DATE for both if DATE_APPOINTED is missing
    appointedDate = cleanedRecord.EFFECTIVE_DATE.toISOString().split('T')[0];
    effectiveDate = appointedDate;
  } else {
    // Both dates missing - use placeholder date (can be corrected later)
    appointedDate = '1970-01-01';
    effectiveDate = '1970-01-01';
  }

  return {
    chapter,
    appointmentType,
    courtId, // Use pre-mapped court ID from cleansing pipeline
    appointedDate,
    status,
    effectiveDate,
  };
}
