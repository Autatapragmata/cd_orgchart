
import React from 'react';
import { XIcon } from './icons/XIcon';

interface TagProps {
  skill: string;
  onRemove: () => void;
  isReadOnly?: boolean;
}

const Tag: React.FC<TagProps> = ({ skill, onRemove, isReadOnly = false }) => {
  return (
    <span className="group flex items-center bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
      {skill}
      {!isReadOnly && (
        <button 
            onClick={onRemove} 
            className="ml-1.5 -mr-1 p-0.5 rounded-full opacity-50 group-hover:opacity-100 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/40 transition-all"
            aria-label={`Remove ${skill} skill`}
        >
            <XIcon className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

export default Tag;
