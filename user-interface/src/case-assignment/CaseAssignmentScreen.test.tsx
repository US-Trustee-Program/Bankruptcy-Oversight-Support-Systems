import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseAssignment } from './CaseAssignmentScreen';
import Chapter15MockApi from '../lib/models/chapter15-mock.api.cases';
import { ResponseData } from '@/lib/type-declarations/api';
import { vi } from 'vitest';
import * as FeatureFlags from '../lib/hooks/UseFeatureFlags';
import AttorneysMockApi from '@/lib/models/attorneys-mock.api.cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { buildResponseBodySuccess, ResponseBodySuccess } from '@common/api/response';
import { CaseBasics } from '@common/cams/cases';

// for UX, it might be good to put a time limit on the api call to return results, and display an appropriate screen message to user.
// for UX, do we want to limit number of results to display on screen (pagination discussion to table for now)

/*
 * Used in tests that are commented out below
const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));
*/

describe('CaseAssignment Component Tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.spyOn(AttorneysMockApi, 'list').mockResolvedValue({
      message: '',
      count: 3,
      body: {
        attorneyList: [
          {
            firstName: 'Martha',
            middleName: '',
            lastName: 'Mock',
            generation: '',
            office: 'Manhattan',
          },
          {
            firstName: 'John',
            middleName: '',
            lastName: 'Doe',
            generation: '',
            office: 'Manhattan',
          },
          {
            firstName: 'Roger',
            middleName: '',
            lastName: 'Wilco',
            generation: '',
            office: 'Manhattan',
          },
          {
            firstName: 'Obi',
            middleName: 'Wan',
            lastName: 'Kenobi',
            generation: '',
            office: 'Manhattan',
          },
        ],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test('Case Assignment should display Region and Office of the AUST who logs in', async () => {
    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const subtitle = screen.getByTestId('case-list-subtitle');
        expect(subtitle.textContent).toBe('Region 2 (Manhattan Office)');
      },
      { timeout: 3000 },
    );
  });

  test('/cases should trigger alert when error status is received from Cases api', async () => {
    const expectAlertMessage = 'Mocked error cases request';

    vi.spyOn(Chapter15MockApi, 'get').mockImplementation((_path: string): Promise<ResponseData> => {
      return Promise.reject(new Error(expectAlertMessage));
    });

    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    const alert = screen.getByTestId('alert');
    const alertMessage = screen.getByTestId('alert-message');

    await waitFor(
      () => {
        expect(alert).toHaveClass('usa-alert__visible');
      },
      { timeout: 6000 },
    ).then(() => {
      expect(alert).toHaveAttribute('role', 'status');
      expect(alert).toHaveClass('usa-alert--error ');
      expect(alertMessage).toContainHTML(expectAlertMessage);
    });
  });

  test('/cases should contain table displaying assigned cases when all cases are assigned', async () => {
    const caseList = [
      MockData.getCaseBasics({ override: { chapter: '9' } }),
      MockData.getCaseBasics({ override: { chapter: '11' } }),
      MockData.getCaseBasics({ override: { chapter: '12' } }),
      MockData.getCaseBasics({ override: { chapter: '15' } }),
    ];
    vi.spyOn(Chapter15MockApi, 'get').mockImplementation(
      (_path: string): Promise<ResponseBodySuccess<CaseBasics[]>> => {
        return Promise.resolve(buildResponseBodySuccess<CaseBasics[]>(caseList));
      },
    );

    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const tableBody = screen.getAllByTestId('case-list-table-body');
      const data = tableBody[0].querySelectorAll('tr');
      expect(data).toHaveLength(caseList.length);
    });
  });

  describe('Feature flag chapter-twelve-enabled', () => {
    test('should display appropriate text when true', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': true });

      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const screenTitle = screen.getByTestId('case-list-heading');
        expect(screenTitle).toBeInTheDocument();
        expect(screenTitle.innerHTML).toEqual('Bankruptcy Cases');
      });
    });

    test('should display appropriate text when false', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': false });

      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const screenTitle = screen.getByTestId('case-list-heading');
        expect(screenTitle).toBeInTheDocument();
        expect(screenTitle.innerHTML).toEqual('Bankruptcy Cases');
      });
    });

    test('should display correct chapter number', async () => {
      const caseList = MockData.buildArray(MockData.getCaseBasics, 5);
      vi.spyOn(Chapter15MockApi, 'get').mockImplementation(
        (_path: string): Promise<ResponseBodySuccess<CaseBasics[]>> => {
          return Promise.resolve(buildResponseBodySuccess<CaseBasics[]>(caseList));
        },
      );

      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const tableHeaders = screen.getAllByTestId('chapter-table-header');
        for (const e of tableHeaders) {
          expect(e).toBeInTheDocument();
          expect(e.innerHTML).toEqual('Chapter');
        }

        caseList.forEach((bCase) => {
          const element = screen.getByTestId(`${bCase.caseId}-chapter`);
          expect(element).toBeInTheDocument();
          expect(element).toHaveTextContent(bCase.chapter);
        });
      });
    });
  });
});
