import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseNumber, CaseNumberProps } from './CaseNumber';

describe('CaseNumber component', () => {
  const testId = 'the-case-number';
  const linkTestId = testId + '-link';
  const caseId = '000-11-22222';
  const expectedTextContent = '11-22222';
  const defaultProps: CaseNumberProps = { caseId, 'data-testid': testId };

  function renderWithProps(props: CaseNumberProps) {
    render(
      <BrowserRouter>
        <CaseNumber {...props} />
      </BrowserRouter>,
    );
  }

  test('should render the case number as a link to the detail screen by default', () => {
    renderWithProps({ ...defaultProps, openLinkIn: 'same-window' });

    const link = screen.getByTestId(linkTestId);
    expect(link).toBeInTheDocument();
    expect(link.attributes.getNamedItem('target')?.value).toEqual('_self');
  });

  test('should open a link in the same window if specified', () => {
    renderWithProps(defaultProps);

    const link = screen.getByTestId(linkTestId);
    expect(link).toBeInTheDocument();
    expect(link.attributes.getNamedItem('href')?.value).toEqual(`/case-detail/${caseId}/`);
    expect(link.attributes.getNamedItem('title')?.value).toEqual(`Open case ${caseId}`);
    expect(link.attributes.getNamedItem('target')?.value).toEqual('_blank');

    const span = screen.getByTestId(testId);
    expect(span).toBeInTheDocument();
    expect(span).toHaveTextContent(expectedTextContent);
  });

  test('should render the case number as a span if specified', () => {
    renderWithProps({ ...defaultProps, renderAs: 'span' });

    const link = screen.queryByTestId(linkTestId);
    expect(link).not.toBeInTheDocument();

    const span = screen.getByTestId(testId);
    expect(span).toBeInTheDocument();
    expect(span).toHaveTextContent(expectedTextContent);
  });

  test('should append a class name to the span if provided', () => {
    const className = 'test';
    renderWithProps({ ...defaultProps, className });

    const span = screen.getByTestId(testId);
    expect(span).toBeInTheDocument();
    expect(span.attributes.getNamedItem('class')?.value).toEqual(className);
  });
});
