import React from 'react';
import { Hash } from 'lucide-react';

interface TrendingBarProps {
  tags: string[];
  onTagClick: (tag: string) => void;
}

const TrendingBar: React.FC<TrendingBarProps> = ({ tags, onTagClick }) => {
  if (tags.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide flex-shrink-0">
      <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase tracking-wider mr-2">
        <Hash className="w-3 h-3" /> Trending
      </div>
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onTagClick(tag)}
          className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap"
        >
          {tag}
        </button>
      ))}
    </div>
  );
};
export default TrendingBar;