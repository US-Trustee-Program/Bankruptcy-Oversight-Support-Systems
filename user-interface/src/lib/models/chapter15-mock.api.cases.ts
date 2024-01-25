import { ResponseData } from '../type-declarations/api';
import {
  CaseDetailType,
  CaseDocketEntry,
  Chapter15CaseDetailsResponseData,
  OfficeDetails,
  Order,
} from '../type-declarations/chapter-15';
import Api from './api';
import { ObjectKeyVal } from '@/lib/type-declarations/basic';

export default class Chapter15MockApi extends Api {
  static caseList = [
    {
      caseId: '101-23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '2023-05-04',
    },
    {
      caseId: '101-23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '2023-04-14',
    },
    {
      caseId: '101-23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '2023-04-04',
    },
    {
      caseId: '101-23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '2023-03-01',
    },
    {
      caseId: '101-23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '2023-02-14',
    },
    {
      caseId: '101-23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '2023-02-04',
    },
    {
      caseId: '101-23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '2023-01-14',
    },
    {
      caseId: '101-23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '2023-01-04',
    },
    {
      caseId: '101-23-44455',
      caseTitle: 'Justin Long and Michael Cera',
      dateFiled: '2023-02-07',
    },
  ];

  static caseDocketEntries: CaseDocketEntry[] = [
    {
      sequenceNumber: 0,
      dateFiled: '2015-11-05T00:00:00.000Z',
      summaryText: 'Motion for Joint Administration',
      fullText:
        'Clamo bellum repellendus conservo patrocinor commemoro. Coniuratio victus blanditiis ulterius voluptate territo utrimque tam umerus. Repellendus creta cum carpo laudantium adhuc volva provident dolores aqua. Tredecim demens acsi consectetur adfectus compello pecus sed complectus. Conspergo caecus absorbeo.',
    },
    {
      sequenceNumber: 1,
      dateFiled: '2016-07-12T00:00:00.000Z',
      summaryText: 'Order Re: Motion for Joint Administration',
      fullText:
        'Vorax venio comminor quasi toties eaque soluta. Statua denique asper desino. Voluptatibus inventore cupiditate. Vigilo crastinus contigo aestus credo.',
    },
    {
      sequenceNumber: 2,
      dateFiled: '2016-08-15T00:00:00.000Z',
      summaryText: 'Auto- docket of credit card',
      fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
    },
    {
      sequenceNumber: 3,
      dateFiled: '2018-06-09T00:00:00.000Z',
      summaryText: 'Case Association - Joint Administration',
      fullText:
        'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
    },
    {
      sequenceNumber: 4,
      documentNumber: 4,
      dateFiled: '2018-01-01T00:00:00.000Z',
      summaryText: 'Petition for Recognition of Foreign Proceeding',
      fullText:
        'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
    },
    {
      sequenceNumber: 5,
      documentNumber: 5,
      dateFiled: '2015-11-30T00:00:00.000Z',
      summaryText: 'Case Association - Joint Administration',
      fullText:
        'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
      documents: [
        {
          fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-5-4-0.pdf',
          fileSize: 100000,
          fileLabel: '4-0',
          fileExt: 'pdf',
        },
        {
          fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-5-4-1.pdf',
          fileSize: 100000,
          fileLabel: '4-1',
          fileExt: 'pdf',
        },
      ],
    },
  ];

  static caseDetails: CaseDetailType = {
    caseId: '101-23-12345',
    chapter: '15',
    regionId: '02',
    officeName: 'New York',
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    caseTitle: 'Débora Arden Coronado Nazario III',
    dateFiled: '2023-02-15',
    judgeName: 'Meyer Steven',
    assignments: ['Brian Wilson', 'Carl Wilson', 'Dennis Wilson', 'Mike Love', 'Al Jardine'],
    debtor: {
      name: 'Débora Arden Coronado Nazario III',
      address1: 'Huerta Cedro 3',
      address2: 'Edificio 9',
      cityStateZipCountry: 'Miramar DG 30849 Mexico',
      ssn: '010-10-1010',
      taxId: '12-1234567',
    },
    debtorAttorney: {
      name: 'Julio César Kyle Contreras de Caballero Mtro.',
      address1: 'Pasaje Martín Salcido 4929',
      address2: 'Puerta 248',
      cityStateZipCountry: 'Irapuato HG 82513 Mexico',
      phone: '5992-349-234',
      email: 'testemail@email.com',
    },
    debtorTypeLabel: 'Corporate Business',
    petitionLabel: 'Voluntary',
    transfers: [
      {
        caseId: '101-23-12345',
        otherCaseId: '001-19-12446',
        orderDate: '01-04-2023',
        divisionName: 'Old Division',
        courtName: 'Ye Olde Court',
        documentType: 'TRANSFER_IN',
      },
      {
        caseId: '101-23-12345',
        otherCaseId: '222-24-00001',
        orderDate: '01-12-2024',
        divisionName: 'New Division',
        courtName: 'New Hotness Court',
        documentType: 'TRANSFER_OUT',
      },
    ],
  };

  static offices: Array<OfficeDetails> = [
    {
      divisionCode: '001',
      groupDesignator: 'AA',
      courtId: '0101',
      officeCode: '1',
      officeName: 'A1',
      state: 'NY',
      courtName: 'A District of New York',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      divisionCode: '002',
      groupDesignator: 'AB',
      courtId: '0102',
      officeCode: '2',
      officeName: 'B1',
      state: 'NY',
      courtName: 'B District of New York',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      divisionCode: '003',
      groupDesignator: 'AC',
      courtId: '0103',
      officeCode: '3',
      officeName: 'C1',
      state: 'NY',
      courtName: 'C District of New York',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      divisionCode: '004',
      groupDesignator: 'AD',
      courtId: '0104',
      officeCode: '4',
      officeName: 'D1',
      state: 'NY',
      courtName: 'D District of New York',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
  ];

  static orders: Array<Order> = [
    {
      id: 'guid-0',
      caseId: '081-01-00001',
      caseTitle: 'Case 1',
      chapter: '15',
      courtName: 'Court 1',
      courtDivisionName: 'Court Division 1',
      regionId: '02',
      orderType: 'transfer',
      orderDate: '01-01-2024',
      status: 'pending',
      newCaseId: '23-54321',
      newCourtName: 'A',
      newCourtDivisionName: 'New York 1',
      newDivisionCode: '101',
      newRegionId: '02',
      sequenceNumber: 1,
      documentNumber: 1,
      dateFiled: '01/01/2024',
      summaryText: 'Summary Text 1',
      fullText: 'Full Text 1',
      documents: [
        {
          fileUri: 'file1',
          fileSize: 1000001,
          fileLabel: 'FileLabel1',
          fileExt: 'pdf',
        },
      ],
    },
    {
      id: 'guid-1',
      caseId: '081-01-00002',
      caseTitle: 'Case 2',
      chapter: '15',
      courtName: 'Court 2',
      courtDivisionName: 'Court Division 2',
      regionId: '02',
      orderType: 'transfer',
      orderDate: '01-02-2024',
      status: 'approved',
      newCaseId: '',
      sequenceNumber: 2,
      documentNumber: 2,
      dateFiled: '01/02/2024',
      summaryText: 'Summary Text 2',
      fullText: 'Full Text 2',
      documents: [
        {
          fileUri: 'file2',
          fileSize: 1000002,
          fileLabel: 'FileLabel2',
          fileExt: 'pdf',
        },
      ],
    },
    {
      id: 'guid-2',
      caseId: '081-01-00003',
      caseTitle: 'Case 3',
      chapter: '15',
      courtName: 'Court 3',
      courtDivisionName: 'Court Division 3',
      regionId: '02',
      orderType: 'transfer',
      orderDate: '01-03-2024',
      status: 'rejected',
      newCaseId: '',
      sequenceNumber: 3,
      documentNumber: 3,
      dateFiled: '01/03/2024',
      summaryText: 'Summary Text 3',
      fullText: 'Full Text 3',
      reason: 'order rejected because its bad.',
      documents: [
        {
          fileUri: 'file3',
          fileSize: 1000003,
          fileLabel: 'FileLabel3',
          fileExt: 'pdf',
        },
      ],
    },
  ];

  public static async list(path: string): Promise<ResponseData> {
    let response: ResponseData;
    switch (path) {
      case '/cases':
        response = {
          message: '',
          count: Chapter15MockApi.caseList.length,
          body: {
            caseList: Chapter15MockApi.caseList,
          },
        };
        break;
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {
            caseList: [],
          },
        };
    }
    return Promise.resolve(response);
  }

  public static async get(path: string): Promise<Chapter15CaseDetailsResponseData> {
    let response: ResponseData;
    if (path.match(/\/cases\/123-12-12345\/docket/)) {
      return Promise.reject(new Error());
    } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
      return Promise.reject({ message: 'Case summary not found for the case ID.' });
    } else if (path.match(/\/cases\/[\d-]+\/docket/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.caseDocketEntries,
      };
    } else if (path.match(/\/cases\/[\d-]+\/summary/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.caseDetails,
      };
    } else if (path.match(/\/cases\/[\d-]+/)) {
      response = {
        message: '',
        count: 1,
        body: {
          caseDetails: Chapter15MockApi.caseDetails,
        },
      };
    } else if (path.match(/\/orders/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.orders,
      };
    } else if (path.match(/\/offices/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.offices,
      };
    } else {
      response = {
        message: 'not found',
        count: 0,
        body: {
          caseDetails: {},
        },
      };
    }

    return Promise.resolve(response as Chapter15CaseDetailsResponseData);
  }

  public static async patch(_path: string, data: object, _options?: ObjectKeyVal) {
    const response = {
      message: '',
      count: 1,
      body: data,
    };
    return Promise.resolve(response);
  }
}
