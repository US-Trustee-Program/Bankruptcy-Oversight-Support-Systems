import React from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { uspsStatesFull } from '@common/cams/usps-states';

const usStateOptions: ComboOption[] = uspsStatesFull.map((state) => {
  return {
    label: `${state.code} - ${state.name}`,
    value: state.code,
  };
});

function _UspsStatesComboBox(props: Omit<ComboBoxProps, 'options'>, ref?: React.Ref<ComboBoxRef>) {
  return (
    <ComboBox
      {...props}
      ref={ref}
      options={usStateOptions}
      singularLabel="state"
      pluralLabel="states"
    />
  );
}

const UspsStatesComboBox = _UspsStatesComboBox;
export default UspsStatesComboBox;
