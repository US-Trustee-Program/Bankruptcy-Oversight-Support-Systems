import { CaseNumber } from '@/lib/components/CaseNumber';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
} from '@/lib/components/uswds/Table';
import { CaseSummary } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';

type SearchCaseTableProps = {
  cases: CaseSummary[];
};

export function SearchCaseTable(props: SearchCaseTableProps) {
  const { cases } = props;

  // TODO: Unmock this.
  const offices = MockData.getOffices();

  return (
    <Table>
      <TableHeader>
        <TableHeaderData sortable={true} sort-direction={'ascending'}>
          Case Number
        </TableHeaderData>
        <TableHeaderData sortable={true} sort-direction={'ascending'}>
          Court (Division)
        </TableHeaderData>
        <TableHeaderData sortable={true} sort-direction={'ascending'}>
          Debtor(s)
        </TableHeaderData>
        <TableHeaderData sortable={true} sort-direction={'ascending'}>
          Chapter
        </TableHeaderData>
        <TableHeaderData sortable={true} sort-direction={'ascending'}>
          Filed Date
        </TableHeaderData>
      </TableHeader>
      <TableBody>
        {cases.map((bCase, idx) => {
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
        })}
      </TableBody>
    </Table>
  );
}

type SearchScreenProps = object;

export default function SearchScreen(_props: SearchScreenProps) {
  // TODO: Unmock this.
  const cases = MockData.buildArray(MockData.getCaseSummary, 5);

  return (
    <div className="search" data-testid="search">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Search Results</h1>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <SearchCaseTable cases={cases}></SearchCaseTable>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
