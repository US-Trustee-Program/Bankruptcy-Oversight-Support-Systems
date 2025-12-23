import { describe, expect, it } from 'vitest';
import HttpStatusCodes from './http-status-codes';

describe('HttpStatusCodes', () => {
  it('should export an object with status codes', () => {
    expect(HttpStatusCodes).toBeDefined();
    expect(typeof HttpStatusCodes).toBe('object');
  });

  it('should contain expected status codes', () => {
    expect(HttpStatusCodes.OK).toBe(200);
    expect(HttpStatusCodes.CREATED).toBe(201);
    expect(HttpStatusCodes.ACCEPTED).toBe(202);
    expect(HttpStatusCodes.NO_CONTENT).toBe(204);
    expect(HttpStatusCodes.BAD_REQUEST).toBe(400);
    expect(HttpStatusCodes.UNAUTHORIZED).toBe(401);
    expect(HttpStatusCodes.FORBIDDEN).toBe(403);
    expect(HttpStatusCodes.NOT_FOUND).toBe(404);
    expect(HttpStatusCodes.INTERNAL_SERVER_ERROR).toBe(500);
  });
});
