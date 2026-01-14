import { MockAzureSearchGateway } from './mock-azure-search.gateway';
import { DebtorSearchDocument } from '../../adapters/types/search';

describe('MockAzureSearchGateway', () => {
  let gateway: MockAzureSearchGateway;

  const mockDocuments: DebtorSearchDocument[] = [
    {
      id: '1',
      name: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
      ssn: '123456789',
      taxId: '987654321',
      address: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
    },
    {
      id: '2',
      name: 'Alice Johnson',
      firstName: 'Alice',
      lastName: 'Johnson',
      ssn: '234567890',
      taxId: '876543210',
      address: '456 Park Ave',
      city: 'New York',
      state: 'NY',
    },
    {
      id: '3',
      name: 'Robert Anderson',
      firstName: 'Robert',
      lastName: 'Anderson',
      ssn: '345678901',
      taxId: '765432109',
      address: '789 Oak St',
      city: 'Boston',
      state: 'MA',
    },
  ];

  beforeEach(() => {
    gateway = new MockAzureSearchGateway();
  });

  afterEach(() => {
    gateway.reset();
  });

  describe('createIndex', () => {
    it('should create an index successfully', async () => {
      await expect(gateway.createIndex()).resolves.not.toThrow();
      const count = await gateway.getDocumentCount();
      expect(count).toBe(0);
    });
  });

  describe('deleteIndex', () => {
    it('should delete an index and clear documents', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
      expect(await gateway.getDocumentCount()).toBe(3);

      await gateway.deleteIndex();
      expect(await gateway.getDocumentCount()).toBe(0);
    });
  });

  describe('uploadDocuments', () => {
    it('should upload documents to the index', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);

      const count = await gateway.getDocumentCount();
      expect(count).toBe(3);
    });

    it('should throw error if index is not created', async () => {
      await expect(gateway.uploadDocuments(mockDocuments)).rejects.toThrow(
        'Index must be created before uploading documents',
      );
    });

    it('should replace existing documents on upload', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
      expect(await gateway.getDocumentCount()).toBe(3);

      const newDocuments = [mockDocuments[0]];
      await gateway.uploadDocuments(newDocuments);
      expect(await gateway.getDocumentCount()).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
    });

    describe('exact matching', () => {
      it('should find documents by exact last name match', async () => {
        const result = await gateway.search('Smith');
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('John Smith');
      });

      it('should find documents by exact first name match', async () => {
        const result = await gateway.search('Alice');
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('Alice Johnson');
      });

      it('should find documents by partial name match', async () => {
        const result = await gateway.search('John');
        expect(result.count).toBe(2);
        const names = result.results.map((r) => r.name);
        expect(names).toContain('John Smith');
        expect(names).toContain('Alice Johnson');
      });

      it('should return empty results for non-matching search', async () => {
        const result = await gateway.search('NoMatch');
        expect(result.count).toBe(0);
        expect(result.results).toHaveLength(0);
      });

      it('should perform case-insensitive search', async () => {
        const result = await gateway.search('smith');
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('John Smith');
      });
    });

    describe('fuzzy matching', () => {
      it('should find documents with 1 character typo', async () => {
        const result = await gateway.search('Smth', { fuzzy: true });
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('John Smith');
      });

      it('should find documents with missing character', async () => {
        const result = await gateway.search('Johson', { fuzzy: true });
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('Alice Johnson');
      });

      it('should find documents with extra character', async () => {
        const result = await gateway.search('Johhnson', { fuzzy: true });
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('Alice Johnson');
      });

      it('should find documents with substituted character', async () => {
        const result = await gateway.search('Andersen', { fuzzy: true });
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('Robert Anderson');
      });

      it('should find documents with character substitution in middle', async () => {
        // "Smmth" has edit distance 1 from "Smith" (i->m substitution)
        const result = await gateway.search('Smmth', { fuzzy: true });
        expect(result.count).toBe(1);
        expect(result.results[0].name).toBe('John Smith');
      });

      it('should not match with more than 1 edit distance', async () => {
        // Test with actual edit distance > 1

        // "Smythe" has 2 edits from "Smith" (i->y substitution and extra 'e')
        const result = await gateway.search('Smythe', { fuzzy: true });
        expect(result.count).toBe(0);

        // "Jnsen" has 3 edits from "Johnson"
        const result2 = await gateway.search('Jnsen', { fuzzy: true });
        expect(result2.count).toBe(0);

        // "Andrsn" has 2 edits from "Anderson" (missing 'e' and 'o')
        const result3 = await gateway.search('Andrsn', { fuzzy: true });
        expect(result3.count).toBe(0);
      });
    });

    describe('pagination', () => {
      it('should respect top parameter', async () => {
        const result = await gateway.search('', { top: 2 });
        expect(result.results).toHaveLength(2);
        expect(result.count).toBe(3); // Total count should still be 3
      });

      it('should respect skip parameter', async () => {
        const result = await gateway.search('', { skip: 1 });
        expect(result.results).toHaveLength(2);
        expect(result.count).toBe(3);
      });

      it('should handle skip and top together', async () => {
        const result = await gateway.search('', { skip: 1, top: 1 });
        expect(result.results).toHaveLength(1);
        expect(result.count).toBe(3);
      });
    });

    describe('field selection', () => {
      it('should select only specified fields', async () => {
        const result = await gateway.search('Smith', {
          select: ['id', 'name'],
        });

        expect(result.results).toHaveLength(1);
        const doc = result.results[0] as any;
        expect(doc.id).toBe('1');
        expect(doc.name).toBe('John Smith');
        expect(doc.firstName).toBeUndefined();
        expect(doc.lastName).toBeUndefined();
        expect(doc.ssn).toBeUndefined();
      });

      it('should ignore non-existent fields in select', async () => {
        const result = await gateway.search('Smith', {
          select: ['id', 'nonExistentField'],
        });

        expect(result.results).toHaveLength(1);
        const doc = result.results[0] as any;
        expect(doc.id).toBe('1');
        expect(doc.nonExistentField).toBeUndefined();
      });
    });
  });

  describe('getDocumentCount', () => {
    it('should return 0 for empty index', async () => {
      await gateway.createIndex();
      const count = await gateway.getDocumentCount();
      expect(count).toBe(0);
    });

    it('should return correct document count', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
      const count = await gateway.getDocumentCount();
      expect(count).toBe(3);
    });
  });

  describe('helper methods', () => {
    it('should reset the gateway state', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
      expect(await gateway.getDocumentCount()).toBe(3);

      gateway.reset();
      expect(await gateway.getDocumentCount()).toBe(0);
    });

    it('should get all documents', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);

      const allDocs = gateway.getAllDocuments();
      expect(allDocs).toHaveLength(3);
      expect(allDocs).toEqual(mockDocuments);
    });

    it('should return a copy of documents to prevent external modification', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);

      const allDocs = gateway.getAllDocuments();
      allDocs[0].name = 'Modified Name';

      const originalDocs = gateway.getAllDocuments();
      expect(originalDocs[0].name).toBe('John Smith');
    });
  });

  describe('release', () => {
    it('should release resources without error', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);
      await expect(gateway.release()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty search string', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);

      const result = await gateway.search('');
      expect(result.count).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should return empty results if index not created', async () => {
      const result = await gateway.search('Smith');
      expect(result.count).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should handle special characters in search', async () => {
      await gateway.createIndex();
      await gateway.uploadDocuments(mockDocuments);

      const result = await gateway.search('John-Smith');
      expect(result.count).toBe(0); // Hyphen not in original data
    });
  });
});
