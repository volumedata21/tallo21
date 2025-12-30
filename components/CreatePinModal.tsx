import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Layers, MapPin, Loader, Plus, Search, Tag as TagIcon, Check, Link, Globe, ArrowRight, Camera } from 'lucide-react';
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

  // Clear state when modal is closed
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

  // Handlers
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const defaultBoardId = getDefaultBoardId();

      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDrafts(prev => {
             const draft: DraftPin = {
               id: Math.random().toString(36),
               file,
               previewUrl: reader.result as string,
               title: '',
               description: '',
               boardIds: defaultBoardId ? [defaultBoardId] : [], 
               tags: [],
               link: ''
             };
             if (prev.length === 0) setSelectedDraftId(draft.id);
             return [...prev, draft];
          });
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
        if (syncChanges) {
             return { ...d, ...updates };
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

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    const newBoard = dataService.createBoard(newBoardName, undefined, userId);
    updateDraft({ boardIds: [newBoard.id] });
    setNewBoardName('');
    setIsCreatingBoard(false);
    onCreated();
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    validDrafts.forEach(d => {
      dataService.addPin({
        title: d.title || 'Untitled',
        description: d.description,
        imageUrl: d.previewUrl,
        boardIds: d.boardIds,
        ownerId: userId,
        aspectRatio: '1:1',
        location: d.location,
        tags: d.tags,
        link: dataService.sanitizeUrl(d.link || '')
      });
    });

    setIsLoading(false);
    onCreated();
    onClose();
    setDrafts([]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div 
        className="bg-[#050505] w-full h-full sm:max-w-6xl sm:h-[85vh] sm:rounded-2xl border-slate-800 sm:border shadow-2xl flex flex-col overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#050505] shrink-0">
           <h2 className="font-bold text-white text-lg flex items-center gap-2">
               Create Pins
               {drafts.length > 1 && (
                   <span className="text-xs font-normal bg-slate-800 px-2 py-1 rounded text-slate-400">
                       {drafts.length} files
                   </span>
               )}
           </h2>
           <button onClick={onClose}><X className="text-slate-400 hover:text-white" /></button>
        </div>

        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            
            {/* Drafts List - Mobile: Top Strip, Desktop: Sidebar */}
            {drafts.length > 0 && (
              <>
                {/* Desktop Sidebar */}
                <div className="hidden md:flex w-64 border-r border-slate-800 bg-slate-950/50 flex-col shrink-0">
                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                      {drafts.map(draft => (
                          <div 
                            key={draft.id} 
                            onClick={() => { setSelectedDraftId(draft.id); setIsImportMode(false); }}
                            className={`relative group rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedDraftId === draft.id && !isImportMode ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                          >
                            <div className="aspect-square bg-slate-900">
                                <img src={draft.previewUrl} className="w-full h-full object-cover" />
                            </div>
                            <button onClick={(e) => removeDraft(draft.id, e)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-teal-600 transition-all">
                              <X size={12} />
                            </button>
                          </div>
                      ))}
                      
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 hover:text-teal-500 hover:border-teal-500 hover:bg-slate-900 gap-1">
                              <Upload size={20} /> <span className="text-[10px] font-medium">Upload</span>
                          </button>
                          <button onClick={() => { setIsImportMode(true); setSelectedDraftId(null); }} className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 ${isImportMode ? 'border-teal-500 text-teal-500 bg-slate-900' : 'border-slate-700 text-slate-500 hover:text-teal-500 hover:border-teal-500 hover:bg-slate-900'}`}>
                              <Link size={20} /> <span className="text-[10px] font-medium">URL</span>
                          </button>
                      </div>
                  </div>
                </div>

                {/* Mobile Top Strip */}
                <div className="md:hidden flex items-center gap-2 p-3 bg-slate-900/50 border-b border-slate-800 overflow-x-auto shrink-0">
                    <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-slate-400 shrink-0">
                        <Plus size={20} />
                    </button>
                    {drafts.map(draft => (
                        <div 
                          key={draft.id} 
                          onClick={() => { setSelectedDraftId(draft.id); setIsImportMode(false); }}
                          className={`w-12 h-12 rounded-lg overflow-hidden cursor-pointer border shrink-0 ${selectedDraftId === draft.id && !isImportMode ? 'border-teal-500' : 'border-transparent opacity-60'}`}
                        >
                           <img src={draft.previewUrl} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
              </>
            )}

            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFiles} />
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFiles} />

            {/* Main Content */}
            <div className="flex-1 bg-[#050505] overflow-y-auto relative">
               {isImportMode ? (
                   <div className="h-full flex flex-col p-4 md:p-12">
                       <div className="max-w-2xl mx-auto w-full">
                           <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-3">
                               <Globe className="text-teal-500" /> Import from Web
                           </h2>
                           <form onSubmit={handleUrlScrape} className="relative mb-6 md:mb-8">
                               <input 
                                   autoFocus
                                   value={urlInput}
                                   onChange={e => setUrlInput(e.target.value)}
                                   placeholder="Paste a link..."
                                   className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-5 pr-20 py-3 md:py-4 text-white focus:border-teal-600 outline-none text-base md:text-lg"
                               />
                               <button type="submit" disabled={isScraping || !urlInput.trim()} className="absolute right-2 top-2 bottom-2 px-4 bg-slate-800 hover:bg-teal-600 text-white rounded-lg transition flex items-center justify-center">
                                   {isScraping ? <Loader className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                               </button>
                           </form>

                           {/* Scrape Results Grid */}
                           {scrapedImages.length > 0 && (
                               <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 mb-20">
                                   {scrapedImages.map((img, i) => (
                                       <div key={i} onClick={() => toggleScrapedImage(img)} className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 relative ${selectedScrapedImages.includes(img) ? 'border-teal-500' : 'border-transparent'}`}>
                                           <img src={img} className="w-full h-full object-cover" />
                                           {selectedScrapedImages.includes(img) && <div className="absolute top-1 right-1 bg-teal-500 text-white rounded-full p-0.5"><Check size={12} /></div>}
                                       </div>
                                   ))}
                               </div>
                           )}

                           {/* Sticky Action Button for Scrape */}
                           {scrapedImages.length > 0 && (
                               <div className="fixed bottom-4 left-4 right-4 md:absolute md:bottom-0 md:left-0 md:right-0 flex justify-center p-4 bg-gradient-to-t from-black to-transparent pointer-events-none">
                                   <button 
                                      onClick={addScrapedImagesToDrafts}
                                      disabled={selectedScrapedImages.length === 0}
                                      className="pointer-events-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-full shadow-lg flex items-center gap-2"
                                   >
                                       Add {selectedScrapedImages.length} Images
                                   </button>
                               </div>
                           )}
                       </div>
                   </div>
               ) : drafts.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6">
                       <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                           <Upload size={32} className="text-slate-600 md:hidden" />
                           <Upload size={40} className="text-slate-600 hidden md:block" />
                       </div>
                       <h3 className="text-xl font-bold text-white mb-2">Start creating</h3>
                       <p className="mb-8 text-center text-sm max-w-xs">Upload photos, take a picture, or import from the web.</p>
                       
                       <div className="flex flex-col gap-3 w-full max-w-xs">
                           <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-teal-600 text-white font-bold rounded-full hover:bg-teal-700 transition flex items-center justify-center gap-2">
                               <Upload size={18} /> Upload Files
                           </button>
                           <button onClick={() => cameraInputRef.current?.click()} className="w-full py-3 bg-slate-800 text-white font-bold rounded-full hover:bg-slate-700 transition flex items-center justify-center gap-2">
                               <Camera size={18} /> Take Photo
                           </button>
                           <button onClick={() => setIsImportMode(true)} className="w-full py-3 bg-slate-800 text-white font-bold rounded-full hover:bg-slate-700 transition flex items-center justify-center gap-2">
                               <Globe size={18} /> Import URL
                           </button>
                       </div>
                   </div>
               ) : currentDraft ? (
                   <div className="flex flex-col md:flex-row h-full">
                       {/* Preview */}
                       <div className="w-full md:w-5/12 bg-black flex items-center justify-center p-4 relative shrink-0 min-h-[300px] md:min-h-0">
                           <img src={currentDraft.previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                           
                           {/* Bulk Edit Toggle Overlay */}
                           {drafts.length > 1 && (
                               <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl z-10 whitespace-nowrap">
                                   <span className="text-xs font-semibold text-slate-300">Apply to all</span>
                                   <button 
                                      onClick={() => setSyncChanges(!syncChanges)}
                                      className={`w-10 h-5 rounded-full relative transition-colors ${syncChanges ? 'bg-teal-600' : 'bg-slate-600'}`}
                                   >
                                       <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${syncChanges ? 'left-6' : 'left-1'}`} />
                                   </button>
                               </div>
                           )}
                       </div>

                       {/* Fields */}
                       <div className="w-full md:w-7/12 p-4 md:p-6 space-y-6 overflow-y-auto pb-24 md:pb-6">
                           {/* Board */}
                           <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Board</label>
                                {isCreatingBoard ? (
                                    <div className="flex gap-2">
                                        <input autoFocus value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="New board name..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-teal-600" />
                                        <button onClick={handleCreateBoard} className="px-3 bg-teal-600 text-white rounded-lg font-bold text-xs">Create</button>
                                        <button onClick={() => setIsCreatingBoard(false)} className="px-3 bg-slate-800 text-white rounded-lg font-bold text-xs">Cancel</button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select 
                                            value={currentDraft.boardIds[0] || ''}
                                            onChange={(e) => { if (e.target.value === 'NEW') setIsCreatingBoard(true); else updateDraft({ boardIds: [e.target.value] }); }}
                                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-3 pr-10 py-3 outline-none focus:border-teal-600 appearance-none text-sm"
                                        >
                                            <option value="" disabled>Select a board</option>
                                            <option value="NEW" className="text-teal-400 font-bold">+ Create New Board</option>
                                            {collections.map(col => (
                                                <optgroup key={col.id} label={col.title}>
                                                    {boards.filter(b => b.collectionId === col.id).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                                </optgroup>
                                            ))}
                                            <optgroup label="New Boards">
                                                {boards.filter(b => !b.collectionId).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                            </optgroup>
                                        </select>
                                        <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                    </div>
                                )}
                           </div>

                           <div className="space-y-4">
                               <input value={currentDraft.title} onChange={e => updateDraft({ title: e.target.value })} placeholder="Title" className="w-full bg-transparent border-b border-slate-700 py-2 text-xl font-bold text-white placeholder-slate-600 focus:border-teal-600 outline-none" />
                               <textarea value={currentDraft.description} onChange={e => updateDraft({ description: e.target.value })} placeholder="Description" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm focus:border-teal-600 outline-none h-20 resize-none" />
                               <div className="relative">
                                  <input value={currentDraft.link || ''} onChange={e => updateDraft({ link: e.target.value })} placeholder="Website Link" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white outline-none focus:border-teal-600 text-sm" />
                                  <Link className="absolute left-3 top-2.5 text-slate-500" size={14} />
                               </div>
                           </div>

                           <div>
                               <div className="flex flex-wrap gap-2 mb-2">
                                   {currentDraft.tags.map(tag => (
                                       <span key={tag} className="bg-teal-500/10 text-teal-400 px-2 py-1 rounded text-xs flex items-center gap-1">
                                           #{tag} <button onClick={() => removeTag(tag)}><X size={10} /></button>
                                       </span>
                                   ))}
                               </div>
                               <div className="relative">
                                   <TagIcon className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                   <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Tags (Enter)" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white outline-none focus:border-teal-600 text-sm" />
                               </div>
                           </div>
                       </div>
                   </div>
               ) : null}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#050505] border-t border-slate-800 flex justify-end gap-3 shrink-0">
             <div className="text-xs text-slate-500 flex items-center mr-auto hidden md:flex">
                 {drafts.filter(d => d.boardIds.length > 0).length} / {drafts.length} ready
             </div>
             <button 
                onClick={handlePublishAll}
                disabled={isLoading || drafts.length === 0 || drafts.filter(d => d.boardIds.length > 0).length === 0}
                className="w-full md:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition shadow-lg flex items-center justify-center gap-2"
             >
                {isLoading ? <Loader className="animate-spin" size={20} /> : 'Publish All'}
             </button>
        </div>
      </div>
    </div>
  );
};