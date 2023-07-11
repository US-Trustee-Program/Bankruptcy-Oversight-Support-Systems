import { Chapter15Case } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';

export interface PacerGatewayInterface {
    getChapter15Cases(context: Context, startingMonth?: number): Promise<Chapter15Case[]>;
}
