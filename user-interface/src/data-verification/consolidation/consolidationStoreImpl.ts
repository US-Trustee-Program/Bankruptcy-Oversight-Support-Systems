import { useState } from 'react';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import { ConsolidationOrderAccordionProps } from '@/data-verification/ConsolidationOrderAccordion';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';

export function useConsolidationStoreImpl(
  props: ConsolidationOrderAccordionProps,
  officesList: OfficeDetails[],
): ConsolidationStore {
  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);
  const [filteredOfficesList, setFilteredOfficesList] = useState<OfficeDetails[] | null>(
    filterCourtByDivision(props.order.courtDivisionCode, officesList),
  );
  const [foundValidCaseNumber, setFoundValidCaseNumber] = useState<boolean>(false);
  const [isConsolidationProcessing, setIsConsolidationProcessing] = useState<boolean>(false);
  const [isDataEnhanced, setIsDataEnhanced] = useState<boolean>(false);
  const [isValidatingLeadCaseNumber, setIsValidatingLeadCaseNumber] = useState<boolean>(false);
  const [leadCaseId, setLeadCaseId] = useState<string>('');
  const [leadCase, setLeadCase] = useState<ConsolidationOrderCase | null>(null);
  const [leadCaseCourt, setLeadCaseCourt] = useState<string>('');
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const [leadCaseNumberError, setLeadCaseNumberError] = useState<string>('');
  const [order, setOrder] = useState<ConsolidationOrder>(props.order);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const [showLeadCaseForm, setShowLeadCaseForm] = useState<boolean>(false);

  return {
    consolidationType,
    setConsolidationType,
    filteredOfficesList,
    setFilteredOfficesList,
    foundValidCaseNumber,
    setFoundValidCaseNumber,
    isProcessing: isConsolidationProcessing,
    setIsProcessing: setIsConsolidationProcessing,
    isDataEnhanced,
    setIsDataEnhanced,
    isValidatingLeadCaseNumber,
    setIsValidatingLeadCaseNumber,
    leadCase,
    setLeadCase,
    leadCaseCourt,
    setLeadCaseCourt,
    leadCaseId,
    setLeadCaseId,
    leadCaseNumber,
    setLeadCaseNumber,
    leadCaseNumberError,
    setLeadCaseNumberError,
    order,
    setOrder,
    selectedCases,
    setSelectedCases,
    showLeadCaseForm,
    setShowLeadCaseForm,
  };
}
