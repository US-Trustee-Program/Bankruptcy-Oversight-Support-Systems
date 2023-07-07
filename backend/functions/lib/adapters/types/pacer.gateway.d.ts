import { Chapter15Case } from './cases';

export interface PacerGatewayInterface {
  startingMonth: number;
  getChapter15Cases(startingMonth?: number): Promise<Chapter15Case[]>;
}
