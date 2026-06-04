import './TrusteeOtherInfoForm.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import React, { useState } from 'react';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

type TrusteeOtherInfoFormProps = {
  trusteeId: string;
  banks?: string[];
  softwareId?: string;
  softwareOptions: ComboOption[];
  softwareProfiles: BankruptcySoftwareProfile[];
};

function TrusteeOtherInfoForm(props: Readonly<TrusteeOtherInfoFormProps>) {
  const globalAlert = useGlobalAlert();
  const { trusteeId, softwareOptions, softwareProfiles } = props;
  const initialBanks = props.banks?.filter((b) => b.trim() !== '') ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState<string[]>(
    initialBanks.length > 0 ? initialBanks : props.softwareId ? [''] : [],
  );
  const [softwareId, setSoftwareId] = useState<string>(props.softwareId ?? '');

  const navigate = useCamsNavigator();

  const selectedSoftware = softwareProfiles.find((p) => p.id === softwareId);
  const availableBanks: ComboOption[] =
    selectedSoftware?.associatedBanks
      ?.filter((b) => b.status === 'active')
      .map((b) => ({ value: b.bankId, label: b.bankName })) ?? [];

  const handleBankChange = (index: number, selections: ComboOption[]) => {
    const newBanks = [...banks];
    if (selections.length > 0) {
      newBanks[index] = selections[0].value;
    } else {
      newBanks[index] = '';
    }
    setBanks(newBanks);
  };

  const handleBankAdd = () => {
    setBanks((current) => [...current, '']);
  };

  const handleSoftwareChange = (selections: ComboOption[]) => {
    const selectedValue = selections.length > 0 ? selections[0].value : '';
    if (selectedValue !== softwareId) {
      setBanks(selectedValue ? [''] : []);
    }
    setSoftwareId(selectedValue);
  };

  async function handleSubmit(event?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (event) {
      event.preventDefault();
    }

    if (!trusteeId || trusteeId.trim() === '') {
      globalAlert?.error('Cannot save trustee information: Trustee ID is missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const filteredBanks = banks.filter(
        (bank) => bank.trim() !== '' && availableBanks.some((opt) => opt.value === bank),
      );
      const response = await Api2.patchTrustee(trusteeId, {
        banks: filteredBanks.length > 0 ? filteredBanks : null,
        softwareId: softwareId,
      });
      if (response?.data) {
        navigate.navigateTo(`/trustees/${trusteeId}`);
      }
    } catch (e) {
      globalAlert?.error(`Failed to update trustee information: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel(_event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }

  const bankDisabled = !softwareId;
  const hasBankSelected = banks.some((b) => b.trim() !== '');
  const saveDisabled = isSubmitting || !softwareId || !hasBankSelected;

  return (
    <div className="other-info-trustee-form-screen">
      <form data-testid="trustee-other-info-form">
        <div className="form-container">
          <div className="form-column">
            <div className="field-group">
              <ComboBox
                id="trustee-software"
                className="trustee-software-input"
                name="software"
                label="Bankruptcy Software"
                options={softwareOptions}
                selections={softwareOptions.filter((option) => option.value === softwareId)}
                onUpdateSelection={handleSoftwareChange}
                autoComplete="off"
              />
            </div>
            {bankDisabled && (
              <div className="field-group bank-field">
                <div className="bank-field-input">
                  <ComboBox
                    id="trustee-banks-0"
                    className="trustee-bank-input"
                    name="bank-0"
                    label="Bank"
                    required
                    options={[]}
                    selections={[]}
                    onUpdateSelection={() => {}}
                    autoComplete="off"
                    disabled={true}
                  />
                </div>
              </div>
            )}
            {!bankDisabled &&
              banks.map((bankId, index) => {
                const selectedBankIds = banks.filter((_, i) => i !== index && banks[i] !== '');
                const filteredOptions = availableBanks.filter(
                  (opt) => !selectedBankIds.includes(opt.value),
                );
                return (
                  <div className="field-group bank-field" key={`bank-${index}`}>
                    <div className="bank-field-input">
                      <ComboBox
                        id={`trustee-banks-${index}`}
                        className="trustee-bank-input"
                        name={`bank-${index}`}
                        label="Bank"
                        required={index === 0}
                        options={filteredOptions}
                        selections={availableBanks.filter((opt) => opt.value === bankId)}
                        onUpdateSelection={(selections) => handleBankChange(index, selections)}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                );
              })}
            <Button
              id="add-bank-button"
              className="add-bank-button"
              onClick={handleBankAdd}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              disabled={bankDisabled}
            >
              <Icon name="add_circle" />
              Add another bank
            </Button>
          </div>
        </div>
        <div className="usa-button-group">
          <Button id="submit-button" onClick={handleSubmit} disabled={saveDisabled}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            id="cancel-button"
            className="spaced-button cancel-button"
            type="button"
            onClick={handleCancel}
            uswdsStyle={UswdsButtonStyle.Unstyled}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default TrusteeOtherInfoForm;
