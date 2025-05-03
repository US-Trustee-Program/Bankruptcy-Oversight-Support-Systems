import { ConsolidationOrderAccordionProps } from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { CourtDivisionDetails, filterCourtByDivision } from '@common/cams/courts';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';
import { useState } from 'react';

export function useConsolidationStoreReact(
  props: ConsolidationOrderAccordionProps,
  officesList: CourtDivisionDetails[],
): ConsolidationStore {
  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);
  const [filteredOfficesList, setFilteredOfficesList] = useState<CourtDivisionDetails[] | null>(
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
    filteredOfficesList,
    foundValidCaseNumber,
    isDataEnhanced,
    isProcessing: isConsolidationProcessing,
    isValidatingLeadCaseNumber,
    leadCase,
    leadCaseCourt,
    leadCaseId,
    leadCaseNumber,
    leadCaseNumberError,
    order,
    selectedCases,
    setConsolidationType,
    setFilteredOfficesList,
    setFoundValidCaseNumber,
    setIsDataEnhanced,
    setIsProcessing: setIsConsolidationProcessing,
    setIsValidatingLeadCaseNumber,
    setLeadCase,
    setLeadCaseCourt,
    setLeadCaseId,
    setLeadCaseNumber,
    setLeadCaseNumberError,
    setOrder,
    setSelectedCases,
    setShowLeadCaseForm,
    showLeadCaseForm,
  };
}
