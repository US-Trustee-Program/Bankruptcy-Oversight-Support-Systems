import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';

export interface Chapter12StandingBudgetCardProps {
  appointmentId: string;
}

export default function Chapter12StandingBudgetCard(
  props: Readonly<Chapter12StandingBudgetCardProps>,
) {
  const { appointmentId } = props;

  return (
    <EditableTableCard
      id={`chapter12-standing-budget-${appointmentId}`}
      title="Budget"
      testId="chapter12-standing-budget-card"
      className="chapter12-standing-budget-card"
      tableId={`chapter12-standing-budget-table-${appointmentId}`}
      tableClassName="chapter12-standing-budget-table"
      tableAriaLabel="Budget key dates"
      columns={[
        {
          key: 'budgetSubmissionDue',
          header: 'Budget Submission Due',
          testId: 'budget-submission-due-row',
        },
        {
          key: 'budgetReviewToOO',
          header: 'Budget Due to OO',
          testId: 'budget-review-to-oo-row',
        },
      ]}
      values={{
        budgetSubmissionDue: '05/01',
        budgetReviewToOO: '06/01',
      }}
    />
  );
}
