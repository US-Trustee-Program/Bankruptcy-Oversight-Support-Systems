import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { useRef } from 'react';
import { OrderTableImperative } from '@/data-verification/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/ConsolidationOrderModal';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';

export function useConsolidationControlsImpl(): ConsolidationControls {
  const approveButtonRef = useRef<ButtonRef>(null);
  const caseTableRef = useRef<OrderTableImperative>(null);
  const clearButtonRef = useRef<ButtonRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const jointAdministrationRef = useRef<RadioRef>(null);
  const leadCaseDivisionRef = useRef<InputRef>(null);
  const leadCaseNumberRef = useRef<InputRef>(null);
  const rejectButtonRef = useRef<ButtonRef>(null);
  const substantiveRef = useRef<RadioRef>(null);
  const toggleLeadCaseFormRef = useRef<CheckboxRef>(null);

  return {
    approveButtonRef,
    caseTableRef,
    clearButtonRef,
    confirmationModalRef,
    jointAdministrationRef,
    leadCaseDivisionRef,
    leadCaseNumberRef,
    rejectButtonRef,
    substantiveRef,
    toggleLeadCaseFormRef,
  };
}
