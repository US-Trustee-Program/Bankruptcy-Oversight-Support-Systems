//import { CaseNumber } from '@/lib/components/CaseNumber';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  //TableRowData,
  TableRowSortButton,
} from '@/lib/components/uswds/Table';
import { Chapter15Type } from '../type-declarations/chapter-15';

const inTableTransferMode = '';

type AssignedCasesTableProps = {
  caseList: Chapter15Type[];
};

export function AssignedCasesTable(props: AssignedCasesTableProps) {
  return (
    <Table scrollable={true} caption="Unassigned Cases" uswdsStyle={['striped']}>
      <TableHeader className="case-headings">
        <TableHeaderData scope="col">Case Number</TableHeaderData>
        <TableHeaderData scope="col" data-testid="chapter-table-header">
          Chapter
        </TableHeaderData>
        <TableHeaderData scope="col">Case Title (Debtor)</TableHeaderData>
        <TableHeaderData
          scope="col"
          sortable={true}
          sort-direction={'descending'}
          aria-label="Filing Date, sortable column, currently sorted descending"
        >
          Filing Date
          <TableRowSortButton
            title="Click to sort by Filing Date in ascending order."
            direction="descending"
          />
        </TableHeaderData>
        <TableHeaderData scope="col">Assign Attorney</TableHeaderData>
      </TableHeader>
      <TableBody data-testid="unassigned-table-body">
        {(props.caseList as Array<Chapter15Type>).map((theCase: Chapter15Type, idx: number) => {
          return (
            <TableRow
              className={theCase.caseId === inTableTransferMode ? 'in-table-transfer-mode' : ''}
              key={idx}
            ></TableRow>
          );
        })}

        {/*cases.map((bCase, idx) => {
          return (
            <TableRow key={idx}>
              <TableRowData>
                <CaseNumber caseId={bCase.caseId}></CaseNumber>
              </TableRowData>
              <TableRowData>
                {bCase.courtDivisionName} (
                {offices.find((office) => office.officeCode === bCase.officeCode)?.officeName ?? ''}
                )
              </TableRowData>
              <TableRowData>{bCase.debtor.name}</TableRowData>
              <TableRowData>{bCase.chapter}</TableRowData>
              <TableRowData>{bCase.dateFiled}</TableRowData>
            </TableRow>
          );
        })*/}
      </TableBody>
    </Table>
  );
}
