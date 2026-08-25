import { UpcomingKeyDatesVariant } from '@/trustees/panels/upcomingKeyDatesFieldConfig';

type StaticFieldKind = 'exam-audit-group' | 'tpr-review-period' | 'tpr-due' | 'tir-period';

export interface DatePickerFieldDescriptor {
  kind: 'date-picker';
  id: string;
  label: string;
  formKey: 'leaseExpiration' | 'idExpiration';
}

export type UpcomingFormFieldDescriptor = StaticFieldKind | DatePickerFieldDescriptor;

export const UPCOMING_KEY_DATES_FORM_CONFIG: Record<
  UpcomingKeyDatesVariant,
  UpcomingFormFieldDescriptor[]
> = {
  'chapter7-panel': ['exam-audit-group', 'tpr-review-period', 'tpr-due', 'tir-period'],
  'ch12-13-case-by-case': ['tpr-review-period', 'tpr-due'],
  'chapter12-standing': [
    'tpr-review-period',
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
