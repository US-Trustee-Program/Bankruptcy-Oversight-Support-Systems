import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../../src/server';

chai.use(chaiHttp);
const request = chai.request;

describe('cases-endpoints', () => {
  type CaseList = {
    cases_id: number;
    staff1: string;
    staff2: string;
    idi_status: string;
    idi_date: string;
    chapters_id: string; 
  }
  let list: CaseList[];
  let casesMock: {list: CaseList[]};

  beforeEach(async () => {
    casesMock = await import('../../src/adapters/mock-data/cases.mock');
    list = casesMock.list;
  });

  describe('Get full cases list', async () => {
    it('should return a set of 9 cases', () => {
      return request(app).get('/cases/')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 9,
            "body": list,
            "success": true
          });
      });
    });
  });

  describe('Get details of case 3', async () => {
    it('should return detail for a single cases matching mock case number 3', () => {
      return request(app).get('/cases/3')
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
        staff1: 'Joe',
        staff2: 'Johnson',
        idi_status: 'pending',
        idi_date: '2023-12-31',
        chapters_id: '3'
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
          expect(list.length).to.eql(10);
          expect(list[9]).to.eql(newRecord)
      });

      return request(app).get('/cases/')
        .then(res => {
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 10,
            "body": list,
            "success": true
          });
      });
    });

  });

});
