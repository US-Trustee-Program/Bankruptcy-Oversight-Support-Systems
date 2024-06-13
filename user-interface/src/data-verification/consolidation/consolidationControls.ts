import { OrderTableImperative } from '@/data-verification/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/ConsolidationOrderModal';
import React from 'react';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';

interface ConsolidationControls {
  approveButtonRef: React.RefObject<ButtonRef>;
  caseTableRef: React.RefObject<OrderTableImperative>;
  clearButtonRef: React.RefObject<ButtonRef>;
  confirmationModalRef: React.RefObject<ConfirmationModalImperative>;
  jointAdministrationRef: React.RefObject<RadioRef>;
  leadCaseDivisionRef: React.RefObject<InputRef>;
  leadCaseNumberRef: React.RefObject<InputRef>;
  rejectButtonRef: React.RefObject<ButtonRef>;
  substantiveRef: React.RefObject<RadioRef>;
  toggleLeadCaseFormRef: React.RefObject<CheckboxRef>;
}

export type { ConsolidationControls };
