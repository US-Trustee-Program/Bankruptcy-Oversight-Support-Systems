import { JSX } from 'react';
import { IconLabel } from './IconLabel/IconLabel';

type EmailLinkProps = {
  email: string;
  subject?: string;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
};

export default function EmailLink(props: EmailLinkProps): JSX.Element {
  const { email, subject, className, 'data-testid': dataTestId, 'aria-label': ariaLabel } = props;

  const href = subject ? `mailto:${email}?subject=${subject}` : `mailto:${email}`;

  return (
    <div data-testid={dataTestId} aria-label={ariaLabel} className={className}>
      <a href={href}>
        <IconLabel icon="mail_outline" label={email} />
      </a>
    </div>
  );
}
