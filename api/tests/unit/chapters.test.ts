import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from './../../src/server';
import { list } from '../../src/adapters/mock-data/chapters.mock';

chai.use(chaiHttp);
const request = chai.request;

describe('chapters-endpoints', () => {

  describe('Get full chapters list', () => {
    it('should return a set of 7 chapters', () => {
      return request(app).get('/chapters/')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "chapters list",
            "count": 7,
            "body": list,
            "success": true
          });
      });
    });
  });

});