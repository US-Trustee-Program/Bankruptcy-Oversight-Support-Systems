import { CASE_NUMBER_REGEX } from '@common/cams/regex';
import { VALID, ValidationSpec, ValidatorFunction } from '@common/cams/validation';
import V from '@common/cams/validators';

export type SearchScreenFormData = {
  caseNumber?: string;
  debtorName?: string;
  divisionCodes?: string[];
  chapters?: string[];
  excludeClosedCases?: boolean;
};

const CASE_NUMBER_INVALID_ERROR_REASON = 'Must be 7 digits';
const AT_LEAST_ONE_SEARCH_CRITERION_ERROR_REASON = 'Please enter at least one search criterion';
const DEBTOR_NAME_MIN_LENGTH = 2;
const DEBTOR_NAME_TOO_SHORT_ERROR_REASON = 'Debtor name must be at least 2 characters';

const caseNumber = [V.matches(CASE_NUMBER_REGEX, CASE_NUMBER_INVALID_ERROR_REASON)];

const debtorName: ValidatorFunction[] = [
  (value: unknown) => {
    const name = value as string | undefined;
    // If debtor name is provided (not empty), it must be at least 2 characters
    if (name && name.trim().length > 0 && name.trim().length < DEBTOR_NAME_MIN_LENGTH) {
      return {
        reasonMap: {
          debtorName: {
            reasons: [DEBTOR_NAME_TOO_SHORT_ERROR_REASON],
          },
        },
      };
    }
    return VALID;
  },
];

const atLeastOneSearchCriterion: ValidatorFunction = (obj: unknown) => {
  const form = obj as SearchScreenFormData;

  const hasCaseNumber = !!form.caseNumber?.trim();
  const hasDebtorName = (form.debtorName?.trim().length ?? 0) >= DEBTOR_NAME_MIN_LENGTH;
  const hasDivisionCodes = !!form.divisionCodes && form.divisionCodes.length > 0;
  const hasChapters = !!form.chapters && form.chapters.length > 0;

  // Include Closed Cases alone is not a valid search criterion
  // User must have at least one of: case number, debtor name, division codes, or chapters
  if (!hasCaseNumber && !hasDebtorName && !hasDivisionCodes && !hasChapters) {
    return {
      reasonMap: {
        $: {
          reasons: [AT_LEAST_ONE_SEARCH_CRITERION_ERROR_REASON],
        },
      },
    };
  }

  return VALID;
};

export const SEARCH_SCREEN_SPEC: Readonly<ValidationSpec<SearchScreenFormData>> = {
  $: [atLeastOneSearchCriterion],
  caseNumber: [V.optional(...caseNumber)],
  debtorName: [V.optional(...debtorName)],
};
