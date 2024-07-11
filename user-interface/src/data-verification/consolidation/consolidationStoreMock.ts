import { ConsolidationOrderAccordionProps } from '@/data-verification/ConsolidationOrderAccordion';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';

export class ConsolidationStoreMock implements ConsolidationStore {
  consolidationType: ConsolidationType | null = null;
  filteredOfficesList: OfficeDetails[] | null;
  foundValidCaseNumber: boolean = false;
  isProcessing: boolean = false;
  isDataEnhanced: boolean = false;
  isValidatingLeadCaseNumber: boolean = false;
  leadCase: ConsolidationOrderCase | null = null;
  leadCaseCourt: string = '';
  leadCaseId: string = '';
  leadCaseNumber: string = '';
  leadCaseNumberError: string = '';
  order: ConsolidationOrder;
  selectedCases: ConsolidationOrderCase[] = [];
  showLeadCaseForm: boolean = false;

  constructor(props: ConsolidationOrderAccordionProps, officesList: OfficeDetails[]) {
    this.filteredOfficesList = filterCourtByDivision(props.order.courtDivisionCode, officesList);
    this.order = props.order;
  }

  setConsolidationType = (newType: ConsolidationType): void => {
    this.consolidationType = newType;
  };

  setFilteredOfficesList = (val: OfficeDetails[]): void => {
    this.filteredOfficesList = val;
  };

  setFoundValidCaseNumber = (val: boolean): void => {
    this.foundValidCaseNumber = val;
  };

  setIsProcessing = (val: boolean): void => {
    this.isProcessing = val;
  };

  setIsDataEnhanced = (val: boolean): void => {
    this.isDataEnhanced = val;
  };

  setIsValidatingLeadCaseNumber = (val: boolean): void => {
    this.isValidatingLeadCaseNumber = val;
  };

  setLeadCase = (val: ConsolidationOrderCase | null): void => {
    this.leadCase = val;
  };

  setLeadCaseCourt = (val: string): void => {
    this.leadCaseCourt = val;
  };

  setLeadCaseId = (val: string): void => {
    this.leadCaseId = val;
  };

  setLeadCaseNumber = (val: string): void => {
    this.leadCaseNumber = val;
  };

  setLeadCaseNumberError = (val: string): void => {
    this.leadCaseNumberError = val;
  };

  setOrder = (val: ConsolidationOrder): void => {
    this.order = val;
  };

  setSelectedCases = (val: ConsolidationOrderCase[]): void => {
    this.selectedCases = val;
  };

  setShowLeadCaseForm = (val: boolean): void => {
    this.showLeadCaseForm = val;
  };
}
