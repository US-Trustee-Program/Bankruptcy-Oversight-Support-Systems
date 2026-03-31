import './NewTabLink.scss';
import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';

type NewTabLinkProps = {
  to: string;
  label: string;
  className?: string;
};

export function NewTabLink({ to, label, className }: Readonly<NewTabLinkProps>) {
  const classes = ['new-tab-link', className].filter(Boolean).join(' ');
  return (
    <Link to={to} className={classes} target="_blank" rel="noopener noreferrer">
      <Icon name="launch" />
      {label}
    </Link>
  );
}
