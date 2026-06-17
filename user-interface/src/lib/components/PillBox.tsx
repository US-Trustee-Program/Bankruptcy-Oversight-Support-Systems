import { useEffect, useRef, useState } from 'react';
import { ComboOption } from './combobox/ComboBox';
import Pill from './Pill';

export type PillBoxSelection = ComboOption & { removable?: boolean };

type PillBoxProps = {
  id: string;
  disabled?: boolean;
  ariaLabelPrefix?: string;
  className?: string;
  selections: PillBoxSelection[];
  wrapPills?: boolean;
  onSelectionChange: (selections: PillBoxSelection[]) => void;
};

type PillFocus = {
  shouldFocus: boolean;
  index: number;
};

function PillBox(props: PillBoxProps) {
  const { onSelectionChange, ariaLabelPrefix, disabled, wrapPills } = props;
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [selections, setSelections] = useState<Map<string, PillBoxSelection>>(
    new Map(props.selections.map((value) => [value.value, value])),
  );
  const [pillFocus, setPillFocus] = useState<PillFocus>({ shouldFocus: false, index: 0 });

  function onPillClick(value: string) {
    const removedIndex = Array.from(selections.entries()).findIndex(([key, _]) => key === value);

    const newSelections = new Map(selections);
    if (newSelections.has(value)) {
      newSelections.delete(value);
    }

    if (newSelections.size > 0 && removedIndex > newSelections.size - 1) {
      setPillFocus({ shouldFocus: true, index: removedIndex });
    } else {
      setPillFocus({ shouldFocus: true, index: removedIndex + 1 });
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
    <div aria-live="off" aria-atomic="false">
      <div id={props.id} className={`pill-container ${props.className}`} role="list">
        {[...selections.values()].map((selection, idx) => (
          <span role="listitem" className="pill-span" key={idx}>
            <Pill
              id={`pill-${props.id}-${idx}`}
              label={selection.label}
              ariaLabelPrefix={ariaLabelPrefix}
              value={selection.value}
              onClick={onPillClick}
              disabled={disabled}
              wrapText={wrapPills}
              removable={selection.removable !== false}
              ref={(el: HTMLButtonElement | null) => {
                pillRefs.current[idx] = el;
              }}
            ></Pill>
          </span>
        ))}
      </div>
    </div>
  );
}

export default PillBox;
