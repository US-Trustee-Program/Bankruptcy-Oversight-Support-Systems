interface SearchScreenProps {}

export default function SearchScreen(_props: SearchScreenProps) {
  return (
    <div className="search" data-testid="search">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Search Results</h1>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
