import './CommsLink.scss';
import { ContactInformation } from '@common/cams/contact';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Validators from '@common/cams/validators';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';
import { EMAIL_REGEX, PHONE_REGEX } from '@common/cams/regex';

type CommsLinkProps = {
  contact: Omit<ContactInformation, 'address'>;
  mode: 'teams-chat' | 'teams-call' | 'phone-dialer' | 'email' | 'website';
  label?: string;
  icon?: string;
  emailSubject?: string;
};

const NON_DIGITS = /\D/g;

function formatWebsiteUrl(website: string) {
  return website.replace(/^(?:http:\/\/|(?!https?:\/\/))/i, 'https://');
}

function toTelephoneUri(number: string, extension?: string) {
  const strippedNumber = number.replaceAll(NON_DIGITS, '');
  const strippedExtension = extension?.replaceAll(NON_DIGITS, '');
  if (strippedExtension) {
    return `tel:+1${strippedNumber};ext=${strippedExtension}`;
  } else {
    return `tel:+1${strippedNumber}`;
  }
}

function CommsLink(props: Readonly<CommsLinkProps>) {
  const { contact, mode, label, icon, emailSubject } = props;
  const { email, website, phone } = contact;
  const { number, extension } = phone ?? {};

  const isValidEmail: boolean = !!Validators.matches(
    EMAIL_REGEX,
    FIELD_VALIDATION_MESSAGES.EMAIL,
  )(email).valid;
  const isValidPhoneNumber: boolean = !!Validators.matches(
    PHONE_REGEX,
    FIELD_VALIDATION_MESSAGES.PHONE_NUMBER,
  )(number).valid;

  let href = '';
  let labelToUse = label ?? '';
  let iconToUse = 'error';
  let target = undefined;

  if (isValidEmail && mode === 'teams-chat') {
    href = `msteams://teams.microsoft.com/l/chat/0/0?users=${email}`;
    labelToUse = label ?? 'Chat';
    iconToUse = icon ?? 'chat';
  } else if (isValidEmail && mode === 'teams-call') {
    href = `msteams://teams.microsoft.com/l/call/0/0?users=${email}`;
    labelToUse = label ?? 'Talk';
    iconToUse = icon ?? 'forum';
  } else if (isValidEmail && mode === 'email') {
    href = `mailto:${email}`;
    if (emailSubject) {
      href += `?subject=${encodeURIComponent(emailSubject)}`;
    }
    labelToUse = label ?? email!;
    iconToUse = icon ?? 'mail';
  } else if (mode === 'website' && website) {
    target = '_blank';
    href = formatWebsiteUrl(website);
    labelToUse = label ?? website;
    iconToUse = icon ?? 'launch';
  } else if (mode === 'phone-dialer' && number) {
    // Always display the phone number, even if it doesn't match our expected format
    // If valid, create a clickable tel: link; otherwise just display the number
    if (isValidPhoneNumber) {
      href = toTelephoneUri(number, extension);
    }
    labelToUse = label ?? (extension ? `${number} ext. ${extension}` : number);
    iconToUse = icon ?? 'phone';
  }

  if (href) {
    return (
      <a href={href} className="usa-link comms-link" target={target} rel="noopener noreferrer">
        <IconLabel label={labelToUse} icon={iconToUse} location="left" />
      </a>
    );
  } else if (labelToUse && iconToUse !== 'error') {
    // Display non-link content if we have a label and it's not an error state
    return <IconLabel label={labelToUse} icon={iconToUse} location="left" />;
  } else {
    return <IconLabel label={labelToUse} icon={iconToUse} location="left" />;
  }
}

export default CommsLink;
