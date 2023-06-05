import {Chapter15Case} from "../types/cases";

export interface PacerGatewayInterface {
    getChapter15Cases(startingMonth: number): Promise<Chapter15Case[]>;
}
