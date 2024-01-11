import { Order } from '../../use-cases/orders/orders.model';

export const ORDERS: Order[] = [
  {
    id: 'test-id-0',
    caseId: '111-11-11111',
    caseTitle: 'Foreign Business Entity',
    chapter: '15',
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    orderType: 'transfer',
    orderDate: '2023-11-02',
    status: 'pending',
    newCaseId: '012-34-56789',
    sequenceNumber: 100,
    dateFiled: '2023-11-02',
    summaryText: 'Order to Transfer',
    fullText: 'It is ordered that the case be transferred...',
  },
];
