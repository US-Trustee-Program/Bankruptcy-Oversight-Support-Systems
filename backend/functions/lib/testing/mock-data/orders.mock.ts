import { TransferOrder } from '../../../../../common/src/cams/orders';

export const ORDERS: TransferOrder[] = [
  {
    id: 'test-id-0',
    orderType: 'transfer',
    status: 'pending',
    caseId: '111-11-11111',
    caseTitle: 'Foreign Business Entity',
    chapter: '15',
    regionId: '02',
    courtName: 'Southern District of New York',
    courtDivision: '',
    courtDivisionName: 'Manhattan',
    orderDate: '2023-11-02',
    dateFiled: '2023-11-02',
    newCaseId: '34-56789',
    docketEntries: [
      {
        dateFiled: '2023-11-02',
        sequenceNumber: 100,
        summaryText: 'Order to Transfer',
        fullText: 'It is ordered that the case be transferred...',
      },
    ],
    courtId: '',
    debtor: {
      name: 'DebtorName',
    },
    dxtrId: '0',
    groupDesignator: '',
    officeCode: '',
    officeName: '',
    regionName: '',
  },
];
