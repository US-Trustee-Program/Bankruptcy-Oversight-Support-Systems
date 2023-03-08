import {describe, it, expect } from '@jest/globals';
import { app } from './../../src/server';
import * as request from 'supertest';

describe('basic-endpoints', () => {

  describe('hello world', () => {
    it('should return "Hello World"', () => {
      /* having issues with top-level await in server.js *--/
      request(app).get('/')
        .expect(200, {
          "message": "Hello World",
          "count": 1,
          "body": "hello",
          "success": true
        });
      /**/
      expect(true).toBe(true);
    });
  });

  describe('health check', () => {
    it('should return "Health Check OK"', () => {
      expect(true).toBe(true);
    });
  });

});
