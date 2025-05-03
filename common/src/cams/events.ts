import { Auditable } from './auditable';
import { CaseSummary } from './cases';
import { ConsolidationType } from './orders';

export type Consolidation = ConsolidationFrom | ConsolidationTo;

export type ConsolidationDocumentTypes = 'CONSOLIDATION_FROM' | 'CONSOLIDATION_TO';

// Pointer to child case. One for each child.
export type ConsolidationFrom = Auditable &
  ConsolidationDetails &
  EventBase & {
    documentType: 'CONSOLIDATION_FROM';
  };

// Pointer to the LEAD Case.
export type ConsolidationTo = Auditable &
  ConsolidationDetails &
  EventBase & {
    documentType: 'CONSOLIDATION_TO';
  };

export type EventCaseReference = Consolidation | Transfer;

export type Transfer = TransferFrom | TransferTo;

export type TransferFrom = EventBase & {
  documentType: 'TRANSFER_FROM';
};

export type TransferTo = EventBase & {
  documentType: 'TRANSFER_TO';
};

type ConsolidationDetails = {
  consolidationType: ConsolidationType;
};

type EventBase = {
  caseId: string;
  orderDate: string;
  otherCase: CaseSummary; // What happens if/when this is stale?? Store less than CaseSummary???
  // verificationDate: string; // TODO: Need this????
};

export function isJointAdministrationChildCase(references?: Consolidation[]): boolean {
  return consolidationsMatchTypes(references, 'administrative', 'CONSOLIDATION_TO');
}

export function isJointAdministrationLeadCase(references?: Consolidation[]): boolean {
  return consolidationsMatchTypes(references, 'administrative', 'CONSOLIDATION_FROM');
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
