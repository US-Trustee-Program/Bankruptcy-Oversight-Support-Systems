import { CourtDivisionDetails } from '@common/cams/courts';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';

interface ConsolidationStore {
  consolidationType: ConsolidationType | null;
  filteredOfficesList: CourtDivisionDetails[] | null;

  foundValidCaseNumber: boolean;
  isDataEnhanced: boolean;

  isProcessing: boolean;
  isValidatingLeadCaseNumber: boolean;

  leadCase: ConsolidationOrderCase | null;
  leadCaseCourt: string;

  leadCaseId: string;
  leadCaseNumber: string;

  leadCaseNumberError: string;
  order: ConsolidationOrder;

  selectedCases: ConsolidationOrderCase[];
  setConsolidationType(val: ConsolidationType | null): void;

  setFilteredOfficesList(officesList: CourtDivisionDetails[] | null): void;
  setFoundValidCaseNumber(val: boolean): void;

  setIsDataEnhanced(val: boolean): void;
  setIsProcessing(val: boolean): void;

  setIsValidatingLeadCaseNumber(val: boolean): void;
  setLeadCase(val: ConsolidationOrderCase | null): void;

  setLeadCaseCourt(val: string): void;
  setLeadCaseId(val: string): void;

  setLeadCaseNumber(val: string): void;
  setLeadCaseNumberError(val: string): void;

  setOrder(order: ConsolidationOrder): void;
  setSelectedCases(cases: ConsolidationOrderCase[]): void;

  setShowLeadCaseForm(val: boolean): void;
  showLeadCaseForm: boolean;
}

export type { ConsolidationStore };
