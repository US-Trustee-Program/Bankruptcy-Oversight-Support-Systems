import './StaffContactLinks.scss';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';
import { CamsUserReference } from '@common/cams/users';

interface StaffContactLinksProps {
  user: CamsUserReference;
}

export default function StaffContactLinks(props: Readonly<StaffContactLinksProps>) {
  const { user } = props;

  if (!user.email) {
    return null;
  }

  return (
    <div className="staff-contact-links">
      <CommsLink contact={{ email: user.email }} mode="email" name={user.name} />
      <CommsLink contact={{ email: user.email }} mode="teams-chat" name={user.name} />
      <CommsLink contact={{ email: user.email }} mode="teams-call" name={user.name} />
    </div>
  );
}
