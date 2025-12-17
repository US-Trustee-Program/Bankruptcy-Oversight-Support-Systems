import { CaseDocketEntry, CaseDocketEntryDocument } from '@common/cams/cases';
import Icon from './uswds/Icon';
import { formatDateForVoiceOver } from './uswds/DateRangePicker';

export function fileSizeDescription(fileSize: number): string {
  // https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/term-collections/bits-bytes-terms
  const KB = 1024;
  const MB = 1048576;
  const GB = 1073741824;
  let unit: string = 'bytes';
  let decimalSize: number = fileSize;
  if (fileSize >= GB) {
    decimalSize = fileSize / GB;
    unit = 'GB';
  } else if (fileSize >= MB) {
    decimalSize = fileSize / MB;
    unit = 'MB';
  } else if (fileSize >= KB) {
    decimalSize = fileSize / KB;
    unit = 'KB';
  }
  const sizeString = unit === 'bytes' ? fileSize : (Math.round(decimalSize * 10) / 10).toFixed(1);
  return `${sizeString} ${unit}`;
}

export function generateDocketFilenameDisplay(linkInfo: CaseDocketEntryDocument): string {
  const { fileLabel, fileSize, fileExt } = linkInfo;
  const extension = fileExt ? fileExt?.toUpperCase() + ', ' : '';
  return `View ${fileLabel} [${extension}${fileSizeDescription(fileSize)}]`;
}

interface DocketEntryDocumentListProps {
  docketEntry?: CaseDocketEntry;
}

export default function DocketEntryDocumentList(props: DocketEntryDocumentListProps) {
  const { docketEntry } = props;
  const documents: CaseDocketEntryDocument[] | undefined = docketEntry?.documents;

  if (!documents || documents.length === 0) return <></>;

  return (
    <div className="docket-documents">
      <ul className="usa-list usa-list--unstyled" data-testid="document-unordered-list">
        {documents.map((linkInfo: CaseDocketEntryDocument) => {
          return (
            <li key={linkInfo.fileUri}>
              <a
                href={linkInfo.fileUri}
                target="_blank"
                rel="noreferrer"
                aria-label={`Link for document number ${docketEntry?.documentNumber ?? ''} ${formatDateForVoiceOver(docketEntry?.dateFiled ?? '')} ${docketEntry?.summaryText}`}
              >
                {generateDocketFilenameDisplay(linkInfo)}
                <Icon className="link-icon" name="launch"></Icon>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
