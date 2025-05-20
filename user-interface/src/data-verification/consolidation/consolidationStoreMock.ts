import { ConsolidationOrderAccordionProps } from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import { filterCourtByDivision, CourtDivisionDetails } from '@common/cams/courts';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrder, ConsolidationOrderCase, ConsolidationType } from '@common/cams/orders';

export class ConsolidationStoreMock implements ConsolidationStore {
  addCaseNumberError: string | null = null;
  caseToAdd: ConsolidationOrderCase | null = null;
  consolidationType: ConsolidationType | null = null;
  filteredOfficesList: CourtDivisionDetails[] | null;
  foundValidCaseNumber: boolean = false;
  isProcessing: boolean = false;
  isDataEnhanced: boolean = false;
  isLookingForCase: boolean = false;
  isValidatingLeadCaseNumber: boolean = false;
  leadCase: ConsolidationOrderCase | null = null;
  leadCaseCourt: string = '';
  leadCaseId: string = '';
  leadCaseNumber: string = '';
  leadCaseNumberError: string = '';
  order: ConsolidationOrder;
  selectedCases: ConsolidationOrderCase[] = [];
  showLeadCaseForm: boolean = false;
  caseToAddCourt: string = '';
  caseToAddCaseNumber: string = '';

  constructor(props: ConsolidationOrderAccordionProps, officesList: CourtDivisionDetails[]) {
    this.filteredOfficesList = filterCourtByDivision(props.order.courtDivisionCode, officesList);
    this.order = props.order;
  }

  setCaseToAddCourt = (val: string): void => {
    this.caseToAddCourt = val;
  };

  setCaseToAddCaseNumber = (val: string): void => {
    this.caseToAddCaseNumber = val;
  };

  setAddCaseNumberError = (val: string | null): void => {
    this.addCaseNumberError = val;
  };

  setCaseToAdd = (val: ConsolidationOrderCase | null): void => {
    this.caseToAdd = val;
  };

  setConsolidationType = (newType: ConsolidationType): void => {
    this.consolidationType = newType;
  };

  setFilteredOfficesList = (val: CourtDivisionDetails[]): void => {
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

  setIsLookingForCase = (val: boolean): void => {
    this.isLookingForCase = val;
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
