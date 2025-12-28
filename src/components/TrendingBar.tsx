import React from 'react';
import { TrendingUp, Hash, X } from 'lucide-react';

interface TrendingBarProps {
  tags: string[];
  activeTag: string | null;
  onTagClick: (tag: string) => void;
}

const TrendingBar: React.FC<TrendingBarProps> = ({ tags, activeTag, onTagClick }) => {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-4 mb-6 w-full max-w-full">
      {/* Label */}
      <div className="flex items-center gap-2 text-rose-500 text-xs font-black uppercase tracking-widest flex-shrink-0 select-none">
        <TrendingUp className="w-4 h-4" />
        <span>Trending</span>
      </div>

      {/* Scrollable Tags Area */}
      <div className="flex-1 overflow-x-auto pb-2 -mb-2 scrollbar-hide mask-linear-fade">
        <div className="flex items-center gap-2">
          {tags.map(tag => {
            const isActive = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className={`
                  group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border select-none flex-shrink-0
                  ${isActive
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/20'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                  }
                `}
              >
                <Hash className={`w-3 h-3 ${isActive ? 'text-white/70' : 'text-slate-600 group-hover:text-slate-500'}`} />
                <span>{tag}</span>
                {isActive && <X className="w-3 h-3 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrendingBar;