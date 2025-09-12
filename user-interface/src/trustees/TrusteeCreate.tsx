import TrusteeForm, { SubmissionResult } from '@/trustees/TrusteeForm';
import { useLocation } from 'react-router-dom';
import { TrusteeFormData } from './UseTrusteeFormValidation.types';
import { TrusteeInput } from '@common/cams/trustees';
import { useApi2 } from '@/lib/hooks/UseApi2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';

export default function TrusteeCreate() {
  const api = useApi2();
  const location = useLocation();
  const navigate = useCamsNavigator();

  const submit = async (formData: TrusteeFormData): Promise<SubmissionResult> => {
    const result: SubmissionResult = { success: true };
    try {
      const payload: TrusteeInput = {
        name: formData.name,
        public: {
          address: {
            address1: formData.address1,
            ...(formData.address2 && { address2: formData.address2 }),
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            countryCode: 'US',
          },
          phone: { number: formData.phone, extension: formData.extension },
          email: formData.email,
        },
        ...(formData.districts &&
          formData.districts.length > 0 && { districts: formData.districts }),
        ...(formData.chapters && formData.chapters.length > 0 && { chapters: formData.chapters }),
        status: formData.status,
      };

      const response = await api.postTrustee(payload);
      const createdId = (response as { data?: { id?: string } })?.data?.id;

      navigate.navigateTo(`/trustees/${createdId}`);
    } catch (e) {
      result.success = false;
      result.message = e instanceof Error ? e.message : 'Could not create trustee.';
    }
    return result;
  };

  return (
    <TrusteeForm
      action="create"
      contactInformation="public"
      cancelTo={location.state?.cancelTo ?? '/trustees'}
      onSubmit={submit}
    ></TrusteeForm>
  );
}
