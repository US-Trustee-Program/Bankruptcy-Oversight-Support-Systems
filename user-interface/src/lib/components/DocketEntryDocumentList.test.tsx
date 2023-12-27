import { render, screen } from '@testing-library/react';
import { CaseDocketEntryDocument } from '../type-declarations/chapter-15';
import DocketEntryDocumentList, {
  fileSizeDescription,
  generateDocketFilenameDisplay,
} from './DocketEntryDocumentList';

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
    test('should render a list', () => {
      const documents = [document, badDocument];
      render(<DocketEntryDocumentList documents={documents} />);
      const root = screen.queryByTestId('document-unordered-list');
      console.log(root);
      expect(root).toBeInTheDocument();
      expect(root?.childNodes.length).toEqual(documents.length);
    });

    test('should render an empty fragment for an empty list', () => {
      render(<DocketEntryDocumentList documents={[]} />);
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
