import './SearchScreen.scss';
import { CaseNumber } from '@/lib/components/CaseNumber';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
} from '@/lib/components/uswds/Table';
import { useApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type AlertProps = {
  show: boolean;
  title: string;
  message: string;
};

type SearchScreenProps = object;

export default function SearchScreen(_props: SearchScreenProps) {
  const api = useApi();
  const [caseNumber, setCaseNumber] = useState<string>('');
  const location = useLocation();

  let error: AlertProps = { show: false, title: '', message: '' };

  // TODO: Unmock this.
  const cases = MockData.buildArray(MockData.getCaseSummary, 5);

  function updateCaseNumber() {
    const queryParams = new URLSearchParams(window.location.search);
    const caseNumber = queryParams.get('caseNumber');
    if (caseNumber) {
      setCaseNumber(caseNumber);
    } else {
      error = {
        show: true,
        title: 'Enter search terms',
        message: 'Please provide a case number to perform a search',
      };
    }
  }

  if (caseNumber && caseNumber.length < 6) {
    // display error alert indicating that at least 5 digits are neccessary.
    error = {
      show: true,
      title: 'Enter search terms',
      message: 'Please provide at least 5 digits to search by case number',
    };
  } else {
    if (caseNumber) {
      api
        .get(`/cases/${caseNumber}`)
        .then((_bCase) => {})
        .catch((_reason) => {});
    }
  }

  useEffect(() => {
    updateCaseNumber();
  }, [location.state]);

  return (
    <div className="search-screen" data-testid="search">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h3>Search Results</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {error.show ? (
            <div className="search-alert">
              <Alert
                message={error.message}
                title={error.title}
                type={UswdsAlertStyle.Info}
                show={true}
                slim={true}
                inline={true}
              ></Alert>
            </div>
          ) : (
            <SearchCaseTable cases={cases}></SearchCaseTable>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}

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
