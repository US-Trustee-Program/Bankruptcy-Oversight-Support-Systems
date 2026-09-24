import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';

// USTP-mandated fiscal-year budget deadlines for Chapter 13 Standing trustees.
const BUDGET_SUBMISSION_DUE = '07/01';
const BUDGET_DUE_TO_OO = '08/15';

export default function Chapter13StandingBudgetCard() {
  return (
    <Chapter13StandingKeyDatesCard
      title="Budget"
      testId="chapter13-standing-budget-card"
      fields={[
        {
          label: 'Budget Submission Due',
          value: BUDGET_SUBMISSION_DUE,
          testId: 'budget-submission-due-row',
        },
        { label: 'Budget Due to OO', value: BUDGET_DUE_TO_OO, testId: 'budget-review-to-oo-row' },
      ]}
    />
  );
}
