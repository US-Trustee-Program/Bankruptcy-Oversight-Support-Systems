import { CaseDocket, CaseDocketEntryDocument } from '@common/cams/cases';
import { DxtrCaseDocketEntryDocument } from '../../adapters/gateways/dxtr/case-docket.dxtr.gateway';

export const DXTR_CASE_DOCKET_ENTRIES: CaseDocket = [
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
    documentNumber: 1,
    dateFiled: '2016-08-15T00:00:00.000Z',
    summaryText: 'Auto- docket of credit card',
    fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
  },
  {
    sequenceNumber: 3,
    documentNumber: 2,
    dateFiled: '2018-06-09T00:00:00.000Z',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
  },
  {
    sequenceNumber: 4,
    documentNumber: 3,
    dateFiled: '2018-01-01T00:00:00.000Z',
    summaryText: 'Petition for Recognition of Foreign Proceeding',
    fullText:
      'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
  },
  {
    sequenceNumber: 5,
    documentNumber: 4,
    dateFiled: '2015-11-30T00:00:00.000Z',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
  },
];

export const DXTR_DOCKET_ENTRIES_DOCUMENTS: DxtrCaseDocketEntryDocument[] = [
  {
    sequenceNumber: 2,
    fileSize: 100000,
    fileName: '0208-882356-2-1-0.pdf',
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
    deleted: 'N',
  },
  {
    sequenceNumber: 3,
    fileSize: 100000,
    fileName: '0208-882356-3-2-0.pdf',
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
    deleted: 'N',
  },
  {
    sequenceNumber: 4,
    fileSize: 100000,
    fileName: '0208-882356-4-3-0.pdf',
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
    deleted: 'N',
  },
  {
    sequenceNumber: 5,
    fileSize: 100000,
    fileName: '0208-882356-5-4-0.pdf',
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
    deleted: 'N',
  },
  {
    sequenceNumber: 5,
    fileSize: 100000,
    fileName: '0208-882356-5-4-1.pdf',
    uriStem: 'https://somecourt.doj.gov/api/rest_v1/page/pdf',
    deleted: 'N',
  },
  {
    sequenceNumber: 0,
    uriStem: null,
    fileName: 'missing-uri-stem.pdf',
    fileSize: 4060318,
    deleted: 'N',
  },
  {
    sequenceNumber: 0,
    uriStem: null,
    fileName: 'deleted-file.pdf',
    fileSize: 4060318,
    deleted: 'Y',
  },
];

const SEQUENCE_NUMBER_DOCUMENT_MAP = new Map<number, CaseDocketEntryDocument[]>([
  [
    2,
    [
      {
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-2-1-0.pdf',
        fileSize: 100000,
        fileLabel: '1',
        fileExt: 'pdf',
      },
    ],
  ],
  [
    3,
    [
      {
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-3-2-0.pdf',
        fileSize: 100000,
        fileLabel: '2',
        fileExt: 'pdf',
      },
    ],
  ],
  [
    4,
    [
      {
        fileUri: 'https://somecourt.doj.gov/api/rest_v1/page/pdf/0208-882356-4-3-0.pdf',
        fileSize: 100000,
        fileLabel: '3',
        fileExt: 'pdf',
      },
    ],
  ],
  [
    5,
    [
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
  ],
]);

export const CASE_DOCKET_ENTRIES = DXTR_CASE_DOCKET_ENTRIES.map((entry) => {
  return {
    ...entry,
    documents: SEQUENCE_NUMBER_DOCUMENT_MAP.get(entry.sequenceNumber),
  };
});
