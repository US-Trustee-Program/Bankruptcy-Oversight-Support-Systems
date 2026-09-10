import { UpcomingKeyDatesVariant } from '@/trustees/panels/upcomingKeyDatesFieldConfig';

type StaticFieldKind =
  'exam-audit-group' | 'tpr-review-period' | 'tpr-frequency' | 'tpr-due' | 'tir-period';

export interface DatePickerFieldDescriptor {
  kind: 'date-picker';
  id: string;
  label: string;
  formKey: 'leaseExpiration' | 'idExpiration';
}

export type UpcomingFormFieldDescriptor = StaticFieldKind | DatePickerFieldDescriptor;

const UPCOMING_KEY_DATES_FORM_CONFIG: Record<
  UpcomingKeyDatesVariant,
  UpcomingFormFieldDescriptor[]
> = {
  'chapter7-panel': [
    'exam-audit-group',
    'tpr-review-period',
    'tpr-frequency',
    'tpr-due',
    'tir-period',
  ],
  'ch12-13-case-by-case': ['tpr-review-period', 'tpr-frequency', 'tpr-due'],
  'chapter12-standing': [
    'tpr-review-period',
    'tpr-frequency',
    'tpr-due',
    {
      kind: 'date-picker',
      id: 'lease-expiration',
      label: 'Lease Expiration',
      formKey: 'leaseExpiration',
    },
    {
      kind: 'date-picker',
      id: 'id-expiration',
      label: 'ID Expiration',
      formKey: 'idExpiration',
    },
  ],
  'chapter13-standing': [
    'tpr-review-period',
    'tpr-frequency',
    'tpr-due',
    {
      kind: 'date-picker',
      id: 'lease-expiration',
      label: 'Lease Expiration',
      formKey: 'leaseExpiration',
    },
    {
      kind: 'date-picker',
      id: 'id-expiration',
      label: 'ID Expiration',
      formKey: 'idExpiration',
    },
  ],
};

export function getUpcomingKeyDatesFormConfig(
  variant: UpcomingKeyDatesVariant,
  tprDisplayUpdates: boolean,
): UpcomingFormFieldDescriptor[] {
  const base = UPCOMING_KEY_DATES_FORM_CONFIG[variant];
  if (tprDisplayUpdates) {
    return base;
  }
  return base.filter((d) => d !== 'tpr-frequency');
}
