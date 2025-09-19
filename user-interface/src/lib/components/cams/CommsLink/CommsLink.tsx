import { ContactInformation } from '@common/cams/contact';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

type CommsLinkProps = {
  contact: Omit<ContactInformation, 'address'>;
  mode: 'teams-chat' | 'teams-call' | 'phone-dialer' | 'email';
  label?: string;
  icon?: string;
  emailSubject?: string;
};

const NON_DIGITS = /\D/g;

function toTelephoneUri(number: string, extension?: string) {
  const strippedNumber = number.replace(NON_DIGITS, '');
  const strippedExtension = extension?.replace(NON_DIGITS, '');
  if (strippedExtension) {
    return `tel:+1${strippedNumber};ext=${strippedExtension}`;
  } else {
    return `tel:+1${strippedNumber}`;
  }
}

function CommsLink(props: Readonly<CommsLinkProps>) {
  const { contact, mode, label, icon, emailSubject } = props;
  const { number, extension } = contact.phone ?? { number: '' };
  const { email } = contact;

  let href = 'javascript:void(0);';
  let labelToUse = '';
  let iconToUse = icon;

  switch (mode) {
    case 'teams-chat':
      href = `msteams://teams.microsoft.com/l/chat/0/0?users=${email}`;
      labelToUse = label ?? 'Chat';
      iconToUse = iconToUse ?? 'chat';
      break;
    case 'teams-call':
      href = `msteams://teams.microsoft.com/l/call/0/0?users=${email}`;
      labelToUse = label ?? 'Talk';
      iconToUse = iconToUse ?? 'forum';
      break;
    case 'phone-dialer':
      href = toTelephoneUri(number, extension);
      labelToUse = label ?? (extension ? `${number} x${extension}` : number);
      iconToUse = iconToUse ?? 'phone';
      break;
    case 'email':
      href = `mailto:${email}`;
      if (emailSubject) {
        href += `?subject=${encodeURIComponent(emailSubject)}`;
      }
      labelToUse = label ?? email ?? 'Email';
      iconToUse = iconToUse ?? 'mail';
      break;
  }

  return (
    <a href={href} className="usa-link">
      <IconLabel label={labelToUse} icon={iconToUse} location="left" />
    </a>
  );
}

export default CommsLink;
