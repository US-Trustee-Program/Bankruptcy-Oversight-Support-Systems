interface AbstractTransfer {
  caseId: string;
  otherCaseId: string;
  orderDate: string;
  divisionName: string;
  courtName: string;
}

export type TransferIn = AbstractTransfer & {
  documentType: 'TRANSFER_IN';
};

export type TransferOut = AbstractTransfer & {
  documentType: 'TRANSFER_OUT';
};

export type Transfer = TransferIn | TransferOut;
