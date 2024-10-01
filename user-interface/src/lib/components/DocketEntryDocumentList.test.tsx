import { render, screen } from '@testing-library/react';
import DocketEntryDocumentList, {
  fileSizeDescription,
  generateDocketFilenameDisplay,
} from './DocketEntryDocumentList';
import { CaseDocketEntryDocument } from '@common/cams/cases';

const document: CaseDocketEntryDocument = {
  fileUri: 'http://somehost.gov/pdf/0000-111111-2-2-0.pdf',
  fileSize: 1000,
  fileLabel: '2-0',
  fileExt: 'pdf',
};

const badDocument = {
  ...document,
  fileExt: undefined,
};

describe('DocketEntryDocumentList component', () => {
  describe('HTML', () => {
    function createDocket(documents: CaseDocketEntryDocument[]) {
      return {
        sequenceNumber: 1,
        dateFiled: '2024-10-01',
        summaryText: 'Summary Text',
        fullText: 'Full text description',
        documents,
      };
    }

    test('should render a list', () => {
      const documents = [document, badDocument];
      const docket = createDocket(documents);
      render(<DocketEntryDocumentList docketEntry={docket} />);
      const root = screen.queryByTestId('document-unordered-list');
      expect(root).toBeInTheDocument();
      expect(root?.childNodes.length).toEqual(documents.length);
    });

    test('should render an empty fragment for an empty list', () => {
      const docket = createDocket([]);
      render(<DocketEntryDocumentList docketEntry={docket} />);
      const root = screen.queryByTestId('document-unordered-list');
      expect(root).not.toBeInTheDocument();
    });
  });

  describe('Link formatting', () => {
    test('should properly format a normal document', () => {
      const expectedLinkText = 'View 2-0 [PDF, 1000 bytes]';
      const actualLinkText = generateDocketFilenameDisplay(document);
      expect(actualLinkText).toEqual(expectedLinkText);
    });
    test('should properly format a document missing an extension', () => {
      const expectedLinkText = 'View 2-0 [1000 bytes]';
      const actualLinkText = generateDocketFilenameDisplay(badDocument);
      expect(actualLinkText).toEqual(expectedLinkText);
    });
  });

  describe('File size desciption', () => {
    test('should show byte size if less than a KB', () => {
      const expectedDescription = '1000 bytes';
      const actualDescription = fileSizeDescription(1000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show KB file size if less than a MB', () => {
      const expectedDescription = '2.0 KB';
      const actualDescription = fileSizeDescription(2000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show MB file size if less than a GB', () => {
      const expectedDescription = '1.0 MB';
      const actualDescription = fileSizeDescription(1100000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show GB file size if greather than or equal to a GB', () => {
      const expectedDescription = '1.0 GB';
      const actualDescription = fileSizeDescription(1100000000);
      expect(actualDescription).toEqual(expectedDescription);
    });
  });
});
