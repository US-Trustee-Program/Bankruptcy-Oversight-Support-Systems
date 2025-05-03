import { CaseDocket, CaseDocketEntryDocument } from '../../../../common/src/cams/cases';
import { DxtrCaseDocketEntryDocument } from '../../adapters/gateways/dxtr/case-docket.dxtr.gateway';

export const DXTR_CASE_DOCKET_ENTRIES: CaseDocket = [
  {
    dateFiled: '2015-11-05T00:00:00.000Z',
    fullText:
      'Clamo bellum repellendus conservo patrocinor commemoro. Coniuratio victus blanditiis ulterius voluptate territo utrimque tam umerus. Repellendus creta cum carpo laudantium adhuc volva provident dolores aqua. Tredecim demens acsi consectetur adfectus compello pecus sed complectus. Conspergo caecus absorbeo.',
    sequenceNumber: 0,
    summaryText: 'Motion for Joint Administration',
  },
  {
    dateFiled: '2016-07-12T00:00:00.000Z',
    fullText:
      'Vorax venio comminor quasi toties eaque soluta. Statua denique asper desino. Voluptatibus inventore cupiditate. Vigilo crastinus contigo aestus credo.',
    sequenceNumber: 1,
    summaryText: 'Order Re: Motion for Joint Administration',
  },
  {
    dateFiled: '2016-08-15T00:00:00.000Z',
    documentNumber: 1,
    fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
    sequenceNumber: 2,
    summaryText: 'Auto- docket of credit card',
  },
  {
    dateFiled: '2018-06-09T00:00:00.000Z',
    documentNumber: 2,
    fullText:
      'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
    sequenceNumber: 3,
    summaryText: 'Case Association - Joint Administration',
  },
  {
    dateFiled: '2018-01-01T00:00:00.000Z',
    documentNumber: 3,
    fullText:
      'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
    sequenceNumber: 4,
    summaryText: 'Petition for Recognition of Foreign Proceeding',
  },
  {
    dateFiled: '2015-11-30T00:00:00.000Z',
    documentNumber: 4,
    fullText:
      'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
    sequenceNumber: 5,
    summaryText: 'Case Association - Joint Administration',
  },
];

export const DXTR_DOCKET_ENTRIES_DOCUMENTS: DxtrCaseDocketEntryDocument[] = [
  {
    deleted: 'N',
    fileName: '0208-882356-2-1-0.pdf',
    fileSize: 100000,
    sequenceNumber: 2,
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
  },
  {
    deleted: 'N',
    fileName: '0208-882356-3-2-0.pdf',
    fileSize: 100000,
    sequenceNumber: 3,
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
  },
  {
    deleted: 'N',
    fileName: '0208-882356-4-3-0.pdf',
    fileSize: 100000,
    sequenceNumber: 4,
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
  },
  {
    deleted: 'N',
    fileName: '0208-882356-5-4-0.pdf',
    fileSize: 100000,
    sequenceNumber: 5,
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
  },
  {
    deleted: 'N',
    fileName: '0208-882356-5-4-1.pdf',
    fileSize: 100000,
    sequenceNumber: 5,
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
  },
  {
    deleted: 'N',
    fileName: 'missing-uri-stem.pdf',
    fileSize: 4060318,
    sequenceNumber: 0,
    uriStem: null,
  },
  {
    deleted: 'Y',
    fileName: 'deleted-file.pdf',
    fileSize: 4060318,
    sequenceNumber: 0,
    uriStem: null,
  },
];

const SEQUENCE_NUMBER_DOCUMENT_MAP = new Map<number, CaseDocketEntryDocument[]>([
  [
    2,
    [
      {
        fileExt: 'pdf',
        fileLabel: '1',
        fileSize: 100000,
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-2-1-0.pdf',
      },
    ],
  ],
  [
    3,
    [
      {
        fileExt: 'pdf',
        fileLabel: '2',
        fileSize: 100000,
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-3-2-0.pdf',
      },
    ],
  ],
  [
    4,
    [
      {
        fileExt: 'pdf',
        fileLabel: '3',
        fileSize: 100000,
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-4-3-0.pdf',
      },
    ],
  ],
  [
    5,
    [
      {
        fileExt: 'pdf',
        fileLabel: '4-0',
        fileSize: 100000,
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-5-4-0.pdf',
      },
      {
        fileExt: 'pdf',
        fileLabel: '4-1',
        fileSize: 100000,
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-5-4-1.pdf',
      },
    ],
  ],
]);

export const CASE_DOCKET_ENTRIES = DXTR_CASE_DOCKET_ENTRIES.map((entry) => {
  return {
    ...entry,
    documents: SEQUENCE_NUMBER_DOCUMENT_MAP.get(entry.sequenceNumber),
  };
});
