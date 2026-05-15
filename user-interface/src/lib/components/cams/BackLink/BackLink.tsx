import './BackLink.scss';
import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';

interface BackLinkProps {
  to: string;
  label: string;
  title?: string;
  testId?: string;
}

export function BackLink({ to, label, title, testId }: Readonly<BackLinkProps>) {
  return (
    <Link to={to} className="usa-link back-link" title={title} data-testid={testId ?? 'back-link'}>
      <Icon name="navigate_before" />
      {label}
    </Link>
  );
}
