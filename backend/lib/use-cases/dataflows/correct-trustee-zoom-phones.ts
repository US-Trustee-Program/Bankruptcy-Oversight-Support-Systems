import { PHONE_REGEX } from '@common/cams/regex';
import { Trustee } from '@common/cams/trustees';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'CORRECT-TRUSTEE-ZOOM-PHONES-USE-CASE';

export type ZoomPhoneConversion =
  | { outcome: 'alreadyValid' }
  | { outcome: 'converted'; newValue: string }
  | { outcome: 'flagged'; reason: string };

const EXTENSION_SUFFIX = /^(.*?)\s*(?:x|ext\.?|extension[:.]?)\s*(\d+)$/i;
const NUMBER_PART_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * One-time migration rule (CAMS-975) for Zoom phones the Zoom Info Import stored
 * without validation, e.g. "(680) 214-4529". Converts what can be unambiguously
 * reformatted to PHONE_REGEX and flags everything else for review.
 */
export function convertZoomPhone(stored: string | undefined): ZoomPhoneConversion {
  const trimmed = stored?.trim() ?? '';
  if (!trimmed) {
    return { outcome: 'flagged', reason: 'Zoom phone is empty or missing.' };
  }
  if (stored === trimmed && PHONE_REGEX.test(trimmed)) {
    return { outcome: 'alreadyValid' };
  }

  const extensionMatch = EXTENSION_SUFFIX.exec(trimmed);
  const numberPart = extensionMatch ? extensionMatch[1] : trimmed;
  const extension = extensionMatch ? extensionMatch[2] : undefined;

  if (!NUMBER_PART_CHARACTERS.test(numberPart)) {
    return { outcome: 'flagged', reason: 'Zoom phone contains unexpected characters.' };
  }

  const digits = numberPart.replace(/\D/g, '');
  let formatted: string;
  if (digits.length === 10) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    formatted = `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else {
    return { outcome: 'flagged', reason: `Zoom phone has ${digits.length} digits.` };
  }

  const newValue = extension ? `${formatted} x${extension}` : formatted;
  if (!PHONE_REGEX.test(newValue)) {
    return { outcome: 'flagged', reason: 'Converted Zoom phone does not match the phone format.' };
  }
  return { outcome: 'converted', newValue };
}

type ZoomPhoneCorrectionOutcome = 'converted' | 'alreadyValid' | 'flagged' | 'failed';

type ZoomPhoneCorrectionResult = {
  trusteeId: string;
  trusteeName: string;
  storedValue: string | undefined;
  outcome: ZoomPhoneCorrectionOutcome;
  newValue?: string;
  reason?: string;
  error?: string;
};

type ZoomPhoneCorrectionSummary = {
  results: ZoomPhoneCorrectionResult[];
  counts: Record<ZoomPhoneCorrectionOutcome, number>;
};

async function getTrusteesWithZoomInfo(context: ApplicationContext): Promise<MaybeData<Trustee[]>> {
  try {
    const repo = factory.getTrusteesRepository(context);
    const trustees = await repo.listTrustees();
    return { data: trustees.filter((trustee) => !!trustee.zoomInfo) };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to get trustees with Zoom info.'),
    };
  }
}

/**
 * Writes corrected Zoom phones through the repository setter only. It deliberately does
 * not go through TrusteesUseCase, so no trustee history or change notification is produced.
 */
async function correctZoomPhones(
  context: ApplicationContext,
  trustees: Trustee[],
): Promise<MaybeData<ZoomPhoneCorrectionSummary>> {
  try {
    const repo = factory.getTrusteesRepository(context);
    const results: ZoomPhoneCorrectionResult[] = [];

    for (const trustee of trustees) {
      const storedValue = trustee.zoomInfo?.phone;
      const base = { trusteeId: trustee.trusteeId, trusteeName: trustee.name, storedValue };
      const conversion = convertZoomPhone(storedValue);

      if (conversion.outcome === 'alreadyValid') {
        results.push({ ...base, outcome: 'alreadyValid' });
      } else if (conversion.outcome === 'flagged') {
        results.push({ ...base, outcome: 'flagged', reason: conversion.reason });
      } else {
        const { newValue } = conversion;
        try {
          await repo.setZoomInfo(trustee.trusteeId, { ...trustee.zoomInfo, phone: newValue });
          results.push({ ...base, outcome: 'converted', newValue });
        } catch (originalError) {
          results.push({
            ...base,
            outcome: 'failed',
            newValue,
            error: originalError instanceof Error ? originalError.message : String(originalError),
          });
        }
      }
    }

    const counts = { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 };
    results.forEach((result) => counts[result.outcome]++);

    return { data: { results, counts } };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to correct trustee Zoom phones.'),
    };
  }
}

const CorrectTrusteeZoomPhones = {
  getTrusteesWithZoomInfo,
  correctZoomPhones,
};

export default CorrectTrusteeZoomPhones;
