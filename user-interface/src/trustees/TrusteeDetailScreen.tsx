import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { JSX, useEffect, useState } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
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
import TrusteeAssignedStaff from './panels/TrusteeAssignedStaff';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareList } from '@common/cams/lists';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';
import TrusteeInternalContactForm from './forms/TrusteeInternalContactForm';

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

const transformSoftwareList = (items: BankruptcySoftwareList): ComboOption[] => {
  return items.map((item: { key: string; value: string }) => ({
    value: item.key,
    label: item.value,
  }));
};

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const location = useLocation();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [navState, setNavState] = useState<number>(mapTrusteeDetailNavState(location.pathname));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [softwareOptions, setSoftwareOptions] = useState<ComboOption[]>([]);

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

    fetchSoftwareOptions();
  }, [api]);

  useEffect(() => {
    const fetchTrusteeDetails = () => {
      if (trusteeId) {
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
      setNavState(mapTrusteeDetailNavState(location.pathname));
    };

    fetchTrusteeDetails();
  }, [location.pathname, trusteeId, api, globalAlert]);

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
            <TrusteeAssignedStaff trusteeId={trusteeId} />
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
              <TrusteeHeader trustee={trustee} isLoading={isLoading} subHeading={subHeading}>
                {content}
              </TrusteeHeader>
            }
          />
        ))}
      </Routes>
    </MainContent>
  );
}
