import { useEffect } from 'react';

type DocumentTitleProps = {
  name: string;
};

export default function DocumentTitle(props: DocumentTitleProps) {
  const { name } = props;

  useEffect(() => {
    document.title = `${name} | U.S. Trustee Program - Case Management System (CAMS)`;
  }, []);

  return <></>;
}
