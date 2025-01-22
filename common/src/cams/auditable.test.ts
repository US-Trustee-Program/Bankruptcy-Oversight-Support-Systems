import { Auditable, createAuditRecord, SYSTEM_USER_REFERENCE } from './auditable';
import MockData from './test-utilities/mock-data';

type Foo = Auditable & {
  foo: string;
};

describe('auditable tests', () => {
  test('should create fields with system user', () => {
    const foo = {
      foo: 'bar',
    };

    const expected = {
      ...foo,
      updatedOn: expect.any(String),
      updatedBy: SYSTEM_USER_REFERENCE,
    };
    expect(createAuditRecord<Foo>(foo)).toEqual(expected);
  });

  test('should create fields with provided user', () => {
    const user = MockData.getCamsUserReference();
    const foo = {
      foo: 'bar',
    };

    const expected = {
      ...foo,
      updatedOn: expect.any(String),
      updatedBy: user,
    };
    expect(createAuditRecord<Foo>(foo, user)).toEqual(expected);
  });
});
