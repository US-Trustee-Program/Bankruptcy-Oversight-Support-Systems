import { ResponseData } from '../type-declarations/api';
import {
  CaseDetailType,
  CaseDocketEntry,
  Chapter15CaseDetailsResponseData,
} from '../type-declarations/chapter-15';
import Api from './api';

export default class Chapter15MockApi extends Api {
  static caseList = [
    {
      caseId: '101-23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '05-04-2023',
    },
    {
      caseId: '101-23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '04-14-2023',
    },
    {
      caseId: '101-23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '04-04-2023',
    },
    {
      caseId: '101-23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '03-01-2023',
    },
    {
      caseId: '101-23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '02-14-2023',
    },
    {
      caseId: '101-23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '02-04-2023',
    },
    {
      caseId: '101-23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '01-14-2023',
    },
    {
      caseId: '101-23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '01-04-2023',
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
    dateFiled: '02-15-2023',
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
    petitionLabel: 'Voluntary Petition',
  };

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
    if (path.match(/\/cases\/[\d-]+\/docket/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.caseDocketEntries,
      };
    } else if (path.match(/\/cases\/[\d-]+/)) {
      response = {
        message: '',
        count: 1,
        body: {
          caseDetails: Chapter15MockApi.caseDetails,
        },
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
}
