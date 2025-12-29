import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ViewType, PinGroup } from '../../shared/types';

// Components
import Sidebar from './Sidebar';
import LoginScreen from './LoginScreen';
import UploadModal from './UploadModal';
import CreateBoardModal from './CreateBoardModal';
import CreateCollectionModal from './CreateCollectionModal';
import SettingsModal from './SettingsModal';
import ImageDetailModal from './ImageDetailModal';
import BulkActionModal from './BulkActionModal';

// Icons
import { Menu, Search, X, Plus, CheckSquare, ArrowLeft, FolderPlus, Hash, MapPin, Layers, Eye, Trash2 } from 'lucide-react';

export interface OutletContextType {
  searchTerm: string;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  onOpenCreateBoard: () => void;
  onOpenCreateCollection: () => void;
}

const UserMenu = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 outline-none">
        <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold text-white border-2 border-transparent hover:border-rose-400 transition-all">
          {user?.username?.substring(0, 2).toUpperCase() || 'U'}
        </div>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 py-1">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs text-slate-500 font-bold uppercase">Signed in as</p>
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            </div>
            <button 
              onClick={() => { onLogout(); setIsOpen(false); }} 
              className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const Layout: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const data = useData(); 
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  // We separate CreateBoard/Collection to allow stacking (e.g. creating a board WHILE uploading)
  const [activeModal, setActiveModal] = useState<'upload' | 'settings' | null>(null);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);

  // Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'board' | 'tags' | 'location' | 'group' | 'visibility' | null>(null);

  const handleLogout = () => { logout(); navigate('/'); };

  // --- HANDLERS ---
  const handleDropImageToBoard = async (imageId: string, boardId: string) => {
    const img = data.images.find(i => i.id === imageId);
    if (!img) return;
    if (!img.boardIds.includes(boardId)) {
      await data.updateImage({ ...img, boardIds: [...img.boardIds, boardId] });
    }
  };

  const handleMoveBoardToCollection = async (boardId: string, collectionId: string) => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return;
    // Prevent duplicates
    if (!board.collectionIds.includes(collectionId)) {
       const updated = { ...board, collectionIds: [...board.collectionIds, collectionId] };
       await data.updateBoard(updated);
       console.log("Moved board to collection:", updated); // Debug log
    }
  };

  const handleTogglePin = async (imageId: string, boardId: string) => {
    const img = data.images.find(i => i.id === imageId);
    if (!img) return;
    let newBoardIds = [...img.boardIds];
    if (newBoardIds.includes(boardId)) {
      newBoardIds = newBoardIds.filter(id => id !== boardId);
    } else {
      newBoardIds.push(boardId);
    }
    await data.updateImage({ ...img, boardIds: newBoardIds });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
      for (const id of selectedIds) {
        const group = data.groups.find(g => g.id === id);
        if (group) { await data.deleteGroup(id); } else { await data.deleteImage(id); }
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const executeBulkAction = async (formData: any) => {
    if (!bulkAction || !user) return;
    try {
      if (bulkAction === 'group') {
        const newGroup: PinGroup = { id: crypto.randomUUID(), title: formData.groupName, imageIds: Array.from(selectedIds), createdAt: Date.now(), boardIds: [], ownerId: user.id };
        await data.addGroup(newGroup);
      } else {
        for (const id of selectedIds) {
            const img = data.images.find(i => i.id === id);
            if (!img) continue;
            const updated = { ...img };
            if (bulkAction === 'board') { 
                if (!updated.boardIds.includes(formData.boardId)) updated.boardIds = [...updated.boardIds, formData.boardId]; 
            } else if (bulkAction === 'tags') { 
                updated.tags = Array.from(new Set([...updated.tags, ...formData.tags])); 
            } else if (bulkAction === 'location') { 
                updated.location = formData.location; updated.latitude = formData.latitude; updated.longitude = formData.longitude; 
            } else if (bulkAction === 'visibility') { 
                updated.visibility = formData.visibility; 
            }
            await data.updateImage(updated);
        }
      }
      setBulkAction(null); setSelectedIds(new Set()); setIsSelectionMode(false);
    } catch (e) { console.error("Bulk action failed", e); }
  };

  const handleBulkPinToBoard = async (boardId: string) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
        const img = data.images.find(i => i.id === id);
        if (img && !img.boardIds.includes(boardId)) {
            await data.updateImage({ ...img, boardIds: [...img.boardIds, boardId] });
        }
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleCloseImageModal = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('pin');
    setSearchParams(newParams);
  };

  const handleSetGroupHero = async (imageId: string) => {
    const group = data.groups.find(g => g.imageIds.includes(imageId));
    if (group) {
        const newImageIds = [imageId, ...group.imageIds.filter(id => id !== imageId)];
        await data.updateGroup({ ...group, imageIds: newImageIds });
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const image = data.images.find(i => i.id === id);
    if (!image || !user) return;
    await data.updateImage({ ...image, isFavorite: !image.isFavorite });
  };

  const handleUploadComplete = (newImages: any[]) => {
    newImages.forEach(img => data.addImage(img));
    setActiveModal(null);
  };

  const getCurrentView = (): ViewType => {
    const path = location.pathname;
    if (path.startsWith('/board/')) return 'board-detail';
    if (path === '/boards') return 'boards';
    if (path === '/favorites') return 'favorites';
    if (path === '/community') return 'community';
    if (path === '/discovery') return 'discovery';
    if (path.startsWith('/collection/')) return 'collection-detail';
    return 'all';
  };

  if (!isAuthenticated) return <LoginScreen onLogin={login} onGuestAccess={() => {}} />;

  const activePinId = searchParams.get('pin');
  const activeImage = activePinId ? data.images.find(img => img.id === activePinId) : null;

  return (
    <div className="flex h-screen w-full bg-black text-slate-100 overflow-hidden">
      <Sidebar
        activeView={getCurrentView()}
        setActiveView={(view) => {
           if(view === 'all') navigate('/');
           else if(view === 'boards') navigate('/boards');
           else if(view === 'favorites') navigate('/favorites');
           else if(view === 'community') navigate('/community');
           else if(view === 'discovery') navigate('/discovery');
        }}
        boards={data.boards}
        collections={data.collections}
        selectedBoardId={null} 
        selectedCollectionId={null} 
        setSelectedBoardId={(id) => id ? navigate(`/board/${id}`) : null}
        setSelectedCollectionId={(id) => id ? navigate(`/collection/${id}`) : null}
        onOpenCreateBoard={() => setIsCreateBoardOpen(true)}
        onOpenCreateCollection={() => setIsCreateCollectionOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isReadOnly={false}
        boardLastUpdated={{}}
        collectionLastUpdated={{}}
        onDropImageToBoard={handleDropImageToBoard}
        onMoveBoardToCollection={handleMoveBoardToCollection}
        onOpenSettings={() => setActiveModal('settings')}
        onClearSearch={() => setSearchTerm('')}
        onLogout={handleLogout} 
        onBulkPinToBoard={handleBulkPinToBoard}
        selectedImageIds={selectedIds}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 bg-black relative">
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-4 md:px-8 gap-4 flex-shrink-0 z-20 bg-black/80 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
            <div className={`relative flex-1 max-w-md group ${isMobileSearchOpen ? 'block absolute left-0 right-0 top-0 h-16 bg-slate-900 z-50 px-4 flex items-center' : 'hidden md:block'}`}>
              {isMobileSearchOpen && <button onClick={() => setIsMobileSearchOpen(false)} className="mr-3 text-slate-400"><ArrowLeft className="w-5 h-5" /></button>}
              <Search className="absolute left-3 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search..." className="w-full bg-slate-900 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/50 transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X className="w-3 h-3" /></button>}
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileSearchOpen(true)} className="md:hidden text-slate-400 p-2"><Search className="w-5 h-5" /></button>
             {!isSelectionMode ? (
                 <button onClick={() => { setIsSelectionMode(true); setSelectedIds(new Set()); }} className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-full transition-colors"><CheckSquare className="w-5 h-5" /></button>
             ) : (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in">
                    <span className="text-sm font-bold text-rose-500 mr-2">{selectedIds.size} Selected</span>
                    <button onClick={() => setBulkAction('board')} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors disabled:opacity-30"><FolderPlus className="w-5 h-5" /></button>
                    <button onClick={() => setBulkAction('tags')} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors disabled:opacity-30"><Hash className="w-5 h-5" /></button>
                    <button onClick={() => setBulkAction('location')} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors disabled:opacity-30"><MapPin className="w-5 h-5" /></button>
                    <button onClick={() => setBulkAction('group')} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors disabled:opacity-30"><Layers className="w-5 h-5" /></button>
                    <button onClick={() => setBulkAction('visibility')} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors disabled:opacity-30"><Eye className="w-5 h-5" /></button>
                    <button onClick={handleBulkDelete} disabled={selectedIds.size === 0} className="p-2 text-slate-400 hover:text-red-500 rounded-full transition-colors disabled:opacity-30"><Trash2 className="w-5 h-5" /></button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="ml-2 text-xs font-bold text-slate-500 hover:text-slate-300">Cancel</button>
                </div>
             )}
             <button onClick={() => setActiveModal('upload')} className="bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-full shadow-lg hover:scale-105 active:scale-95"><Plus className="w-5 h-5" /></button>
             <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 relative">
           <Outlet context={{ 
              searchTerm, 
              isSelectionMode, 
              selectedIds, 
              setSelectedIds,
              onOpenCreateBoard: () => setIsCreateBoardOpen(true),
              onOpenCreateCollection: () => setIsCreateCollectionOpen(true)
           }} />
        </div>
      </main>

      {activeImage && (
        <ImageDetailModal
          image={activeImage}
          boards={data.boards}
          onClose={handleCloseImageModal}
          onUpdate={data.updateImage}
          onTogglePin={handleTogglePin}
          groupImages={data.images} 
          onToggleFavorite={() => handleToggleFavorite(activeImage.id)}
          onSelectImage={(id) => {
             const newParams = new URLSearchParams(searchParams);
             newParams.set('pin', id);
             setSearchParams(newParams);
          }}
          onSetHero={handleSetGroupHero}
        />
      )}

      {/* --- MODALS (Stacked) --- */}
      {activeModal === 'upload' && user && (
        <UploadModal 
          onClose={() => setActiveModal(null)} 
          onUpload={handleUploadComplete} 
          ownerId={user.id} 
          boards={data.boards}
          // Fix: Open CreateBoard without closing UploadModal
          onCreateBoard={() => setIsCreateBoardOpen(true)} 
        />
      )}
      
      {/* Create Board Modal (Can overlay Upload Modal) */}
      {isCreateBoardOpen && (
        <CreateBoardModal 
          onClose={() => setIsCreateBoardOpen(false)} 
          onCreate={async (name, desc, vis) => { 
             await data.addBoard({ id: crypto.randomUUID(), name, description: desc, visibility: vis, ownerId: user!.id, createdAt: Date.now(), collectionIds: [] }); 
             setIsCreateBoardOpen(false); 
          }} 
        />
      )}

      {isCreateCollectionOpen && (
        <CreateCollectionModal 
          onClose={() => setIsCreateCollectionOpen(false)} 
          onCreate={async (name) => { 
             await data.addCollection({ id: crypto.randomUUID(), name, ownerId: user!.id, createdAt: Date.now() }); 
             setIsCreateCollectionOpen(false); 
          }} 
        />
      )}

      {bulkAction && <BulkActionModal action={bulkAction} count={selectedIds.size} onClose={() => setBulkAction(null)} onSubmit={executeBulkAction} boards={data.boards} onCreateBoard={() => setIsCreateBoardOpen(true)} />}
      {activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} onDataImported={() => data.refreshData()} />}
    </div>
  );
};