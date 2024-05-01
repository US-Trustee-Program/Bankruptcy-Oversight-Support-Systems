import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
  TableRowSortButton,
} from '@/lib/components/uswds/Table';
import { Chapter15Type } from '../lib/type-declarations/chapter-15';
import { CaseNumber } from '../lib/components/CaseNumber';
import { formatDate } from '../lib/utils/datetime';
import { ToggleModalButton } from '../lib/components/uswds/modal/ToggleModalButton';
import { AssignAttorneyModalRef } from './AssignAttorneyModal';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { GenericTable, GenericTableProps } from '@/lib/components/cams/GenericTable/GenericTable';
import './AssignAttorneyCasesTable.scss';

type AssignedCasesTableProps = {
  caseList: Chapter15Type[];
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
  inTableTransferMode: string;
};

export function AssignedCasesTableX(props: AssignedCasesTableProps) {
  const { caseList, modalId, modalRef } = props;

  const assignedAttorneysTransformer = (theCase: Chapter15Type, idx?: number) => {
    return (
      <>
        {theCase.assignments && theCase.assignments.length > 0 && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              {theCase.assignments?.map((attorney, key: number) => (
                <div key={key}>
                  {attorney}
                  <br />
                </div>
              ))}
            </div>
            <div className="table-column-toolbar">
              <ToggleModalButton
                uswdsStyle={UswdsButtonStyle.Outline}
                className="case-assignment-modal-toggle"
                buttonIndex={`${idx}`}
                toggleAction="open"
                toggleProps={{
                  bCase: theCase,
                }}
                modalId={`${modalId}`}
                modalRef={modalRef}
                title="edit assignments"
              >
                Edit
              </ToggleModalButton>
            </div>
          </div>
        )}
        {!theCase.assignments ||
          (!theCase.assignments.length && (
            <div className="table-flex-container">
              <div className="attorney-list-container">(unassigned)</div>
              <div className="table-column-toolbar">
                <ToggleModalButton
                  className="case-assignment-modal-toggle"
                  buttonIndex={`${idx}`}
                  toggleAction="open"
                  toggleProps={{
                    bCase: theCase,
                  }}
                  modalId={`${modalId}`}
                  modalRef={modalRef}
                  title="add assignments"
                >
                  {}
                  Assign
                </ToggleModalButton>
              </div>
            </div>
          ))}
      </>
    );
  };

  const tableProps: GenericTableProps<Chapter15Type> = {
    data: caseList,
    columns: [
      {
        name: 'caseNumber',
        content: 'Case Number',
        mobileTitle: 'Case Number',
        property: 'caseId',
        transformer: (caseId) => <CaseNumber caseId={caseId as string} openLinkIn="same-window" />,
      },
      {
        name: 'chapter',
        content: 'Chapter',
        mobileTitle: 'Chapter',
        property: 'chapter',
        transformer: (chapter) => (
          <>
            <span className="mobile-title">Chapter:</span>
            {chapter as string}
          </>
        ),
      },
      {
        name: 'caseTitleAndDebtor',
        content: 'Case Title (Debtor)',
        mobileTitle: 'Case Title (Debtor)',
        property: 'caseTitle',
      },
      {
        name: 'filingDate',
        content: (
          <>
            Filing Date
            <>
              <TableRowSortButton
                title="Click to sort by Filing Date in ascending order."
                direction="descending"
              />
            </>
          </>
        ),
        mobileTitle: 'Filing Date',
        property: 'dateFiled',
        transformer: (dateFiled) => formatDate(dateFiled as string),
      },
      {
        name: 'assignedAttorneys',
        content: 'Assign Attorney',
        mobileTitle: 'Assign Attorney',
        property: 'assignments',
        transformer: assignedAttorneysTransformer,
      },
    ],
  };
  return <GenericTable<Chapter15Type> {...tableProps} />;
}

export function AssignAttorneyCasesTable(props: AssignedCasesTableProps) {
  const { caseList, inTableTransferMode, modalId, modalRef } = props;
  return (
    <Table className="case-list" scrollable="true" caption="Case List" uswdsStyle={['striped']}>
      <TableHeader className="case-headings">
        <TableHeaderData scope="col">Case Number</TableHeaderData>
        <TableHeaderData scope="col" data-testid="chapter-table-header">
          Chapter
        </TableHeaderData>
        <TableHeaderData scope="col">Case Title (Debtor)</TableHeaderData>
        <TableHeaderData
          scope="col"
          sortable={true}
          sortDirection={'descending'}
          aria-label="Filing Date, sortable column, currently sorted descending"
        >
          Filing Date
        </TableHeaderData>
        <TableHeaderData scope="col">Assign Attorney</TableHeaderData>
      </TableHeader>
      <TableBody data-testid="case-list-table-body">
        {(caseList as Array<Chapter15Type>).map((theCase: Chapter15Type, idx: number) => {
          return (
            <TableRow
              className={theCase.caseId === inTableTransferMode ? 'in-table-transfer-mode' : ''}
              key={idx}
            >
              <TableRowData className="case-number">
                <span className="mobile-title">Case Number:</span>
                <CaseNumber caseId={theCase.caseId} openLinkIn="same-window" />
              </TableRowData>
              <TableRowData className="chapter" data-testid={`${theCase.caseId}-chapter`}>
                <span className="mobile-title">Chapter:</span>
                {theCase.chapter}
              </TableRowData>
              <TableRowData className="case-title-column">
                <span className="mobile-title">Case Title (Debtor):</span>
                {theCase.caseTitle}
              </TableRowData>
              <TableRowData
                className="filing-date"
                data-sort-value={theCase.dateFiled}
                data-sort-active={true}
              >
                <span className="mobile-title">Filing Date:</span>
                {formatDate(theCase.dateFiled)}
              </TableRowData>
              <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
                <span className="mobile-title">Assigned Attorney:</span>
                {theCase.assignments && theCase.assignments.length > 0 && (
                  <div className="table-flex-container">
                    <div className="attorney-list-container">
                      {theCase.assignments?.map((attorney, key: number) => (
                        <div key={key}>
                          {attorney}
                          <br />
                        </div>
                      ))}
                    </div>
                    <div className="table-column-toolbar">
                      <ToggleModalButton
                        uswdsStyle={UswdsButtonStyle.Outline}
                        className="case-assignment-modal-toggle"
                        buttonIndex={`${idx}`}
                        toggleAction="open"
                        toggleProps={{
                          bCase: theCase,
                        }}
                        modalId={`${modalId}`}
                        modalRef={modalRef}
                        title="edit assignments"
                      >
                        Edit
                      </ToggleModalButton>
                    </div>
                  </div>
                )}
                {(!theCase.assignments || !theCase.assignments.length) && (
                  <div className="table-flex-container">
                    <div className="attorney-list-container">(unassigned)</div>
                    <div className="table-column-toolbar">
                      <ToggleModalButton
                        className="case-assignment-modal-toggle"
                        buttonIndex={`${idx}`}
                        toggleAction="open"
                        toggleProps={{
                          bCase: theCase,
                        }}
                        modalId={`${modalId}`}
                        modalRef={modalRef}
                        title="add assignments"
                      >
                        {}
                        Assign
                      </ToggleModalButton>
                    </div>
                  </div>
                )}
              </TableRowData>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
