import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { CaseDocketGateway } from '../gateways.types';

export class MockCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(caseId: string): Promise<CaseDocket> {
    const caseDocket: CaseDocket = [
      {
        caseId,
        sequenceNumber: 0,
        documentNumber: null,
        dateEntered: '2015-11-06T00:00:00.000Z',
        dateFiled: '2015-11-05T00:00:00.000Z',
        type: 'motion',
        summaryText: 'Motion for Joint Administration',
        fullText:
          'Clamo bellum repellendus conservo patrocinor commemoro. Coniuratio victus blanditiis ulterius voluptate territo utrimque tam umerus. Repellendus creta cum carpo laudantium adhuc volva provident dolores aqua. Tredecim demens acsi consectetur adfectus compello pecus sed complectus. Conspergo caecus absorbeo.',
      },
      {
        caseId,
        sequenceNumber: 1,
        documentNumber: null,
        dateEntered: '2018-07-30T00:00:00.000Z',
        dateFiled: '2016-07-12T00:00:00.000Z',
        type: 'order',
        summaryText: 'Order Re: Motion for Joint Administration',
        fullText:
          'Vorax venio comminor quasi toties eaque soluta. Statua denique asper desino. Voluptatibus inventore cupiditate. Vigilo crastinus contigo aestus credo.',
      },
      {
        caseId,
        sequenceNumber: 2,
        documentNumber: null,
        dateEntered: '2018-03-18T00:00:00.000Z',
        dateFiled: '2016-08-15T00:00:00.000Z',
        type: 'crditcrd',
        summaryText: 'Auto- docket of credit card',
        fullText: 'Textor combibo virtus eum stillicidium tabella tempus sub audax.',
      },
      {
        caseId,
        sequenceNumber: 3,
        documentNumber: null,
        dateEntered: '2020-04-26T00:00:00.000Z',
        dateFiled: '2018-06-09T00:00:00.000Z',
        type: 'misc',
        summaryText: 'Case Association - Joint Administration',
        fullText:
          'Centum vis auctor cupiditate voluptatibus usus demoror valeo summopere. Demens fuga tumultus comes caput charisma. Clarus tardus approbo comes trepide dolores.\nComes enim velit provident quas votum vis tenax timidus eius. Vociferor sponte ipsam. Vinum cinis corporis delectatio.\nAufero timidus aggero deludo capio summisse ambitus blanditiis maxime. Acerbitas pecus occaecati comparo vado. Aveho autus eligendi illo quae praesentium soluta cupio.',
      },
      {
        caseId,
        sequenceNumber: 4,
        documentNumber: '4',
        dateEntered: '2018-01-02T00:00:00.000Z',
        dateFiled: '2018-01-01T00:00:00.000Z',
        type: 'misc',
        summaryText: 'Petition for Recognition of Foreign Proceeding',
        fullText:
          'Corpus truculenter astrum cui tamen tribuo. Sodalitas qui carcer alias vallum sponte. Addo conturbo utique.',
      },
      {
        caseId,
        sequenceNumber: 5,
        documentNumber: '5',
        dateEntered: '2016-10-09T00:00:00.000Z',
        dateFiled: '2015-11-30T00:00:00.000Z',
        type: 'misc',
        summaryText: 'Case Association - Joint Administration',
        fullText:
          'Ustilo basium teneo abeo urbanus terminatio somniculosus sapiente tollo capto. Curatio curo abbas. Adulatio curo sufficio comminor conicio. Sed quia argentum campana admiratio. Ut odio admoveo adsidue confero ambulo urbanus tenus.',
      },
    ];
    return Promise.resolve(caseDocket);
  }
}
