import { Chapter15Case } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';

export interface PacerGatewayInterface {
    startingMonth: number;
    getChapter15Cases(context: Context, startingMonth?: number): Promise<Chapter15Case[]>;
}
