import { ValidationProps } from '@/lib/components/uswds/Validation';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { SimpleResponseData } from '@/lib/type-declarations/api';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MockInstance } from 'vitest';

type ConsolidationArray = (ConsolidationTo | ConsolidationFrom)[];

export function checkValidation(
  validationSpy: MockInstance<[props: ValidationProps], JSX.Element | undefined>,
  cType: boolean,
  twoCases: boolean,
  lead: boolean,
) {
  const validation: ValidationProps = validationSpy.mock.calls[0][0];
  expect(validation.steps![0].valid).toEqual(cType);
  expect(validation.steps![1].valid).toEqual(twoCases);
  expect(validation.steps![2].valid).toEqual(lead);
}

export function clickCaseCheckbox(oid: string, idx: number) {
  const checkbox: HTMLInputElement = screen.getByTestId(
    `checkbox-case-selection-case-list-${oid}-${idx}`,
  );
  fireEvent.click(checkbox);
  return checkbox;
}

export function clickMarkLeadButton(index: number, orderId: string) {
  const markAsLeadButton = screen.getByTestId(`button-assign-lead-case-list-${orderId}-${index}`);
  if (markAsLeadButton.classList.contains('usa-button--outline')) {
    fireEvent.click(markAsLeadButton);
    expect(markAsLeadButton).not.toHaveClass('usa-button--outline');
  } else {
    fireEvent.click(markAsLeadButton);
    expect(markAsLeadButton).toHaveClass('usa-button--outline');
  }
}

export function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
  if (!caseIdInput) throw Error();

  fireEvent.change(caseIdInput!, { target: { value } });
}

export function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

export function findAccordionContent(id: string, visible: boolean) {
  const content = screen.getByTestId(`accordion-content-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

export function findApproveButton(id: string) {
  return document.querySelector(`#accordion-approve-button-${id}`);
}

export function findCaseNumberInput(id: string) {
  const caseIdInput = document.querySelector(`input#lead-case-input-${id}`);
  expect(caseIdInput).toBeInTheDocument();
  return caseIdInput;
}

export function findRejectButton(id: string) {
  return document.querySelector(`#accordion-reject-button-${id}`);
}

export function findValidCaseNumberTable(id: string) {
  return screen.queryByTestId(`valid-case-number-found-${id}`);
}

export function findValidCaseNumberAlert(id: string) {
  return screen.findByTestId(`alert-container-lead-case-number-alert-${id}`);
}

export function openAccordion(orderId: string) {
  const header: HTMLElement = screen.getByTestId(`accordion-heading-${orderId}`);
  fireEvent.click(header);
}

export function selectTypeAndMarkLead(orderId: string) {
  const consolidationTypeRadio = document.querySelector('input[name="consolidation-type"]');
  const consolidationTypeRadioLabel = document.querySelector('.usa-radio__label');
  fireEvent.click(consolidationTypeRadioLabel!);
  expect(consolidationTypeRadio).toBeChecked();

  clickMarkLeadButton(0, orderId);
}

export function setupApiGetMock(
  options: { bCase?: CaseSummary; associations?: ConsolidationArray } = {},
) {
  // Assigned attorneys and associated cases.
  vi.spyOn(Chapter15MockApi, 'get').mockImplementation((path: string) => {
    if (path.includes('/case-assignments/')) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: [MockData.getAttorneyAssignment()],
      } as SimpleResponseData<CaseAssignment[]>);
    } else if (path.match(/\/cases\/\d\d\d-99-99999\/associated/)) {
      return Promise.reject({ message: '404 Case associations not found for the case ID.' });
    } else if (path.match(/\/cases\/\d\d\d-00-00000\/summary/i)) {
      return Promise.reject({ message: 'Some strange error were not expecting' });
    } else if (path.match(/\/cases\/\d\d\d-11-11111\/summary/i)) {
      return Promise.reject({ message: '404 Case summary not found for the case ID.' });
    } else if (path.match(/\/cases\/[A-Z\d-]+\/summary/i)) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: options.bCase ?? {},
      } as SimpleResponseData<CaseSummary>);
    } else if (path.includes('/associated')) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 0,
        body: options.associations ?? [],
      } as SimpleResponseData<Consolidation[]>);
    }
    return Promise.resolve({
      success: false,
      body: {},
    });
  });
}

export async function toggleEnableCaseListForm(id: string) {
  const caseNumberToggleCheckbox = screen.getByTestId(
    `checkbox-lead-case-form-checkbox-toggle-${id}`,
  );

  const initialValue = (caseNumberToggleCheckbox as HTMLInputElement).checked;

  const caseNumberToggleCheckboxLabel = screen.getByTestId(
    `checkbox-label-lead-case-form-checkbox-toggle-${id}`,
  );
  fireEvent.click(caseNumberToggleCheckboxLabel);

  if (initialValue) {
    await waitFor(() => {
      expect(caseNumberToggleCheckbox).not.toBeChecked();
    });
  } else {
    await waitFor(() => {
      expect(caseNumberToggleCheckbox).toBeChecked();
    });
  }
}
