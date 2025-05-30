import { useState } from 'react';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';
import { filterCourtByDivision, CourtDivisionDetails } from '@common/cams/courts';
import { ConsolidationOrderAccordionProps } from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';

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
  const [addCaseNumberError, setAddCaseNumberError] = useState<string | null>(null);
  const [caseToAdd, setCaseToAdd] = useState<ConsolidationOrderCase | null>(null);
  const [isLookingForCase, setIsLookingForCase] = useState<boolean>(false);
  const [caseToAddCourt, setCaseToAddCourt] = useState<string>('');
  const [caseToAddCaseNumber, setCaseToAddCaseNumber] = useState<string>('');

  return {
    caseToAddCourt,
    setCaseToAddCourt,
    caseToAddCaseNumber,
    setCaseToAddCaseNumber,
    addCaseNumberError,
    setAddCaseNumberError,
    caseToAdd,
    setCaseToAdd,
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
    isLookingForCase,
    setIsLookingForCase,
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
