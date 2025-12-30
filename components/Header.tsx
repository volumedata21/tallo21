import React from 'react';
import { Search, Map, LayoutGrid, Menu, Plus, ChevronsUp } from 'lucide-react';
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
  onLogoClick,
  searchQuery,
  onSearchChange
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-50 flex items-center px-4 sm:px-6 shadow-2xl transition-all">
      
      {/* Sidebar Toggle & Logo */}
      <div className="flex items-center gap-2 md:gap-4 mr-2 md:mr-8">
        <button 
          onClick={onToggleSidebar} 
          className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>
        
        <button onClick={onLogoClick} className="flex items-center gap-3 group">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all">
            <ChevronsUp className="text-white w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
          </div>
          <span className="text-lg sm:text-xl font-bold text-white tracking-tight hidden lg:block group-hover:text-teal-400 transition-colors">Tallo</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl relative mr-2 md:mr-4">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full h-10 sm:h-11 pl-10 sm:pl-12 pr-4 bg-slate-900 focus:bg-slate-800 text-slate-200 rounded-full border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder-slate-500 text-sm sm:text-base"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <button 
           onClick={onCreatePin}
           className="hidden sm:flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full font-medium transition shadow-lg shadow-teal-900/20"
        >
           <Plus size={18} />
           <span>Add</span>
        </button>

        <button 
           onClick={onCreatePin}
           className="sm:hidden p-2 bg-teal-600 text-white rounded-full shrink-0"
        >
           <Plus size={20} />
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>

        {/* View Toggle - Desktop (Pill) */}
        <div className="hidden md:flex bg-slate-900 rounded-full p-1 border border-slate-700">
          <button 
            onClick={() => onToggleView('grid')}
            className={`p-1.5 sm:p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-teal-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
             onClick={() => onToggleView('map')}
             className={`p-1.5 sm:p-2 rounded-full transition-all ${viewMode === 'map' ? 'bg-slate-800 text-teal-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
             title="Map View"
          >
            <Map size={18} />
          </button>
        </div>

        {/* View Toggle - Mobile (Single Icon) */}
        <button 
          onClick={() => onToggleView(viewMode === 'grid' ? 'map' : 'grid')}
          className="md:hidden p-2 text-slate-400 hover:text-white"
        >
           {viewMode === 'grid' ? <Map size={20} /> : <LayoutGrid size={20} />}
        </button>
        
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden cursor-pointer hover:border-teal-600 transition-colors shrink-0 ml-1">
          <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${user.avatarSeed}`} alt="Profile" />
        </div>
      </div>
    </header>
  );
};