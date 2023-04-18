import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../../src/server';

chai.use(chaiHttp);
const request = chai.request;

describe('users-endpoints', () => {
  describe('Login (mock login)', async () => {
    it('when supplied a first and last name, should return a record containing professional id', () => {
      const names = {
        first_name: 'Joe',
        last_name: 'Bob'
      };
      const expectedResult = [{
        firstName: names.first_name,
        lastName: names.last_name,
        middleInitial: ' ',
        professionalId: 123
      }];
      return request(app).post('/users/login/').send(names)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "user record",
            "count": 1,
            "body": expectedResult,
            "success": true
          });
      });
    });
  });

});
