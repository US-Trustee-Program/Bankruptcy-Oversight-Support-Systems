import { CaseSummary } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { formatDate } from '../../../utils/datetime';
import { CaseNumber } from '../../CaseNumber';
import { GenericTable, GenericTableProps } from './GenericTable';

describe('GenericTable component', () => {
  test('should render a table', () => {
    const args: GenericTableProps<CaseSummary> = {
      columns: [
        { content: 'Case ID', mobileTitle: 'Case ID', name: 'caseId', property: 'caseId' },
        {
          content: 'Case Name',
          mobileTitle: 'Case Name',
          name: 'caseTitle',
          property: 'caseTitle',
        },
        {
          content: 'Date Filed',
          mobileTitle: 'Date Filed',
          name: 'dateFiled',
          property: 'dateFiled',
        },
      ],
      data: MockData.buildArray(MockData.getCaseSummary, 3),
    };

    render(<GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>);
  });

  test('should render a table with transformers', () => {
    const args: GenericTableProps<CaseSummary> = {
      columns: [
        {
          content: 'Case ID',
          mobileTitle: 'Case ID',
          name: 'caseId',
          property: 'caseId',
          transformer: (caseId) => {
            return <CaseNumber caseId={caseId as string} />;
          },
        },
        {
          content: 'Case Name',
          mobileTitle: 'Case Name',
          name: 'caseTitle',
          property: 'caseTitle',
          transformer: (caseTitle) => {
            return <span>{caseTitle as string}</span>;
          },
        },
        {
          content: 'Date Filed',
          mobileTitle: 'Date Filed',
          name: 'dateFiled',
          property: 'dateFiled',
          transformer: (dateFiled) => {
            return formatDate(dateFiled as string);
          },
        },
      ],
      data: MockData.buildArray(MockData.getCaseSummary, 3),
    };
    render(
      <BrowserRouter>
        <GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>
      </BrowserRouter>,
    );
  });

  test('should render a table with a transformers that uses the domain object', () => {
    const args: GenericTableProps<CaseSummary> = {
      columns: [
        {
          content: 'Case Info',
          mobileTitle: 'Case Info',
          name: 'caseInfo',
          property: '@',
          transformer: (arg) => {
            const bCase = arg as CaseSummary;
            return (
              <>
                <span>{bCase.caseTitle}</span> <span>({bCase.courtDivisionName})</span>
              </>
            );
          },
        },
      ],
      data: MockData.buildArray(MockData.getCaseSummary, 3),
    };
    render(
      <BrowserRouter>
        <GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>
      </BrowserRouter>,
    );
  });
});
