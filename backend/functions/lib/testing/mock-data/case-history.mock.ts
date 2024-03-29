import { CaseAssignmentHistory } from '../../../../../common/src/cams/history';

export const CASE_HISTORY: CaseAssignmentHistory[] = [
  {
    id: 'da2ba8c0-b38b-4b4b-a4d7-986e0fdb671a',
    caseId: '081-22-84687',
    documentType: 'AUDIT_ASSIGNMENT',
    occurredAtTimestamp: '2023-12-14T21:39:18.909Z',
    before: [],
    after: [
      {
        id: '2265215f-88e8-4cc7-a2d1-2d5ebaaabe73',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Susan Arbeit',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
      {
        id: 'de6f4277-b7a8-4d90-bdb7-59a52d14d895',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Mark Bruh',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
      {
        id: 'a2cb1c7c-2c1f-412d-bd0a-c1b412769de1',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Shara Cornell',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
    ],
  },
  {
    id: '72515281-2ac9-49f6-b40c-affcc12ec059',
    caseId: '081-22-84687',
    documentType: 'AUDIT_ASSIGNMENT',
    occurredAtTimestamp: '2023-12-14T21:39:26.755Z',
    before: [
      {
        id: '2265215f-88e8-4cc7-a2d1-2d5ebaaabe73',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Susan Arbeit',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
      {
        id: 'de6f4277-b7a8-4d90-bdb7-59a52d14d895',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Mark Bruh',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
      {
        id: 'a2cb1c7c-2c1f-412d-bd0a-c1b412769de1',
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Shara Cornell',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
      },
    ],
    after: [
      {
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Shara Cornell',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:18.909Z',
        id: 'a2cb1c7c-2c1f-412d-bd0a-c1b412769de1',
      },
      {
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Brian S Masumoto',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:26.755Z',
        id: '8d101caa-e3c8-4927-8cf4-3a57a481bf9c',
      },
      {
        documentType: 'ASSIGNMENT',
        caseId: '081-22-84687',
        name: 'Daniel Rudewicz',
        role: 'TrialAttorney',
        assignedOn: '2023-12-14T21:39:26.755Z',
        id: '7a6e1dba-4a27-4c59-85bb-919a6746a676',
      },
    ],
  },
];
