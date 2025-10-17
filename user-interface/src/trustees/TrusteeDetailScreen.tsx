import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { JSX, useEffect, useState } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import TrusteeDetailHeader from './TrusteeDetailHeader';
import TrusteeDetailProfile from './panels/TrusteeDetailProfile';
import TrusteeDetailAuditHistory from './panels/TrusteeDetailAuditHistory';
import TrusteeDetailNavigation, { mapTrusteeDetailNavState } from './TrusteeDetailNavigation';
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

export default function TrusteeDetailScreen({
  trustee: propTrustee,
}: { trustee?: Trustee | null } = {}) {
  const { trusteeId } = useParams();
  const [trustee, setTrustee] = useState<Trustee | null>(propTrustee ?? null);
  const [navState, setNavState] = useState<number>(
    mapTrusteeDetailNavState(window.location.pathname),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [softwareOptions, setSoftwareOptions] = useState<ComboOption[]>([]);
  const [courtDivisionDetails, setCourtDivisionDetails] = useState<CourtDivisionDetails[]>([]);
  const districtLabels =
    trustee && courtDivisionDetails ? getDistrictLabels(trustee, courtDivisionDetails) : [];

  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const api = useApi2();

  function openEditPublicProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/public`);
  }

  function openEditInternalProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/internal`);
  }

  function openEditOtherInformation() {
    navigate(`/trustees/${trusteeId}/other/edit`);
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
    if (trusteeId && !propTrustee) {
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
  }, [trusteeId, propTrustee]);

  useEffect(() => {
    setNavState(mapTrusteeDetailNavState(window.location.pathname));
  }, []);

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
      content: (
        <TrusteeContactForm
          trusteeId={trusteeId}
          contactInformation="public"
          action="edit"
          cancelTo={window.location.pathname}
        />
      ),
    },
    {
      path: 'contact/edit/internal',
      subHeading: 'Edit Trustee Profile (USTP Internal)',
      content: (
        <TrusteeContactForm
          trusteeId={trusteeId}
          contactInformation="internal"
          action="edit"
          cancelTo={window.location.pathname}
        />
      ),
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
