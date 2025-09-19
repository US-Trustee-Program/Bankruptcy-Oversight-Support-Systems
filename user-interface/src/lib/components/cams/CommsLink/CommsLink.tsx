import { ContactInformation } from '@common/cams/contact';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

type CommsLinkProps = {
  contact: Omit<ContactInformation, 'address'>;
  mode: 'teams-chat' | 'teams-call' | 'phone-dialer' | 'email';
  label?: string;
  icon?: string;
};

function toTelephoneUri(number: string, extension?: string) {
  const strippedNumber = number.replace(/[^\d]/g, '');
  if (extension) {
    return `tel:+1${strippedNumber};ext=${extension}`;
  } else {
    return `tel:+1${strippedNumber}`;
  }
}

function CommsLink(props: Readonly<CommsLinkProps>) {
  const { contact, mode, label, icon } = props;
  const { number, extension } = contact.phone ?? { number: '' };
  const { email } = contact;

  // TODO: Sanity check the content to make sure we are not opening a malicious link.

  // TODO: Add detection if teams link isn't available. Example code:
  // function tryTeamsOrTel(phone) {
  //   const teamsUrl = `msteams://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(phone)}`;
  //   const telUrl   = `tel:${phone}`;
  //
  //   let launched = false;
  //   const timeout = setTimeout(() => {
  //     if (!launched) {
  //       window.location.href = telUrl; // fallback
  //     }
  //   }, 1500);
  //
  //   window.location.href = teamsUrl;
  //   // If Teams handles it, the browser leaves and never runs fallback.
  //   // If not, timeout fires and we redirect to tel:
  // }

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
      labelToUse = label ?? email ?? 'Email';
      iconToUse = iconToUse ?? 'mail';
      break;
  }

  return (
    <a href={href} className="usa-link">
      {iconToUse ? <IconLabel label={labelToUse} icon={iconToUse} location="left" /> : labelToUse}
    </a>
  );
}

export default CommsLink;
