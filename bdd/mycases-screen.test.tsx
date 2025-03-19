import { render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { initTestingApi } from './testing-api';
import { CamsUser } from '@common/cams/users';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import { MyCasesScreen } from '@/my-cases/MyCasesScreen';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';

initTestingApi();

describe('My Cases Screen Happy path',() => {
    const user: CamsUser = MockData.getCamsUser({});

    beforeEach(() => {
        vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    })

    test('Should navigate to My Cases screen and display cases assigned to the user', async () => {
        const expectedData = MockData.buildArray(MockData.getSyncedCase, 3);
        //vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        //data: expectedData,
        //});

        render(
            <BrowserRouter>
                <MyCasesScreen></MyCasesScreen>
            </BrowserRouter>,
        );


        expect(true).toBeTruthy();

        await waitFor(() => {
            const loadingIndicator = screen.queryByTestId('loading-indicator');
            expect(loadingIndicator).not.toBeInTheDocument();
        });

        const tableData = document.querySelectorAll('table tbody td');

        let dIndex = 0;
        for (let i = 0; i < 3; i++) {
        expect(tableData![dIndex++]).toHaveTextContent(
            `${getCaseNumber(expectedData[i].caseId)} (${expectedData[i].courtDivisionName})`,
        );
        expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].caseTitle);
        expect(tableData![dIndex++]).toHaveTextContent(expectedData[i].chapter);
        expect(tableData![dIndex++]).toHaveTextContent(formatDate(expectedData[i].dateFiled));
        }
    });
});
