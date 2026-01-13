import { useState, ChangeEvent, useRef } from 'react';
import './App.css';

// Import all USWDS components with default exports
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Banner } from '@/lib/components/uswds/Banner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ButtonGroup from '@/lib/components/uswds/ButtonGroup';
import { Card, CardHeading, CardBody, CardFooter } from '@/lib/components/uswds/Card';
import Checkbox from '@/lib/components/uswds/Checkbox';
import DatePicker from '@/lib/components/uswds/DatePicker';
import DateRangePicker from '@/lib/components/uswds/DateRangePicker';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import { PrivacyActFooter } from '@/lib/components/uswds/PrivacyActFooter';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Table from '@/lib/components/uswds/Table';
import Tag from '@/lib/components/uswds/Tag';
import TextArea from '@/lib/components/uswds/TextArea';
import Modal from '@/lib/components/uswds/modal/Modal';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

function App() {
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [inputValue, setInputValue] = useState('');
  const [textAreaValue, setTextAreaValue] = useState('');
  const [dateValue, setDateValue] = useState('2025-12-01');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeButtonId, setActiveButtonId] = useState('btn-1');

  const modalRef = useRef<ModalRefType>(null);
  const alertRef = useRef<any>(null);

  const handleLearnMoreClick = () => {
    alertRef.current?.show();
  };

  return (
    <div className="uswds-showcase">
      <Alert
        ref={alertRef}
        type={UswdsAlertStyle.Info}
        title="Card Button Clicked!"
        message="You clicked the Learn More button in the card."
        timeout={5}
        show={false}
        className="floating-alert"
      />
      <header className="usa-header usa-header--basic">
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <div className="usa-logo">
              <h1 className="usa-logo__text">USWDS Component Showcase</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="usa-section">
        <div className="grid-container">
          <section className="showcase-section">
            <h2>Banner</h2>
            <Banner />
          </section>

          <section className="showcase-section">
            <h2>Alert</h2>
            <Alert type={UswdsAlertStyle.Success} title="Success alert" slim show inline>
              This is a success alert with a slim appearance
            </Alert>
            <Alert type={UswdsAlertStyle.Warning} title="Warning alert" show inline>
              This is a warning alert
            </Alert>
            <Alert type={UswdsAlertStyle.Error} title="Error alert" show inline>
              This is an error alert
            </Alert>
            <Alert type={UswdsAlertStyle.Info} title="Info alert" show>
              This is an info alert (non-inline)
            </Alert>
          </section>

          <section className="showcase-section">
            <h2>Buttons</h2>
            <div className="button-examples">
              <Button>Default</Button>
              <Button uswdsStyle={UswdsButtonStyle.Secondary}>Secondary</Button>
              <Button uswdsStyle={UswdsButtonStyle.Cool}>Accent Cool</Button>
              <Button uswdsStyle={UswdsButtonStyle.Base}>Base</Button>
              <Button uswdsStyle={UswdsButtonStyle.Outline}>Outline</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          <section className="showcase-section">
            <h2>Button Group</h2>
            <ButtonGroup
              id="button-group-example"
              activeButtonId={activeButtonId}
              onButtonClick={(id) => setActiveButtonId(id)}
              singleSelect={true}
            >
              <Button id="btn-1">First</Button>
              <Button id="btn-2">Second</Button>
              <Button id="btn-3">Third</Button>
            </ButtonGroup>
          </section>

          <section className="showcase-section">
            <h2>Card</h2>
            <Card>
              <CardHeading>Card Header</CardHeading>
              <CardBody>
                <p>This is the card body content. Cards can contain various types of content.</p>
              </CardBody>
              <CardFooter>
                <Button uswdsStyle={UswdsButtonStyle.Secondary} onClick={handleLearnMoreClick}>
                  Learn More
                </Button>
              </CardFooter>
            </Card>
          </section>

          <section className="showcase-section">
            <h2>Form Controls</h2>

            <div className="form-example">
              <h3>Input</h3>
              <Input
                id="input-example"
                name="input-example"
                label="Full name"
                value={inputValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              />
            </div>

            <div className="form-example">
              <h3>TextArea</h3>
              <TextArea
                id="textarea-example"
                name="textarea-example"
                label="Comments"
                value={textAreaValue}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTextAreaValue(e.target.value)}
              />
            </div>

            <div className="form-example">
              <h3>Checkbox</h3>
              <Checkbox
                id="checkbox-example"
                name="checkbox-example"
                label="Enable notifications"
                value="checkbox-value"
                checked={checkboxValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCheckboxValue(e.target.checked)}
              />
            </div>

            <div className="form-example">
              <h3>Radio Buttons (Individual)</h3>
              <Radio
                id="radio-1"
                name="radio-example"
                label="Small"
                value="option1"
                checked={radioValue === 'option1'}
                onChange={(value: string) => setRadioValue(value)}
              />
              <Radio
                id="radio-2"
                name="radio-example"
                label="Medium"
                value="option2"
                checked={radioValue === 'option2'}
                onChange={(value: string) => setRadioValue(value)}
              />
              <Radio
                id="radio-3"
                name="radio-example"
                label="Large"
                value="option3"
                checked={radioValue === 'option3'}
                onChange={(value: string) => setRadioValue(value)}
              />
            </div>

            <div className="form-example">
              <h3>Radio Group</h3>
              <RadioGroup label="Preferred contact method">
                <Radio
                  id="radio-a"
                  name="radio-group-example"
                  label="Email"
                  value="a"
                  checked={radioValue === 'a'}
                  onChange={(value: string) => setRadioValue(value)}
                />
                <Radio
                  id="radio-b"
                  name="radio-group-example"
                  label="Phone"
                  value="b"
                  checked={radioValue === 'b'}
                  onChange={(value: string) => setRadioValue(value)}
                />
                <Radio
                  id="radio-c"
                  name="radio-group-example"
                  label="Mail"
                  value="c"
                  checked={radioValue === 'c'}
                  onChange={(value: string) => setRadioValue(value)}
                />
              </RadioGroup>
            </div>
          </section>

          <section className="showcase-section">
            <h2>Date Pickers</h2>
            <div className="form-example">
              <h3>Date Picker</h3>
              <DatePicker
                id="date-picker-example"
                name="date-picker-example"
                label="Select a date"
                value={dateValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDateValue(e.target.value)}
              />
            </div>

            <div className="form-example">
              <h3>Date Range Picker</h3>
              <DateRangePicker
                id="date-range-picker-example"
                label="Select a date range"
                value={dateRange}
                onStartDateChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
                onEndDateChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
              />
            </div>
          </section>

          <section className="showcase-section">
            <h2>Accordion</h2>
            <AccordionGroup>
              <Accordion id="accordion-1">
                Personal Information
                <div>This is the content of the first accordion item.</div>
              </Accordion>
              <Accordion id="accordion-2">
                Contact Details
                <div>This is the content of the second accordion item.</div>
              </Accordion>
              <Accordion id="accordion-3">
                Preferences
                <div>This is the content of the third accordion item.</div>
              </Accordion>
            </AccordionGroup>
          </section>

          <section className="showcase-section">
            <h2>Table</h2>
            <Table caption="Example Table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>John Doe</td>
                  <td>john@example.com</td>
                  <td>Admin</td>
                </tr>
                <tr>
                  <td>Jane Smith</td>
                  <td>jane@example.com</td>
                  <td>User</td>
                </tr>
                <tr>
                  <td>Bob Johnson</td>
                  <td>bob@example.com</td>
                  <td>User</td>
                </tr>
              </tbody>
            </Table>
          </section>

          <section className="showcase-section">
            <h2>Tag</h2>
            <div className="tag-examples">
              <Tag>Default</Tag>
              <Tag className="usa-tag--big">Big</Tag>
            </div>
          </section>

          <section className="showcase-section">
            <h2>Icon</h2>
            <div className="icon-examples">
              <Icon name="check" />
              <Icon name="close" />
              <Icon name="info" />
              <Icon name="warning" />
            </div>
          </section>

          <section className="showcase-section">
            <h2>Modal</h2>
            <OpenModalButton
              id="open-modal-btn"
              modalId="example-modal"
              modalRef={modalRef}
            >
              Open Modal
            </OpenModalButton>
            <Modal
              ref={modalRef}
              modalId="example-modal"
              heading="Example Modal"
              content={<p>This is an example modal content.</p>}
              actionButtonGroup={{
                modalId: "example-modal",
                modalRef: modalRef,
                submitButton: {
                  label: 'Confirm',
                  onClick: () => {
                    modalRef.current?.hide({});
                  },
                },
                cancelButton: {
                  label: 'Cancel',
                },
              }}
            />
          </section>

          <section className="showcase-section">
            <h2>Form Requirements Notice</h2>
            <FormRequirementsNotice />
          </section>

          <section className="showcase-section">
            <h2>Privacy Act Footer</h2>
            <PrivacyActFooter />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
