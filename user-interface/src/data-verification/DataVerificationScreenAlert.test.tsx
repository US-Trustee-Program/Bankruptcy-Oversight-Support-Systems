import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as transferOrderAccordionModule from './TransferOrderAccordion';
import * as consolidationOrderAccordionModule from './consolidation/ConsolidationOrderAccordion';
import * as trusteeMatchVerificationAccordionModule from './trustee-verification/TrusteeMatchVerificationAccordion';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BrowserRouter } from 'react-router-dom';
import DataVerificationScreen from './DataVerificationScreen';
import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';

describe('Review Orders screen - Alert', () => {
  const user = testingUtilities.setUserWithRoles([CamsRole.DataVerifier]);

  function setupFeatureFlags(overrides: Record<string, boolean> = {}) {
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'transfer-orders-enabled': true,
      'consolidations-enabled': true,
      'trustee-verification-enabled': false,
      ...overrides,
    });
  }

  beforeEach(async () => {
    LocalStorage.setSession(MockData.getCamsSession({ user }));
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  test('should display alert and update order list when an order is updated by the TransferOrderAccordion', async () => {
    setupFeatureFlags();
    sessionStorage.setItem(
      'cams:filter:data-verification:type',
      JSON.stringify([{ value: 'transfer', label: 'Transfer' }]),
    );

    const mockOrder = MockData.getTransferOrder({ override: { status: 'approved' } });
    const otherOrder = MockData.getTransferOrder({ override: { status: 'pending' } });
    const mockAlertMessage = `Transfer of case to ${mockOrder.docketSuggestedCaseNumber} in ${mockOrder.newCase?.courtName} (${mockOrder.newCase?.courtDivisionName}) was approved.`;

    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [mockOrder, otherOrder] });

    vi.spyOn(transferOrderAccordionModule, 'TransferOrderAccordion').mockImplementation(
      (props: transferOrderAccordionModule.TransferOrderAccordionProps) => {
        const { onOrderUpdate } = props;
        React.useEffect(() => {
          onOrderUpdate(
            { message: mockAlertMessage, type: UswdsAlertStyle.Success, timeOut: 8 },
            mockOrder,
          );
        }, [onOrderUpdate]);
        return <></>;
      },
    );

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const alertContainer = screen.getByTestId('alert-container-data-verification-alert');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer).toHaveClass('visible');
      expect(screen.getByTestId('alert-data-verification-alert')).toHaveTextContent(
        mockAlertMessage,
      );
    });
  });

  test('should display alert without updating order list when consolidation onOrderUpdate is called with only alert details', async () => {
    setupFeatureFlags();
    sessionStorage.setItem(
      'cams:filter:data-verification:type',
      JSON.stringify([{ value: 'consolidation', label: 'Consolidation' }]),
    );

    const existingOrder = MockData.getConsolidationOrder({
      override: { status: 'pending', leadCase: MockData.getCaseSummary() },
    });
    const mockAlertMessage = 'An error occurred processing the consolidation.';

    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [existingOrder] });

    vi.spyOn(consolidationOrderAccordionModule, 'ConsolidationOrderAccordion').mockImplementation(
      (props: consolidationOrderAccordionModule.ConsolidationOrderAccordionProps) => {
        const { onOrderUpdate } = props;
        React.useEffect(() => {
          onOrderUpdate({
            message: mockAlertMessage,
            type: UswdsAlertStyle.Error,
            timeOut: 8,
          });
        }, [onOrderUpdate]);
        return <></>;
      },
    );

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const alertContainer = screen.getByTestId('alert-container-data-verification-alert');
      expect(alertContainer).toHaveClass('visible');
      expect(screen.getByTestId('alert-data-verification-alert')).toHaveTextContent(
        mockAlertMessage,
      );
    });
  });

  test('should not include transfer option in filter when transfer-orders-enabled flag is off', async () => {
    setupFeatureFlags({ 'transfer-orders-enabled': false });
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    expect(expandBtn).toBeInTheDocument();
  });

  test('should display alert when a consolidation order is updated', async () => {
    setupFeatureFlags();
    sessionStorage.setItem(
      'cams:filter:data-verification:type',
      JSON.stringify([{ value: 'consolidation', label: 'Consolidation' }]),
    );

    const deletedOrder = MockData.getConsolidationOrder({
      override: { status: 'pending', leadCase: MockData.getCaseSummary() },
    });
    const replacementOrder = MockData.getConsolidationOrder({
      override: { status: 'approved', leadCase: MockData.getCaseSummary() },
    });
    const mockAlertMessage = 'Consolidation order approved.';

    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [deletedOrder] });

    vi.spyOn(consolidationOrderAccordionModule, 'ConsolidationOrderAccordion').mockImplementation(
      (props: consolidationOrderAccordionModule.ConsolidationOrderAccordionProps) => {
        const { onOrderUpdate } = props;
        React.useEffect(() => {
          onOrderUpdate(
            { message: mockAlertMessage, type: UswdsAlertStyle.Success, timeOut: 8 },
            [replacementOrder],
            deletedOrder,
          );
        }, [onOrderUpdate]);
        return <></>;
      },
    );

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const alertContainer = screen.getByTestId('alert-container-data-verification-alert');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer).toHaveClass('visible');
      expect(screen.getByTestId('alert-data-verification-alert')).toHaveTextContent(
        mockAlertMessage,
      );
    });
  });

  test('should display success alert and update order status when trustee match is approved', async () => {
    setupFeatureFlags({ 'trustee-verification-enabled': true });
    sessionStorage.setItem(
      'cams:filter:data-verification:type',
      JSON.stringify([{ value: 'trustee-match', label: 'Trustee Mismatch' }]),
    );

    const pendingVerification: TrusteeMatchVerification = {
      id: 'tmv-001',
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      orderType: 'trustee-match',
      caseId: '081-22-11111',
      courtId: '0881',
      status: 'pending',
      mismatchReason: 'HIGH_CONFIDENCE_MATCH',
      dxtrTrustee: { fullName: 'John Doe' },
      matchCandidates: [
        {
          trusteeId: 'trustee-1',
          trusteeName: 'Jane Smith',
          totalScore: 95,
          addressScore: 90,
          districtDivisionScore: 100,
          chapterScore: 95,
        },
      ],
      createdOn: '2026-01-15T10:00:00.000Z',
      updatedOn: '2026-01-15T10:00:00.000Z',
      updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    };
    const approvedVerification: TrusteeMatchVerification = {
      ...pendingVerification,
      status: 'approved',
      resolvedTrusteeId: 'trustee-1',
    };

    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getTrusteeMatchVerifications').mockResolvedValue({
      data: [pendingVerification],
    });

    let renderedOrder: TrusteeMatchVerification | undefined;
    vi.spyOn(
      trusteeMatchVerificationAccordionModule,
      'TrusteeMatchVerificationAccordion',
    ).mockImplementation((props) => {
      renderedOrder = props.order;
      React.useEffect(() => {
        props.onOrderUpdate(
          { message: 'Trustee match confirmed.', type: UswdsAlertStyle.Success, timeOut: 8 },
          approvedVerification,
        );
      }, [props.onOrderUpdate]);
      return <></>;
    });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const alertContainer = screen.getByTestId('alert-container-data-verification-alert');
      expect(alertContainer).toHaveClass('visible');
      expect(screen.getByTestId('alert-data-verification-alert')).toHaveTextContent(
        'Trustee match confirmed.',
      );
      expect(renderedOrder?.status).toBe('approved');
    });
  });
});
