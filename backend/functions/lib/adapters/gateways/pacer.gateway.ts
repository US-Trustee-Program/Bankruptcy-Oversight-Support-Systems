import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';

dotenv.config();

export async function getChapter15Cases(): Promise<Chapter15Case[]> {
    const date = new Date();
    date.setMonth(date.getMonth() + -6);
    const dateFileFrom = date.toISOString().split('T')[0];

    const body = `{
            "jurisdictionType": "bk",
            "courtId": [
                "cm8bk", "nyebk", "nynbk", "nysbk", "nywbk", "vtbk", "ctbk"
            ],
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
    const cases = await response.json();
    return cases.content;
}
