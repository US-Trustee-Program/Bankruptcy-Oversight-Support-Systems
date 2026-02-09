import V from './validators';
import { ValidationSpec } from './validation';
import { CasesSearchPredicate } from '../api/search';
import { CASE_NUMBER_REGEX } from './regex';

// Constants matching frontend validation
const DEBTOR_NAME_MIN_LENGTH = 2;
const DEBTOR_NAME_MAX_LENGTH = 200; // Security recommendation: cap at reasonable length

// Error messages - following the pattern of validation-messages.ts
const SEARCH_VALIDATION_MESSAGES = {
  DEBTOR_NAME_TOO_SHORT: `Debtor name must be at least ${DEBTOR_NAME_MIN_LENGTH} characters`,
  DEBTOR_NAME_TOO_LONG: `Debtor name must not exceed ${DEBTOR_NAME_MAX_LENGTH} characters`,
  CASE_NUMBER_INVALID: 'Case number must be in format: YY-NNNNN',
  LIMIT_INVALID: 'Limit must be a positive number between 1 and 100',
  OFFSET_INVALID: 'Offset must be a non-negative number',
  DIVISION_CODE_INVALID: 'Invalid division code format',
  CHAPTER_INVALID: 'Chapter must be one of: 7, 11, 12, 13, 15',
  CASE_ID_INVALID: 'Case ID must be a non-empty string',
  AT_LEAST_ONE_CRITERION: 'At least one search criterion is required',
} as const;

// Individual field validators following the pattern from trustees-validators.ts
export const caseNumber = V.optional(
  V.matches(CASE_NUMBER_REGEX, SEARCH_VALIDATION_MESSAGES.CASE_NUMBER_INVALID),
);

export const debtorName = V.optional(
  V.trimmed(
    V.checkFirst(
      V.minLength(DEBTOR_NAME_MIN_LENGTH, SEARCH_VALIDATION_MESSAGES.DEBTOR_NAME_TOO_SHORT),
    ).then(V.maxLength(DEBTOR_NAME_MAX_LENGTH, SEARCH_VALIDATION_MESSAGES.DEBTOR_NAME_TOO_LONG)),
  ),
);

export const limit = V.optional(
  V.useValidators((value: unknown) => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof num !== 'number' || isNaN(num)) {
      return { reasons: ['Limit must be a number'] };
    }
    if (num < 1 || num > 100) {
      return { reasons: [SEARCH_VALIDATION_MESSAGES.LIMIT_INVALID] };
    }
    return { valid: true };
  }),
);

export const offset = V.optional(
  V.useValidators((value: unknown) => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof num !== 'number' || isNaN(num)) {
      return { reasons: ['Offset must be a number'] };
    }
    if (num < 0) {
      return { reasons: [SEARCH_VALIDATION_MESSAGES.OFFSET_INVALID] };
    }
    return { valid: true };
  }),
);

export const divisionCodes = V.optional(
  V.arrayOf(
    V.useValidators((value: unknown) => {
      if (typeof value !== 'string') {
        return { reasons: ['Division code must be a string'] };
      }
      // Basic sanity check for division codes
      if (value.length === 0 || value.length > 10) {
        return { reasons: [SEARCH_VALIDATION_MESSAGES.DIVISION_CODE_INVALID] };
      }
      return { valid: true };
    }),
  ),
);

export const chapters = V.optional(
  V.arrayOf(
    V.useValidators((value: unknown) => {
      if (typeof value !== 'string') {
        return { reasons: ['Chapter must be a string'] };
      }
      // Valid chapter values based on bankruptcy law
      const validChapters = ['7', '11', '12', '13', '15'];
      if (!validChapters.includes(value)) {
        return { reasons: [SEARCH_VALIDATION_MESSAGES.CHAPTER_INVALID] };
      }
      return { valid: true };
    }),
  ),
);

export const caseIds = V.optional(
  V.arrayOf(
    V.useValidators((value: unknown) => {
      if (typeof value !== 'string' || value.length === 0) {
        return { reasons: [SEARCH_VALIDATION_MESSAGES.CASE_ID_INVALID] };
      }
      return { valid: true };
    }),
  ),
);

export const excludedCaseIds = V.optional(
  V.arrayOf(
    V.useValidators((value: unknown) => {
      if (typeof value !== 'string' || value.length === 0) {
        return { reasons: [SEARCH_VALIDATION_MESSAGES.CASE_ID_INVALID] };
      }
      return { valid: true };
    }),
  ),
);

// At least one search criterion validator
export const atLeastOneSearchCriterion = V.useValidators((form: unknown) => {
  const predicate = form as CasesSearchPredicate;

  const hasCaseNumber = !!predicate.caseNumber?.trim();
  const hasDebtorName = (predicate.debtorName?.trim().length ?? 0) >= DEBTOR_NAME_MIN_LENGTH;
  const hasDivisionCodes = !!predicate.divisionCodes && predicate.divisionCodes.length > 0;
  const hasChapters = !!predicate.chapters && predicate.chapters.length > 0;
  const hasCaseIds = !!predicate.caseIds && predicate.caseIds.length > 0;
  const hasExcludedCaseIds = !!predicate.excludedCaseIds && predicate.excludedCaseIds.length > 0;
  const hasAssignments = !!predicate.assignments && predicate.assignments.length > 0;

  const hasAtLeastOne =
    hasCaseNumber ||
    hasDebtorName ||
    hasDivisionCodes ||
    hasChapters ||
    hasCaseIds ||
    hasExcludedCaseIds ||
    hasAssignments ||
    predicate.includeOnlyUnassigned;

  if (!hasAtLeastOne) {
    return { reasons: [SEARCH_VALIDATION_MESSAGES.AT_LEAST_ONE_CRITERION] };
  }

  return { valid: true };
});

// CasesSearchPredicate validation spec - following the pattern from trustees-validators.ts
export const casesSearchPredicateSpec: ValidationSpec<CasesSearchPredicate> = {
  // Add the form-level validator for at least one criterion
  $: [atLeastOneSearchCriterion],

  // Pagination fields
  limit: [limit],
  offset: [offset],

  // Search fields
  caseNumber: [caseNumber],
  debtorName: [debtorName],
  divisionCodes: [divisionCodes],
  chapters: [chapters],
  caseIds: [caseIds],
  excludedCaseIds: [excludedCaseIds],

  // Boolean flags - no validation needed as they default to false
  excludeMemberConsolidations: [V.optional()],
  excludeClosedCases: [V.optional()],
  includeOnlyUnassigned: [V.optional()],

  // assignments field - complex validation can be added if needed
  assignments: [V.optional()],
};
