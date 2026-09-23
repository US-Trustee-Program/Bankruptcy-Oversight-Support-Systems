import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';

export default function Chapter12StandingBudgetCard() {
  return (
    <EditableTableCard
      id="chapter12-standing-budget"
      title="Budget"
      testId="chapter12-standing-budget-card"
      className="chapter12-standing-budget-card"
      tableId="chapter12-standing-budget-table"
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
