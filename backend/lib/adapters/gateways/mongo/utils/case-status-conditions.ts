import QueryBuilder, { ConditionOrConjunction } from '../../../../query/query-builder';
import { TrusteeCaseStatus } from '@common/api/search';

const { and, or, using } = QueryBuilder;

/**
 * Builds QueryBuilder conditions encoding the open/closed case-status rule.
 *
 * Mirrors isCaseClosed/isCaseOpen from common/src/cams/cases.ts as Mongo filter
 * conditions. The optional fieldPrefix supports post-join namespacing (e.g. '_case').
 */
export function buildCaseStatusCondition<T>(
  caseStatus: TrusteeCaseStatus | undefined,
  fieldPrefix?: string,
): ConditionOrConjunction<T> | null {
  if (!caseStatus || caseStatus === 'ALL') return null;

  type Rec = Record<string, unknown>;
  const doc = using<Rec>();
  const f = (name: string) => (fieldPrefix ? `${fieldPrefix}.${name}` : name);

  if (caseStatus === 'OPEN') {
    return or<Rec>(
      doc(f('closedDate')).notExists(),
      and<Rec>(
        doc(f('closedDate')).exists(),
        doc(f('reopenedDate')).exists(),
        doc(f('reopenedDate')).greaterThanOrEqual({ name: f('closedDate') }),
      ),
    ) as unknown as ConditionOrConjunction<T>;
  }

  // CLOSED
  return and<Rec>(
    doc(f('closedDate')).exists(),
    or<Rec>(
      doc(f('reopenedDate')).notExists(),
      doc(f('closedDate')).greaterThanOrEqual({ name: f('reopenedDate') }),
    ),
  ) as unknown as ConditionOrConjunction<T>;
}
