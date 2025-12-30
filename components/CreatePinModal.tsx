import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Layers, MapPin, Loader, Plus, Search, Tag as TagIcon, Check, Link, Globe, ArrowRight, Camera, FileImage } from 'lucide-react';
import { Collection, Board, LocationData } from '../types';
import { dataService } from '../services/dataService';

interface CreatePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  boards: Board[];
  onCreated: () => void;
  userId: string;
}

interface DraftPin {
  id: string;
  file?: File;
  previewUrl: string;
  title: string;
  description: string;
  boardIds: string[];
  location?: LocationData;
  tags: string[];
  link?: string;
}

export const CreatePinModal: React.FC<CreatePinModalProps> = ({ isOpen, onClose, collections, boards, onCreated, userId }) => {
  // State
  const [drafts, setDrafts] = useState<DraftPin[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  
  // URL Import State
  const [isImportMode, setIsImportMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [selectedScrapedImages, setSelectedScrapedImages] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  // Bulk Edit Toggle
  const [syncChanges, setSyncChanges] = useState(true);

  // Search State
  const [locationQuery, setLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<LocationData[]>([]);

  // Tag State
  const [tagInput, setTagInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
        setDrafts([]);
        setSelectedDraftId(null);
        setTagInput('');
        setLocationQuery('');
        setLocationResults([]);
        resetUrlImport();
        setIsImportMode(false);
    }
  }, [isOpen]);

  const resetUrlImport = () => {
      setUrlInput('');
      setScrapedImages([]);
      setSelectedScrapedImages([]);
      setScrapeError('');
  };

  if (!isOpen) return null;

  const currentDraft = drafts.find(d => d.id === selectedDraftId);

  // Helper to get default board
  const getDefaultBoardId = () => {
    const moodboard = boards.find(b => b.title === 'Moodboard') || boards.find(b => !b.collectionId) || boards[0];
    return moodboard ? moodboard.id : '';
  };

  // Handlers - FIXED SELECTION LOGIC
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const defaultBoardId = getDefaultBoardId();
      const newDrafts: DraftPin[] = [];
      let processed = 0;

      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
             newDrafts.push({
               id: Math.random().toString(36),
               file, 
               previewUrl: reader.result as string,
               title: file.name.split('.')[0], 
               description: '',
               boardIds: defaultBoardId ? [defaultBoardId] : [], 
               tags: [],
               link: ''
             });
             processed++;
             
             // Wait for all to process then set state once
             if (processed === files.length) {
                 setDrafts(prev => {
                     const combined = [...prev, ...newDrafts];
                     // Select first if none selected
                     if (!selectedDraftId && combined.length > 0) {
                         setSelectedDraftId(combined[0].id);
                     }
                     return combined;
                 });
             }
        };
        reader.readAsDataURL(file);
      });
      setIsImportMode(false);
    }
  };

  const handleUrlScrape = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!urlInput.trim()) return;

      const sanitized = dataService.sanitizeUrl(urlInput);
      if (!sanitized) {
          setScrapeError('Invalid URL');
          return;
      }

      setIsScraping(true);
      setScrapeError('');
      setScrapedImages([]);
      
      try {
          // Uses the new server endpoint
          const images = await dataService.getImagesFromUrl(sanitized);
          if (images.length === 0) {
              setScrapeError('No images found at this URL.');
          } else if (images.length === 1) {
              addUrlToDrafts(images[0], sanitized);
              resetUrlImport();
          } else {
              setScrapedImages(images);
          }
      } catch (err) {
          setScrapeError('Failed to fetch URL.');
      } finally {
          setIsScraping(false);
      }
  };

  const toggleScrapedImage = (img: string) => {
      setSelectedScrapedImages(prev => 
          prev.includes(img) ? prev.filter(i => i !== img) : [...prev, img]
      );
  };

  const addScrapedImagesToDrafts = () => {
      const sourceUrl = dataService.sanitizeUrl(urlInput);
      selectedScrapedImages.forEach(img => addUrlToDrafts(img, sourceUrl));
      resetUrlImport();
      setIsImportMode(false);
  };

  const addUrlToDrafts = (url: string, sourceLink: string = '') => {
      const defaultBoardId = getDefaultBoardId();
      setDrafts(prev => {
         const draft: DraftPin = {
           id: Math.random().toString(36),
           previewUrl: url,
           title: '',
           description: '',
           boardIds: defaultBoardId ? [defaultBoardId] : [], 
           tags: [],
           link: sourceLink
         };
         if (prev.length === 0) setSelectedDraftId(draft.id);
         return [...prev, draft];
      });
  };

  const updateDraft = (updates: Partial<DraftPin>) => {
    if (!selectedDraftId) return;
    setDrafts(prev => prev.map(d => {
        if (syncChanges && drafts.length > 1) {
             const syncKeys = ['boardIds', 'tags', 'location', 'link'];
             const shouldSync = Object.keys(updates).some(k => syncKeys.includes(k));
             if (shouldSync) return { ...d, ...updates };
             return d.id === selectedDraftId ? { ...d, ...updates } : d;
        } else {
             return d.id === selectedDraftId ? { ...d, ...updates } : d;
        }
    }));
  };

  const removeDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrafts(prev => {
      const remaining = prev.filter(d => d.id !== id);
      if (selectedDraftId === id && remaining.length > 0) {
        setSelectedDraftId(remaining[0].id);
      } else if (remaining.length === 0) {
        setSelectedDraftId(null);
      }
      return remaining;
    });
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    try {
        const newBoard = await dataService.createBoard(newBoardName, undefined, userId);
        updateDraft({ boardIds: [newBoard.id] });
        setNewBoardName('');
        setIsCreatingBoard(false);
        onCreated(); 
    } catch (e) {
        console.error("Failed to create board", e);
    }
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    setIsSearchingLocation(true);
    const results = await dataService.searchLocation(locationQuery);
    setIsSearchingLocation(false);
    setLocationResults(results);
  };

  const selectLocation = (loc: LocationData) => {
      updateDraft({ location: loc });
      setLocationQuery('');
      setLocationResults([]);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTags = tagInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      if (currentDraft && newTags.length > 0) {
          const updatedTags = [...new Set([...currentDraft.tags, ...newTags])];
          updateDraft({ tags: updatedTags });
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    if (currentDraft) {
      updateDraft({ tags: currentDraft.tags.filter(t => t !== tag) });
    }
  };

  const handlePublishAll = async () => {
    const validDrafts = drafts.filter(d => d.boardIds.length > 0 && d.previewUrl);
    if (validDrafts.length === 0) return;

    setIsLoading(true);
    
    for (const d of validDrafts) {
        let finalImageUrl = d.previewUrl;
        if (d.file) {
            try {
                finalImageUrl = await dataService.uploadImage(d.file);
            } catch (err) { continue; }
        }

        await dataService.addPin({
            title: d.title || 'Untitled',
            description: d.description,
            imageUrl: finalImageUrl, 
            boardIds: d.boardIds,
            ownerId: userId,
            aspectRatio: '1:1',
            location: d.location,
            tags: d.tags,
            link: dataService.sanitizeUrl(d.link || '')
        });
    }

    setIsLoading(false);
    onCreated();
    onClose();
    setDrafts([]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm sm:p-4 md:p-8" onClick={onClose}>
      <div 
        className="bg-[#050505] w-full h-full sm:max-w-7xl sm:h-[90vh] sm:rounded-3xl border-slate-800 sm:border shadow-2xl flex flex-col overflow-hidden transition-all" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-[#050505] shrink-0">
           <h2 className="font-bold text-white text-lg flex items-center gap-3">
               Create Pins
               {drafts.length > 1 && (
                   <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2 py-1 rounded-full border border-slate-700">
                       {drafts.length} files
                   </span>
               )}
           </h2>
           <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full transition-colors"><X className="text-slate-400 hover:text-white" /></button>
        </div>

        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            
            {/* Drafts List - Desktop Sidebar */}
            {drafts.length > 0 && (
              <>
                <div className="hidden md:flex w-20 lg:w-64 border-r border-slate-800 bg-slate-950/30 flex-col shrink-0">
                  <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                      {drafts.map(draft => (
                          <div 
                            key={draft.id} 
                            onClick={() => { setSelectedDraftId(draft.id); setIsImportMode(false); }}
                            className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 shadow-sm ${selectedDraftId === draft.id && !isImportMode ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                          >
                            <div className="aspect-square bg-slate-900 relative">
                                <img src={draft.previewUrl} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </div>
                            
                            <div className="hidden lg:block p-3 bg-slate-900">
                                <div className="text-sm font-medium text-white truncate">{draft.title || 'Untitled'}</div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">{draft.boardIds.length > 0 ? 'Board selected' : 'No board'}</div>
                            </div>

                            <button onClick={(e) => removeDraft(draft.id, e)} className="absolute top-1 right-1 p-1 bg-black/60 backdrop-blur text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10">
                              <X size={12} />
                            </button>
                          </div>
                      ))}
                      
                      <div className="grid grid-cols-1 gap-2 pt-2">
                          <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-teal-500 hover:bg-teal-500/10 transition-all gap-2 group">
                              <Upload size={18} className="group-hover:scale-110 transition-transform" /> 
                              <span className="text-xs font-bold hidden lg:inline">Upload</span>
                          </button>
                          <button onClick={() => { setIsImportMode(true); setSelectedDraftId(null); }} className={`p-3 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-all ${isImportMode ? 'border-teal-500 text-teal-400 bg-teal-500/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-teal-500 hover:bg-teal-500/10'}`}>
                              <Globe size={18} /> 
                              <span className="text-xs font-bold hidden lg:inline">URL</span>
                          </button>
                      </div>
                  </div>
                </div>

                {/* Mobile Top Strip */}
                <div className="md:hidden flex items-center gap-3 p-3 bg-slate-900/50 border-b border-slate-800 overflow-x-auto shrink-0 no-scrollbar">
                    <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-xl border border-dashed border-slate-600 flex items-center justify-center text-slate-400 shrink-0">
                        <Plus size={24} />
                    </button>
                    {drafts.map(draft => (
                        <div 
                          key={draft.id} 
                          onClick={() => { setSelectedDraftId(draft.id); setIsImportMode(false); }}
                          className={`w-14 h-14 rounded-xl overflow-hidden cursor-pointer border-2 shrink-0 ${selectedDraftId === draft.id && !isImportMode ? 'border-teal-500' : 'border-transparent opacity-70'}`}
                        >
                           <img src={draft.previewUrl} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
              </>
            )}

            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFiles} />
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFiles} />

            {/* Main Content Area */}
            <div className="flex-1 bg-[#050505] overflow-y-auto relative custom-scrollbar">
               {isImportMode ? (
                   // URL IMPORT VIEW
                   <div className="h-full flex flex-col p-6 md:p-12 items-center">
                       <div className="max-w-3xl w-full">
                           <div className="mb-8 text-center">
                               <div className="w-16 h-16 bg-teal-500/10 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <Globe size={32} />
                               </div>
                               <h2 className="text-2xl font-bold text-white mb-2">Import from Web</h2>
                               <p className="text-slate-400">Paste a link to grab images automatically.</p>
                           </div>

                           <form onSubmit={handleUrlScrape} className="relative mb-10">
                               <input 
                                   autoFocus
                                   value={urlInput}
                                   onChange={e => setUrlInput(e.target.value)}
                                   placeholder="https://..."
                                   className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-6 pr-24 py-4 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-lg transition-all"
                               />
                               <button type="submit" disabled={isScraping || !urlInput.trim()} className="absolute right-2 top-2 bottom-2 px-6 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition flex items-center justify-center font-bold">
                                   {isScraping ? <Loader className="animate-spin" size={20} /> : <ArrowRight size={24} />}
                               </button>
                           </form>

                           {scrapeError && (
                               <div className="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl mb-6 text-center text-sm font-medium border border-red-500/20">
                                   {scrapeError}
                               </div>
                           )}

                           {scrapedImages.length > 0 && (
                               <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-24 animate-in fade-in slide-in-from-bottom-4">
                                   {scrapedImages.map((img, i) => (
                                       <div key={i} onClick={() => toggleScrapedImage(img)} className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 relative group transition-all ${selectedScrapedImages.includes(img) ? 'border-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.2)]' : 'border-transparent hover:border-slate-700'}`}>
                                           <img src={img} className="w-full h-full object-cover" />
                                           <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${selectedScrapedImages.includes(img) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                {selectedScrapedImages.includes(img) && <div className="bg-teal-500 text-white rounded-full p-1"><Check size={16} /></div>}
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           )}

                           {scrapedImages.length > 0 && (
                               <div className="fixed bottom-0 left-0 right-0 md:absolute flex justify-center p-6 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
                                   <button 
                                      onClick={addScrapedImagesToDrafts}
                                      disabled={selectedScrapedImages.length === 0}
                                      className="pointer-events-auto px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-full shadow-2xl shadow-teal-900/50 flex items-center gap-3 transform hover:scale-105 transition-all"
                                   >
                                       <span>Add {selectedScrapedImages.length} Images</span>
                                       <ArrowRight size={20} />
                                   </button>
                               </div>
                           )}
                       </div>
                   </div>
               ) : drafts.length === 0 ? (
                   // EMPTY STATE VIEW
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 animate-in fade-in zoom-in-95 duration-300">
                       <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-slate-800 rotate-3">
                           <FileImage size={48} className="text-slate-600" />
                       </div>
                       <h3 className="text-3xl font-bold text-white mb-3">Create New Stem</h3>
                       <p className="mb-10 text-center text-slate-400 max-w-sm leading-relaxed">
                           Upload photos from your device or import them directly from any website.
                       </p>
                       
                       <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                           <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-2xl transition shadow-lg shadow-teal-900/20 flex items-center justify-center gap-3 group">
                               <Upload size={20} className="group-hover:-translate-y-1 transition-transform" /> Upload File
                           </button>
                           <button onClick={() => setIsImportMode(true)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-3 group">
                               <Globe size={20} className="group-hover:rotate-12 transition-transform" /> Import URL
                           </button>
                       </div>
                       <button onClick={() => cameraInputRef.current?.click()} className="mt-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-2 transition-colors">
                           <Camera size={16} /> Take a photo instead
                       </button>
                   </div>
               ) : currentDraft ? (
                   // ACTIVE DRAFT EDIT VIEW
                   <div className="flex flex-col md:flex-row h-full">
                       {/* Preview - LEFT SIDE (50%) */}
                       <div className="w-full md:w-1/2 bg-black/50 flex items-center justify-center p-8 relative shrink-0 min-h-[300px] border-b md:border-b-0 md:border-r border-slate-800">
                           <img src={currentDraft.previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                           
                           {/* Bulk Edit Toggle */}
                           {drafts.length > 1 && (
                               <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-md border border-slate-700 rounded-full pl-4 pr-1 py-1.5 flex items-center gap-3 shadow-xl z-10 whitespace-nowrap">
                                   <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Sync Info</span>
                                   <button 
                                      onClick={() => setSyncChanges(!syncChanges)}
                                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${syncChanges ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                                   >
                                       {syncChanges ? 'ON' : 'OFF'}
                                   </button>
                               </div>
                           )}
                       </div>

                       {/* Fields - RIGHT SIDE (50%) */}
                       <div className="w-full md:w-1/2 flex flex-col h-full bg-[#050505]">
                           <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                               {/* Board Selection */}
                               <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                        <Layers size={14} /> Saved to Board
                                    </label>
                                    {isCreatingBoard ? (
                                        <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                                            <input autoFocus value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="New board name..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-600 transition-colors" />
                                            <button onClick={handleCreateBoard} className="px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition-colors">Create</button>
                                            <button onClick={() => setIsCreatingBoard(false)} className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors">Cancel</button>
                                        </div>
                                    ) : (
                                        <div className="relative group">
                                            <select 
                                                value={currentDraft.boardIds[0] || ''}
                                                onChange={(e) => { if (e.target.value === 'NEW') setIsCreatingBoard(true); else updateDraft({ boardIds: [e.target.value] }); }}
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-4 pr-10 py-3.5 outline-none focus:border-teal-600 appearance-none text-sm font-medium transition-colors cursor-pointer hover:bg-slate-800"
                                            >
                                                <option value="" disabled>Select a board</option>
                                                <option value="NEW" className="text-teal-400 font-bold bg-slate-900">+ Create New Board</option>
                                                {collections.map(col => (
                                                    <optgroup key={col.id} label={col.title} className="bg-slate-900">
                                                        {boards.filter(b => b.collectionId === col.id).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                                    </optgroup>
                                                ))}
                                                <optgroup label="Unorganized" className="bg-slate-900">
                                                    {boards.filter(b => !b.collectionId).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                                </optgroup>
                                            </select>
                                            <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-white transition-colors" size={16} />
                                        </div>
                                    )}
                               </div>

                               {/* Core Details */}
                               <div className="space-y-6">
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                                       <input 
                                           value={currentDraft.title} 
                                           onChange={e => updateDraft({ title: e.target.value })} 
                                           placeholder="Add a title" 
                                           className="w-full bg-transparent border-b-2 border-slate-800 py-2 text-2xl font-bold text-white placeholder-slate-700 focus:border-teal-600 outline-none transition-colors" 
                                       />
                                   </div>
                                   
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                       <textarea 
                                           value={currentDraft.description} 
                                           onChange={e => updateDraft({ description: e.target.value })} 
                                           placeholder="What is this pin about?" 
                                           className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm focus:border-teal-600 focus:bg-slate-900 outline-none h-24 resize-none transition-all" 
                                       />
                                   </div>

                                   <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider"><Link size={14} /> Website</label>
                                       <div className="relative">
                                          <input value={currentDraft.link || ''} onChange={e => updateDraft({ link: e.target.value })} placeholder="Add a destination link" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-600 text-sm transition-colors" />
                                       </div>
                                   </div>
                               </div>

                               {/* Location - RESTORED & INSERTED HERE */}
                               <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                        <MapPin size={14} /> Location
                                    </label>
                                    {currentDraft.location ? (
                                        <div className="flex items-center justify-between bg-slate-900 border border-teal-500/50 p-3 rounded-lg">
                                            <div className="flex items-center gap-2 text-teal-400">
                                                <MapPin size={16} />
                                                <span className="font-medium text-sm">{currentDraft.location.name}</span>
                                            </div>
                                            <button onClick={() => updateDraft({ location: undefined })} className="p-1 hover:text-white text-slate-500"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="flex gap-2">
                                                <input value={locationQuery} onChange={e => setLocationQuery(e.target.value)} placeholder="Search city or place..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-600 text-sm transition-colors" />
                                                <button onClick={handleLocationSearch} disabled={isSearchingLocation} className="px-3 bg-slate-800 text-white rounded-xl"><Search size={16} /></button>
                                            </div>
                                            {locationResults.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                                    {locationResults.map((loc, i) => (
                                                        <button key={i} onClick={() => selectLocation(loc)} className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800/50 text-sm text-slate-300">
                                                            {loc.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                               </div>

                               {/* Tags & Metadata */}
                               <div>
                                   <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                        <TagIcon size={14} /> Tags
                                   </label>
                                   <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 focus-within:border-teal-600 transition-colors">
                                       <div className="flex flex-wrap gap-2 mb-2 px-2">
                                           {currentDraft.tags.map(tag => (
                                               <span key={tag} className="bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                                   #{tag} <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={12} /></button>
                                               </span>
                                           ))}
                                       </div>
                                       <input 
                                           value={tagInput} 
                                           onChange={e => setTagInput(e.target.value)} 
                                           onKeyDown={handleAddTag} 
                                           placeholder={currentDraft.tags.length > 0 ? "Add more..." : "Add tags (press Enter)..."} 
                                           className="w-full bg-transparent px-2 py-1 text-white outline-none text-sm placeholder-slate-600" 
                                       />
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>
               ) : null}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:px-8 md:py-5 bg-[#050505] border-t border-slate-800 flex justify-end gap-4 shrink-0 z-20">
             {drafts.length > 0 && (
                 <div className="hidden md:flex flex-col justify-center mr-auto">
                     <div className="text-sm font-bold text-white">
                         {drafts.filter(d => d.boardIds.length > 0).length} of {drafts.length} ready
                     </div>
                     <div className="text-xs text-slate-500">
                         {drafts.some(d => d.boardIds.length === 0) ? 'Some items need a board assigned' : 'All set to publish'}
                     </div>
                 </div>
             )}
             
             {drafts.length > 0 && (
                 <>
                    <button 
                        onClick={() => setDrafts([])} 
                        className="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors"
                    >
                        Discard
                    </button>
                    <button 
                        onClick={handlePublishAll}
                        disabled={isLoading || drafts.length === 0 || drafts.filter(d => d.boardIds.length > 0).length === 0}
                        className="w-full md:w-auto px-8 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader className="animate-spin" size={20} /> : 'Publish All'}
                    </button>
                 </>
             )}
        </div>
      </div>
    </div>
  );
};