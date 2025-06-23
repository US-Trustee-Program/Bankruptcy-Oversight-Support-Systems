type PrerenderedHtmlProps = {
  htmlString: string;
};

function PrerenderedHtml(props: PrerenderedHtmlProps) {
  return <div dangerouslySetInnerHTML={{ __html: props.htmlString }} />;
}

export default PrerenderedHtml;
