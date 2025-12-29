import React, { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom'; // Added useSearchParams
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import MasonryGrid from '../components/MasonryGrid';
import MapView from '../components/MapView';
import TrendingBar from '../components/TrendingBar';
import { PinnedImage, ViewType, GridItem } from '../../shared/types';
import { LayoutGrid, Map as MapIcon, Heart, Users, Shuffle, ArrowUpDown } from 'lucide-react';

interface DashboardPageProps {
  view: 'all' | 'community' | 'favorites';
}

interface OutletContextType {
  searchTerm: string;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ view }) => {
  const { images, boards, groups, updateImage, deleteImage, deleteGroup } = useData();
  const { user } = useAuth();
  
  // URL Params for Modal Navigation
  const [searchParams, setSearchParams] = useSearchParams();

  // Receive Search & Selection state from Layout
  const { searchTerm, isSelectionMode, selectedIds, setSelectedIds } = useOutletContext<OutletContextType>();

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [pinSort, setPinSort] = useState<'newest' | 'oldest'>('newest');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // --- Filtering Logic ---
  const displayImages = useMemo(() => {
    let imgs = images;

    // 1. Permission Filter
    imgs = imgs.filter(img => {
      const isOwner = user && (img.ownerId === user.id);
      const isPublic = img.visibility === 'public';
      return isOwner || isPublic;
    });

    // 2. View Filter
    if (view === 'favorites' && user) {
      imgs = imgs.filter(img => img.ownerId === user.id ? img.isFavorite : (img.likedBy || []).includes(user.id));
    } else if (view === 'community') {
      imgs = imgs.filter(img => img.visibility === 'public');
    }

    // 3. Search Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      imgs = imgs.filter(img =>
        img.title.toLowerCase().includes(lower) ||
        img.tags.some(t => t.toLowerCase().includes(lower)) ||
        (img.location && img.location.toLowerCase().includes(lower))
      );
    }
    
    // 4. Tag Filter
    if (filterTag) {
        imgs = imgs.filter(img => img.tags.some(t => t.toLowerCase() === filterTag));
    }

    return imgs;
  }, [images, user, view, searchTerm, filterTag]);

  // --- Trending Tags ---
  const trendingTags = useMemo(() => {
    if (view !== 'all' && view !== 'community') return [];
    const tagCounts: Record<string, number> = {};
    displayImages.forEach(img => {
       if (img.tags) img.tags.forEach(tag => {
          const normalized = tag.toLowerCase().trim();
          if (normalized) tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
       });
    });
    return Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 15).map(([tag]) => tag);
  }, [displayImages, view]);

  // --- Grid Item Construction ---
  const gridItems = useMemo(() => {
    const items: GridItem[] = [];
    const groupedIds = new Set<string>();

    if (view === 'all' && !searchTerm && !filterTag) {
      const relevantGroups = groups.filter(g => user && g.ownerId === user.id);
      relevantGroups.forEach(g => {
        const groupImgs = g.imageIds.map(id => images.find(i => i.id === id)).filter((i): i is PinnedImage => !!i);
        if (groupImgs.length) {
          items.push({ type: 'group', data: g, images: groupImgs });
          g.imageIds.forEach(id => groupedIds.add(id));
        }
      });
    }

    displayImages.forEach(img => {
      if (!groupedIds.has(img.id)) {
        items.push({ type: 'image', data: img });
      }
    });

    return items.sort((a, b) => {
      if (shuffleSeed > 0) {
        // Deterministic shuffle logic
        const idA = a.type === 'image' ? a.data.id : a.data.id;
        const idB = b.type === 'image' ? b.data.id : b.data.id;
        let hA = 0x811c9dc5, hB = 0x811c9dc5;
        for (let i = 0; i < idA.length; i++) hA = Math.imul(hA ^ idA.charCodeAt(i), 0x01000193);
        for (let i = 0; i < idB.length; i++) hB = Math.imul(hB ^ idB.charCodeAt(i), 0x01000193);
        return (hA >>> 0) - (hB >>> 0);
      }
      const timeA = a.type === 'image' ? a.data.createdAt : a.data.createdAt;
      const timeB = b.type === 'image' ? b.data.createdAt : b.data.createdAt;
      return pinSort === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [displayImages, groups, images, searchTerm, shuffleSeed, pinSort, view, filterTag, user]);

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            {view === 'favorites' && <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />}
            {view === 'community' && <Users className="w-6 h-6 text-blue-500" />}
            {view === 'all' && <LayoutGrid className="w-6 h-6 text-rose-500" />}
            <span>{view === 'all' ? 'My Tallos' : view === 'favorites' ? 'Favorites' : 'Community'}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto overflow-x-auto max-w-full pb-1 md:pb-0">
           <button onClick={() => setShuffleSeed(Math.random())} className="p-2 bg-slate-900 border border-slate-800 rounded-md text-slate-400 hover:text-slate-200">
             <Shuffle className="w-4 h-4" />
           </button>
           <button onClick={() => setPinSort(s => s === 'newest' ? 'oldest' : 'newest')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200">
             <ArrowUpDown className="w-3 h-3" />
             {pinSort === 'newest' ? 'Newest' : 'Oldest'}
           </button>
           <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-slate-800 text-rose-500' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-md ${viewMode === 'map' ? 'bg-slate-800 text-rose-500' : 'text-slate-400'}`}><MapIcon className="w-4 h-4" /></button>
           </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {viewMode === 'grid' ? (
          <>
            {(view === 'all' || view === 'community') && !searchTerm && (
              <TrendingBar tags={trendingTags} activeTag={filterTag} onTagClick={(t) => setFilterTag(t === filterTag ? null : t)} />
            )}
            <MasonryGrid 
              items={gridItems}
              onDelete={(id, isGroup) => isGroup ? deleteGroup(id) : deleteImage(id)}
              boards={boards}
              onTogglePin={() => {}} 
              onUpdate={updateImage}
              
              // --- FIXED: UPDATE URL TO OPEN MODAL ---
              onImageClick={(id) => {
                 setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.set('pin', id);
                    return next;
                 });
              }}
              // ---------------------------------------

              onToggleFavorite={async (id) => {
                 const img = images.find(i => i.id === id);
                 if (img) await updateImage({ ...img, isFavorite: !img.isFavorite });
              }}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onSelect={(id) => {
                 const newSet = new Set(selectedIds);
                 if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                 setSelectedIds(newSet);
              }}
            />
          </>
        ) : (
          <MapView 
            images={displayImages} 
            onImageClick={(id) => {
                 setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.set('pin', id);
                    return next;
                 });
            }} 
          />
        )}
      </div>
    </div>
  );
};