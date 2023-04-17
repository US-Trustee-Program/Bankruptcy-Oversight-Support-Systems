import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../../src/server';

chai.use(chaiHttp);
const request = chai.request;

describe('cases-endpoints', () => {
  type CaseList = {
    CASE_DIV: number;
    STAFF1_PROF_CODE: string;
    STAFF2_PROF_CODE: string;
    CASE_YEAR: string;
    CASE_NUMBER: string;
    CURR_CASE_CHAPT: string;
  }
  let list: CaseList[];
  let casesMock: {list: CaseList[]};

  beforeEach(async () => {
    casesMock = await import('../../src/adapters/mock-data/cases.mock');
    list = casesMock.list;
  });

  describe('Get full cases list', async () => {
    it('should return a set of 10 cases', () => {
      return request(app).get('/cases/')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 10,
            "body": list,
            "success": true
          });
      });
    });
  });

  describe('Get details of case 402', async () => {
    it('should return detail for a single cases matching mock case number 3', () => {
      return request(app).get('/cases/402')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "cases record",
            "count": 1,
            "body": [list[3-1]],
            "success": true
          });
      });
    });
  });

  describe('Post new record to cases', async () => {
    it('should return detail for a single case that was added to list, and list should be updated to include new record', () => {
      const newRecord = {
        STAFF1_PROF_CODE: 'Joe',
        STAFF2_PROF_CODE: 'Johnson',
        CASE_YEAR: '22',
        CASE_NUMBER: '12345',
        CURR_CASE_CHAPT: '11'
      };

      request(app).post('/cases/create').send(newRecord)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "",
            "count": 1,
            "body": newRecord,
            "success": true
          });
          expect(list.length).to.eql(11);
          expect(list[10]).to.eql(newRecord)
      });

      return request(app).get('/cases/')
        .then(res => {
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 11,
            "body": list,
            "success": true
          });
      });
    });

  });

  describe('Put record to cases', async () => {
    it('should return detail for a single case that was added to list, and list should be updated to include new record', () => {
      const newRecord = {
        STAFF1_PROF_CODE: 'Eoj',
        STAFF2_PROF_CODE: 'Nosnhoj',
        CASE_YEAR: '11',
        CASE_NUMBER: '54321',
        CURR_CASE_CHAPT: '22'
      };

      const returnVal = Object.assign({CASE_DIV: 402}, newRecord);

      request(app).put('/cases/402').send(newRecord)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "",
            "count": 1,
            "body": returnVal,
            "success": true
          });
      });

      return request(app).get('/cases/402')
        .then(res => {
          expect(res.body).to.eql({
            "message": "cases record",
            "count": 1,
            "body": [returnVal],
            "success": true
          });
      });
    });

  });

  describe('Delete case 403', async () => {
    it('should return "Record 403 successfully deleted"', () => {
      const newList = list.filter((rec) => rec[`CASE_DIV`] != 403);
      request(app).delete('/cases/403')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "Record 403 successfully deleted",
            "count": 1,
            "body": {},
            "success": true
          });
      });
      request(app).get('/cases/')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 10,
            "body": newList,
            "success": true
          });
      });
      return request(app).get('/cases/403')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "record not found",
            "count": 0,
            "body": {},
            "success": false
          });
      });
    });
  });

});
