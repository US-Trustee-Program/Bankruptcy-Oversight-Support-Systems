export type CaseDocketEntryDocument = {
  sequenceNumber: number;
  fileUri: string;
  fileSize: number;
  fileLabel?: string;
};

export type CaseDocketEntry = {
  sequenceNumber: number;
  documentNumber?: number;
  dateFiled: string;
  summaryText: string;
  fullText: string;
  documents?: CaseDocketEntryDocument[];
};

export type CaseDocket = Array<CaseDocketEntry>;
