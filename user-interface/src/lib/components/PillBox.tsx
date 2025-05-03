import { useEffect, useRef, useState } from 'react';

import { ComboOption } from './combobox/ComboBox';
import { Pill } from './Pill';

type PillBoxProps = {
  ariaLabelPrefix?: string;
  className?: string;
  disabled?: boolean;
  id: string;
  onSelectionChange: (selections: ComboOption[]) => void;
  selections: ComboOption[];
  wrapPills?: boolean;
};

type PillFocus = {
  index: number;
  shouldFocus: boolean;
};

function PillBox(props: PillBoxProps) {
  const { ariaLabelPrefix, disabled, onSelectionChange, wrapPills } = props;
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [selections, setSelections] = useState<Map<string, ComboOption>>(
    new Map(props.selections.map((value) => [value.value, value])),
  );
  const [pillFocus, setPillFocus] = useState<PillFocus>({ index: 0, shouldFocus: false });

  function onPillClick(value: string) {
    const removedIndex = Array.from(selections.entries()).findIndex(([key, _]) => key === value);

    const newSelections = new Map(selections);
    if (newSelections.has(value)) {
      newSelections.delete(value);
    }

    if (newSelections.size > 0 && removedIndex > newSelections.size - 1) {
      setPillFocus({ index: removedIndex, shouldFocus: true });
    } else {
      setPillFocus({ index: removedIndex + 1, shouldFocus: true });
    }

    onSelectionChange([...newSelections.values()]);
    setSelections(newSelections);
  }

  useEffect(() => {
    setSelections(new Map(props.selections.map((value) => [value.value, value])));
  }, [props.selections]);

  useEffect(() => {
    if (pillFocus.shouldFocus) {
      const targetIndex = pillFocus.index - 1;
      const pill = pillRefs.current[targetIndex];

      if (pill) {
        pill.focus();
      }
    }
  }, [pillFocus]);

  return (
    <div className={`pill-container ${props.className}`} id={props.id} role="list">
      {[...selections.values()].map((selection, idx) => (
        <span className="pill-span" key={idx} role="listitem">
          <Pill
            ariaLabelPrefix={ariaLabelPrefix}
            disabled={disabled}
            id={`pill-${props.id}-${idx}`}
            label={selection.label}
            onClick={onPillClick}
            ref={(el: HTMLButtonElement | null) => (pillRefs.current[idx] = el)}
            value={selection.value}
            wrapText={wrapPills}
          ></Pill>
        </span>
      ))}
    </div>
  );
}

export default PillBox;
