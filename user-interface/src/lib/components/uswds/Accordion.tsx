import {
  Children,
  PropsWithChildren,
  FunctionComponent,
  ReactElement,
  cloneElement,
  useState,
  useEffect,
} from 'react';

interface AccordionGroupProps extends PropsWithChildren {
  children: Array<ReactElement>;
}

export const AccordionGroup: FunctionComponent<AccordionGroupProps> = (props) => {
  const [expandedAccordion, setExpandedAccordion] = useState<string>('');

  function expandAccordion(accordionId: string) {
    setExpandedAccordion(accordionId);
  }

  const renderChildren = () => {
    return Children.map(props.children, (child) => {
      return cloneElement(child, {
        onExpand: expandAccordion,
        expandedId: expandedAccordion,
      });
    });
  };

  return <div className="usa-accordion">{renderChildren()}</div>;
};

interface AccordionProps extends PropsWithChildren {
  id: string;
  children: Array<ReactElement | string>;
  expandedId?: string;
  onExpand?: (id: string) => void;
}

export const Accordion: FunctionComponent<AccordionProps> = (props) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    setExpanded(props.expandedId === props.id);
  }, [props.expandedId]);

  function toggle() {
    setExpanded(!expanded);
    if (props.onExpand) {
      props.onExpand(props.id);
    }
  }

  return (
    <>
      <h4 className="usa-accordion__heading">
        <button
          type="button"
          className="usa-accordion__button"
          aria-expanded={expanded}
          aria-controls={`accordion-${props.id}`}
          onClick={toggle}
        >
          {props.children[0]}
        </button>
      </h4>
      <div
        id={`accordion=${props.id}`}
        className="usa-accordion__content usa-prose"
        hidden={!expanded}
      >
        {props.children[1]}
      </div>
    </>
  );
};
