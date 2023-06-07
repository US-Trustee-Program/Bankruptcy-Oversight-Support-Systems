///<reference path="../../../node_modules/@types/node/globals.global.d.ts"/>
//import {getGlobalObject} from "./misc";
import { PacerApiGateway } from "./pacer.api.gateway";
import { Chapter15Case } from '../types/cases';
const http = require('../utils/http');

describe('PACER API gateway tests', () => {
    test('should return error message for non-200 response', async () => {
        const responseValue = {status: 401, message: 'Unauthorized user' };
        jest.spyOn(http, 'httpPost').mockImplementation(() => {
            return {
                json:() => ({ content: responseValue }),
                status: 401,
            };
        });

        const gateway = new PacerApiGateway();
        await expect(gateway.getChapter15Cases()).rejects.toEqual({ content: responseValue });
    });

    test('should return content for 200 response', async () => {
        const expectedResponseValue: Chapter15Case[] = [
            {
                caseNumber: '23-1234',
                caseTitle: '',
                dateFiled: '',
            },
        ];
        jest.spyOn(http, 'httpPost').mockImplementation(() => {
            return {
                json:() => ({ content: expectedResponseValue }),
                status: 200,
            };
        });

        const gateway = new PacerApiGateway();
        await expect(gateway.getChapter15Cases()).toEqual(expectedResponseValue);
    });
});
