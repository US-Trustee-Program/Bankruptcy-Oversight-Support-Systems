import {
  Children,
  PropsWithChildren,
  FunctionComponent,
  ReactElement,
  cloneElement,
  useState,
  useEffect,
} from 'react';
import './Accordion.scss';

interface AccordionGroupProps extends PropsWithChildren {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children?: ReactElement<any> | Array<ReactElement<any>>;
  /** Id of the child Accordion to expand on first render. Has no effect after mount. */
  initialExpandedId?: string;
}

export const AccordionGroup: FunctionComponent<AccordionGroupProps> = (props) => {
  const [expandedAccordion, setExpandedAccordion] = useState<string>(props.initialExpandedId ?? '');

  function expandAccordion(accordionId: string) {
    setExpandedAccordion(accordionId);
  }

  const renderChildren = () => {
    if (!props.children) return;
    return Children.map(props.children, (child) => {
      const childOnExpand = child.props.onExpand;
      return cloneElement(child, {
        key: `${child.key}-copy`,
        onExpand: (id: string) => {
          expandAccordion(id);
          if (childOnExpand) childOnExpand(id);
        },
        expandedId: expandedAccordion,
      });
    });
  };

  return (
    <div className="usa-accordion" data-testid="accordion-group">
      {renderChildren()}
    </div>
  );
};

interface AccordionProps extends PropsWithChildren {
  id: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children: Array<ReactElement<any> | string>;
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  hidden?: boolean;
  ariaDescription?: string;
}

export const Accordion: FunctionComponent<AccordionProps> = (props) => {
  const { hidden } = props;
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    setExpanded(props.expandedId === props.id);
  }, [props.expandedId]);

  function toggle() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded) {
      props.onExpand?.(props.id);
    } else {
      props.onCollapse?.(props.id);
    }
  }

  return (
    <>
      <h4
        className={`usa-accordion__heading ${expanded ? 'usa-accordion--expanded' : ''}`}
        data-testid={`accordion-${props.id}`}
        hidden={hidden}
      >
        <button
          type="button"
          className="usa-accordion__button"
          aria-expanded={expanded}
          aria-controls={`accordion-${props.id}`}
          data-testid={`accordion-button-${props.id}`}
          onClick={toggle}
        >
          {props.children[0]}
        </button>
      </h4>
      <div
        id={`accordion-${props.id}`}
        className="usa-accordion__content usa-prose no-overflow"
        data-testid={`accordion-content-${props.id}`}
        hidden={!!hidden || !expanded}
      >
        {props.children[1]}
      </div>
    </>
  );
};
