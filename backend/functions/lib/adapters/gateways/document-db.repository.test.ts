import { DocumentQuery, transformQuery } from './document-db.repository';

const expectedOne = {
  $and: [{ company: { $exists: false } }, { roles: { $all: ['owner', 'guest'] } }],
};
const expectedTwo = {
  $and: [
    { company: { $exists: true } },
    {
      $or: [
        { name: { $eq: 'Jordan Valencia' } },
        { name: { $eq: 'Glass Morin' } },
        { name: { $eq: 'Hanson Preston' } },
      ],
    },
  ],
};

describe('Document DB Repository', () => {
  test('should build queries correctly', () => {
    const queryOne: DocumentQuery = {
      and: [{ company: { exists: false } }, { roles: { all: ['owner', 'guest'] } }],
    };
    expect(transformQuery(queryOne)).toEqual(expectedOne);

    const queryTwo: DocumentQuery = {
      and: [
        { company: { exists: true } },
        {
          or: [
            { name: { equals: 'Jordan Valencia' } },
            { name: { equals: 'Glass Morin' } },
            { name: { equals: 'Hanson Preston' } },
          ],
        },
      ],
    };
    expect(transformQuery(queryTwo)).toEqual(expectedTwo);
  });
});
