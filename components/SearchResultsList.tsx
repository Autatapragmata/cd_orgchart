import React, { useState } from 'react';
import { Person } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import Tag from './Tag';
import { SpinnerIcon } from './icons/SpinnerIcon';

export interface SearchResultItem extends Person {
  x: number;
  y: number;
  propagatedColor?: string;
  depth: number;
}

interface SearchResultsListProps {
  results: SearchResultItem[];
  aiResults: { [key: string]: SearchResultItem[] } | null;
  onResultClick: (person: SearchResultItem) => void;
  isAiSearchActive: boolean;
  isLoading: boolean;
}

const SearchResultListItem: React.FC<{
  person: SearchResultItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onLocate: (person: SearchResultItem) => void;
  indentStyle: React.CSSProperties;
}> = ({ person, isExpanded, onToggleExpand, onLocate, indentStyle }) => {
  const accentColor = person.color || person.propagatedColor || '#94a3b8';
  const hasDetails = (person.projects && person.projects.length > 0) || (person.skills && person.skills.length > 0);

  return (
    <>
      <div
        onClick={hasDetails ? () => onToggleExpand(person.id) : undefined}
        className={`w-full text-left py-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-700/50 transition-colors flex items-center gap-3 ${hasDetails ? 'cursor-pointer' : ''}`}
        style={indentStyle}
        role={hasDetails ? "button" : undefined}
        aria-expanded={isExpanded}
        aria-label={`Details for ${person.name}`}
      >
        <div 
          className="w-1 h-8 rounded-full flex-shrink-0 -ml-1"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        ></div>
        <div className="flex-grow overflow-hidden">
          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{person.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{person.title}</p>
        </div>
        <div className="flex items-center flex-shrink-0 pr-3">
            <button 
                onClick={(e) => { e.stopPropagation(); onLocate(person); }}
                className="p-1 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                title={`Locate ${person.name} on chart`}
                aria-label={`Locate ${person.name} on chart`}
            >
                <MapPinIcon className="w-4 h-4" />
            </button>
            {hasDetails && (
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            )}
        </div>
      </div>
      {isExpanded && hasDetails && (
          <div 
            className="pb-3 pr-3" 
            style={{ paddingLeft: `${(indentStyle.paddingLeft as string).replace('rem','')}rem` }}
          >
            <div className="pl-3 border-l-2 space-y-3" style={{ borderColor: accentColor }}>
                {person.projects && person.projects.length > 0 && (
                    <div>
                        <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Projects</h5>
                        <div className="flex flex-wrap gap-1">
                            {person.projects.map(p => <Tag key={p} skill={p} onRemove={() => {}} isReadOnly={true} />)}
                        </div>
                    </div>
                )}
                {person.skills && person.skills.length > 0 && (
                    <div>
                        <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Skills</h5>
                        <div className="flex flex-wrap gap-1">
                            {person.skills.map(s => <Tag key={s} skill={s} onRemove={() => {}} isReadOnly={true} />)}
                        </div>
                    </div>
                )}
            </div>
          </div>
      )}
    </>
  );
};


const SearchResultsList: React.FC<SearchResultsListProps> = ({ results, aiResults, onResultClick, isAiSearchActive, isLoading }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = (personId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personId)) {
        newSet.delete(personId);
      } else {
        newSet.add(personId);
      }
      return newSet;
    });
  };

  // FIX: Cast `arr` to the correct type to resolve TypeScript error about 'length' not existing on 'unknown'.
  const totalResults = isAiSearchActive
    ? Object.values(aiResults || {}).reduce((sum, arr) => sum + (arr as SearchResultItem[]).length, 0)
    : results.length;

  const categoryTitles: { [key: string]: string } = {
    bestMatches: 'Best Matches',
    likelyMatches: 'Likely Matches',
    possibleMatches: 'Possible Matches'
  };

  const renderTextResults = () => {
    let lastGroupIdentifier: string | null = null;
    return results.map((person, index) => {
      const accentColor = person.color || person.propagatedColor || '#94a3b8';
      let showGroupHeader = false;
      if (person.depth === 0) {
        const currentGroupIdentifier = `${accentColor}-${person.team}`;
        if (currentGroupIdentifier !== lastGroupIdentifier) {
          showGroupHeader = true;
          lastGroupIdentifier = currentGroupIdentifier;
        }
      }
      const indentStyle = { paddingLeft: `${0.75 + person.depth * 1.25}rem` };

      return (
        <React.Fragment key={person.id}>
          {showGroupHeader && person.team && (
            <li className="px-3 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden="true"
                ></div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{person.team}</p>
              </div>
            </li>
          )}
          <li className={index > 0 && !showGroupHeader ? "border-t border-slate-200 dark:border-slate-700" : ""}>
            <SearchResultListItem 
                person={person}
                isExpanded={expandedIds.has(person.id)}
                onToggleExpand={handleToggleExpand}
                onLocate={onResultClick}
                indentStyle={indentStyle}
            />
          </li>
        </React.Fragment>
      );
    });
  };
  
  const renderAiResults = () => {
    if (!aiResults) return null;
    return Object.entries(categoryTitles).map(([categoryKey, categoryTitle]) => {
        const categoryResults = aiResults[categoryKey];
        if (!categoryResults || categoryResults.length === 0) return null;
        
        return (
            <React.Fragment key={categoryKey}>
                <li className="px-3 pt-3 pb-1 bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">{categoryTitle}</p>
                </li>
                {categoryResults.map((person, index) => (
                    <li key={person.id} className={index > 0 ? "border-t border-slate-200 dark:border-slate-700" : ""}>
                        <SearchResultListItem 
                            person={person}
                            isExpanded={expandedIds.has(person.id)}
                            onToggleExpand={handleToggleExpand}
                            onLocate={onResultClick}
                            indentStyle={{ paddingLeft: '0.75rem' }}
                        />
                    </li>
                ))}
            </React.Fragment>
        );
    });
  };


  return (
    <div className="w-72 max-h-[calc(100vh-280px)] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col nodrag-area">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">
          {isAiSearchActive ? 'AI Search Results' : 'Search Results'}{' '}
          {!isLoading && `(${totalResults})`}
        </h3>
      </div>
      <div className="overflow-y-auto">
        {isLoading ? (
            <div className="flex items-center justify-center p-8 text-slate-500 dark:text-slate-400">
                <SpinnerIcon className="w-6 h-6" />
            </div>
        ) : totalResults === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No results found.
            </div>
        ) : (
        <ul role="list">
          {isAiSearchActive ? renderAiResults() : renderTextResults()}
        </ul>
        )}
      </div>
    </div>
  );
};

export default SearchResultsList;