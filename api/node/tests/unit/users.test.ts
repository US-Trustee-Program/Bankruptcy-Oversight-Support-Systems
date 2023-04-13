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
        firstName: 'Joe',
        lastName: 'Bob'
      };
      const expectedResult = [{
        first_name: names.firstName,
        last_name: names.lastName,
        middle_initial: ' ',
        professional_id: 123
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
