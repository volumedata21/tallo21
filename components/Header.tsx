import React from 'react';
import { Search, Map, LayoutGrid, Menu, Plus } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  viewMode: 'grid' | 'map';
  onToggleView: (mode: 'grid' | 'map') => void;
  onToggleSidebar: () => void;
  onCreatePin: () => void;
  onLogoClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  viewMode, 
  onToggleView, 
  onToggleSidebar,
  onCreatePin,
  searchQuery,
  onSearchChange
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center h-20 px-6 sm:px-8 bg-[#000208]/95 backdrop-blur-xl border-b border-slate-900/50">
      
      {/* Mobile Menu Toggle (Hidden on Desktop) */}
      <button 
        onClick={onToggleSidebar} 
        className="md:hidden mr-4 p-2 -ml-2 text-slate-400 hover:text-white rounded-full"
      >
        <Menu size={24} />
      </button>

      {/* Search Bar - Expanded width since logo is gone */}
      <div className="flex-1 max-w-2xl relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full h-11 pl-12 pr-4 bg-slate-900/50 focus:bg-slate-900 text-slate-200 rounded-full border border-slate-800/50 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 outline-none transition-all placeholder-slate-600"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4 ml-auto pl-4">
        <button 
           onClick={onCreatePin}
           className="hidden sm:flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-teal-900/20"
        >
           <Plus size={18} />
           <span>Create</span>
        </button>

        <button 
           onClick={onCreatePin}
           className="sm:hidden p-2.5 bg-teal-600 text-white rounded-full shadow-lg"
        >
           <Plus size={20} />
        </button>

        <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

        {/* View Toggle */}
        <div className="hidden sm:flex bg-slate-900 rounded-full p-1 border border-slate-800">
          <button 
            onClick={() => onToggleView('grid')}
            className={`p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-teal-500 shadow-sm ring-1 ring-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
             onClick={() => onToggleView('map')}
             className={`p-2 rounded-full transition-all ${viewMode === 'map' ? 'bg-slate-800 text-teal-500 shadow-sm ring-1 ring-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
             title="Map View"
          >
            <Map size={18} />
          </button>
        </div>
        
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer hover:border-teal-500/50 transition-colors shrink-0">
          <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${user.avatarSeed}`} alt="Profile" />
        </div>
      </div>
    </header>
  );
};