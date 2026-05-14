import {
  Auditable,
  createAuditRecord,
  SYSTEM_USER_REFERENCE,
  ACMS_SYSTEM_USER_REFERENCE,
} from './auditable';
import MockData from './test-utilities/mock-data';

type Foo = Auditable & {
  foo: string;
};

describe('auditable tests', () => {
  test('SYSTEM_USER_REFERENCE has id SYSTEM and name SYSTEM', () => {
    expect(SYSTEM_USER_REFERENCE.id).toBe('SYSTEM');
    expect(SYSTEM_USER_REFERENCE.name).toBe('SYSTEM');
  });

  test('ACMS_SYSTEM_USER_REFERENCE has id ACMS and name ACMS', () => {
    expect(ACMS_SYSTEM_USER_REFERENCE.id).toBe('ACMS');
    expect(ACMS_SYSTEM_USER_REFERENCE.name).toBe('ACMS');
  });

  test('should create fields with system user', () => {
    const foo = {
      foo: 'bar',
    };

    const result = createAuditRecord<Foo>(foo);
    expect(result.foo).toBe('bar');
    expect(result.updatedBy).toEqual({ id: 'SYSTEM', name: 'SYSTEM' });
    expect(result.createdBy).toEqual({ id: 'SYSTEM', name: 'SYSTEM' });
    expect(result.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.updatedOn).toBe(result.createdOn);
  });

  test('should create fields with provided user', () => {
    const user = MockData.getCamsUserReference();
    const foo = {
      foo: 'bar',
    };

    const result = createAuditRecord<Foo>(foo, user);
    expect(result.updatedBy).toEqual(user);
    expect(result.createdBy).toEqual(user);
    expect(result.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.updatedOn).toBe(result.createdOn);
    expect(result.foo).toBe('bar');
  });
});
