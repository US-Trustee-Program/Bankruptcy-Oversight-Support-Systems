import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';

// USTP-mandated fiscal-year budget deadlines for Chapter 13 Standing trustees.
const BUDGET_SUBMISSION_DUE = '07/01';
const BUDGET_DUE_TO_OO = '08/15';

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
        { key: 'budgetReviewToOO', header: 'Budget Due to OO', testId: 'budget-review-to-oo-row' },
      ]}
      values={{
        budgetSubmissionDue: BUDGET_SUBMISSION_DUE,
        budgetReviewToOO: BUDGET_DUE_TO_OO,
      }}
    />
  );
}
