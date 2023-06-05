///<reference path="../../../node_modules/@types/node/globals.global.d.ts"/>
//import {getGlobalObject} from "./misc";
import { PacerApiGateway } from "./pacer.api.gateway";
import * as db from "./local.inmemory.gateway";

describe('PACER API gateway tests', () => {
    test('should return error message for non-200 response', async () => {

         jest.mock('fetch', () => {
             json:() => ({status: 401, message: 'Unauthorized user' })
         });

         const gateway = new PacerApiGateway();
         const response = await gateway.getChapter15Cases()

        expect(response).toEqual({status: 401, message: 'Unauthorized user' });

    });
});


