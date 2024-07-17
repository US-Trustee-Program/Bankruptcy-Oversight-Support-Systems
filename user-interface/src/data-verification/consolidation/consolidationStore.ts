import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';

interface ConsolidationStore {
  consolidationType: ConsolidationType | null;
  setConsolidationType(val: ConsolidationType | null): void;

  filteredOfficesList: OfficeDetails[] | null;
  setFilteredOfficesList(officesList: OfficeDetails[] | null): void;

  foundValidCaseNumber: boolean;
  setFoundValidCaseNumber(val: boolean): void;

  isProcessing: boolean;
  setIsProcessing(val: boolean): void;

  isDataEnhanced: boolean;
  setIsDataEnhanced(val: boolean): void;

  isValidatingLeadCaseNumber: boolean;
  setIsValidatingLeadCaseNumber(val: boolean): void;

  leadCase: ConsolidationOrderCase | null;
  setLeadCase(val: ConsolidationOrderCase | null): void;

  leadCaseCourt: string;
  setLeadCaseCourt(val: string): void;

  leadCaseId: string;
  setLeadCaseId(val: string): void;

  leadCaseNumber: string;
  setLeadCaseNumber(val: string): void;

  leadCaseNumberError: string;
  setLeadCaseNumberError(val: string): void;

  order: ConsolidationOrder;
  setOrder(order: ConsolidationOrder): void;

  selectedCases: ConsolidationOrderCase[];
  setSelectedCases(cases: ConsolidationOrderCase[]): void;

  showLeadCaseForm: boolean;
  setShowLeadCaseForm(val: boolean): void;
}

export type { ConsolidationStore };
