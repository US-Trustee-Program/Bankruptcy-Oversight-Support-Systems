import { Chapter15Case } from '../adapters/types/cases';

export interface PacerGatewayInterface {
    startingMonth: number;
    getChapter15Cases(startingMonth?: number): Promise<Chapter15Case[]>;
}
