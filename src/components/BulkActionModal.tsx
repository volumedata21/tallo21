
import React, { useState } from 'react';
import { X, Search, Loader2, MapPin, Hash, FolderPlus, Check, Layers, Plus, Eye, Globe, Lock, Link as LinkIcon } from 'lucide-react';
import { Board, Visibility } from '../types';

interface BulkActionModalProps {
  action: 'board' | 'tags' | 'location' | 'group' | 'visibility';
  count: number;
  onClose: () => void;
  onSubmit: (data: any) => void;
  boards: Board[];
  onCreateBoard?: () => void;
}

interface LocationResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

const BulkActionModal: React.FC<BulkActionModalProps> = ({ action, count, onClose, onSubmit, boards, onCreateBoard }) => {
  const [tags, setTags] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  
  // Location State
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [locationStatus, setLocationStatus] = useState<'none' | 'found' | 'not-found'>('none');

  const handleLookupLocation = async () => {
    if (!location.trim()) return;
    setIsLocating(true);
    setLocationStatus('none');
    setSearchResults([]);
    setCoords(null);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
        headers: { 'User-Agent': 'TalloApp/1.0' }
      });
      const data: LocationResult[] = await res.json();
      
      if (data && data.length > 0) {
        setSearchResults(data.slice(0, 5));
      } else {
        setLocationStatus('not-found');
      }
    } catch (e) {
      console.error("Geocoding failed", e);
      setLocationStatus('not-found');
    } finally {
      setIsLocating(false);
    }
  };

  const selectLocation = (result: LocationResult) => {
    setCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setLocation(result.display_name.split(',')[0]);
    setLocationStatus('found');
    setSearchResults([]);
  };

  const handleSubmit = () => {
    if (action === 'board' && selectedBoardId) {
      onSubmit({ boardId: selectedBoardId });
    } else if (action === 'tags') {
      onSubmit({ tags: tags.split(',').map(t => t.trim()).filter(Boolean) });
    } else if (action === 'location' && coords) {
      onSubmit({ location, latitude: coords.lat, longitude: coords.lng });
    } else if (action === 'group') {
      onSubmit({ groupName: groupName.trim() });
    } else if (action === 'visibility') {
      onSubmit({ visibility });
    }
  };

  const isValid = () => {
    if (action === 'board') return !!selectedBoardId;
    if (action === 'tags') return tags.trim().length > 0;
    if (action === 'location') return !!coords;
    if (action === 'group') return groupName.trim().length > 0;
    if (action === 'visibility') return true;
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderContent = () => {
    switch (action) {
      case 'board':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Select a board to add {count} items to:</p>
            <div className="max-h-60 overflow-y-auto custom-scrollbar grid grid-cols-1 gap-2">
              {boards.map(board => (
                <button
                  key={board.id}
                  onClick={() => setSelectedBoardId(board.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    selectedBoardId === board.id 
                      ? 'bg-rose-950/20 border-rose-500 text-rose-500' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <span className="font-medium text-sm truncate">{board.name}</span>
                  {selectedBoardId === board.id && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              ))}
              {onCreateBoard && (
                <button
                  onClick={onCreateBoard}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-rose-400 hover:border-rose-900 hover:bg-slate-900/50 transition-all group"
                >
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-sm">Create New Board</span>
                </button>
              )}
            </div>
          </div>
        );
      case 'tags':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Add tags to {count} items (comma separated):</p>
            <input 
              type="text" 
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="architecture, nature, dark mode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-rose-500 outline-none transition-colors"
              autoFocus
            />
          </div>
        );
      case 'group':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Create a new group containing {count} items:</p>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group Name</label>
              <input 
                type="text" 
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., The Grill Photos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-rose-500 outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>
        );
      case 'visibility':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Set visibility for {count} items:</p>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['private', 'public', 'unlisted'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-md transition-all ${
                    visibility === v 
                      ? 'bg-slate-800 text-rose-500 shadow-sm ring-1 ring-slate-700' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v === 'private' && <Lock className="w-3 h-3" />}
                  {v === 'public' && <Globe className="w-3 h-3" />}
                  {v === 'unlisted' && <LinkIcon className="w-3 h-3" />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
              {visibility === 'private' && "Only you will be able to see these tallos."}
              {visibility === 'public' && "These tallos will be visible to everyone on this device/server."}
              {visibility === 'unlisted' && "Only people with the direct link can view these tallos."}
            </p>
          </div>
        );
      case 'location':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Set the same location for {count} items:</p>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setCoords(null);
                      setLocationStatus('none');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupLocation()}
                    placeholder="Search location..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:border-rose-500 outline-none transition-colors"
                    autoFocus
                  />
                  {isLocating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleLookupLocation}
                  disabled={isLocating || !location}
                  className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>

              {/* Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                  {searchResults.map((result) => (
                    <button
                      key={result.place_id}
                      onClick={() => selectLocation(result)}
                      className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700 last:border-0 flex items-start gap-2"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                      <span className="line-clamp-2">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {coords && (
                <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Location selected: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
                </div>
              )}
              {locationStatus === 'not-found' && (
                <div className="mt-2 text-xs text-red-500">Location not found. Try a broader search.</div>
              )}
            </div>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (action) {
      case 'board': return 'Add to Board';
      case 'tags': return 'Add Tags';
      case 'location': return 'Set Location';
      case 'group': return 'Create Group';
      case 'visibility': return 'Set Visibility';
    }
  };

  const getIcon = () => {
    switch (action) {
      case 'board': return <FolderPlus className="w-5 h-5 text-rose-500" />;
      case 'tags': return <Hash className="w-5 h-5 text-rose-500" />;
      case 'location': return <MapPin className="w-5 h-5 text-rose-500" />;
      case 'group': return <Layers className="w-5 h-5 text-rose-500" />;
      case 'visibility': return <Eye className="w-5 h-5 text-rose-500" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {renderContent()}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!isValid()}
            className="px-6 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-rose-900/20"
          >
            {action === 'group' ? 'Create Group' : `Apply to ${count} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionModal;
