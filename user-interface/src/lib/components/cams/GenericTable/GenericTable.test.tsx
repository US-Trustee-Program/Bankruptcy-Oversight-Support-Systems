import { render } from '@testing-library/react';
import { GenericTable, GenericTableProps } from './GenericTable';
import { CaseSummary } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDate } from '@/lib/utils/datetime';
import { CaseNumber } from '../../CaseNumber';
import { BrowserRouter } from 'react-router-dom';

describe('GenericTable component', () => {
  test('should render a table', () => {
    const args: GenericTableProps<CaseSummary> = {
      data: MockData.buildArray(MockData.getCaseSummary, 3),
      columns: [
        { name: 'caseId', content: 'Case ID', mobileTitle: 'Case ID', property: 'caseId' },
        {
          name: 'caseTitle',
          content: 'Case Name',
          mobileTitle: 'Case Name',
          property: 'caseTitle',
        },
        {
          name: 'dateFiled',
          content: 'Date Filed',
          mobileTitle: 'Date Filed',
          property: 'dateFiled',
        },
      ],
    };

    render(<GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>);
  });

  test('should render a table with transformers', () => {
    const args: GenericTableProps<CaseSummary> = {
      data: MockData.buildArray(MockData.getCaseSummary, 3),
      columns: [
        {
          name: 'caseId',
          content: 'Case ID',
          mobileTitle: 'Case ID',
          property: 'caseId',
          transformer: (caseId) => {
            return <CaseNumber caseId={caseId as string} />;
          },
        },
        {
          name: 'caseTitle',
          content: 'Case Name',
          mobileTitle: 'Case Name',
          property: 'caseTitle',
          transformer: (caseTitle) => {
            return <span>{caseTitle as string}</span>;
          },
        },
        {
          name: 'dateFiled',
          content: 'Date Filed',
          mobileTitle: 'Date Filed',
          property: 'dateFiled',
          transformer: (dateFiled) => {
            return formatDate(dateFiled as string);
          },
        },
      ],
    };
    render(
      <BrowserRouter>
        <GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>
      </BrowserRouter>,
    );
  });

  test('should render a table with a transformers that uses the domain object', () => {
    const args: GenericTableProps<CaseSummary> = {
      data: MockData.buildArray(MockData.getCaseSummary, 3),
      columns: [
        {
          name: 'caseInfo',
          content: 'Case Info',
          mobileTitle: 'Case Info',
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
    };
    render(
      <BrowserRouter>
        <GenericTable<CaseSummary> id="generic-table" {...args}></GenericTable>
      </BrowserRouter>,
    );
  });
});
