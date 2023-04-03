import { ChangeEvent, useState } from 'react';

export const ChapterFilter = () => {
  const chapterOptions = ['05', '7A', '7B', '11', '12', '13', '15'];
  const [, setChapter] = useState<string>('11');

  const updateChapterFilter = (e: ChangeEvent<HTMLSelectElement>) => {
    setChapter(e.target.value);
  };

  return (
    <div className="chapter-filter">
      <label htmlFor="chapter-filter-input">
        <select id="chapter-filter-input" onChange={updateChapterFilter}>
          <option>Filter by chapter</option>
          {chapterOptions.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
