import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import { Ch13CompletionStatus } from '@common/cams/trustee-upcoming-key-dates';

export interface CompletionStatusTagProps {
  id: string;
  status: Ch13CompletionStatus;
  year: number;
}

/**
 * Themed "Complete for {year}" / "Incomplete for {year}" tag shared by the Chapter 13 Standing
 * Audit and Trustee Performance Report cards.
 */
export default function CompletionStatusTag(props: Readonly<CompletionStatusTagProps>) {
  const { id, status, year } = props;

  return status === 'Complete' ? (
    <Tag id={id} uswdsStyle={UswdsTagStyle.Success}>
      Complete for {year}
    </Tag>
  ) : (
    <Tag id={id} uswdsStyle={UswdsTagStyle.SecondaryDark}>
      Incomplete for {year}
    </Tag>
  );
}
