import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { JSX, useEffect, useState } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useLocation, useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import TrusteeDetailHeader from './TrusteeDetailHeader';
import TrusteeDetailProfile from './panels/TrusteeDetailProfile';
import TrusteeDetailAuditHistory from './panels/TrusteeDetailAuditHistory';
import TrusteeDetailNavigation, { mapTrusteeDetailNavState } from './TrusteeDetailNavigation';
import { TrusteeFormState } from '@/trustees/forms/UseTrusteeContactForm';
import TrusteeContactForm from './forms/TrusteeContactForm';
import TrusteeOtherInfoForm from './forms/TrusteeOtherInfoForm';
import NotFound from '@/lib/components/NotFound';
import TrusteeAssignedStaff from './panels/TrusteeAssignedStaff';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareList } from '@common/cams/lists';
import { CourtDivisionDetails } from '@common/cams/courts';

type TrusteeHeaderProps = JSX.IntrinsicElements['div'] & {
  trustee: Trustee | null;
  isLoading: boolean;
  districtLabels: string[];
  subHeading: string;
};

function TrusteeHeader({
  trustee,
  isLoading,
  districtLabels,
  subHeading,
  children,
}: TrusteeHeaderProps) {
  return (
    <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
      <TrusteeDetailHeader
        trustee={trustee}
        isLoading={isLoading}
        districtLabels={districtLabels}
        subHeading={subHeading}
      />
      <div className="trustee-detail-screen-content-container">{children}</div>
    </div>
  );
}

// Transform backend software list to ComboOption format
const transformSoftwareList = (items: BankruptcySoftwareList): ComboOption[] => {
  return items.map((item: { key: string; value: string }) => ({
    value: item.key,
    label: item.value,
  }));
};

const getDistrictLabels = (trustee: Trustee, courtDivisionDetails: CourtDivisionDetails[]) => {
  const trusteeDistricts: string[] = [];
  trustee.districts?.map((district: string) => {
    const court = courtDivisionDetails.find((court) => court.courtDivisionCode === district);
    if (court) {
      trusteeDistricts.push(`${court.courtName} (${court.courtDivisionName})`);
    }
  });
  return trusteeDistricts;
};

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const location = useLocation();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [navState, setNavState] = useState<number>(mapTrusteeDetailNavState(location.pathname));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [softwareOptions, setSoftwareOptions] = useState<ComboOption[]>([]);
  const [courtDivisionDetails, setCourtDivisionDetails] = useState<CourtDivisionDetails[]>([]);
  const districtLabels =
    trustee && courtDivisionDetails ? getDistrictLabels(trustee, courtDivisionDetails) : [];

  const navigate = useNavigate();

  const globalAlert = useGlobalAlert();
  const api = useApi2();

  function openEditPublicProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee!, // Non-null assertion: function only called when trustee exists
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'public',
    };
    navigate(`/trustees/${trusteeId}/contact/edit/public`, { state });
  }

  function openEditInternalProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee!, // Non-null assertion: function only called when trustee exists
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'internal',
    };
    navigate(`/trustees/${trusteeId}/contact/edit/internal`, { state });
  }

  function openEditOtherInformation() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee!, // Non-null assertion: function only called when trustee exists
      cancelTo: location.pathname,
      action: 'edit',
    };
    navigate(`/trustees/${trusteeId}/other/edit`, { state });
  }

  useEffect(() => {
    const fetchSoftwareOptions = async () => {
      try {
        const response = await api.getBankruptcySoftwareList();
        if (response?.data) {
          const transformedOptions = transformSoftwareList(response.data as BankruptcySoftwareList);
          setSoftwareOptions(transformedOptions);
        }
      } catch (e) {
        console.log('Failed to fetch software options', (e as Error).message);
      }
    };

    const fetchCourtDivisions = async () => {
      try {
        const response = await api.getCourts();
        if (response?.data) {
          setCourtDivisionDetails(response.data);
        }
      } catch (e) {
        console.log('Failed to fetch court divisions', (e as Error).message);
      }
    };

    fetchSoftwareOptions();
    fetchCourtDivisions();
  }, [api]);

  useEffect(() => {
    if (trusteeId && !location.state?.trustee) {
      setIsLoading(true);
      api
        .getTrustee(trusteeId)
        .then((trusteeResponse) => {
          setTrustee(trusteeResponse.data);
        })
        .catch(() => {
          globalAlert?.error('Could not get trustee details');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [trusteeId, location.state?.trustee]);

  useEffect(() => {
    setNavState(mapTrusteeDetailNavState(location.pathname));
  }, [location]);

  useEffect(() => {
    if (location.state?.trustee) {
      setTrustee(location.state.trustee as Trustee);
    }
  }, [location.state?.trustee]);

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
          <TrusteeDetailHeader trustee={null} isLoading={isLoading} districtLabels={[]} />
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
              districtLabels={districtLabels}
              onEditPublicProfile={openEditPublicProfile}
              onEditInternalProfile={openEditInternalProfile}
              onEditOtherInformation={openEditOtherInformation}
            />
          </div>
        </div>
      ),
    },
    {
      path: 'contact/edit/public',
      subHeading: 'Edit Trustee Profile (Public)',
      content: <TrusteeContactForm />,
    },
    {
      path: 'contact/edit/internal',
      subHeading: 'Edit Trustee Profile (USTP Internal)',
      content: <TrusteeContactForm />,
    },
    {
      path: 'other/edit',
      subHeading: 'Edit Other Trustee Information',
      content: (
        <TrusteeOtherInfoForm
          banks={trustee.banks}
          software={trustee.software}
          trusteeId={trustee.trusteeId}
          softwareOptions={softwareOptions}
        />
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
      path: 'assigned-staff',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeAssignedStaff trusteeId={trusteeId} trustee={trustee} />
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainContent className="record-detail" data-testid="record-detail">
      <DocumentTitle name="Trustee Detail" />

      <Routes>
        {routeConfigs.map(({ path, subHeading, content }) => (
          <Route
            key={path}
            path={path}
            element={
              <TrusteeHeader
                trustee={trustee}
                isLoading={isLoading}
                districtLabels={districtLabels}
                subHeading={subHeading}
              >
                {content}
              </TrusteeHeader>
            }
          />
        ))}
      </Routes>
    </MainContent>
  );
}
