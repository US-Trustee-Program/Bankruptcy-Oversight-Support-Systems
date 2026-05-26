import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { JSX, useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useNavigate, useParams, Routes, Route, useLocation } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import TrusteeDetailHeader from './TrusteeDetailHeader';
import TrusteeDetailProfile from './panels/TrusteeDetailProfile';
import TrusteeDetailAuditHistory from './panels/TrusteeDetailAuditHistory';
import TrusteeDetailNavigation, { mapTrusteeDetailNavState } from './TrusteeDetailNavigation';
import TrusteeOtherInfoForm from './forms/TrusteeOtherInfoForm';
import NotFound from '@/lib/components/NotFound';
import { GoHome } from '@/lib/components/GoHome';
import TrusteeAssignedStaff from './panels/TrusteeAssignedStaff';
import TrusteeAppointments from './panels/TrusteeAppointments';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';
import TrusteeInternalContactForm from './forms/TrusteeInternalContactForm';
import TrusteeAssistantForm from './forms/TrusteeAssistantForm';
import TrusteeAppointmentForm from './forms/TrusteeAppointmentForm';
import EditTrusteeAppointment from './forms/EditTrusteeAppointment';
import UpcomingKeyDatesForm from './forms/UpcomingKeyDatesForm';
import PastKeyDatesForm from './forms/PastKeyDatesForm';
import TrusteeMeetingOfCreditorsInfoForm from './forms/TrusteeMeetingOfCreditorsInfoForm';
import TrusteeNotes from '@/trustees/panels/trustee-notes/TrusteeNotes';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
  TRUSTEE_SOFTWARE_BANK_DISPLAY,
  TRUSTEE_ASSIGNED_STAFF_ENABLED,
} from '@/lib/hooks/UseFeatureFlags';

type TrusteeHeaderProps = JSX.IntrinsicElements['div'] & {
  trustee: Trustee | null;
  isLoading: boolean;
  subHeading: string;
};

function TrusteeHeader({ trustee, isLoading, subHeading, children }: TrusteeHeaderProps) {
  return (
    <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
      <TrusteeDetailHeader trustee={trustee} isLoading={isLoading} subHeading={subHeading} />
      <div className="trustee-detail-screen-content-container">{children}</div>
    </div>
  );
}

const transformSoftwareList = (items: BankruptcySoftwareProfile[]): ComboOption[] => {
  return items.map((item) => ({
    value: item.id,
    label: item.name,
  }));
};

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const location = useLocation();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [navState, setNavState] = useState<number>(mapTrusteeDetailNavState(location.pathname));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [softwareOptions, setSoftwareOptions] = useState<ComboOption[]>([]);
  const [softwareProfiles, setSoftwareProfiles] = useState<BankruptcySoftwareProfile[]>([]);
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const featureFlags = useFeatureFlags();
  const showSoftwareBankInfo = !!featureFlags[TRUSTEE_SOFTWARE_BANK_DISPLAY];

  function openEditPublicProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/public`);
  }

  function openEditInternalProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/internal`);
  }

  function openAddAssistant() {
    navigate(`/trustees/${trusteeId}/assistant/create`);
  }

  function openEditAssistant(assistantId: string) {
    navigate(`/trustees/${trusteeId}/assistant/edit/${assistantId}`);
  }

  function openEditOtherInformation() {
    navigate(`/trustees/${trusteeId}/other/edit`);
  }

  function openEditZoomInfo() {
    navigate(`/trustees/${trusteeId}/zoom/edit`);
  }

  useEffect(() => {
    const fetchSoftwareOptions = async () => {
      try {
        const response = await Api2.getSoftwareList();
        if (response?.data) {
          const profiles = response.data as BankruptcySoftwareProfile[];
          setSoftwareProfiles(profiles);
          setSoftwareOptions(transformSoftwareList(profiles));
        }
      } catch (e) {
        console.log('Failed to fetch software options', (e as Error).message);
      }
    };

    fetchSoftwareOptions();
  }, []);

  useEffect(() => {
    if (!trusteeId) return;

    setIsLoading(true);
    setNavState(mapTrusteeDetailNavState(location.pathname));

    Api2.getTrustee(trusteeId)
      .then((trusteeResponse) => {
        setTrustee(trusteeResponse.data);
      })
      .catch(() => {
        globalAlert?.error('Could not get trustee details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [location.pathname, trusteeId, globalAlert]);

  if (!trusteeId || (!isLoading && !trustee)) {
    return (
      <MainContent className="record-detail" data-testid="record-detail">
        <DocumentTitle name="Trustee Detail" />
        <NotFound />
      </MainContent>
    );
  }

  if (!trustee || isLoading) {
    return (
      <MainContent className="record-detail" data-testid="record-detail">
        <DocumentTitle name="Trustee Detail" />
        <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
          <TrusteeDetailHeader trustee={null} isLoading={isLoading} />
        </div>
      </MainContent>
    );
  }

  const routeConfigs = [
    {
      path: '/',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeDetailProfile
              trustee={trustee}
              onEditPublicProfile={openEditPublicProfile}
              onEditInternalProfile={openEditInternalProfile}
              onAddAssistant={openAddAssistant}
              onEditAssistant={openEditAssistant}
              onEditOtherInformation={openEditOtherInformation}
              onEditZoomInfo={openEditZoomInfo}
              showSoftwareBankInfo={showSoftwareBankInfo}
              softwareOptions={softwareOptions}
              softwareProfiles={softwareProfiles}
            />
          </div>
        </div>
      ),
    },
    {
      path: 'contact/edit/public',
      subHeading: 'Edit Trustee Profile (Public)',
      content: (
        <TrusteePublicContactForm
          trusteeId={trusteeId}
          trustee={trustee}
          action="edit"
          cancelTo={`/trustees/${trusteeId}`}
        />
      ),
    },
    {
      path: 'contact/edit/internal',
      subHeading: 'Edit Trustee Profile (USTP Internal)',
      content: (
        <TrusteeInternalContactForm
          trusteeId={trusteeId}
          trustee={trustee}
          cancelTo={`/trustees/${trusteeId}`}
        />
      ),
    },
    {
      path: 'assistant/create',
      subHeading: 'Create Trustee Assistant (USTP Internal)',
      content: <TrusteeAssistantForm trusteeId={trusteeId} />,
    },
    {
      path: 'assistant/edit/:assistantId',
      subHeading: 'Edit Trustee Assistant (USTP Internal)',
      content: <TrusteeAssistantForm trusteeId={trusteeId} trustee={trustee} />,
    },
    {
      path: 'other/edit',
      disabled: !featureFlags[TRUSTEE_SOFTWARE_BANK_DISPLAY],
      subHeading: 'Edit Other Trustee Information',
      content: (
        <TrusteeOtherInfoForm
          banks={trustee.banks}
          softwareId={trustee.softwareId}
          trusteeId={trustee.trusteeId}
          softwareOptions={softwareOptions}
          softwareProfiles={softwareProfiles}
        />
      ),
    },
    {
      path: 'zoom/edit',
      subHeading: 'Edit 341 Meeting Information',
      content: <TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />,
    },
    {
      path: 'appointments',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeAppointments trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'appointments/create',
      subHeading: 'Add Trustee Appointment',
      content: <TrusteeAppointmentForm trusteeId={trusteeId} />,
    },
    {
      path: 'appointments/:appointmentId/edit',
      subHeading: 'Edit Trustee Appointment',
      content: <EditTrusteeAppointment />,
    },
    {
      path: 'appointments/:appointmentId/upcoming-key-dates/edit',
      disabled: !featureFlags[DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES],
      subHeading: (location.state as { subHeading?: string } | null)?.subHeading ?? '',
      content: <UpcomingKeyDatesForm />,
    },
    {
      path: 'appointments/:appointmentId/past-key-dates/edit',
      disabled: !featureFlags[DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES],
      subHeading: (location.state as { subHeading?: string } | null)?.subHeading ?? '',
      content: <PastKeyDatesForm />,
    },
    {
      path: 'assigned-staff',
      disabled: !featureFlags[TRUSTEE_ASSIGNED_STAFF_ENABLED],
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeAssignedStaff trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'audit-history',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeDetailAuditHistory trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'notes',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeNotes trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainContent className="record-detail" data-testid="record-detail">
      <DocumentTitle name="Trustee Detail" />

      <Routes>
        {routeConfigs.map(({ path, subHeading, content, disabled }) => (
          <Route
            key={path}
            path={path}
            element={
              disabled ? (
                <GoHome />
              ) : (
                <TrusteeHeader trustee={trustee} isLoading={isLoading} subHeading={subHeading}>
                  {content}
                </TrusteeHeader>
              )
            }
          />
        ))}
      </Routes>
    </MainContent>
  );
}
