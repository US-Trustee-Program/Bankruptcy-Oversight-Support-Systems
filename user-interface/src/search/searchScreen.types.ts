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

const caseNumber = [V.matches(CASE_NUMBER_REGEX, CASE_NUMBER_INVALID_ERROR_REASON)];

const atLeastOneSearchCriterion: ValidatorFunction = (obj: unknown) => {
  const form = obj as SearchScreenFormData;

  const hasCaseNumber = !!form.caseNumber?.trim();
  const hasDebtorName = !!form.debtorName?.trim();
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
};
