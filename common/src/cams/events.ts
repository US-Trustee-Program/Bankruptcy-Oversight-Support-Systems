import { CaseSummary } from './cases';
import { ConsolidationType } from './orders';

type EventBase = {
  caseId: string;
  orderDate: string;
  otherCase: CaseSummary; // What happens if/when this is stale?? Store less than CaseSummary???
  // verificationDate: string; // TODO: Need this????
};

export type TransferFrom = EventBase & {
  documentType: 'TRANSFER_FROM';
};

export type TransferTo = EventBase & {
  documentType: 'TRANSFER_TO';
};

export type Transfer = TransferFrom | TransferTo;

export type ConsolidationDocumentTypes = 'CONSOLIDATION_FROM' | 'CONSOLIDATION_TO';

type ConsolidationDetails = {
  consolidationType: ConsolidationType;
};

// Pointer to the LEAD Case.
export type ConsolidationTo = EventBase &
  ConsolidationDetails & {
    documentType: 'CONSOLIDATION_TO';
  };

// Pointer to child case. One for each child.
export type ConsolidationFrom = EventBase &
  ConsolidationDetails & {
    documentType: 'CONSOLIDATION_FROM';
  };

export type Consolidation = ConsolidationTo | ConsolidationFrom;

export type EventCaseReference = Consolidation | Transfer;

export function isJointAdministrationLeadCase(references?: Consolidation[]): boolean {
  return consolidationsMatchTypes(references, 'administrative', 'CONSOLIDATION_FROM');
}

export function isJointAdministrationChildCase(references?: Consolidation[]): boolean {
  return consolidationsMatchTypes(references, 'administrative', 'CONSOLIDATION_TO');
}

function consolidationsMatchTypes(
  references: Consolidation[] | undefined,
  consolidationType: ConsolidationType,
  documentType: ConsolidationDocumentTypes,
): boolean {
  if (!references || !references.length) return false;
  return references.reduce((isMatch, reference) => {
    return (
      isMatch ||
      (reference.consolidationType === consolidationType && reference.documentType === documentType)
    );
  }, false);
}
