import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';

// Confirmed by mstankey@flexion.us, 2026-09-29 (cams-plwwz.7).
const BUDGET_SUBMISSION_DUE = '07/01';
const BUDGET_REVIEW_TO_OO = '08/15';

export interface Chapter13StandingBudgetCardProps {
  appointmentId: string;
}

export default function Chapter13StandingBudgetCard(
  props: Readonly<Chapter13StandingBudgetCardProps>,
) {
  const { appointmentId } = props;

  return (
    <EditableTableCard
      id={`chapter13-standing-budget-${appointmentId}`}
      title="Budget"
      testId="chapter13-standing-budget-card"
      className="chapter13-standing-budget-card"
      tableId={`chapter13-standing-budget-table-${appointmentId}`}
      tableClassName="chapter13-standing-budget-table"
      tableAriaLabel="Budget key dates"
      columns={[
        {
          key: 'budgetSubmissionDue',
          header: 'Budget Submission Due',
          testId: 'budget-submission-due-row',
        },
        {
          key: 'budgetReviewToOO',
          header: 'Budget Review to OO',
          testId: 'budget-review-to-oo-row',
        },
      ]}
      values={{
        budgetSubmissionDue: BUDGET_SUBMISSION_DUE,
        budgetReviewToOO: BUDGET_REVIEW_TO_OO,
      }}
    />
  );
}
