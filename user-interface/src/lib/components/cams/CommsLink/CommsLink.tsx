import './CommsLink.scss';
import { ContactInformation } from '@common/cams/contact';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Validators from '@common/cams/validators';

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

  const isValidEmail = Validators.isEmailAddress(email).valid;
  const isValidPhoneNumber = Validators.isPhoneNumber(number).valid;

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
  } else if (isValidPhoneNumber && mode === 'phone-dialer') {
    href = toTelephoneUri(number!, extension);
    labelToUse = label ?? (extension ? `${number} ext. ${extension}` : number!);
    iconToUse = icon ?? 'phone';
  }

  if (href) {
    return (
      <a href={href} className="usa-link comms-link" target={target} rel="noopener noreferrer">
        <IconLabel label={labelToUse} icon={iconToUse} location="left" />
      </a>
    );
  } else {
    return <IconLabel label={labelToUse} icon={iconToUse} location="left" />;
  }
}

export default CommsLink;
