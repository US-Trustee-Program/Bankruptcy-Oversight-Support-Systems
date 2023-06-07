///<reference path="../../../node_modules/@types/node/globals.global.d.ts"/>
import { PacerLocalGateway } from "./pacer.local.gateway";
import { Chapter15Case } from "../types/cases";
import { GatewayHelper } from "./gateway-helper";
const http = require('../utils/http');

const gatewayHelper = new GatewayHelper();

describe('PACER Local gateway tests', () => {

    test('should return content for 200 response', async () => {
        const expectedResponseValue: Chapter15Case[] = [
            {
                caseNumber: '04-44449',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2005-05-04',
            },
            {
                caseNumber: '06-1122',
                caseTitle: 'Jennifer Millhouse',
                dateFiled: '2006-03-27',
            }
        ];

        const gateway = new PacerLocalGateway();

        expect(await gateway.getChapter15Cases()).toEqual(expect.arrayContaining(expectedResponseValue));
    });
});
