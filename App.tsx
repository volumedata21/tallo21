import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PinCard } from './components/PinCard';
import { AdminPanel } from './components/AdminPanel';
import { PinModal } from './components/PinModal';
import { CreatePinModal } from './components/CreatePinModal';
import { MapView } from './components/MapView';
import { BulkActionBar } from './components/BulkActionBar';
import { dataService } from './services/dataService';
import { Pin, UserSettings, Collection, Board, SortOption, User } from './types';
import { Sliders, Plus, ArrowUpDown, ChevronDown, Check, MousePointer2, Shuffle, CheckSquare, Tag as TagIcon, Undo, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); 
  
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [pins, setPins] = useState<Pin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string }>({ type: 'all', id: '' });
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [userSettings, setUserSettings] = useState<UserSettings>({
    hideTitles: false,
    hideDescriptions: false,
    showTags: true,
    darkMode: true
  });

  const [toast, setToast] = useState<{ message: string, onUndo: () => void } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. Initial User Load with Error Handling
  const initUser = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const user = await dataService.getCurrentUser();
      
      if (!user) {
          throw new Error("No user returned from API");
      }
      
      setCurrentUser(user);
    } catch (e: any) {
      console.error("Failed to load user", e);
      setError(e.message || "Failed to connect to server");
    } finally {
      // Handled in refreshData
    }
  };

  useEffect(() => {
    initUser();
  }, []);

  // 2. Data Refresh Logic
  const refreshData = async () => {
    if (!currentUser) return;

    try {
        const [usersData, collectionsData, boardsData, tagsData, allTagsData] = await Promise.all([
            dataService.getUsers(),
            dataService.getCollections(currentUser.id),
            dataService.getBoards(currentUser.id),
            dataService.getTrendingTags(),
            dataService.getAllTags()
        ]);

        setUsers(usersData);
        setCollections(collectionsData);
        setBoards(boardsData);
        setTrendingTags(tagsData);
        setAllTags(allTagsData);
        
        let filterConfig: any = {};
        if (activeFilter.type === 'favorites') filterConfig.favorites = true;
        if (activeFilter.type === 'collection') filterConfig.collectionId = activeFilter.id;
        if (activeFilter.type === 'board') filterConfig.boardId = activeFilter.id;
        if (activeFilter.type === 'tag') filterConfig.tag = activeFilter.id;
        
        const effectiveSort = isShuffle ? 'random' : sortBy;
        const pinsData = await dataService.getPins(filterConfig, effectiveSort, searchQuery);
        setPins(pinsData);

        if (selectedPin) {
            const updatedPin = (await dataService.getAllPins()).find(p => p.id === selectedPin.id);
            if (updatedPin) setSelectedPin(updatedPin);
        }
    } catch (error) {
        console.error("Error refreshing data:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
        refreshData();
    }
  }, [activeFilter, currentUser?.id, sortBy, isShuffle, searchQuery, currentUser]);

  // --- Handlers ---
  const showToast = (message: string, onUndo: () => void) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ message, onUndo });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
  };

  const handlePinDelete = async (pin: Pin) => {
      await dataService.deletePin(pin.id);
      if (selectedPin && selectedPin.id === pin.id) setSelectedPin(null);
      await refreshData();
      showToast('Stem deleted', () => { console.log("Restore not implemented"); });
  };

  const handleBulkDelete = async (ids: string[]) => {
      await dataService.bulkDeletePins(ids);
      await refreshData();
      setSelectedPinIds([]);
      setLastSelectedId(null);
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastSelectedId && lastSelectedId !== id) {
          const currentIndex = pins.findIndex(p => p.id === id);
          const lastIndex = pins.findIndex(p => p.id === lastSelectedId);
          if (currentIndex !== -1 && lastIndex !== -1) {
              const start = Math.min(currentIndex, lastIndex);
              const end = Math.max(currentIndex, lastIndex);
              const rangeIds = pins.slice(start, end + 1).map(p => p.id);
              setSelectedPinIds(prev => [...new Set([...prev, ...rangeIds])]);
              return; 
          }
      }
      setLastSelectedId(id);
      setSelectedPinIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
      if (selectedPinIds.length === pins.length) {
          setSelectedPinIds([]);
          setLastSelectedId(null);
      } else {
          setSelectedPinIds(pins.map(p => p.id));
          setLastSelectedId(null);
      }
  };

  const handleSelectionModeToggle = () => {
      setIsSelectionMode(!isSelectionMode);
      if (isSelectionMode) { setSelectedPinIds([]); setLastSelectedId(null); }
  };
  
  const handlePinClick = (pin: Pin, e: React.MouseEvent) => {
      if (e.shiftKey) {
          if (!isSelectionMode) setIsSelectionMode(true);
          toggleSelection(pin.id, e);
      } else {
          setSelectedPin(pin);
      }
  };

  const resetFilters = () => { setActiveFilter({ type: 'all', id: '' }); setSearchQuery(''); };

  // --- Toggle Trending Tag Logic ---
  const toggleTrendingTag = (tag: string) => {
      if (activeFilter.type === 'tag' && activeFilter.id === tag) {
          resetFilters(); // Clicked again -> Deactivate
      } else {
          setActiveFilter({ type: 'tag', id: tag });
      }
  };

  const SortButton = ({ value, label, current }: { value: SortOption, label: string, current: SortOption }) => (
      <button 
        onClick={() => { setSortBy(value); setIsSortOpen(false); }} 
        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${current === value ? 'bg-teal-500/10 text-teal-500 font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
      >
          {label} {current === value && <Check size={14} />}
      </button>
  );

  const getMasonryColumns = () => {
      const width = window.innerWidth;
      let colCount = 2; 
      if (width >= 1280) colCount = 4;
      else if (width >= 1024) colCount = 3; 
      else if (width >= 768) colCount = 3; 

      const columns: Pin[][] = Array.from({ length: colCount }, () => []);
      pins.forEach((pin, i) => columns[i % colCount].push(pin));
      return columns;
  };
  const masonryColumns = getMasonryColumns();


  // --- ERROR STATE ---
  if (error) {
      return (
        <div className="h-screen w-screen bg-[#000208] flex items-center justify-center text-slate-300">
             <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl">
                 <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertTriangle size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
                 <p className="text-slate-400 mb-6 text-sm">
                    {error === "Failed to fetch" 
                        ? "Could not connect to the Backend API. Ensure the server is running on port 3001." 
                        : error}
                 </p>
                 <button 
                    onClick={initUser}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-full font-medium transition w-full"
                 >
                     <RefreshCcw size={18} /> Retry Connection
                 </button>
             </div>
        </div>
      );
  }

  // --- LOADING STATE ---
  if (!currentUser || (isLoading && pins.length === 0)) {
      return (
          <div className="h-screen w-screen bg-[#000208] flex items-center justify-center text-teal-500">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin w-10 h-10" />
                  <span className="text-slate-400 font-medium">Loading Tallo...</span>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#000208] text-slate-200 font-sans selection:bg-teal-500/30 overflow-hidden">
      
      <Header 
        user={currentUser}
        viewMode={viewMode}
        onToggleView={setViewMode}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onCreatePin={() => setIsCreateOpen(true)}
        onLogoClick={resetFilters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden pt-20"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {toast && (
          <div className="fixed bottom-20 md:bottom-8 right-1/2 translate-x-1/2 md:translate-x-0 md:right-8 z-[70] bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in">
              <span className="font-medium text-sm">{toast.message}</span>
              <button 
                  onClick={() => { toast.onUndo(); setToast(null); }}
                  className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
              >
                  <Undo size={12} /> Undo
              </button>
          </div>
      )}

      <div className="flex pt-16 md:pt-20 h-screen">
        
        <Sidebar
           isOpen={isSidebarOpen}
           activeFilter={activeFilter}
           onFilterChange={setActiveFilter}
           collections={collections}
           boards={boards}
           allTags={allTags}
           currentUser={currentUser}
           onUpdate={refreshData}
           onCloseMobile={() => setIsSidebarOpen(false)}
           onOpenSettings={() => setShowSettings(!showSettings)}
           onOpenAdmin={() => setIsAdminOpen(true)}
        />

        <main className="flex-1 relative overflow-y-auto no-scrollbar bg-[#000208]">
            {showSettings && (
               <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md animate-in slide-in-from-top-5">
                  <div className="flex items-center gap-2 text-teal-500">
                     <Sliders size={20} strokeWidth={1.5} />
                     <span className="font-bold">View Settings</span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={userSettings.hideTitles} 
                           onChange={e => setUserSettings({...userSettings, hideTitles: e.target.checked})}
                           className="accent-teal-600"
                        />
                        <span className="text-sm text-slate-300">Hide Titles</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={userSettings.hideDescriptions} 
                           onChange={e => setUserSettings({...userSettings, hideDescriptions: e.target.checked})}
                           className="accent-teal-600"
                        />
                        <span className="text-sm text-slate-300">Hide Descriptions</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={userSettings.showTags} 
                           onChange={e => setUserSettings({...userSettings, showTags: e.target.checked})}
                           className="accent-teal-600"
                        />
                        <span className="text-sm text-slate-300">Show Tags</span>
                     </label>
                  </div>
               </div>
            )}

            {/* TRENDING TAGS BAR - Updated size & toggle logic */}
            {userSettings.showTags && trendingTags.length > 0 && viewMode === 'grid' && (
                <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-0 overflow-x-auto no-scrollbar flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        <TagIcon size={10} /> Trending
                    </div>
                    {trendingTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleTrendingTag(tag)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${activeFilter.type === 'tag' && activeFilter.id === tag ? 'bg-teal-500/10 border-teal-500/50 text-teal-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {viewMode === 'map' ? (
               <div className="w-full h-full relative z-0">
                  <MapView pins={pins} onPinClick={setSelectedPin} />
               </div>
            ) : (
               <div className="px-4 py-2 sm:p-6 lg:p-8">
                  <div className="flex justify-between items-center mb-6 sticky top-0 z-40 bg-[#000208]/95 backdrop-blur-xl py-4 border-b border-slate-900/50 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                      <div className="flex items-center gap-4 truncate max-w-md">
                         <h2 className="text-xl font-bold text-white">
                           {activeFilter.type === 'all' && 'Tallos'}
                           {activeFilter.type === 'favorites' && 'Favorites'}
                           {activeFilter.type === 'collection' && collections.find(c => c.id === activeFilter.id)?.title}
                           {activeFilter.type === 'board' && boards.find(b => b.id === activeFilter.id)?.title}
                           {activeFilter.type === 'tag' && `#${activeFilter.id}`}
                         </h2>
                         
                         <div className="flex items-center bg-slate-900 rounded-full border border-slate-800 p-1 gap-1">
                             <button 
                                onClick={handleSelectionModeToggle}
                                className={`p-2 rounded-full transition-all ${isSelectionMode ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                title="Select Multiple"
                             >
                                <MousePointer2 size={16} />
                             </button>
                             {isSelectionMode && (
                                <button 
                                    onClick={handleSelectAll}
                                    className={`p-2 rounded-full transition-all ${selectedPinIds.length === pins.length ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    title="Select All"
                                >
                                    <CheckSquare size={16} />
                                </button>
                             )}
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                          <button 
                             onClick={() => setIsShuffle(!isShuffle)}
                             className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm font-medium ${isShuffle ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'}`}
                             title="Shuffle Order"
                          >
                             <Shuffle size={14} />
                             <span className="hidden sm:inline">Shuffle</span>
                          </button>

                          <div className="relative" ref={sortRef}>
                              <button 
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full cursor-pointer transition-all border text-sm font-medium ${isSortOpen ? 'bg-slate-800 border-teal-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'} ${isShuffle ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isShuffle}
                              >
                                  <ArrowUpDown size={14} className={isSortOpen ? 'text-teal-500' : 'text-slate-400'} />
                                  <span className="hidden sm:inline">Sort</span>
                                  <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
                              </button>
                              
                              {isSortOpen && !isShuffle && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100] p-1">
                                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</div>
                                    <SortButton value="newest" label="Newest First" current={sortBy} />
                                    <SortButton value="oldest" label="Oldest First" current={sortBy} />
                                    <div className="h-px bg-slate-800 my-1"></div>
                                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Title</div>
                                    <SortButton value="az" label="Title (A-Z)" current={sortBy} />
                                    <SortButton value="za" label="Title (Z-A)" current={sortBy} />
                                </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {pins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                            <Plus size={40} className="text-slate-700" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-300 mb-2">No Stems Found</h3>
                        <p className="mb-6">
                            {searchQuery ? `No results for "${searchQuery}"` : activeFilter.type === 'tag' ? `No pins tagged with #${activeFilter.id}` : 'Upload an image to get started.'}
                        </p>
                        <button 
                           onClick={() => setIsCreateOpen(true)}
                           className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-medium transition"
                        >
                            Add Stem
                        </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-4 lg:gap-6 justify-center mx-auto max-w-[2400px]">
                       {masonryColumns.map((colPins, colIndex) => (
                          <div key={colIndex} className="flex-1 flex flex-col gap-2 md:gap-4 lg:gap-6 min-w-0">
                             {colPins.map(pin => (
                                <PinCard 
                                  key={pin.id} 
                                  pin={pin} 
                                  settings={userSettings}
                                  onClick={handlePinClick}
                                  isSelectionMode={isSelectionMode}
                                  isSelected={selectedPinIds.includes(pin.id)}
                                  onToggleSelection={toggleSelection}
                                />
                             ))}
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            )}
        </main>

        {selectedPinIds.length > 0 && (
           <BulkActionBar 
              selectedIds={selectedPinIds}
              onClear={() => {
                  setSelectedPinIds([]);
                  setLastSelectedId(null);
              }}
              onUpdate={refreshData}
              collections={collections}
              boards={boards}
              customDeleteHandler={handleBulkDelete}
           />
        )}

      </div>

      <AdminPanel 
         isOpen={isAdminOpen} 
         onClose={() => setIsAdminOpen(false)} 
         users={users}
         onUpdate={refreshData}
      />

      <PinModal 
         pin={selectedPin}
         onClose={() => setSelectedPin(null)}
         collections={collections}
         boards={boards}
         onUpdate={refreshData}
         onDelete={handlePinDelete}
         pinList={pins}
         onNavigate={setSelectedPin}
      />

      <CreatePinModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        collections={collections}
        boards={boards}
        onCreated={refreshData}
        userId={currentUser ? currentUser.id : ''}
      />
      
    </div>
  );
}

export default App;