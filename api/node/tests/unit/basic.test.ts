import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from './../../src/server';

chai.use(chaiHttp);
const request = chai.request;

describe('basic-endpoints', () => {

  describe('hello world', () => {
    it('should return "status 200 and message: Hello World"', () => {
      return request(app).get('/')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "Hello World",
            "count": 1,
            "body": "hello",
            "success": true
          });
      });
    });
  });

  describe('health check', () => {
    it('should return "status 200 and message: Health Check OK"', () => {
      return request(app).get('/healthcheck')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "Health Check OK",
            "count": 1,
            "body": "OK",
            "success": true
          });
      });
    });
  });

});
