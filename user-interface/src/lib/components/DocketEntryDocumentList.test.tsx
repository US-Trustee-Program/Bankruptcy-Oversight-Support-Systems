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
    test.each([
      ['byte size if less than a KB', 1000, '1000 bytes'],
      ['KB file size if less than a MB', 2000, '2.0 KB'],
      ['MB file size if less than a GB', 1100000, '1.0 MB'],
      ['GB file size if greather than or equal to a GB', 1100000000, '1.0 GB'],
    ])('should show %s', (_desc, fileSize, expectedDescription) => {
      const actualDescription = fileSizeDescription(fileSize);
      expect(actualDescription).toEqual(expectedDescription);
    });
  });
});
