import { ConsolidationOrderAccordionProps } from '@/data-verification/ConsolidationOrderAccordion';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';

export function useConsolidationStoreMock(
  props: ConsolidationOrderAccordionProps,
  officesList: OfficeDetails[],
): ConsolidationStore {
  let consolidationType: ConsolidationType | null = null;
  const setConsolidationType = (newType: ConsolidationType): void => {
    consolidationType = newType;
  };

  let filteredOfficesList: OfficeDetails[] | null = filterCourtByDivision(
    props.order.courtDivisionCode,
    officesList,
  );
  const setFilteredOfficesList = (val: OfficeDetails[]): void => {
    filteredOfficesList = val;
  };

  let foundValidCaseNumber: boolean = false;
  const setFoundValidCaseNumber = (val: boolean): void => {
    foundValidCaseNumber = val;
  };

  let isProcessing: boolean = false;
  const setIsProcessing = (val: boolean): void => {
    isProcessing = val;
  };

  let isDataEnhanced: boolean = false;
  const setIsDataEnhanced = (val: boolean): void => {
    isDataEnhanced = val;
  };

  let isValidatingLeadCaseNumber: boolean = false;
  const setIsValidatingLeadCaseNumber = (val: boolean): void => {
    isValidatingLeadCaseNumber = val;
  };

  let leadCase: ConsolidationOrderCase | null = null;
  const setLeadCase = (val: ConsolidationOrderCase | null): void => {
    leadCase = val;
  };

  let leadCaseCourt: string = '';
  const setLeadCaseCourt = (val: string): void => {
    leadCaseCourt = val;
  };

  let leadCaseId: string = '';
  const setLeadCaseId = (val: string): void => {
    leadCaseId = val;
  };

  let leadCaseNumber: string = '';
  const setLeadCaseNumber = (val: string): void => {
    leadCaseNumber = val;
  };

  let leadCaseNumberError: string = '';
  const setLeadCaseNumberError = (val: string): void => {
    leadCaseNumberError = val;
  };

  let order: ConsolidationOrder = props.order;
  const setOrder = (val: ConsolidationOrder): void => {
    order = val;
  };

  let selectedCases: ConsolidationOrderCase[] = [];
  const setSelectedCases = (val: ConsolidationOrderCase[]): void => {
    selectedCases = val;
  };

  let showLeadCaseForm: boolean = false;
  const setShowLeadCaseForm = (val: boolean): void => {
    showLeadCaseForm = val;
  };

  return {
    consolidationType,
    setConsolidationType,
    filteredOfficesList,
    setFilteredOfficesList,
    foundValidCaseNumber,
    setFoundValidCaseNumber,
    isProcessing,
    setIsProcessing,
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
