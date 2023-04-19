import {describe, it } from 'mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../../src/server';

chai.use(chaiHttp);
const request = chai.request;

describe('cases-endpoints', () => {
  type CaseList = {
    caseDiv: number;
    staff1ProfCode: string;
    staff2ProfCode: string;
    caseYear: string;
    caseNumber: string;
    currentCaseChapter: string;
  }
  type CaseListRecordSet = {
    staff1Label: string;
    staff2Label: string;
    caseList: CaseList[];
  }
  let list: CaseListRecordSet;
  let casesMock: {list: CaseListRecordSet};

  beforeEach(async () => {
    casesMock = await import('../../src/adapters/mock-data/cases.mock');
    list = casesMock.list;
  });

  describe('Get full cases list', async () => {
    it('should return a set of 10 cases', () => {
      return request(app).get('/cases/')
        .then(res => {
          expect(res).to.have.status(200);
          console.log(res.body);
          expect(res.body).to.eql({
            "message": "cases list",
            "count": 10,
            "body": list,
            "success": true
          });
      });
    });
  });

  /*
  describe('Get details of case 402', async () => {
    it('should return detail for a single cases matching mock case number 3', () => {
      return request(app).get('/cases/402')
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.eql({
            "message": "cases record",
            "count": 1,
            "body": [list.caseList[3-1]],
            "success": true
          });
      });
    });
  });

  describe('Post new record to cases', async () => {
    it('should return detail for a single case that was added to list, and list should be updated to include new record', () => {
      const newRecord = {
        staff1ProfCode: '123',
        staff1ProfFirstName: 'Joe',
        staff1ProfLastName: 'Jones',
        staff1ProfType: 'ST',
        staff1ProfTypeDescription: 'STAFF MEMBER        ',
        staff2ProfCode: '456',
        staff2ProfFirstName: 'Stacy',
        staff2ProfLastName: 'Went',
        staff2ProfType: 'ST',
        staff2ProfTypeDescription: 'STAFF MEMBER        ',
        groupDesignator: 'CI',
        caseYear: '22',
        caseNumber: '12345',
        currentCaseChapter: '11',
        hearingCode: '012',
        hearingDisposition: 'HD'
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
          expect(list.caseList.length).to.eql(11);
          expect(list.caseList[10]).to.eql(newRecord)
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
        staff1ProfCode: '321',
        staff1ProfFirstName: 'Eoj',
        staff1ProfLastName: 'Nosnhoj',
        staff1ProfType: 'ST',
        staff1ProfTypeDescription: 'STAFF MEMBER        ',
        staff2ProfCode: '654',
        staff2ProfFirstName: 'YcatS',
        staff2ProfLastName: 'Tnew',
        staff2ProfType: 'ST',
        staff2ProfTypeDescription: 'STAFF MEMBER        ',
        groupDesignator: 'CI',
        caseYear: '22',
        caseNumber: '54321',
        currentCaseChapter: '11',
        hearingCode: '210',
        hearingDisposition: 'HD'
      };

      const returnVal = Object.assign({caseDiv: 402}, newRecord);

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
      const newList = list.caseList.filter((rec) => rec[`caseDiv`] != 403);
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
  */

});
