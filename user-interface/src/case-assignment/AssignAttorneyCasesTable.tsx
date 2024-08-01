import { Table, TableBody, TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { AssignAttorneyModalRef } from './AssignAttorneyModal';
import { AssignAttorneyCasesRow } from './AssignAttorneyCasesRow';
import { CaseBasics } from '@common/cams/cases';
import { ResourceActions } from '@common/cams/actions';
import './AssignAttorneyCasesTable.scss';

type AssignedCasesTableProps = {
  caseList: ResourceActions<CaseBasics>[];
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};
// TODO: We might want to reevaluate the ue of generic tables
// ===== GENERIC TABLE EXPERIMENT =====

// export function AssignedCasesTableX(props: AssignedCasesTableProps) {
//   const { caseList, modalId, modalRef } = props;

//   const assignedAttorneysTransformer = (theCase: CaseBasics, idx?: number) => {
//     let assignments;
//     let actionButton;

//     if (theCase.assignments && theCase.assignments.length > 0) {
//       assignments = theCase.assignments?.map((attorney, key: number) => (
//         <div key={key}>
//           {attorney}
//           <br />
//         </div>
//       ));
//       actionButton = (
//         <ToggleModalButton
//           uswdsStyle={UswdsButtonStyle.Outline}
//           className="case-assignment-modal-toggle"
//           buttonIndex={`${idx}`}
//           toggleAction="open"
//           toggleProps={{
//             bCase: theCase,
//           }}
//           modalId={`${modalId}`}
//           modalRef={modalRef}
//           title="edit assignments"
//         >
//           Edit
//         </ToggleModalButton>
//       );
//     } else {
//       assignments = <>(unassigned)</>;
//       actionButton = (
//         <ToggleModalButton
//           className="case-assignment-modal-toggle"
//           buttonIndex={`${idx}`}
//           toggleAction="open"
//           toggleProps={{
//             bCase: theCase,
//           }}
//           modalId={`${modalId}`}
//           modalRef={modalRef}
//           title="add assignments"
//         >
//           {}
//           Assign
//         </ToggleModalButton>
//       );
//     }

//     return (
//       <div className="table-flex-container">
//         <div className="attorney-list-container">{assignments}</div>
//         <div className="table-column-toolbar">
//           {Actions.contains(theCase, Actions.ManageAssignments) && actionButton}
//         </div>
//       </div>
//     );
//   };

//   const tableProps: GenericTableProps<CaseBasics> = {
//     data: caseList,
//     columns: [
//       {
//         name: 'caseNumber',
//         content: 'Case Number',
//         mobileTitle: 'Case Number',
//         property: 'caseId',
//         transformer: (caseId) => <CaseNumber caseId={caseId as string} openLinkIn="same-window" />,
//       },
//       {
//         name: 'chapter',
//         content: 'Chapter',
//         mobileTitle: 'Chapter',
//         property: 'chapter',
//         transformer: (chapter) => (
//           <>
//             <span className="mobile-title">Chapter:</span>
//             {chapter as string}
//           </>
//         ),
//       },
//       {
//         name: 'caseTitleAndDebtor',
//         content: 'Case Title (Debtor)',
//         mobileTitle: 'Case Title (Debtor)',
//         property: 'caseTitle',
//       },
//       {
//         name: 'filingDate',
//         content: (
//           <>
//             Filing Date
//             <>
//               <TableRowSortButton
//                 title="Click to sort by Filing Date in ascending order."
//                 direction="descending"
//               />
//             </>
//           </>
//         ),
//         mobileTitle: 'Filing Date',
//         property: 'dateFiled',
//         transformer: (dateFiled) => formatDate(dateFiled as string),
//       },
//       {
//         name: 'assignedAttorneys',
//         content: 'Assign Attorney',
//         mobileTitle: 'Assign Attorney',
//         property: 'assignments',
//         transformer: assignedAttorneysTransformer,
//       },
//     ],
//   };
//   return <GenericTable<CaseBasics> {...tableProps} />;
// }

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
        {(caseList as Array<CaseBasics>).map((bCase: CaseBasics, idx: number) => {
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
