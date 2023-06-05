import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import {PacerGatewayInterface} from "../../use-cases/pacer.gateway.interface";

dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
    getChapter15Cases = async (startingMonth: number = -6): Promise<Chapter15Case[]> => {
        const date = new Date();
        date.setMonth(date.getMonth() + startingMonth);
        const dateFileFrom = date.toISOString().split('T')[0];
        const regionTwoPacerCourtIds = '["nyebk", "nynbk", "nysbk", "nywbk", "vtbk", "ctbk"]';

        const body = `{
            "jurisdictionType": "bk",
            "courtId": ${regionTwoPacerCourtIds},
            "federalBankruptcyChapter": [
                "15"
            ],
            "dateFiledFrom": "${dateFileFrom}"
        }`;

        let requestInit: RequestInit = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-NEXT-GEN-CSO': process.env.PACER_TOKEN
            },
            body: body,
            cache: 'default'
        };

        const response = await fetch('https://qa-pcl.uscourts.gov/pcl-public-api/rest/cases/find?page=0', requestInit);
        if(response.status != 200)
        {
            return Promise.reject(await response.json());
        } else {
            const cases = await response.json();
            return cases.content;
        }


    }
}

export { PacerApiGateway }
