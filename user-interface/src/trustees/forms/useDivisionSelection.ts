import { useMemo, useEffect, useRef } from 'react';
import { getDivisionsForDistrict } from '@/lib/utils/court-utils';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

export const ALL_DIVISIONS_VALUE = '__ALL__';

type UseDivisionSelectionParams = {
  courtId: string;
  allCourts: CourtDivisionDetails[];
  divisionCodes: string[];
  enabled: boolean;
  onDivisionCodesChange: (codes: string[]) => void;
};

export function useDivisionSelection(params: UseDivisionSelectionParams) {
  const { courtId, allCourts, divisionCodes, enabled, onDivisionCodesChange } = params;
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const divisionOptions = useMemo<ComboOption[]>(() => {
    if (!courtId || !allCourts.length) return [];

    const divisions = getDivisionsForDistrict(allCourts, courtId);

    return [
      { value: ALL_DIVISIONS_VALUE, label: 'All Divisions' },
      ...divisions.map((div) => ({
        value: div.courtDivisionCode,
        label: div.courtDivisionName,
      })),
    ];
  }, [courtId, allCourts]);

  // Auto-select "All Divisions" when district is selected and divisions are empty
  useEffect(() => {
    if (enabled && divisionOptions.length > 0) {
      if (divisionCodes.length === 0) {
        onDivisionCodesChange([ALL_DIVISIONS_VALUE]);
      }
    }
  }, [divisionOptions, enabled, divisionCodes.length, onDivisionCodesChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const getMultiSelections = (fieldValues: string[]) => {
    if (!fieldValues || fieldValues.length === 0) return undefined;
    const selected = divisionOptions.filter((opt) => fieldValues.includes(opt.value));
    return selected.length > 0 ? selected : undefined;
  };

  const handleDivisionSelection = (selectedOptions: ComboOption[]) => {
    const selectedValues = selectedOptions.map((opt) => opt.value);

    // Edge case: User clicked X to clear "All Divisions" - prevent it
    if (selectedValues.length === 0 && divisionCodes.includes(ALL_DIVISIONS_VALUE)) {
      return;
    }

    // If both "All Divisions" and specific divisions are present
    if (selectedValues.includes(ALL_DIVISIONS_VALUE) && selectedValues.length > 1) {
      const addedValues = selectedValues.filter((v) => !divisionCodes.includes(v));

      if (addedValues.includes(ALL_DIVISIONS_VALUE)) {
        onDivisionCodesChange([ALL_DIVISIONS_VALUE]);
      } else {
        onDivisionCodesChange(selectedValues.filter((v) => v !== ALL_DIVISIONS_VALUE));
      }
      return;
    }

    onDivisionCodesChange(selectedValues);
  };

  const handlePillRemoval = (updatedSelections: ComboOption[]) => {
    const newCodes = updatedSelections.map((opt) => opt.value);
    onDivisionCodesChange(newCodes.length === 0 ? [ALL_DIVISIONS_VALUE] : newCodes);
  };

  const handleDivisionBlur = (e: React.FocusEvent) => {
    const currentTarget = e.currentTarget;

    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = setTimeout(() => {
      if (!currentTarget.contains(document.activeElement)) {
        if (!courtId || !allCourts.length) return;

        const allAvailableDivisions = getDivisionsForDistrict(allCourts, courtId).map(
          (d) => d.courtDivisionCode,
        );

        if (
          !divisionCodes.includes(ALL_DIVISIONS_VALUE) &&
          divisionCodes.length === allAvailableDivisions.length &&
          divisionCodes.length > 0 &&
          allAvailableDivisions.every((code) => divisionCodes.includes(code))
        ) {
          onDivisionCodesChange([ALL_DIVISIONS_VALUE]);
        }
      }
    }, 100);
  };

  return {
    divisionOptions,
    divisionSelections: getMultiSelections(divisionCodes),
    handleDivisionSelection,
    handlePillRemoval,
    handleDivisionBlur,
  };
}
