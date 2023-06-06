///<reference path="../../../node_modules/@types/node/globals.global.d.ts"/>
//import {getGlobalObject} from "./misc";
import { PacerApiGateway } from "./pacer.api.gateway";
import * as db from "./local.inmemory.gateway";
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
});
