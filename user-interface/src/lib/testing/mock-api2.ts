import { ResponseBody } from '@common/api/response';
import { ObjectKeyVal } from '../type-declarations/basic';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import {
  CaseDetail,
  CaseDocket,
  CaseNote,
  CaseNoteInput,
  CaseSummary,
  SyncedCase,
} from '@common/cams/cases';
import { AttorneyUser, CamsUserReference, PrivilegedIdentityUser, Staff } from '@common/cams/users';
import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
import { CaseHistory } from '@common/cams/history';
import { CamsSession } from '@common/cams/session';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
} from '@common/cams/orders';
import { CasesSearchPredicate } from '@common/api/search';
import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '@common/cams/offices';
import {
  ElevatePrivilegedUserAction,
  RoleAndOfficeGroupNames,
} from '@common/cams/privileged-identity';
import {
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeOversightAssignment,
} from '@common/cams/trustees';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { Creatable } from '@common/cams/creatable';
import { BankListItem, BankruptcySoftwareListItem } from '@common/cams/lists';
import { CamsRole, OversightRoleType } from '@common/cams/roles';

// Helper to generate a random ID
function randomId() {
  return (
    'guid-' +
    Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')
  );
}

// Helper to generate a random case number
function randomCaseNumber() {
  return (Math.floor(Math.random() * 90000) + 10000).toString();
}

// Helper to generate mock JWT token
function generateMockJWT(): string {
  const header = { typ: 'JWT', alg: 'HS256' };
  // Set expiration far in the future to avoid session timeout issues
  const futureExpiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year from now
  const payload = {
    iss: 'http://fake.issuer.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'fakeApi',
    exp: futureExpiration,
    groups: [],
  };
  // Generate signature at runtime to avoid base64 literals in source
  const signature = btoa('MOCK_SIGNATURE_FOR_TESTING_ONLY_NOT_REAL');

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const caseDocketEntries = [
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2025-12-30',
    summaryText: 'Alias calco decumbo constans voluptatum.',
    fullText:
      'Clementia colo concedo amplus natus. Provident cauda tergiversatio verumtamen aegre officiis enim aiunt adnuo thorax. Tremo tonsor defaeco adamo coadunatio vinculum cupiditas cubitum totidem.',
    documents: [
      {
        fileUri: '001-24-00001-1-0.pdf',
        fileSize: 594618,
        fileLabel: '0',
      },
      {
        fileUri: '001-24-00001-1-1.pdf',
        fileSize: 308742,
        fileLabel: '1',
      },
    ],
  },
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2024-12-10',
    summaryText: 'Abstergo vitiosus vindico deripio conventus ager tricesimus.',
    fullText:
      'Depulso demergo aedificium tam vacuus convoco cunabula. Volubilis aggredior ocer. Accusamus tenus contego succurro reprehenderit optio tutamen.',
    documents: [
      {
        fileUri: '001-24-00001-1-0.pdf',
        fileSize: 239817,
        fileLabel: '0',
      },
      {
        fileUri: '001-24-00001-1-1.pdf',
        fileSize: 390324,
        fileLabel: '1',
      },
    ],
  },
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2024-08-12',
    summaryText: 'Tempus abscido cubicularis officiis apto bardus.',
    fullText:
      'Tamisium creator nulla dedico cuius arguo absens molestias aufero timidus. Et terga caute textus subnecto tener. Aqua vomica basium vito conspergo vespillo varius.',
    documents: [],
  },
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2024-10-21',
    summaryText: 'Careo stillicidium voluptatum.',
    fullText:
      'Vacuus denuo alienus ocer defungo sortitus utilis. Subvenio depulso assentator conscendo. At cribro tum despecto vita decipio.',
    documents: [
      {
        fileUri: '001-24-00001-1-0.pdf',
        fileSize: 319123,
        fileLabel: '0',
      },
      {
        fileUri: '001-24-00001-1-1.pdf',
        fileSize: 983012,
        fileLabel: '1',
      },
      {
        fileUri: '001-24-00001-1-2.pdf',
        fileSize: 718038,
        fileLabel: '2',
      },
    ],
  },
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2026-08-07',
    summaryText: 'Alo accusantium conduco succedo sponte ceno.',
    fullText:
      'Sursum ver cometes ultio verto appositus triumphus. Copia sponte abeo totus aeneus utilis bonus suscipio terra. Amplitudo decerno peior.',
    documents: [
      {
        fileUri: '001-24-00001-1-0.pdf',
        fileSize: 950943,
        fileLabel: '0',
      },
      {
        fileUri: '001-24-00001-1-1.pdf',
        fileSize: 967201,
        fileLabel: '1',
      },
    ],
  },
];

const resourceActionCaseNotes = [
  {
    id: '86531537-2350-463B-A28F-F218E122B458',
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: '101-12-12345',
    content: 'Test Note',
    updatedOn: '2023-01-29',
    updatedBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    createdOn: '2023-01-29',
    createdBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    _actions: [
      {
        actionName: 'edit note',
        method: 'PUT',
        path: '/cases/${caseId}/notes/${id}',
      },
      {
        actionName: 'remove note',
        method: 'DELETE',
        path: '/cases/${caseId}/notes/${id}',
      },
    ],
  },
  {
    id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: '101-12-12345',
    content: 'Test Note',
    updatedOn: '2023-01-29',
    updatedBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    createdOn: '2023-01-29',
    createdBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    _actions: [
      {
        actionName: 'edit note',
        method: 'PUT',
        path: '/cases/${caseId}/notes/${id}',
      },
      {
        actionName: 'remove note',
        method: 'DELETE',
        path: '/cases/${caseId}/notes/${id}',
      },
    ],
  },
  {
    id: '12345678-90AB-CDEF-1234-567890ABCDEF',
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: '101-12-12345',
    content: 'Test Note',
    updatedOn: '2023-01-29',
    updatedBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    createdOn: '2023-01-29',
    createdBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    _actions: [
      {
        actionName: 'edit note',
        method: 'PUT',
        path: '/cases/${caseId}/notes/${id}',
      },
      {
        actionName: 'remove note',
        method: 'DELETE',
        path: '/cases/${caseId}/notes/${id}',
      },
    ],
  },
  {
    id: 'FEDCBA98-7654-3210-FEDC-BA9876543210',
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: '101-12-12345',
    content: 'Test Note',
    updatedOn: '2023-01-29',
    updatedBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    createdOn: '2023-01-29',
    createdBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    _actions: [
      {
        actionName: 'edit note',
        method: 'PUT',
        path: '/cases/${caseId}/notes/${id}',
      },
      {
        actionName: 'remove note',
        method: 'DELETE',
        path: '/cases/${caseId}/notes/${id}',
      },
    ],
  },
  {
    id: '11223344-5566-7788-99AA-BBCCDDEEFF00',
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: '101-12-12345',
    content: 'Test Note',
    updatedOn: '2023-01-29',
    updatedBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    createdOn: '2023-01-29',
    createdBy: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
    },
    _actions: [
      {
        actionName: 'edit note',
        method: 'PUT',
        path: '/cases/${caseId}/notes/${id}',
      },
      {
        actionName: 'remove note',
        method: 'DELETE',
        path: '/cases/${caseId}/notes/${id}',
      },
    ],
  },
];

const caseDetails = {
  debtor: {
    name: 'Trevor Shields',
    address1: '347 Balmoral Road',
    address2: 'Apt. 717',
    address3: 'suite 100',
    cityStateZipCountry: 'Kyleehaven, NH, 33462, US',
    phone: '1-204-717-9520',
    extension: '516854',
    email: 'Aiyana47@hotmail.com',
  },
  officeName: 'Santa Ana',
  officeCode: '8',
  courtId: '0973',
  courtName: 'Central District of California',
  courtDivisionCode: '738',
  courtDivisionName: 'Santa Ana',
  groupDesignator: 'SA',
  regionId: '16',
  regionName: 'LOS ANGELES',
  state: 'CA',
  dxtrId: '0',
  caseId: '101-12-12345',
  chapter: '15',
  caseTitle: 'Test Case Title',
  dateFiled: '2025-09-19',
  debtorTypeCode: 'CB',
  debtorTypeLabel: 'Corporate Business',
  assignments: [],
  transfers: [],
  consolidation: [],
  debtorAttorney: {
    name: 'Miss Toni Quitzon',
    address1: '436 Walnut Street',
    address2: 'Apt. 545',
    address3: 'suite 100',
    cityStateZipCountry: 'Gislasonland, AK, 46119-2320, US',
    phone: '218-634-1652',
    email: 'Antone.Hettinger@yahoo.com',
    office: 'Adams - Watsica',
  },
  judgeName: 'Rafael Padberg-Langworth',
  _actions: [
    {
      actionName: 'manage assignments',
      method: 'POST',
      path: '/case-assignments/${caseId}',
    },
  ],
  petitionLabel: 'Voluntary',
  trustee: {
    name: 'Frances Armstrong',
    legacy: {
      address1: '22156 Old Military Road',
      address2: 'Suite 411',
      address3: 'suite 100',
      cityStateZipCountry: 'East Monteburgh, AL, 22360, US',
      phone: '(553) 469-4817 x7050',
      email: 'Kylie.Haley@gmail.com',
    },
  },
};

const courts = [
  {
    officeName: 'Juneau',
    officeCode: '1',
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '710',
    courtDivisionName: 'Juneau',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    officeName: 'Nome',
    officeCode: '2',
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '720',
    courtDivisionName: 'Nome',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    officeName: 'Anchorage',
    officeCode: '3',
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '730',
    courtDivisionName: 'Anchorage',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    officeName: 'Fairbanks',
    officeCode: '4',
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '740',
    courtDivisionName: 'Fairbanks',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    officeName: 'Ketchikan',
    officeCode: '5',
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '750',
    courtDivisionName: 'Ketchikan',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
];

const consolidation: Array<ConsolidationTo | ConsolidationFrom> = [
  {
    caseId: '999-99-93507',
    consolidationType: 'administrative',
    documentType: 'CONSOLIDATION_TO',
    orderDate: '2026-06-25',
    otherCase: {
      debtor: {
        name: 'Dave Wintheiser',
        address1: '857 Terrell Mall',
        address2: 'Apt. 752',
        address3: 'suite 100',
        cityStateZipCountry: 'Woodbury, UT, 13173, US',
        phone: '1-234-583-5585',
        extension: '549450',
        email: 'Reggie_Skiles46@gmail.com',
      },
      officeName: 'Columbus',
      officeCode: '4',
      courtId: '113G',
      courtName: 'Middle District of Georgia',
      courtDivisionCode: '334',
      courtDivisionName: 'Columbus',
      groupDesignator: 'MC',
      regionId: '21',
      regionName: 'ATLANTA',
      state: 'GA',
      dxtrId: '0',
      caseId: '999-99-00001',
      chapter: '12',
      caseTitle: 'Candace West-Barrows',
      dateFiled: '2025-03-30',
      debtorTypeCode: 'CB',
      debtorTypeLabel: 'Corporate Business',
    },
    updatedBy: {
      id: '123',
      name: 'Diane Nikolaus',
    },
    updatedOn: '2025-01-26',
  },
  {
    caseId: '999-99-00001',
    consolidationType: 'administrative',
    documentType: 'CONSOLIDATION_FROM',
    orderDate: '2026-05-12',
    otherCase: {
      debtor: {
        name: 'Brent Kassulke',
        address1: '124 Leatha Loop',
        address2: 'Suite 810',
        address3: 'suite 100',
        cityStateZipCountry: 'West Anthony, WI, 03510-3711, US',
        phone: '862.755.2942 x6107',
        extension: '756198',
        email: 'Monserrat.Schroeder@hotmail.com',
      },
      officeName: 'Paducah',
      officeCode: '5',
      courtId: '0644',
      courtName: 'Western District of Kentucky',
      courtDivisionCode: '445',
      courtDivisionName: 'Paducah',
      groupDesignator: 'LO',
      regionId: '8',
      regionName: 'MEMPHIS',
      state: 'KY',
      dxtrId: '0',
      caseId: '445-99-81271',
      chapter: '12',
      caseTitle: 'Kurt Hudson II',
      dateFiled: '2025-07-27',
      debtorTypeCode: 'IC',
      debtorTypeLabel: 'Individual Consumer',
    },
    updatedBy: {
      id: '123',
      name: 'Dr. Terrell Zieme',
    },
    updatedOn: '2026-01-25',
  },
  {
    caseId: '999-99-00001',
    consolidationType: 'administrative',
    documentType: 'CONSOLIDATION_FROM',
    orderDate: '2026-03-05',
    otherCase: {
      debtor: {
        name: 'Kristopher Hartmann',
        address1: '154 Oxford Road',
        address2: 'Suite 859',
        address3: 'suite 100',
        cityStateZipCountry: 'Hayward, NV, 87284, US',
        phone: '(609) 777-0451 x81084',
        extension: '948213',
        email: 'Kirsten28@gmail.com',
      },
      officeName: 'Las Vegas',
      officeCode: '2',
      courtId: '0978',
      courtName: 'District of Nevada',
      courtDivisionCode: '782',
      courtDivisionName: 'Las Vegas',
      groupDesignator: 'LV',
      regionId: '17',
      regionName: 'SAN FRANCISCO',
      state: 'NV',
      dxtrId: '0',
      caseId: '782-99-50119',
      chapter: '11',
      caseTitle: 'Ms. Lila Ritchie',
      dateFiled: '2024-04-06',
      debtorTypeCode: 'IC',
      debtorTypeLabel: 'Individual Consumer',
    },
    updatedBy: {
      id: '123',
      name: 'Jackie Crona',
    },
    updatedOn: '2024-12-20',
  },
];

const consolidationLeadCase = {
  debtor: {
    name: 'Dave Wintheiser',
    address1: '857 Terrell Mall',
    address2: 'Apt. 752',
    address3: 'suite 100',
    cityStateZipCountry: 'Woodbury, UT, 13173, US',
    phone: '1-234-583-5585',
    extension: '549450',
    email: 'Reggie_Skiles46@gmail.com',
  },
  officeName: 'Columbus',
  officeCode: '4',
  courtId: '113G',
  courtName: 'Middle District of Georgia',
  courtDivisionCode: '334',
  courtDivisionName: 'Columbus',
  groupDesignator: 'MC',
  regionId: '21',
  regionName: 'ATLANTA',
  state: 'GA',
  dxtrId: '0',
  caseId: '999-99-00001',
  chapter: '12',
  caseTitle: 'Candace West-Barrows',
  dateFiled: '2025-03-30',
  debtorTypeCode: 'CB',
  debtorTypeLabel: 'Corporate Business',
  assignments: [],
  transfers: [],
  consolidation: [
    {
      caseId: '999-99-93507',
      consolidationType: 'administrative',
      documentType: 'CONSOLIDATION_TO',
      orderDate: '2026-06-25',
      otherCase: {
        debtor: {
          name: 'Dave Wintheiser',
          address1: '857 Terrell Mall',
          address2: 'Apt. 752',
          address3: 'suite 100',
          cityStateZipCountry: 'Woodbury, UT, 13173, US',
          phone: '1-234-583-5585',
          extension: '549450',
          email: 'Reggie_Skiles46@gmail.com',
        },
        officeName: 'Columbus',
        officeCode: '4',
        courtId: '113G',
        courtName: 'Middle District of Georgia',
        courtDivisionCode: '334',
        courtDivisionName: 'Columbus',
        groupDesignator: 'MC',
        regionId: '21',
        regionName: 'ATLANTA',
        state: 'GA',
        dxtrId: '0',
        caseId: '999-99-00001',
        chapter: '12',
        caseTitle: 'Candace West-Barrows',
        dateFiled: '2025-03-30',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
      },
      updatedBy: {
        id: '123',
        name: 'Diane Nikolaus',
      },
      updatedOn: '2025-01-26',
    },
    {
      caseId: '999-99-00001',
      consolidationType: 'administrative',
      documentType: 'CONSOLIDATION_FROM',
      orderDate: '2026-05-12',
      otherCase: {
        debtor: {
          name: 'Brent Kassulke',
          address1: '124 Leatha Loop',
          address2: 'Suite 810',
          address3: 'suite 100',
          cityStateZipCountry: 'West Anthony, WI, 03510-3711, US',
          phone: '862.755.2942 x6107',
          extension: '756198',
          email: 'Monserrat.Schroeder@hotmail.com',
        },
        officeName: 'Paducah',
        officeCode: '5',
        courtId: '0644',
        courtName: 'Western District of Kentucky',
        courtDivisionCode: '445',
        courtDivisionName: 'Paducah',
        groupDesignator: 'LO',
        regionId: '8',
        regionName: 'MEMPHIS',
        state: 'KY',
        dxtrId: '0',
        caseId: '445-99-81271',
        chapter: '12',
        caseTitle: 'Kurt Hudson II',
        dateFiled: '2025-07-27',
        debtorTypeCode: 'IC',
        debtorTypeLabel: 'Individual Consumer',
      },
      updatedBy: {
        id: '123',
        name: 'Dr. Terrell Zieme',
      },
      updatedOn: '2026-01-25',
    },
    {
      caseId: '999-99-00001',
      consolidationType: 'administrative',
      documentType: 'CONSOLIDATION_FROM',
      orderDate: '2026-03-05',
      otherCase: {
        debtor: {
          name: 'Kristopher Hartmann',
          address1: '154 Oxford Road',
          address2: 'Suite 859',
          address3: 'suite 100',
          cityStateZipCountry: 'Hayward, NV, 87284, US',
          phone: '(609) 777-0451 x81084',
          extension: '948213',
          email: 'Kirsten28@gmail.com',
        },
        officeName: 'Las Vegas',
        officeCode: '2',
        courtId: '0978',
        courtName: 'District of Nevada',
        courtDivisionCode: '782',
        courtDivisionName: 'Las Vegas',
        groupDesignator: 'LV',
        regionId: '17',
        regionName: 'SAN FRANCISCO',
        state: 'NV',
        dxtrId: '0',
        caseId: '782-99-50119',
        chapter: '11',
        caseTitle: 'Ms. Lila Ritchie',
        dateFiled: '2024-04-06',
        debtorTypeCode: 'IC',
        debtorTypeLabel: 'Individual Consumer',
      },
      updatedBy: {
        id: '123',
        name: 'Jackie Crona',
      },
      updatedOn: '2024-12-20',
    },
  ],
  debtorAttorney: {
    name: 'Jackie Will',
    address1: '84532 Burnice Lakes',
    address2: 'Apt. 313',
    address3: 'suite 100',
    cityStateZipCountry: 'Ebonyport, ID, 44210-5170, US',
    phone: '471-517-2124 x423',
    email: 'Sonny86@yahoo.com',
    office: 'Wilderman, Glover and Strosin',
  },
  judgeName: 'Geraldine Morar',
  _actions: [],
};

const orders = [
  {
    debtor: {
      name: 'Crystal Bashirian-Von',
      address1: '5634 W Market Street',
      address2: 'Suite 264',
      address3: 'suite 100',
      cityStateZipCountry: 'South Dandre, WV, 12740, US',
      phone: '743-723-8781 x29927',
      extension: '901842',
      email: 'Rudolph.Waelchi@yahoo.com',
    },
    officeName: 'Harrisburg',
    officeCode: '1',
    courtId: '0314',
    courtName: 'Middle District of Pennsylvania',
    courtDivisionCode: '141',
    courtDivisionName: 'Harrisburg',
    groupDesignator: 'HA',
    regionId: '3',
    regionName: 'PHILADELPHIA',
    state: 'PA',
    dxtrId: '0',
    caseId: '141-99-08978',
    chapter: '12',
    caseTitle: 'Olive Lowe',
    dateFiled: '2022-06-15',
    debtorTypeCode: 'CB',
    debtorTypeLabel: 'Corporate Business',
    id: 'guid-0',
    orderType: 'transfer',
    orderDate: '2024-01-01',
    status: 'pending',
    docketEntries: [
      {
        sequenceNumber: 1,
        documentNumber: 1,
        dateFiled: '2024-11-30',
        summaryText: 'Utroque comes tunc.',
        fullText:
          'Suppellex ducimus alveus credo spes. Una viridis candidus tenus demonstro. Amitto velum tamdiu.',
        documents: [
          {
            fileUri: '001-24-00001-1-0.pdf',
            fileSize: 49827,
            fileLabel: '0',
          },
          {
            fileUri: '001-24-00001-1-1.pdf',
            fileSize: 34947,
            fileLabel: '1',
          },
          {
            fileUri: '001-24-00001-1-2.pdf',
            fileSize: 889610,
            fileLabel: '2',
          },
        ],
      },
    ],
    docketSuggestedCaseNumber: '99-55047',
  },
  {
    debtor: {
      name: 'Dr. Dallas Koch MD',
      address1: '91060 Vivienne Ford',
      address2: 'Apt. 605',
      address3: 'suite 100',
      cityStateZipCountry: 'Hertashire, GA, 06032, US',
      phone: '461.932.7633',
      extension: '508758',
      email: 'Duncan.Daniel@gmail.com',
    },
    officeName: 'Providence',
    officeCode: '1',
    courtId: '0103',
    courtName: 'District of Rhode Island',
    courtDivisionCode: '031',
    courtDivisionName: 'Providence',
    groupDesignator: 'PR',
    regionId: '1',
    regionName: 'BOSTON',
    state: 'RI',
    dxtrId: '0',
    caseId: '031-99-22811',
    chapter: '11',
    caseTitle: 'Mr. Toby Satterfield',
    dateFiled: '2023-10-17',
    debtorTypeCode: 'CB',
    debtorTypeLabel: 'Corporate Business',
    id: 'guid-1',
    orderType: 'transfer',
    orderDate: '2024-02-01',
    status: 'approved',
    docketEntries: [
      {
        sequenceNumber: 1,
        documentNumber: 1,
        dateFiled: '2025-12-01',
        summaryText: 'Civis suppono tempore conforto.',
        fullText:
          'Cupressus verumtamen acsi crur sollicito carcer. Adimpleo ater ullam textus collum sufficio consequuntur corroboro. Deporto vulticulus dolorum voro argumentum sophismata conforto impedit ara.',
        documents: [
          {
            fileUri: '001-24-00001-1-0.pdf',
            fileSize: 789308,
            fileLabel: '0',
          },
          {
            fileUri: '001-24-00001-1-1.pdf',
            fileSize: 299136,
            fileLabel: '1',
          },
          {
            fileUri: '001-24-00001-1-2.pdf',
            fileSize: 316421,
            fileLabel: '2',
          },
          {
            fileUri: '001-24-00001-1-3.pdf',
            fileSize: 215724,
            fileLabel: '3',
          },
        ],
      },
    ],
    newCase: {
      debtor: {
        name: 'Garrett Hauck DVM',
        address1: '5237 Hilpert Park',
        address2: 'Apt. 892',
        address3: 'suite 100',
        cityStateZipCountry: 'Janickfield, MI, 61007-7325, US',
        phone: '1-551-783-6236 x362',
        extension: '859124',
        email: 'Moises3@hotmail.com',
      },
      officeName: 'Panama City',
      officeCode: '5',
      courtId: '1129',
      courtName: 'Northern District of Florida',
      courtDivisionCode: '295',
      courtDivisionName: 'Panama City',
      groupDesignator: 'TL',
      regionId: '21',
      regionName: 'ATLANTA',
      state: 'FL',
      dxtrId: '0',
      caseId: '295-99-09179',
      chapter: '12',
      caseTitle: 'Walter Hackett Jr.',
      dateFiled: '2026-03-01',
      debtorTypeCode: 'CB',
      debtorTypeLabel: 'Corporate Business',
    },
  },
  {
    debtor: {
      name: 'Jose Veum-Friesen',
      address1: '56532 10th Street',
      address2: 'Suite 993',
      address3: 'suite 100',
      cityStateZipCountry: 'Conroyton, TX, 97339, US',
      phone: '1-293-504-8562',
      extension: '697677',
      email: 'Allene_Harvey77@hotmail.com',
    },
    officeName: 'St. Joseph',
    officeCode: '5',
    courtId: '0866',
    courtName: 'Western District of Missouri',
    courtDivisionCode: '665',
    courtDivisionName: 'St. Joseph',
    groupDesignator: 'KC',
    regionId: '13',
    regionName: 'KANSAS CITY',
    state: 'MO',
    dxtrId: '0',
    caseId: '665-99-94418',
    chapter: '12',
    caseTitle: 'Jason Schumm',
    dateFiled: '2023-08-16',
    debtorTypeCode: 'CB',
    debtorTypeLabel: 'Corporate Business',
    id: 'guid-2',
    orderType: 'transfer',
    orderDate: '2024-03-01',
    status: 'rejected',
    docketEntries: [
      {
        sequenceNumber: 1,
        documentNumber: 1,
        dateFiled: '2026-05-27',
        summaryText: 'Bibo condico utrimque ascit deleo verto thorax.',
        fullText:
          'Theca virgo cinis vero sunt pariatur provident compello deleniti hic. Acerbitas cruentus demoror celo aequitas. Rem omnis in bellum decens sono totus dolore deludo calculus.',
        documents: [],
      },
    ],
    docketSuggestedCaseNumber: '99-26581',
    reason: 'Quaerat torrens appositus. Laborum verus tergeo adopto.',
  },
  {
    consolidationId: '6daf4350-b10f-448f-8846-9d8941bc8400',
    consolidationType: 'administrative',
    courtName: 'Eastern District of Washington',
    id: 'guid-3',
    orderType: 'consolidation',
    orderDate: '2024-04-01',
    status: 'pending',
    courtDivisionCode: '802',
    jobId: 5228532703238990,
    memberCases: [
      {
        debtor: {
          name: 'Kerry Marvin III',
          address1: '7728 Spinka Knolls',
          address2: 'Suite 942',
          address3: 'suite 100',
          cityStateZipCountry: 'Bettieland, MN, 08989-2150, US',
          phone: '(747) 816-6571',
          email: 'Hiram_Douglas34@hotmail.com',
        },
        officeName: 'Lubbock',
        officeCode: '5',
        courtId: '0539',
        courtName: 'Northern District of Texas',
        courtDivisionCode: '395',
        courtDivisionName: 'Lubbock',
        groupDesignator: 'DA',
        regionId: '6',
        regionName: 'DALLAS',
        state: 'TX',
        dxtrId: '0',
        caseId: '395-99-73260',
        chapter: '11',
        caseTitle: 'Ismael Runte',
        dateFiled: '2024-01-29',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-3',
        orderDate: '2024-04-01',
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2025-12-07',
            summaryText: 'Color volup adsidue statua acceptus civis cohibeo autem tenus.',
            fullText:
              'Laboriosam civitas paens comitatus antepono conculco vobis ascit. Clementia accusamus amo deputo. Denuo constans via capitulus temporibus doloribus tergum ceno valetudo optio.',
            documents: [
              {
                fileUri: '001-24-00001-1-0.pdf',
                fileSize: 178695,
                fileLabel: '0',
              },
              {
                fileUri: '001-24-00001-1-1.pdf',
                fileSize: 454289,
                fileLabel: '1',
              },
              {
                fileUri: '001-24-00001-1-2.pdf',
                fileSize: 64441,
                fileLabel: '2',
              },
            ],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-91867',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-06501',
            userId: 'guid-30156',
            name: 'Jackie Kulas',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-34247',
              name: 'Marie Muller',
            },
          },
        ],
        associations: [],
      },
      {
        debtor: {
          name: 'Wilson West',
          address1: '84931 Dovie Gardens',
          address2: 'Suite 436',
          address3: 'suite 100',
          cityStateZipCountry: 'East Keltonview, AK, 41394, US',
          phone: '733-534-0165 x3625',
          extension: '672319',
          email: 'Mireya_Moen80@hotmail.com',
        },
        officeName: 'Dallas',
        officeCode: '3',
        courtId: '0539',
        courtName: 'Northern District of Texas',
        courtDivisionCode: '393',
        courtDivisionName: 'Dallas',
        groupDesignator: 'DA',
        regionId: '6',
        regionName: 'DALLAS',
        state: 'TX',
        dxtrId: '0',
        caseId: '393-99-29163',
        chapter: '12',
        caseTitle: 'Henry Marks',
        dateFiled: '2024-10-31',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-3',
        orderDate: '2024-04-01',
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2026-03-28',
            summaryText: 'Usque subvenio labore bonus assumenda spargo eligendi.',
            fullText:
              'Quas candidus maxime. Pecco conventus vapulus dicta. Spiritus catena subvenio sodalitas blanditiis.',
            documents: [
              {
                fileUri: '001-24-00001-1-0.pdf',
                fileSize: 71111,
                fileLabel: '0',
              },
              {
                fileUri: '001-24-00001-1-1.pdf',
                fileSize: 261197,
                fileLabel: '1',
              },
            ],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-24646',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-92627',
            userId: 'guid-28526',
            name: 'Sonya Ratke',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-59277',
              name: 'Joann Volkman',
            },
          },
        ],
        associations: [],
      },
    ],
  },
  {
    consolidationId: '6f704ddd-9bf4-4e86-869d-416d006ad086',
    consolidationType: 'administrative',
    courtName: 'Southern District of Florida',
    id: 'guid-4',
    orderType: 'consolidation',
    orderDate: '2024-05-01',
    status: 'approved',
    courtDivisionCode: '310',
    jobId: 2015447520064332,
    memberCases: [
      {
        debtor: {
          name: 'Arlene Goodwin',
          address1: '352 Aufderhar Dam',
          address2: 'Suite 970',
          address3: 'suite 100',
          cityStateZipCountry: 'New Keonfurt, IL, 64091, US',
          phone: '(976) 601-6247 x023',
          extension: '295021',
          email: 'Rene_Breitenberg7@yahoo.com',
        },
        officeName: 'Huntington',
        officeCode: '3',
        courtId: '0425',
        courtName: 'Southern District of West Virginia',
        courtDivisionCode: '253',
        courtDivisionName: 'Huntington',
        groupDesignator: 'CT',
        regionId: '4',
        regionName: 'COLUMBIA',
        state: 'WV',
        dxtrId: '0',
        caseId: '253-99-66444',
        chapter: '9',
        caseTitle: 'Colin Bernier Sr.',
        dateFiled: '2026-02-22',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-4',
        orderDate: '2024-05-01',
        status: 'approved',
        leadCase: {
          debtor: {
            name: 'Dave Wintheiser',
            address1: '857 Terrell Mall',
            address2: 'Apt. 752',
            address3: 'suite 100',
            cityStateZipCountry: 'Woodbury, UT, 13173, US',
            phone: '1-234-583-5585',
            extension: '549450',
            email: 'Reggie_Skiles46@gmail.com',
          },
          officeName: 'Columbus',
          officeCode: '4',
          courtId: '113G',
          courtName: 'Middle District of Georgia',
          courtDivisionCode: '334',
          courtDivisionName: 'Columbus',
          groupDesignator: 'MC',
          regionId: '21',
          regionName: 'ATLANTA',
          state: 'GA',
          dxtrId: '0',
          caseId: '999-99-00001',
          chapter: '12',
          caseTitle: 'Candace West-Barrows',
          dateFiled: '2025-03-30',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
        },
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2026-06-18',
            summaryText: 'Aurum vinitor aetas.',
            fullText:
              'Artificiose depulso compono assumenda. Stabilis arma nisi nam vesco cibo paulatim testimonium aestus. Clam creber subnecto aduro facilis valetudo cerno causa.',
            documents: [],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-97385',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-18487',
            userId: 'guid-95456',
            name: 'Kerry Jerde-Beer',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-75157',
              name: 'Sammy Dare',
            },
          },
        ],
        associations: [],
      },
      {
        debtor: {
          name: 'Luther Baumbach',
          address1: "280 St John's Road",
          address2: 'Apt. 440',
          address3: 'suite 100',
          cityStateZipCountry: 'Labadiefurt, NJ, 98920, US',
          phone: '710.512.6537',
          email: 'Eleonore_Roob62@gmail.com',
        },
        officeName: 'GTF',
        officeCode: '4',
        courtId: '0977',
        courtName: 'District of Montana',
        courtDivisionCode: '774',
        courtDivisionName: 'GTF',
        groupDesignator: 'GF',
        regionId: '18',
        regionName: 'SEATTLE',
        state: 'MT',
        dxtrId: '0',
        caseId: '774-99-11477',
        chapter: '12',
        caseTitle: 'Albert Moen',
        dateFiled: '2025-01-16',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-4',
        orderDate: '2024-05-01',
        status: 'approved',
        leadCase: {
          debtor: {
            name: 'Dave Wintheiser',
            address1: '857 Terrell Mall',
            address2: 'Apt. 752',
            address3: 'suite 100',
            cityStateZipCountry: 'Woodbury, UT, 13173, US',
            phone: '1-234-583-5585',
            extension: '549450',
            email: 'Reggie_Skiles46@gmail.com',
          },
          officeName: 'Columbus',
          officeCode: '4',
          courtId: '113G',
          courtName: 'Middle District of Georgia',
          courtDivisionCode: '334',
          courtDivisionName: 'Columbus',
          groupDesignator: 'MC',
          regionId: '21',
          regionName: 'ATLANTA',
          state: 'GA',
          dxtrId: '0',
          caseId: '999-99-00001',
          chapter: '12',
          caseTitle: 'Candace West-Barrows',
          dateFiled: '2025-03-30',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
        },
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2024-07-26',
            summaryText: 'Decens tunc cunabula valetudo tempora timor textilis corrumpo.',
            fullText:
              'Assentator caterva illo natus censura earum. Volup amplitudo crux at allatus via candidus cuius. Deduco ter caelum copiose urbanus tremo.',
            documents: [
              {
                fileUri: '001-24-00001-1-0.pdf',
                fileSize: 471249,
                fileLabel: '0',
              },
              {
                fileUri: '001-24-00001-1-1.pdf',
                fileSize: 424182,
                fileLabel: '1',
              },
            ],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-90692',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-97384',
            userId: 'guid-85449',
            name: 'Rickey Kohler',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-18719',
              name: 'Geraldine Lemke',
            },
          },
        ],
        associations: [],
      },
    ],
    leadCase: {
      debtor: {
        name: 'Dave Wintheiser',
        address1: '857 Terrell Mall',
        address2: 'Apt. 752',
        address3: 'suite 100',
        cityStateZipCountry: 'Woodbury, UT, 13173, US',
        phone: '1-234-583-5585',
        extension: '549450',
        email: 'Reggie_Skiles46@gmail.com',
      },
      officeName: 'Columbus',
      officeCode: '4',
      courtId: '113G',
      courtName: 'Middle District of Georgia',
      courtDivisionCode: '334',
      courtDivisionName: 'Columbus',
      groupDesignator: 'MC',
      regionId: '21',
      regionName: 'ATLANTA',
      state: 'GA',
      dxtrId: '0',
      caseId: '999-99-00001',
      chapter: '12',
      caseTitle: 'Candace West-Barrows',
      dateFiled: '2025-03-30',
      debtorTypeCode: 'CB',
      debtorTypeLabel: 'Corporate Business',
    },
  },
  {
    consolidationId: 'efabf5be-5fa1-480b-9762-e2024acbf7db',
    consolidationType: 'administrative',
    courtName: 'Eastern District of Pennsylvania',
    id: 'guid-5',
    orderType: 'consolidation',
    orderDate: '2024-06-01',
    status: 'rejected',
    courtDivisionCode: '132',
    jobId: 2857091012849403,
    memberCases: [
      {
        debtor: {
          name: 'Devin Herman',
          address1: '658 Heron Close',
          address2: 'Suite 210',
          address3: 'suite 100',
          cityStateZipCountry: 'Port Jaylin, IN, 25745-3470, US',
          phone: '(305) 255-3573 x15534',
          extension: '824355',
          email: 'Quincy.Hudson8@hotmail.com',
        },
        officeName: 'West Palm Beach',
        officeCode: '9',
        courtId: '113C',
        courtName: 'Southern District of Florida',
        courtDivisionCode: '319',
        courtDivisionName: 'West Palm Beach',
        groupDesignator: 'MM',
        regionId: '21',
        regionName: 'ATLANTA',
        state: 'FL',
        dxtrId: '0',
        caseId: '319-99-34361',
        chapter: '12',
        caseTitle: 'Christie Hodkiewicz Jr.',
        dateFiled: '2026-06-04',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-5',
        orderDate: '2024-06-01',
        status: 'rejected',
        reason: 'This is a rejection reason.',
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2025-05-25',
            summaryText: 'Vulnero claustrum sto ipsam stabilis solio.',
            fullText:
              'Defessus distinctio audeo patior taceo curtus. Aeneus utrimque spiritus delinquo fugiat. Arx cruciamentum statua celebrer vulpes tibi vilitas ulterius.',
            documents: [
              {
                fileUri: '001-24-00001-1-0.pdf',
                fileSize: 103039,
                fileLabel: '0',
              },
            ],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-99410',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-74547',
            userId: 'guid-68483',
            name: 'Kim Jacobs',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-60817',
              name: 'Sam Quitzon Jr.',
            },
          },
        ],
        associations: [],
      },
      {
        debtor: {
          name: 'Salvatore Wolff',
          address1: '3505 Frami Common',
          address2: 'Suite 966',
          address3: 'suite 100',
          cityStateZipCountry: 'Fort Conorburgh, AL, 10154-2661, US',
          phone: '1-438-468-3929 x82799',
          extension: '751771',
          email: 'Ashlynn_Gerhold58@yahoo.com',
        },
        officeName: 'Waycross',
        officeCode: '5',
        courtId: '113J',
        courtName: 'Southern District of Georgia',
        courtDivisionCode: '345',
        courtDivisionName: 'Waycross',
        groupDesignator: 'SV',
        regionId: '21',
        regionName: 'ATLANTA',
        state: 'GA',
        dxtrId: '0',
        caseId: '345-99-84621',
        chapter: '9',
        caseTitle: 'Eddie Hudson',
        dateFiled: '2024-11-28',
        debtorTypeCode: 'CB',
        debtorTypeLabel: 'Corporate Business',
        id: 'guid-5',
        orderDate: '2024-06-01',
        status: 'rejected',
        reason: 'This is a rejection reason.',
        docketEntries: [
          {
            sequenceNumber: 1,
            documentNumber: 1,
            dateFiled: '2026-04-25',
            summaryText: 'Tamquam calamitas crinis amet suspendo clibanus.',
            fullText:
              'Vesper caritas suppellex perspiciatis thema tibi tego. Theca turba cruciamentum studio. Ad denuncio animi ciminatio caecus compono tempora supra.',
            documents: [
              {
                fileUri: '001-24-00001-1-0.pdf',
                fileSize: 97125,
                fileLabel: '0',
              },
              {
                fileUri: '001-24-00001-1-1.pdf',
                fileSize: 956952,
                fileLabel: '1',
              },
              {
                fileUri: '001-24-00001-1-2.pdf',
                fileSize: 510546,
                fileLabel: '2',
              },
              {
                fileUri: '001-24-00001-1-3.pdf',
                fileSize: 317223,
                fileLabel: '3',
              },
            ],
          },
        ],
        attorneyAssignments: [
          {
            id: 'guid-33111',
            documentType: 'ASSIGNMENT',
            caseId: '999-99-06865',
            userId: 'guid-71361',
            name: 'Omar Marquardt V',
            role: 'TrialAttorney',
            assignedOn: '2023-01-29',
            unassignedOn: '2023-02-26',
            updatedOn: '2023-02-26',
            updatedBy: {
              id: 'guid-24547',
              name: 'Alice Bednar',
            },
          },
        ],
        associations: [],
      },
    ],
    reason: 'This is a rejection reason.',
  },
];

async function post<T = unknown>(
  path: string,
  body: object,
  _options: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  if (path.match(/\/cases/)) {
    const searchRequest = body as CasesSearchPredicate;
    const _actions = [
      { actionName: 'manage assignments', method: 'POST', path: '/case-assignments/${caseId}' },
    ];
    const caseNumber = searchRequest ? searchRequest.caseNumber : '';
    const response: ResponseBody<unknown> = {
      data: [],
    };
    if (caseNumber === '99-99999') {
      throw new Error('api error');
    } else if (caseNumber === '00-00000') {
      response.data = [
        {
          officeName: 'Santa Ana',
          officeCode: '8',
          courtId: '0973',
          courtName: 'Central District of California',
          courtDivisionCode: '738',
          courtDivisionName: 'Santa Ana',
          groupDesignator: 'SA',
          regionId: '16',
          regionName: 'LOS ANGELES',
          state: 'CA',
          dxtrId: '0',
          caseId: `011-${caseNumber}`,
          chapter: '15',
          caseTitle: 'Test Debtor',
          dateFiled: '2024-01-01',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
        },
      ];
    } else if (caseNumber === '11-00000') {
      response.data = [];
    } else {
      response.data = [
        {
          officeName: 'Santa Ana',
          officeCode: '8',
          courtId: '0973',
          courtName: 'Central District of California',
          courtDivisionCode: '738',
          courtDivisionName: 'Santa Ana',
          groupDesignator: 'SA',
          regionId: '16',
          regionName: 'LOS ANGELES',
          state: 'CA',
          dxtrId: '0',
          caseId: `011-${caseNumber ?? randomCaseNumber()}`,
          chapter: '15',
          caseTitle: 'Test Debtor 1',
          dateFiled: '2024-01-01',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
          _actions,
        },
        {
          officeName: 'Eugene',
          officeCode: '3',
          courtId: '0979',
          courtName: 'District of Oregon',
          courtDivisionCode: '793',
          courtDivisionName: 'Eugene',
          groupDesignator: 'PO',
          regionId: '18',
          regionName: 'SEATTLE',
          state: 'OR',
          dxtrId: '0',
          caseId: `070-${caseNumber ?? randomCaseNumber()}`,
          chapter: '11',
          caseTitle: 'Test Debtor 2',
          dateFiled: '2024-02-01',
          debtorTypeCode: 'IC',
          debtorTypeLabel: 'Individual Consumer',
          _actions,
        },
        {
          officeName: 'Philadelphia',
          officeCode: '2',
          courtId: '0313',
          courtName: 'Eastern District of Pennsylvania',
          courtDivisionCode: '132',
          courtDivisionName: 'Philadelphia',
          groupDesignator: 'PH',
          regionId: '3',
          regionName: 'PHILADELPHIA',
          state: 'PA',
          dxtrId: '0',
          caseId: `132-${caseNumber ?? randomCaseNumber()}`,
          chapter: '7',
          caseTitle: 'Test Debtor 3',
          dateFiled: '2024-03-01',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
          _actions,
        },
        {
          officeName: 'Miami',
          officeCode: '1',
          courtId: '113C',
          courtName: 'Southern District of Florida',
          courtDivisionCode: '311',
          courtDivisionName: 'Miami',
          groupDesignator: 'MM',
          regionId: '21',
          regionName: 'ATLANTA',
          state: 'FL',
          dxtrId: '0',
          caseId: `3E1-${caseNumber ?? randomCaseNumber()}`,
          chapter: '13',
          caseTitle: 'Test Debtor 4',
          dateFiled: '2024-04-01',
          debtorTypeCode: 'IC',
          debtorTypeLabel: 'Individual Consumer',
          _actions,
        },
        {
          officeName: 'Newark',
          officeCode: '1',
          courtId: '0312',
          courtName: 'District of New Jersey',
          courtDivisionCode: '121',
          courtDivisionName: 'Newark',
          groupDesignator: 'NW',
          regionId: '2',
          regionName: 'NEW YORK',
          state: 'NJ',
          dxtrId: '0',
          caseId: `256-${caseNumber ?? randomCaseNumber()}`,
          chapter: '12',
          caseTitle: 'Test Debtor 5',
          dateFiled: '2024-05-01',
          debtorTypeCode: 'CB',
          debtorTypeLabel: 'Corporate Business',
          _actions,
        },
      ];
    }
    return response as ResponseBody<T>;
  } else if (path.match(/^\/trustees$/)) {
    const input = body as TrusteeInput;
    const created: Trustee = {
      ...input,
      id: randomId(),
      trusteeId: randomId(),
      createdBy: { id: 'user-1', name: 'Mock User' },
      createdOn: new Date().toISOString(),
      lastUpdatedBy: { id: 'user-1', name: 'Mock User' },
      lastUpdatedOn: new Date().toISOString(),
      updatedBy: { id: 'user-1', name: 'Mock User' },
      updatedOn: new Date().toISOString(),
    } as unknown as Trustee;
    return { data: created } as ResponseBody<T>;
  } else {
    throw new Error();
  }
}

async function get<T = unknown>(path: string): Promise<ResponseBody<T>> {
  let response: ResponseBody<unknown>;
  if (path.match(/\/cases\/123-12-12345\/docket/)) {
    throw new Error();
  } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
    throw new Error('Case summary not found for the case ID.');
  } else if (path.match(/\/cases\/999-99-00001\/associated/)) {
    response = {
      data: consolidation,
    };
  } else if (path.match(/\/cases\/999-99-00001\/docket/)) {
    response = {
      data: [],
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/docket/)) {
    response = {
      data: caseDocketEntries,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/notes/)) {
    response = {
      data: resourceActionCaseNotes,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/summary/i)) {
    response = {
      data: caseDetails,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/associated/)) {
    response = {
      data: [],
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+/)) {
    response = {
      data: caseDetails,
    };
  } else if (path.match(/\/dev-tools\/privileged-identity\/groups/)) {
    response = {
      data: {
        roles: [],
        offices: [],
      },
    };
  } else if (path.match(/\/orders-suggestions\/[A-Z\d-]+/)) {
    response = {
      data: [caseDetails],
    };
  } else if (path.match(/\/orders/)) {
    response = {
      data: orders,
    };
  } else if (path.match(/\/offices\/.*\/assignees/)) {
    response = {
      data: [
        {
          id: 'guid-07698',
          name: 'Mrs. Janice Mante',
        },
        {
          id: 'guid-35689',
          name: 'Georgia Hartmann-Green',
        },
        {
          id: 'guid-11037',
          name: 'Elena Sporer',
        },
        {
          id: 'guid-30601',
          name: 'Debra Roberts',
        },
        {
          id: 'guid-45103',
          name: 'Gretchen Gleason',
        },
      ],
    };
  } else if (path.match(/\/offices/)) {
    response = {
      data: MOCKED_USTP_OFFICES_ARRAY,
    };
  } else if (path.match(/\/courts/)) {
    response = {
      data: courts,
    };
  } else if (path.match(/\/trustees\/[A-Z\d-]+/i)) {
    response = {
      data: {
        id: '79423bc7-a086-47f1-adb4-f66bdcdee74a',
        trusteeId: 'ab6b007b-deb3-4f88-b376-0f3786ce75d3',
        updatedOn: '2025-11-05T11:24:27.700Z',
        updatedBy: {
          id: 'guid-88076',
          name: 'Elizabeth Grady',
        },
        name: 'Jeffery Roberts',
        public: {
          phone: {
            number: '599-900-2822',
          },
          email: 'Turner92@yahoo.com',
          address: {
            address1: '64045 Dare Mews',
            address2: 'Suite 470',
            address3: '',
            city: 'Makaylaberg',
            state: 'TN',
            zipCode: '97087',
            countryCode: 'US',
          },
        },
      },
    };
  } else if (path.match(/\/trustees/)) {
    response = {
      data: [
        {
          name: 'John Doe',
          legacy: {
            address1: '8904 Marquardt Keys',
            address2: 'Apt. 284',
            address3: 'suite 100',
            cityStateZipCountry: 'Margate, CT, 85948-6281, US',
            phone: '(694) 876-7057 x45546',
            email: 'Maurice.Windler@gmail.com',
          },
        },
        {
          name: 'Jane Smith',
          legacy: {
            address1: '18098 Kitty Canyon',
            address2: 'Suite 449',
            address3: 'suite 100',
            cityStateZipCountry: 'Johnscester, ME, 83363, US',
            phone: '963-363-4964 x4002',
            email: 'Arnaldo_Runolfsson@yahoo.com',
          },
        },
        {
          name: 'Bob Johnson',
          legacy: {
            address1: '68622 Judd Highway',
            address2: 'Suite 147',
            address3: 'suite 100',
            cityStateZipCountry: 'Urbanworth, CT, 12981, US',
            phone: '(203) 424-9970',
            email: 'Lawrence_Auer9@hotmail.com',
          },
        },
      ],
    };
  } else if (path.match(/\/me/)) {
    response = {
      data: {
        user: {
          id: '==MOCKUSER=user@fake.com==',
          name: "Martha's Son",
          roles: [
            'PrivilegedIdentityUser',
            'SuperUser',
            'CaseAssignmentManager',
            'TrialAttorney',
            'DataVerifier',
            'TrusteeAdmin',
            'Auditor',
            'Paralegal',
          ],
          offices: [
            {
              officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
              idpGroupName: 'USTP CAMS Region 18 Office Seattle',
              officeName: 'Seattle',
              groups: [
                {
                  groupDesignator: 'SE',
                  divisions: [
                    {
                      divisionCode: '812',
                      court: {
                        courtId: '0981',
                        courtName: 'Western District of Washington',
                        state: 'WA',
                      },
                      courtOffice: {
                        courtOfficeCode: '2',
                        courtOfficeName: 'Seattle',
                      },
                    },
                    {
                      divisionCode: '813',
                      court: {
                        courtId: '0981',
                        courtName: 'Western District of Washington',
                        state: 'WA',
                      },
                      courtOffice: {
                        courtOfficeCode: '3',
                        courtOfficeName: 'Tacoma',
                      },
                    },
                  ],
                },
                {
                  groupDesignator: 'AK',
                  divisions: [
                    {
                      divisionCode: '710',
                      court: {
                        courtId: '097-',
                        courtName: 'District of Alaska',
                        state: 'AK',
                      },
                      courtOffice: {
                        courtOfficeCode: '1',
                        courtOfficeName: 'Juneau',
                      },
                    },
                    {
                      divisionCode: '720',
                      court: {
                        courtId: '097-',
                        courtName: 'District of Alaska',
                        state: 'AK',
                      },
                      courtOffice: {
                        courtOfficeCode: '2',
                        courtOfficeName: 'Nome',
                      },
                    },
                    {
                      divisionCode: '730',
                      court: {
                        courtId: '097-',
                        courtName: 'District of Alaska',
                        state: 'AK',
                      },
                      courtOffice: {
                        courtOfficeCode: '3',
                        courtOfficeName: 'Anchorage',
                      },
                    },
                    {
                      divisionCode: '740',
                      court: {
                        courtId: '097-',
                        courtName: 'District of Alaska',
                        state: 'AK',
                      },
                      courtOffice: {
                        courtOfficeCode: '4',
                        courtOfficeName: 'Fairbanks',
                      },
                    },
                    {
                      divisionCode: '750',
                      court: {
                        courtId: '097-',
                        courtName: 'District of Alaska',
                        state: 'AK',
                      },
                      courtOffice: {
                        courtOfficeCode: '5',
                        courtOfficeName: 'Ketchikan',
                      },
                    },
                  ],
                },
              ],
              regionId: '18',
              regionName: 'SEATTLE',
            },
            {
              officeCode: 'USTP_CAMS_Region_3_Office_Wilmington',
              idpGroupName: 'USTP CAMS Region 3 Office Wilmington',
              officeName: 'Wilmington',
              groups: [
                {
                  groupDesignator: 'WL',
                  divisions: [
                    {
                      divisionCode: '111',
                      court: {
                        courtId: '0311',
                        courtName: 'District of Delaware',
                        state: 'DE',
                      },
                      courtOffice: {
                        courtOfficeCode: '1',
                        courtOfficeName: 'Delaware',
                      },
                    },
                  ],
                },
              ],
              regionId: '3',
              regionName: 'PHILADELPHIA',
            },
            {
              officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
              idpGroupName: 'USTP CAMS Region 2 Office Manhattan',
              officeName: 'Manhattan',
              groups: [
                {
                  groupDesignator: 'NY',
                  divisions: [
                    {
                      divisionCode: '081',
                      court: {
                        courtId: '0208',
                        courtName: 'Southern District of New York',
                        state: 'NY',
                      },
                      courtOffice: {
                        courtOfficeCode: '1',
                        courtOfficeName: 'Manhattan',
                      },
                    },
                    {
                      divisionCode: '087',
                      court: {
                        courtId: '0208',
                        courtName: 'Southern District of New York',
                        state: 'NY',
                      },
                      courtOffice: {
                        courtOfficeCode: '7',
                        courtOfficeName: 'White Plains',
                      },
                    },
                  ],
                },
              ],
              regionId: '2',
              regionName: 'NEW YORK',
            },
            {
              officeCode: 'USTP_CAMS_Region_2_Office_Buffalo',
              idpGroupName: 'USTP CAMS Region 2 Office Buffalo',
              officeName: 'Buffalo',
              groups: [
                {
                  groupDesignator: 'BU',
                  divisions: [
                    {
                      divisionCode: '091',
                      court: {
                        courtId: '0209',
                        courtName: 'Western District of New York',
                        state: 'NY',
                      },
                      courtOffice: {
                        courtOfficeCode: '1',
                        courtOfficeName: 'Buffalo',
                      },
                    },
                  ],
                },
              ],
              regionId: '2',
              regionName: 'NEW YORK',
            },
          ],
        },
        accessToken: generateMockJWT(),
        provider: 'mock',
        issuer: 'http://issuer/',
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
      },
    };
  } else if (path === '/staff') {
    response = {
      data: {
        [CamsRole.OversightAttorney]: [
          {
            id: 'guid-34537',
            name: 'Sophia Stracke',
            roles: [CamsRole.OversightAttorney],
          },
          {
            id: 'guid-44199',
            name: 'Shawn Cronin',
            roles: [CamsRole.OversightAttorney],
          },
          {
            id: 'guid-58647',
            name: 'Brad Cremin I',
            roles: [CamsRole.OversightAttorney],
          },
        ],
        [CamsRole.OversightAuditor]: [
          {
            id: 'guid-92805',
            name: 'Gilbert Conn',
            roles: [CamsRole.OversightAuditor],
          },
          {
            id: 'guid-28124',
            name: 'Angelica Collins',
            roles: [CamsRole.OversightAuditor],
          },
        ],
        [CamsRole.OversightParalegal]: [
          {
            id: 'guid-73451',
            name: 'Patricia Martinez',
            roles: [CamsRole.OversightParalegal],
          },
          {
            id: 'guid-61829',
            name: 'Robert Thompson',
            roles: [CamsRole.OversightParalegal],
          },
        ],
      },
    };
  } else if (path.match(/\/cases\/999-99-00001/)) {
    response = {
      data: {
        ...consolidationLeadCase,
        consolidation,
      },
    };
  } else {
    response = {
      data: {},
    };
  }

  return response as ResponseBody<T>;
}

async function patch<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return response as ResponseBody<T>;
}

async function put<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return response as ResponseBody<T>;
}

async function _delete<T = unknown>(_path: string): Promise<ResponseBody<T>> {
  const response = {
    data: null,
  };
  return response as ResponseBody<T>;
}

async function getOversightStaff(): Promise<ResponseBody<Record<OversightRoleType, Staff[]>>> {
  return get<Record<OversightRoleType, Staff[]>>('/staff');
}

async function getCaseDetail(caseId: string): Promise<ResponseBody<CaseDetail>> {
  return get<CaseDetail>(`/cases/${caseId}`);
}

async function getCaseDocket(caseId: string): Promise<ResponseBody<CaseDocket>> {
  return get<CaseDocket>(`/cases/${caseId}/docket`);
}

async function getCaseSummary(caseId: string): Promise<ResponseBody<CaseSummary>> {
  return get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCaseAssignments(caseId: string): Promise<ResponseBody<CaseAssignment[]>> {
  return get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string): Promise<ResponseBody<Consolidation[]>> {
  return get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getCaseHistory(caseId: string): Promise<ResponseBody<CaseHistory[]>> {
  return get<CaseHistory[]>(`/cases/${caseId}/history`);
}

async function getCourts(): Promise<ResponseBody<CourtDivisionDetails[]>> {
  return get<CourtDivisionDetails[]>(`/courts`);
}

async function getMe(): Promise<ResponseBody<CamsSession>> {
  return get<CamsSession>(`/me`);
}

async function getOfficeAttorneys(officeCode: string) {
  return get<AttorneyUser[]>(`/offices/${officeCode}/attorneys`);
}

async function getOfficeAssignees(officeCode: string) {
  return get<Staff[]>(`/offices/${officeCode}/assignees`);
}

async function getOffices(): Promise<ResponseBody<UstpOfficeDetails[]>> {
  return get<UstpOfficeDetails[]>(`/offices`);
}

async function getOrders(): Promise<ResponseBody<Order[]>> {
  return get<Order[]>(`/orders`);
}

async function getOrderSuggestions(caseId: string): Promise<ResponseBody<CaseSummary[]>> {
  return get<CaseSummary[]>(`/orders-suggestions/${caseId}/`);
}

async function patchTransferOrderApproval(_data: FlexibleTransferOrderAction): Promise<void> {
  return;
}

async function patchTransferOrderRejection(_data: FlexibleTransferOrderAction): Promise<void> {
  return;
}

async function getCaseNotes(caseId: string): Promise<ResponseBody<CaseNote[]>> {
  return get<CaseNote[]>(`/cases/${caseId}/notes`);
}

async function deleteCaseNote(_note: Partial<CaseNote>) {
  return;
}

async function postCaseNote(note: CaseNoteInput): Promise<void> {
  await post(`/cases/${note.caseId}/notes`, { note }, {});
}

async function putCaseNote(_note: CaseNoteInput): Promise<string | undefined> {
  return randomId();
}

async function putConsolidationOrderApproval(
  data: ConsolidationOrderActionApproval,
): Promise<ResponseBody<ConsolidationOrder[]>> {
  return put<ConsolidationOrder[]>('/consolidations/approve', data);
}

async function putConsolidationOrderRejection(
  data: ConsolidationOrderActionRejection,
): Promise<ResponseBody<ConsolidationOrder[]>> {
  return put<ConsolidationOrder[]>('/consolidations/reject', data);
}

async function searchCases(
  predicate: CasesSearchPredicate,
  options: { includeAssignments?: boolean } = {},
): Promise<ResponseBody<SyncedCase[]>> {
  return post<SyncedCase[]>('/cases', predicate, options);
}

async function postStaffAssignments(action: StaffAssignmentAction): Promise<ResponseBody> {
  return post('/case-assignments', action, {});
}

async function getRoleAndOfficeGroupNames() {
  return get<RoleAndOfficeGroupNames>('/dev-tools/privileged-identity/groups');
}

async function getPrivilegedIdentityUsers() {
  return get<CamsUserReference[]>('/dev-tools/privileged-identity');
}

async function getPrivilegedIdentityUser(userId: string) {
  return get<PrivilegedIdentityUser>(`/dev-tools/privileged-identity/${userId}`);
}

async function putPrivilegedIdentityUser(userId: string, action: ElevatePrivilegedUserAction) {
  await put(`/dev-tools/privileged-identity/${userId}`, action);
}

async function deletePrivilegedIdentityUser(userId: string) {
  await _delete(`/dev-tools/privileged-identity/${userId}`);
}

async function postTrustee(trustee: TrusteeInput) {
  return post('/trustees', trustee, {}) as unknown as Promise<ResponseBody<Trustee>>;
}

async function patchTrustee(id: string, trustee: Partial<TrusteeInput>) {
  return patch(`/trustees/${id}`, trustee, {}) as unknown as Promise<ResponseBody<Trustee>>;
}

async function getTrustees() {
  return get<Trustee[]>('/trustees');
}

async function getTrustee(id: string) {
  return get<Trustee>(`/trustees/${id}`);
}

async function getTrusteeHistory(_ignore: string): Promise<ResponseBody<TrusteeHistory[]>> {
  return {
    data: [
      {
        id: '527cb44d-0e79-453c-a75e-85617ccdc89b',
        trusteeId: '7d4e2a0b-c39a-4f57-b2c6-ea1fc3c61488',
        documentType: 'AUDIT_NAME',
        updatedOn: '2023-12-14T21:39:18.909Z',
        updatedBy: {
          id: 'SYSTEM',
          name: 'SYSTEM',
        },
        before: 'John Doe',
        after: 'John M. Doe',
      } as TrusteeHistory,
      {
        id: '26de2413-7050-41f2-9882-38cab0e141e2',
        trusteeId: 'a8f72c5d-6e94-4b1a-9d3e-8c7b59a23f01',
        documentType: 'AUDIT_PUBLIC_CONTACT',
        updatedOn: '2023-12-15T14:22:45.123Z',
        updatedBy: {
          id: 'SYSTEM',
          name: 'SYSTEM',
        },
        before: {
          email: 'john.doe@example.com',
          phone: {
            number: '555-123-4567',
            extension: '101',
          },
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '10001',
            countryCode: 'US',
          },
        },
        after: {
          email: 'john.m.doe@example.com',
          phone: {
            number: '555-123-4567',
            extension: '101',
          },
          address: {
            address1: '456 Oak Ave',
            city: 'Newtown',
            state: 'NY',
            zipCode: '10002',
            countryCode: 'US',
          },
        },
      } as TrusteeHistory,
      {
        id: 'c0045b96-3f64-4e5e-b9aa-78f7a98d921a',
        trusteeId: 'c6b3e9a2-7d51-48f9-b0e4-3a5c2d1f8e7a',
        documentType: 'AUDIT_INTERNAL_CONTACT',
        updatedOn: '2023-12-16T09:15:30.456Z',
        updatedBy: {
          id: 'guid-15929',
          name: 'Ben Brown',
        },
        before: {
          email: 'internal.doe@example.org',
          phone: {
            number: '555-987-6543',
            extension: '202',
          },
          address: {
            address1: '789 Elm St',
            address2: 'Suite 100',
            city: 'Oldcity',
            state: 'NY',
            zipCode: '10003',
            countryCode: 'US',
          },
        },
        after: {
          email: 'internal.m.doe@example.org',
          phone: {
            number: '555-987-6543',
            extension: '303',
          },
          address: {
            address1: '789 Elm St',
            address2: 'Suite 200',
            city: 'Oldcity',
            state: 'NY',
            zipCode: '10003',
            countryCode: 'US',
          },
        },
      } as TrusteeHistory,
    ],
  };
}

async function getTrusteeAppointments(trusteeId: string) {
  return {
    data: [
      {
        id: 'appointment-1',
        trusteeId,
        chapter: '7-panel' as const,
        courtId: '0208',
        divisionCode: '081',
        appointedDate: '2023-01-01T00:00:00Z',
        status: 'active' as const,
        effectiveDate: '2023-01-01T00:00:00Z',
        updatedOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'user-1', name: 'Mock User' },
      },
    ],
  };
}

async function postTrusteeAppointment(trusteeId: string, appointment: TrusteeAppointmentInput) {
  return post(`/trustees/${trusteeId}/appointments`, appointment, {});
}

async function putTrusteeAppointment(
  trusteeId: string,
  appointmentId: string,
  appointment: TrusteeAppointmentInput,
) {
  return put(`/trustees/${trusteeId}/appointments/${appointmentId}`, appointment, {});
}

async function getBankruptcySoftwareList() {
  return {
    data: [
      {
        _id: '1',
        list: 'bankruptcy-software',
        key: 'Axos',
        value: 'Axos',
      },
      {
        _id: '2',
        list: 'bankruptcy-software',
        key: 'BlueStylus',
        value: 'BlueStylus',
      },
      {
        _id: '3',
        list: 'bankruptcy-software',
        key: 'Epiq',
        value: 'Epiq',
      },
    ],
  };
}

async function postBankruptcySoftware(_ignore: Creatable<BankruptcySoftwareListItem>) {
  return '--id--';
}

async function deleteBankruptcySoftware(_ignore: string) {
  return;
}

async function getBanks() {
  return {
    data: [
      {
        _id: '1',
        list: 'banks',
        key: 'Bank of America',
        value: 'Bank of America',
      },
      {
        _id: '2',
        list: 'banks',
        key: 'Chase Bank',
        value: 'Chase Bank',
      },
      {
        _id: '3',
        list: 'banks',
        key: 'Wells Fargo',
        value: 'Wells Fargo',
      },
    ],
  };
}

async function postBank(_ignore: Creatable<BankListItem>) {
  return '--id--';
}

async function deleteBank(_ignore: string) {
  return;
}

async function getTrusteeOversightAssignments(
  trusteeId: string,
): Promise<ResponseBody<TrusteeOversightAssignment[]>> {
  return {
    data: [
      {
        id: 'assignment-1',
        trusteeId,
        user: {
          id: 'attorney-1',
          name: 'John Doe',
        },
        role: CamsRole.OversightAttorney,
        createdBy: { id: 'user-1', name: 'Admin User' },
        createdOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
        updatedOn: '2023-01-01T00:00:00Z',
      },
    ],
  };
}

async function createTrusteeOversightAssignment(
  trusteeId: string,
  userId: string,
  role: OversightRoleType,
): Promise<ResponseBody<TrusteeOversightAssignment>> {
  return {
    data: {
      id: randomId(),
      trusteeId,
      user: {
        id: userId,
        name: 'John Doe',
      },
      role,
      createdBy: { id: 'user-1', name: 'Admin User' },
      createdOn: new Date().toISOString(),
      updatedBy: { id: 'user-1', name: 'Admin User' },
      updatedOn: new Date().toISOString(),
    },
  };
}

const MockApi2 = {
  getTrustees,
  getTrustee,
  getTrusteeHistory,
  getTrusteeAppointments,
  postTrusteeAppointment,
  putTrusteeAppointment,
  postTrustee,
  patchTrustee,
  deletePrivilegedIdentityUser,
  getCaseDetail,
  getCaseDocket,
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getCaseHistory,
  postCaseNote,
  putCaseNote,
  getCaseNotes,
  deleteCaseNote,
  getCourts,
  getMe,
  getOfficeAttorneys,
  getOfficeAssignees,
  getOffices,
  getOrders,
  getOrderSuggestions,
  getPrivilegedIdentityUsers,
  getPrivilegedIdentityUser,
  getRoleAndOfficeGroupNames,
  patchTransferOrderApproval,
  patchTransferOrderRejection,
  postStaffAssignments,
  putConsolidationOrderApproval,
  putConsolidationOrderRejection,
  putPrivilegedIdentityUser,
  searchCases,
  getBankruptcySoftwareList,
  postBankruptcySoftware,
  deleteBankruptcySoftware,
  deleteBank,
  postBank,
  getBanks,
  getTrusteeOversightAssignments,
  createTrusteeOversightAssignment,
  getOversightStaff,
};

export default MockApi2;
