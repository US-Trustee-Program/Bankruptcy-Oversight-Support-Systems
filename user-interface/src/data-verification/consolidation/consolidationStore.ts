import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';

interface ConsolidationStore {
  filteredOfficesList: OfficeDetails[] | null;
  setFilteredOfficesList(officesList: OfficeDetails[]): void;

  isProcessing: boolean;
  setIsProcessing(val: boolean): void;

  isDataEnhanced: boolean;
  setIsDataEnhances(val: boolean): void;

  isValidatingLeadCaseNumber: boolean;
  setIsValidatingLeadCaseNumber(val: boolean): void;

  leadCase: ConsolidationOrderCase;
  setLeadCase(val: ConsolidationOrderCase): void;

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

  selectedCases: ConsolidationOrder[];
  setSelectedCases(cases: ConsolidationOrder[]): void;

  showLeadCaseForm: boolean;
  setShowLeadCaseForm(val: boolean): void;

  type: ConsolidationType | null;
  setType(val: ConsolidationType | null): void;
}

export type { ConsolidationStore };
