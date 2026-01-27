import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import Api2 from '@/lib/models/api2';
import {
  BASE_ZOOM_INFO,
  BASE_ZOOM_INFO_BEFORE,
  renderWithProps,
  renderHistoryAndWaitForTable,
  expectZoomInfoValues,
  createMockNameHistory,
  createMockPublicContactHistory,
  createMockZoomInfoHistory,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Zoom Info History Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockNameHistory = createMockNameHistory();
  const mockPublicContactHistory = createMockPublicContactHistory();

  test('should display zoom info change history correctly', async () => {
    const mockZoomInfoHistory = createMockZoomInfoHistory();
    await renderHistoryAndWaitForTable([mockZoomInfoHistory]);

    expect(screen.getByTestId('change-type-zoom-info-0')).toHaveTextContent(
      '341 Meeting Zoom Info',
    );

    expectZoomInfoValues('previous-zoom-info-0', BASE_ZOOM_INFO_BEFORE);
    expectZoomInfoValues('new-zoom-info-0', BASE_ZOOM_INFO);

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/23/2024');
  });

  test('should render zoom info as description list with proper semantics', async () => {
    const mockZoomInfoHistory = createMockZoomInfoHistory();
    await renderHistoryAndWaitForTable([mockZoomInfoHistory]);

    const previousZoomInfo = screen.getByTestId('previous-zoom-info-0');
    const newZoomInfo = screen.getByTestId('new-zoom-info-0');

    expect(previousZoomInfo.querySelector('dl')).toBeInTheDocument();
    expect(newZoomInfo.querySelector('dl')).toBeInTheDocument();

    expect(previousZoomInfo.querySelectorAll('dt')).toHaveLength(4);
    expect(previousZoomInfo.querySelectorAll('dd')).toHaveLength(4);
    expect(newZoomInfo.querySelectorAll('dt')).toHaveLength(4);
    expect(newZoomInfo.querySelectorAll('dd')).toHaveLength(4);
  });

  test('should have proper ARIA labels for accessibility', async () => {
    const mockZoomInfoHistory = createMockZoomInfoHistory();
    await renderHistoryAndWaitForTable([mockZoomInfoHistory]);

    const previousCell = screen.getByTestId('previous-zoom-info-0');
    const newCell = screen.getByTestId('new-zoom-info-0');

    expect(previousCell).toHaveAttribute('aria-label', 'Previous 341 meeting zoom information');
    expect(newCell).toHaveAttribute('aria-label', 'New 341 meeting zoom information');
  });

  test('should display mixed history types including zoom info', async () => {
    const mockZoomInfoHistory = createMockZoomInfoHistory();
    const mixedHistory = [mockNameHistory, mockPublicContactHistory, mockZoomInfoHistory];

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mixedHistory });

    renderWithProps({});

    await screen.findByTestId('trustee-history-table');

    expect(screen.getByTestId('change-type-name-2')).toHaveTextContent('Name');
    expect(screen.getByTestId('change-type-public-contact-1')).toHaveTextContent('Public Contact');
    expect(screen.getByTestId('change-type-zoom-info-0')).toHaveTextContent(
      '341 Meeting Zoom Info',
    );

    expectZoomInfoValues('previous-zoom-info-0', BASE_ZOOM_INFO_BEFORE);
  });

  const scenarios = [
    {
      name: 'basic zoom info change',
      history: createMockZoomInfoHistory(),
      expectPrevInfo: BASE_ZOOM_INFO_BEFORE,
      expectNewInfo: BASE_ZOOM_INFO,
      expectChangedBy: 'SYSTEM',
    },
    {
      name: 'no previous zoom info (new zoom info)',
      history: createMockZoomInfoHistory({ before: undefined }),
      expectPrevNone: true,
      expectNewInfo: BASE_ZOOM_INFO,
      expectChangedBy: 'SYSTEM',
    },
    {
      name: 'no new zoom info (deleted zoom info)',
      history: createMockZoomInfoHistory({ after: undefined }),
      expectPrevInfo: BASE_ZOOM_INFO_BEFORE,
      expectNewNone: true,
      expectChangedBy: 'SYSTEM',
    },
    {
      name: 'both zoom info values undefined',
      history: createMockZoomInfoHistory({ before: undefined, after: undefined }),
      expectPrevNone: true,
      expectNewNone: true,
      expectChangedBy: 'SYSTEM',
    },
    {
      name: 'missing updatedBy',
      history: createMockZoomInfoHistory({ updatedBy: { id: '', name: '' } }),
      expectPrevInfo: BASE_ZOOM_INFO_BEFORE,
      expectNewInfo: BASE_ZOOM_INFO,
      expectChangedBy: '',
    },
  ];

  test.each(scenarios)(
    'should display zoom info history with $name',
    async ({
      history,
      expectPrevInfo,
      expectNewInfo,
      expectPrevNone,
      expectNewNone,
      expectChangedBy,
    }) => {
      vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });
      renderWithProps({});
      await screen.findByTestId('trustee-history-table');

      if (expectPrevNone) {
        expect(screen.getByTestId('previous-zoom-info-0')).toHaveTextContent('(none)');
      } else if (expectPrevInfo) {
        expectZoomInfoValues('previous-zoom-info-0', expectPrevInfo);
      }

      if (expectNewNone) {
        expect(screen.getByTestId('new-zoom-info-0')).toHaveTextContent('(none)');
      } else if (expectNewInfo) {
        expectZoomInfoValues('new-zoom-info-0', expectNewInfo);
      }

      expect(screen.getByTestId('changed-by-0')).toHaveTextContent(expectChangedBy);
    },
  );
});
