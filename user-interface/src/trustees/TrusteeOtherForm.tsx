import React, { useState } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button from '@/lib/components/uswds/Button';

type TrusteeOtherFormProps = {
  banks: string[];
};

function TrusteeOtherForm(props: Readonly<TrusteeOtherFormProps>) {
  const [banks, setBanks] = useState(props.banks);

  const handleBankChange = (index: number) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setBanks((current) => {
        return current.map((bank, i) => {
          if (i === index) {
            return event.target.value;
          }
          return bank;
        });
      });
    };
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

  return (
    <>
      {banks.length === 0 ? (
        <Input name="bank-0" value={''} onChange={handleBankChange(0)} />
      ) : (
        banks.map((bank, index) => {
          return (
            <div key={`bank-${bank.toLowerCase().replace(' ', '')}`}>
              <label htmlFor={`bank-${index}`}>Bank</label>
              <Input name={`bank-${index}`} value={bank} onChange={handleBankChange(index)} />
              <Button onClick={handleBankRemove(index)}>Remove Bank</Button>
            </div>
          );
        })
      )}
      <Button onClick={handleBankAdd} value="Add Bank" />
    </>
  );
}

export default TrusteeOtherForm;
