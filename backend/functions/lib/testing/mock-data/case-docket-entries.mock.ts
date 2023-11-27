import { CaseDocket } from '../../use-cases/case-docket/case-docket.model';

export const CASE_DOCKET_ENTRIES: CaseDocket = [
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
    documentNumber: 2,
    dateFiled: '2016-08-15T00:00:00.000Z',
    summaryText: 'Auto- docket of credit card',
    fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
    documents: [{ sequenceNumber: 2, fileUri: 'http://google.com', fileSize: 100000 }],
  },
  {
    sequenceNumber: 3,
    documentNumber: 3,
    dateFiled: '2018-06-09T00:00:00.000Z',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
    documents: [{ sequenceNumber: 3, fileUri: 'http://google.com', fileSize: 200000 }],
  },
  {
    sequenceNumber: 4,
    documentNumber: 4,
    dateFiled: '2018-01-01T00:00:00.000Z',
    summaryText: 'Petition for Recognition of Foreign Proceeding',
    fullText:
      'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
    documents: [{ sequenceNumber: 3, fileUri: 'http://google.com', fileSize: 150000 }],
  },
  {
    sequenceNumber: 5,
    documentNumber: 5,
    dateFiled: '2015-11-30T00:00:00.000Z',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
    documents: [
      { sequenceNumber: 5, fileUri: 'http://google.com', fileSize: 3000000 },
      { sequenceNumber: 5, fileUri: 'http://google.com', fileSize: 1750000 },
    ],
  },
];
