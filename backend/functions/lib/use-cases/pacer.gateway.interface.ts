import { PacerCaseData } from "../adapters/types/cases";

export interface PacerGatewayInterface {
    getChapter15Cases(startingMonth?: number): Promise<PacerCaseData[]>;
}
