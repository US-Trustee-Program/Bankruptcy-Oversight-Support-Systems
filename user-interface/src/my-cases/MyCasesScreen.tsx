import LocalStorage from '@/lib/utils/local-storage';
import { SearchResults } from '@/search/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';

export const MyCasesScreen = () => {
  const screenTitle = 'My Cases';

  const session = LocalStorage.getSession();
  const searchPredicate: CasesSearchPredicate = {
    chapters: ['15'],
    assignments: [session!.user.id],
  };

  return (
    <div className="my-cases case-list">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1 data-testid="case-list-heading">{screenTitle}</h1>
          <SearchResults id="search-results" searchPredicate={searchPredicate}></SearchResults>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
};
