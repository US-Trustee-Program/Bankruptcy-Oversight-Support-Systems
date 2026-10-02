import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';

export type StandingBudgetCardVariant = 'chapter12-standing' | 'chapter13-standing';

interface BudgetDates {
  budgetSubmissionDue: string;
  budgetReviewToOO: string;
}

// Dates confirmed by mstankey@flexion.us, 2026-09-29 (cams-plwwz.7). That confirmation also
// established the underlying field is a review date, not a due date, which is why the field/key
// stays budgetReviewToOO -- but the card header reads "Budget Due to OO" per product direction
// for this read-only summary view (2026-09-30, CAMS-909 QA pass). Any future edit form for this
// field should use "review" language to stay consistent with the confirmed semantics.
const BUDGET_DATES: Record<StandingBudgetCardVariant, BudgetDates> = {
  'chapter12-standing': { budgetSubmissionDue: '05/01', budgetReviewToOO: '06/01' },
  'chapter13-standing': { budgetSubmissionDue: '07/01', budgetReviewToOO: '08/15' },
};

export interface StandingBudgetCardProps {
  appointmentId: string;
  variant: StandingBudgetCardVariant;
}

export default function StandingBudgetCard(props: Readonly<StandingBudgetCardProps>) {
  const { appointmentId, variant } = props;
  const { budgetSubmissionDue, budgetReviewToOO } = BUDGET_DATES[variant];

  return (
    <EditableTableCard
      id={`${variant}-budget-${appointmentId}`}
      title="Budget"
      testId={`${variant}-budget-card`}
      className={`${variant}-budget-card`}
      tableId={`${variant}-budget-table-${appointmentId}`}
      tableClassName={`${variant}-budget-table`}
      tableAriaLabel="Budget key dates"
      columns={[
        {
          key: 'budgetSubmissionDue',
          header: 'Budget Submission Due',
          headerLabel: 'Budget Submission Due',
          testId: 'budget-submission-due-row',
        },
        {
          key: 'budgetReviewToOO',
          header: 'Budget Due to OO',
          headerLabel: 'Budget Due to OO',
          testId: 'budget-review-to-oo-row',
        },
      ]}
      values={{
        budgetSubmissionDue,
        budgetReviewToOO,
      }}
    />
  );
}
