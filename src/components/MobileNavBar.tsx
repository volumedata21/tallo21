import React from 'react';
import { Home, Search, Plus, Map as MapIcon, Menu } from 'lucide-react';
import { ViewType } from '../../shared/types';

interface MobileNavBarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  onOpenSidebar: () => void;
  onUpload: () => void;
  mainViewMode: 'grid' | 'map';
  setMainViewMode: (mode: 'grid' | 'map') => void;
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeView, setActiveView, onOpenSidebar, onUpload, mainViewMode, setMainViewMode }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950 border-t border-slate-900 flex items-center justify-around z-40 pb-safe-bottom">
      <button onClick={() => setActiveView('all')} className={`p-2 ${activeView === 'all' ? 'text-rose-500' : 'text-slate-500'}`}>
        <Home className="w-6 h-6" />
      </button>
      <button onClick={() => setMainViewMode(mainViewMode === 'grid' ? 'map' : 'grid')} className={`p-2 ${mainViewMode === 'map' ? 'text-rose-500' : 'text-slate-500'}`}>
        <MapIcon className="w-6 h-6" />
      </button>
      <button onClick={onUpload} className="p-3 bg-rose-600 rounded-full text-white -mt-6 shadow-lg shadow-rose-900/40">
        <Plus className="w-6 h-6" />
      </button>
      <button onClick={() => setActiveView('discovery')} className={`p-2 ${activeView === 'discovery' ? 'text-rose-500' : 'text-slate-500'}`}>
        <Search className="w-6 h-6" />
      </button>
      <button onClick={onOpenSidebar} className="p-2 text-slate-500">
        <Menu className="w-6 h-6" />
      </button>
    </div>
  );
};

export default MobileNavBar;