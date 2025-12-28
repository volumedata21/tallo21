
import React, { useState, useMemo } from 'react';
import { PinnedImage, Board, DiscoverySource, GridItem } from '../../shared/types';
import MasonryGrid from './MasonryGrid';
import ManageSourcesModal from './ManageSourcesModal';
import { Sparkles, Settings2, RefreshCw, Filter } from 'lucide-react';

interface DiscoveryViewProps {
  sources: DiscoverySource[];
  onAddSource: (url: string, name: string) => Promise<void>;
  onRemoveSource: (id: string) => void;
  boards: Board[];
  onPinToBoard: (imageId: string, boardId: string) => void;
  onToggleFavorite: (imageId: string) => void;
  items: PinnedImage[];
  onRefresh: () => void;
  isLoading: boolean;
}

const DiscoveryView: React.FC<DiscoveryViewProps> = ({ 
  sources, onAddSource, onRemoveSource, boards, onPinToBoard, onToggleFavorite, items, onRefresh, isLoading
}) => {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string>('all');

  // Filter items based on the source name stored in the description or via mapping
  // Since we stored source.name in item.description in discoveryService, we can use that,
  // OR strictly match by logic if we had sourceId on items. 
  // For now, let's filter by checking if the item description contains the source name.
  
  const filteredItems = useMemo(() => {
    if (activeFilterId === 'all') return items;
    const source = sources.find(s => s.id === activeFilterId);
    if (!source) return items;
    
    // In discoveryService we did: description: `Via ${source.name}`
    return items.filter(item => item.description.includes(source.name));
  }, [items, activeFilterId, sources]);

  // Transform to GridItems
  const gridItems: GridItem[] = filteredItems.map(img => ({ type: 'image', data: img }));

  const handleExternalClick = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item && item.sourceUrl) {
      window.open(item.sourceUrl, '_blank');
    }
  };

  const noOp = () => {};

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col flex-shrink-0 gap-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-rose-500" />
              Discovery
            </h1>
            <p className="text-slate-400 text-sm mt-1">Fresh inspiration from your subscribed feeds.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button 
              onClick={() => setIsManageOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-rose-900/20"
            >
              <Settings2 className="w-4 h-4" />
              Manage Sources
            </button>
          </div>
        </div>

        {/* Source Filters */}
        {sources.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0 mr-1" />
            <button
              onClick={() => setActiveFilterId('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeFilterId === 'all'
                  ? 'bg-slate-100 text-slate-900 border-slate-100'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
              }`}
            >
              All Feeds
            </button>
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => setActiveFilterId(source.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  activeFilterId === source.id
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                }`}
              >
                {source.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {sources.length === 0 ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
             <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
               <Sparkles className="w-8 h-8 opacity-50" />
             </div>
             <p className="text-lg font-medium">No feeds configured</p>
             <button onClick={() => setIsManageOpen(true)} className="mt-2 text-rose-500 hover:underline">Add a Source</button>
           </div>
        ) : gridItems.length === 0 && !isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
             <p>No items found in your feeds.</p>
           </div>
        ) : (
          <MasonryGrid 
            items={gridItems}
            onDelete={noOp} // Can't delete ephemeral items directly
            boards={boards}
            onTogglePin={onPinToBoard} 
            onUpdate={noOp}
            onImageClick={handleExternalClick} // Click opens URL directly for discovery items
            onToggleFavorite={onToggleFavorite}
            isSelectionMode={false}
          />
        )}
      </div>

      {isManageOpen && (
        <ManageSourcesModal 
          sources={sources}
          onAdd={onAddSource}
          onRemove={onRemoveSource}
          onClose={() => setIsManageOpen(false)}
        />
      )}
    </div>
  );
};

export default DiscoveryView;
