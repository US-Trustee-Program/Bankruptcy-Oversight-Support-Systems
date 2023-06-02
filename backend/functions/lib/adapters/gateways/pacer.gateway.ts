import {Request} from "mssql";

export function getChapter15Cases() {
    // make http api call
    const body = `{
            "jurisdictionType": "bk",
            "courtId": [
                "cm8bk", "nyebk", "nynbk", "nysbk", "nywbk", "vtbk", "ctbk"
            ],
            "federalBankruptcyChapter": [
                "15"
            ]
        }`
    let requestInit: RequestInit = {
        method: 'POST',
        headers: {
            Accept: 'application.json',
            'Content-Type': 'application/json',
            'X-NEXT-GEN-CSO': process.env.PACER_TOKEN
        },
        body: body,
        cache: 'default'
    };
    fetch('https://qa-pcl.uscourts.gov/pcl-public-api/rest/cases/find?page=0', requestInit);
}
