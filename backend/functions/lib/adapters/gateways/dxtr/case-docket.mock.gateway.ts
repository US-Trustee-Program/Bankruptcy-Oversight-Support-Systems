import { NotFoundError } from '../../../common-errors/not-found-error';
import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../gateways.types';

const MODULENAME = 'CASE-DOCKET-MOCK-GATEWAY';

export const DOCKET: CaseDocket = [
  {
    sequenceNumber: 0,
    documentNumber: null,
    dateFiled: '11-05-2015',
    summaryText: 'Motion for Joint Administration',
    fullText:
      'Clamo bellum repellendus conservo patrocinor commemoro. Coniuratio victus blanditiis ulterius voluptate territo utrimque tam umerus. Repellendus creta cum carpo laudantium adhuc volva provident dolores aqua. Tredecim demens acsi consectetur adfectus compello pecus sed complectus. Conspergo caecus absorbeo.',
  },
  {
    sequenceNumber: 1,
    documentNumber: null,
    dateFiled: '07-12-2016',
    summaryText: 'Order Re: Motion for Joint Administration',
    fullText:
      'Vorax venio comminor quasi toties eaque soluta. Statua denique asper desino. Voluptatibus inventore cupiditate. Vigilo crastinus contigo aestus credo.',
  },
  {
    sequenceNumber: 2,
    documentNumber: null,
    dateFiled: '08-15-2016',
    summaryText: 'Auto- docket of credit card',
    fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
  },
  {
    sequenceNumber: 3,
    documentNumber: null,
    dateFiled: '06-09-2018',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
  },
  {
    sequenceNumber: 4,
    documentNumber: '4',
    dateFiled: '01-01-2018',
    summaryText: 'Petition for Recognition of Foreign Proceeding',
    fullText:
      'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
  },
  {
    sequenceNumber: 5,
    documentNumber: '5',
    dateFiled: '11-30-2015',
    summaryText: 'Case Association - Joint Administration',
    fullText:
      'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
  },
];

export const NORMAL_CASE_ID = '111-11-11111';

export class MockCaseDocketGateway implements CaseDocketGateway {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getCaseDocket(_context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    if (caseId === NORMAL_CASE_ID) return Promise.resolve(DOCKET);
    return Promise.reject(new NotFoundError(MODULENAME, { data: { caseId } }));
  }
}
