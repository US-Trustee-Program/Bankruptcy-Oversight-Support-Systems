import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRowSortButton,
} from '@/lib/components/uswds/Table';
import { CaseNumber } from '../lib/components/CaseNumber';
import { formatDate } from '../lib/utils/datetime';
import { ToggleModalButton } from '../lib/components/uswds/modal/ToggleModalButton';
import { AssignAttorneyModalRef } from './AssignAttorneyModal';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { GenericTable, GenericTableProps } from '@/lib/components/cams/GenericTable/GenericTable';
import { CaseWithAssignments } from './CaseAssignmentScreen.types';
import { AssignAttorneyCasesRow } from './AssignAttorneyCasesRow';
import './AssignAttorneyCasesTable.scss';

type AssignedCasesTableProps = {
  caseList: CaseWithAssignments[];
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export function AssignedCasesTableX(props: AssignedCasesTableProps) {
  const { caseList, modalId, modalRef } = props;

  const assignedAttorneysTransformer = (theCase: CaseWithAssignments, idx?: number) => {
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

  const tableProps: GenericTableProps<CaseWithAssignments> = {
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
  return <GenericTable<CaseWithAssignments> {...tableProps} />;
}

export function AssignAttorneyCasesTable(props: AssignedCasesTableProps) {
  const { caseList, modalId, modalRef } = props;
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
        {(caseList as Array<CaseWithAssignments>).map((bCase: CaseWithAssignments, idx: number) => {
          return (
            <AssignAttorneyCasesRow
              bCase={bCase}
              idx={idx}
              modalId={modalId}
              modalRef={modalRef}
              key={idx}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
