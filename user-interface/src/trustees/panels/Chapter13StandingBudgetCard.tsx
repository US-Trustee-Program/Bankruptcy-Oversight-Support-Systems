import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';

export default function Chapter13StandingBudgetCard() {
  return (
    <Chapter13StandingKeyDatesCard
      title="Budget"
      testId="chapter13-standing-budget-card"
      fields={[
        { label: 'Budget Submission Due', value: '07/01', testId: 'budget-submission-due-row' },
        { label: 'Budget Due to OO', value: '08/15', testId: 'budget-review-to-oo-row' },
      ]}
    />
  );
}
