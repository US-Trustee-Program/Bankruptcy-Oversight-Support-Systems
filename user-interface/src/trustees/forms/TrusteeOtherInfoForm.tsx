import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useState } from 'react';

type TrusteeOtherInfoFormProps = {
  trusteeId: string;
  banks?: string[];
};

function TrusteeOtherInfoForm(props: Readonly<TrusteeOtherInfoFormProps>) {
  const { trusteeId } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState<string[]>(props.banks || ['']);

  const navigate = useCamsNavigator();

  const handleBankChange = (index: number, value: string) => {
    const newBanks = [...banks];
    if (index < newBanks.length) {
      newBanks[index] = value;
      setBanks(newBanks);
    }
  };

  const handleBankRemove = (index: number) => {
    return (_: React.MouseEvent<HTMLButtonElement>) => {
      setBanks((current) => {
        const updated = [...current];
        current.splice(index, 1);
        return updated;
      });
    };
  };

  const handleBankAdd = () => {
    setBanks((current) => {
      return [...current, ''];
    });
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setIsSubmitting(true);
    throw new Error('Function not implemented.');
  }

  function handleCancel(_event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    navigate.navigateTo(trusteeId);
  }

  return (
    <div className="trustee-other-info-form-screen">
      <div className="form-header">
        <h1 className="text-no-wrap display-inline-block margin-right-1">Edit Other Information</h1>
      </div>
      <form data-testid="trustee-other-info-form" onSubmit={handleSubmit}>
        <div className="form-container">
          <div className="form-column">
            {banks.length === 1 && banks[0] === '' ? (
              <div className="field-group">
                <Input
                  id={`trustee-banks-0`}
                  className="trustee-bank-input"
                  name="bank-0"
                  value={''}
                  label="Bank"
                  onChange={(e) => handleBankChange(0, e.target.value)}
                  autoComplete="off"
                />
              </div>
            ) : (
              banks.map((bank, index) => {
                return (
                  <div className="field-group" key={`bank-${bank.toLowerCase().replace(' ', '')}`}>
                    <Input
                      id={`trustee-banks-${index}`}
                      className="trustee-bank-input"
                      name={`bank-${index}`}
                      value={bank}
                      label="Bank"
                      onChange={(e) => handleBankChange(index, e.target.value)}
                      autoComplete="off"
                    />
                    <Button onClick={handleBankRemove(index)}>Remove Bank</Button>
                  </div>
                );
              })
            )}
            <Button onClick={handleBankAdd} uswdsStyle={UswdsButtonStyle.Unstyled}>
              <Icon name="add_circle" />
              Add another bank
            </Button>
          </div>
        </div>
        <div className="usa-button-group">
          <Button id="submit-button" type="submit">
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            className="unstyled-button"
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
