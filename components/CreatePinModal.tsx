import React, { useState, useRef, useEffect } from 'react';
import { X, Layers, MapPin, Loader, Search, Check, Link as LinkIcon, ArrowRight, Image as ImageIcon, Grid, Type, Plus, Trash2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Collection, Board, LocationData } from '../types';
import { dataService } from '../services/dataService';

interface CreatePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections?: Collection[];
  boards?: Board[];
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

export const CreatePinModal: React.FC<CreatePinModalProps> = ({ 
  isOpen, 
  onClose, 
  collections = [], 
  boards = [],
  onCreated, 
  userId 
}) => {
  const [drafts, setDrafts] = useState<DraftPin[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');

  const [urlInput, setUrlInput] = useState('');
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [selectedScrapedImages, setSelectedScrapedImages] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapedTitle, setScrapedTitle] = useState(''); // Store title

  const [syncChanges, setSyncChanges] = useState(true);

  const [locationQuery, setLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<LocationData[]>([]);

  const [dragActive, setDragActive] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
        setDrafts([]);
        setSelectedDraftId(null);
        setTagInput('');
        setLocationQuery('');
        setLocationResults([]);
        resetUrlImport();
        setActiveTab('upload');
    }
  }, [isOpen]);

  const resetUrlImport = () => {
      setUrlInput('');
      setScrapedImages([]);
      setSelectedScrapedImages([]);
      setScrapeError('');
      setScrapedTitle('');
  };

  if (!isOpen) return null;

  const currentDraft = drafts.find(d => d.id === selectedDraftId);

  const getDefaultBoardId = () => {
    if (!boards || boards.length === 0) return '';
    const newStems = boards.find(b => b.title === 'New Stems');
    if (newStems) return newStems.id;
    const moodboard = boards.find(b => b.title === 'Moodboard') || boards.find(b => !b.collectionId) || boards[0];
    return moodboard ? moodboard.id : '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
      const defaultBoardId = getDefaultBoardId();
      
      const filePromises = files.map(file => {
          return new Promise<DraftPin>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                  resolve({
                      id: Math.random().toString(36) + Date.now(),
                      file, 
                      previewUrl: e.target?.result as string,
                      title: '',
                      description: '',
                      boardIds: defaultBoardId ? [defaultBoardId] : [], 
                      tags: [],
                      link: ''
                  });
              };
              reader.readAsDataURL(file);
          });
      });

      const newDrafts = await Promise.all(filePromises);
      
      setDrafts(prev => {
          const combined = [...prev, ...newDrafts];
          if (!selectedDraftId && combined.length > 0) {
             setSelectedDraftId(combined[0].id);
          }
          return combined;
      });
      
      if (!selectedDraftId && newDrafts.length > 0) {
          setSelectedDraftId(newDrafts[0].id);
      }
      
      setActiveTab('upload');
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
          const { images, title } = await dataService.getImagesFromUrl(sanitized);
          if (images.length === 0) {
              setScrapeError('No images found.');
          } else if (images.length === 1) {
              addUrlToDrafts(images[0], sanitized, title);
              resetUrlImport();
          } else {
              setScrapedImages(images);
              setScrapedTitle(title);
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
      selectedScrapedImages.forEach(img => addUrlToDrafts(img, sourceUrl, scrapedTitle));
      resetUrlImport();
      setActiveTab('upload');
  };

  const addUrlToDrafts = (url: string, sourceLink: string = '', autoTitle: string = '') => {
      const defaultBoardId = getDefaultBoardId();
      const newDraft: DraftPin = {
           id: Math.random().toString(36) + Date.now(),
           previewUrl: url,
           title: autoTitle,
           description: '',
           boardIds: defaultBoardId ? [defaultBoardId] : [], 
           tags: [],
           link: sourceLink
      };
      
      setDrafts(prev => {
          const combined = [...prev, newDraft];
          if (!selectedDraftId) setSelectedDraftId(newDraft.id);
          return combined;
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

  const removeDraft = (id: string) => {
    setDrafts(prev => {
      const remaining = prev.filter(d => d.id !== id);
      if (selectedDraftId === id) {
          if (remaining.length > 0) setSelectedDraftId(remaining[0].id);
          else setSelectedDraftId(null);
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
      const newTags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
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
            aspectRatio: 1, 
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

  const ToggleSwitch = () => (
    <div className="bg-[#05080F] p-1 rounded-lg border border-gray-800 flex w-48 mb-6 mx-auto">
        <button 
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'upload' ? 'bg-[#1F2937] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
        >
            Upload
        </button>
        <button 
            onClick={() => setActiveTab('url')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'url' ? 'bg-[#1F2937] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
        >
            URL
        </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="bg-[#0B1120] w-full max-w-5xl h-[700px] rounded-2xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden transition-all" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-[#0B1120] shrink-0">
           <div className="flex items-center gap-3">
               <h2 className="font-bold text-white text-lg">Create</h2>
               {drafts.length > 0 && (
                   <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                       {drafts.length} items
                   </span>
               )}
           </div>
           
           <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white">
               <X size={20} />
           </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            <input type="file" multiple accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

            <div className="flex-1 bg-[#0B1120] overflow-hidden flex flex-col w-full h-full">
               
               {drafts.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0B1120]">
                       <div className="max-w-md w-full">
                           <ToggleSwitch />
                           
                           {activeTab === 'url' ? (
                               <>
                                   <div className="text-center mb-6">
                                       <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                                          <LinkIcon size={24} />
                                       </div>
                                       <h3 className="text-lg font-bold text-white">Import from URL</h3>
                                   </div>

                                   <form onSubmit={handleUrlScrape} className="relative mb-6">
                                       <input 
                                           autoFocus
                                           value={urlInput}
                                           onChange={e => setUrlInput(e.target.value)}
                                           placeholder="Paste link here..."
                                           className="w-full bg-[#131B2C] border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-white focus:border-emerald-500 outline-none text-sm placeholder-gray-600 transition-all"
                                       />
                                       <button type="submit" disabled={isScraping || !urlInput.trim()} className="absolute right-2 top-2 bottom-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex items-center justify-center">
                                           {isScraping ? <Loader className="animate-spin" size={16} /> : <ArrowRight size={18} />}
                                       </button>
                                   </form>

                                   {scrapeError && <div className="text-red-400 text-xs text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{scrapeError}</div>}

                                   {scrapedImages.length > 0 && (
                                       <div className="space-y-4">
                                           <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                               {scrapedImages.map((img, i) => (
                                                   <div key={i} onClick={() => toggleScrapedImage(img)} className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 relative group transition-all ${selectedScrapedImages.includes(img) ? 'border-emerald-500' : 'border-transparent hover:border-gray-700'}`}>
                                                       <img src={img} className="w-full h-full object-cover" />
                                                       {selectedScrapedImages.includes(img) && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center"><div className="bg-emerald-500 text-white rounded-full p-0.5"><Check size={12} /></div></div>}
                                                   </div>
                                               ))}
                                           </div>
                                           <button onClick={addScrapedImagesToDrafts} disabled={selectedScrapedImages.length === 0} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50">
                                               Add {selectedScrapedImages.length} Images
                                           </button>
                                       </div>
                                   )}
                               </>
                           ) : (
                               <div 
                                 className={`flex flex-col items-center justify-center w-full max-w-lg h-64 rounded-xl border-2 border-dashed transition-all cursor-pointer bg-[#0F1522]
                                   ${dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-gray-800 hover:bg-[#131B2C] hover:border-gray-700'}
                                 `}
                                 onDragEnter={handleDrag}
                                 onDragLeave={handleDrag}
                                 onDragOver={handleDrag}
                                 onDrop={handleDrop}
                                 onClick={() => fileInputRef.current?.click()}
                               >
                                   <div className="w-14 h-14 bg-[#1A202C] rounded-full flex items-center justify-center mb-4 text-gray-400">
                                       <ImageIcon size={28} />
                                   </div>
                                   <h3 className="text-lg font-bold text-gray-200 mb-1">Drop files to upload</h3>
                                   <p className="text-gray-500 text-xs">or click to browse</p>
                               </div>
                           )}
                       </div>
                   </div>

               ) : currentDraft ? (
                   <div className="flex flex-col md:flex-row h-full overflow-hidden">
                       
                       {/* LEFT COLUMN: PREVIEW + THUMBNAILS (45%) */}
                       <div className="w-full md:w-[45%] bg-[#05080F] flex flex-col border-r border-gray-800 shrink-0">
                           
                           {/* Main Image Preview */}
                           <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden bg-black/50">
                               <img src={currentDraft.previewUrl} className="max-w-full max-h-full object-contain rounded shadow-2xl" />
                               
                               <button 
                                  onClick={() => removeDraft(currentDraft.id)}
                                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur"
                                  title="Remove Draft"
                               >
                                   <Trash2 size={16} />
                               </button>

                               {drafts.length > 1 && (
                                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur border border-gray-700 rounded-full pl-3 pr-1 py-1 flex items-center gap-2 shadow-xl z-10">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apply to All</span>
                                       <button 
                                          onClick={() => setSyncChanges(!syncChanges)}
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${syncChanges ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                       >
                                           {syncChanges ? 'ON' : 'OFF'}
                                       </button>
                                   </div>
                               )}
                           </div>

                           {drafts.length > 0 && (
                               <div className="h-24 bg-[#020408] border-t border-gray-800 flex items-center gap-3 px-4 overflow-x-auto custom-scrollbar shrink-0">
                                   {drafts.map(draft => (
                                       <div 
                                          key={draft.id} 
                                          onClick={() => setSelectedDraftId(draft.id)}
                                          className={`h-16 w-16 rounded-lg overflow-hidden cursor-pointer border-2 shrink-0 transition-all relative ${selectedDraftId === draft.id ? 'border-emerald-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                       >
                                           <img src={draft.previewUrl} className="w-full h-full object-cover" />
                                       </div>
                                   ))}
                                   
                                   <button 
                                      onClick={() => fileInputRef.current?.click()}
                                      className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-gray-900 flex items-center justify-center text-gray-500 hover:text-white transition-all shrink-0"
                                      title="Add More"
                                   >
                                       <Plus size={24} />
                                   </button>
                               </div>
                           )}
                       </div>

                       {/* RIGHT COLUMN: FORM (55%) */}
                       <div className="flex-1 bg-[#0B1120] overflow-y-auto custom-scrollbar flex flex-col">
                           <div className="p-8 space-y-6">
                               
                               <div>
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                                        <Layers size={12} /> Board
                                    </label>
                                    {isCreatingBoard ? (
                                        <div className="flex gap-2">
                                            <input autoFocus value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="Board name..." className="flex-1 bg-transparent border-b border-gray-700 py-2 text-white outline-none focus:border-emerald-500 text-sm" />
                                            <button onClick={handleCreateBoard} className="text-emerald-500 font-bold text-xs uppercase hover:text-emerald-400">Save</button>
                                            <button onClick={() => setIsCreatingBoard(false)} className="text-gray-500 font-bold text-xs uppercase hover:text-white">Cancel</button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select 
                                                value={(currentDraft.boardIds && currentDraft.boardIds[0]) || ''}
                                                onChange={(e) => { if (e.target.value === 'NEW') setIsCreatingBoard(true); else updateDraft({ boardIds: [e.target.value] }); }}
                                                className="w-full bg-[#131B2C] border border-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:border-emerald-500 appearance-none text-sm font-medium cursor-pointer hover:bg-[#1A2436] transition-colors"
                                            >
                                                <option value="" disabled>Select a board</option>
                                                <option value="NEW" className="text-emerald-400 font-bold bg-[#0B1120]">+ Create Board</option>
                                                {collections.map(col => (
                                                    <optgroup key={col.id} label={col.title} className="bg-[#0B1120]">
                                                        {boards.filter(b => b.collectionId === col.id).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                                    </optgroup>
                                                ))}
                                                <optgroup label="Unorganized" className="bg-[#0B1120]">
                                                    {boards.filter(b => !b.collectionId).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                                </optgroup>
                                            </select>
                                            <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                        </div>
                                    )}
                               </div>

                               <div className="space-y-1">
                                   <div className="flex justify-between items-center">
                                       <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                                           <Type size={12} /> Title
                                       </label>
                                       {currentDraft.file && (
                                           <button 
                                               onClick={() => updateDraft({ title: currentDraft.file?.name.split('.')[0] })}
                                               className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full"
                                           >
                                               <FileText size={10} /> Use Filename
                                           </button>
                                       )}
                                   </div>
                                   <input 
                                       value={currentDraft.title} 
                                       onChange={e => updateDraft({ title: e.target.value })} 
                                       className="w-full bg-transparent border-b border-gray-800 py-2 text-xl font-bold text-white outline-none focus:border-emerald-500 placeholder-gray-700"
                                       placeholder="Add a title"
                                   />
                               </div>
                               
                               <div className="space-y-1">
                                   <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                                   <textarea 
                                       value={currentDraft.description} 
                                       onChange={e => updateDraft({ description: e.target.value })} 
                                       className="w-full bg-transparent border border-gray-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500 text-sm placeholder-gray-700 h-24 resize-none transition-colors focus:bg-[#131B2C]"
                                       placeholder="Tell everyone what your pin is about..."
                                   />
                               </div>

                               <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Link</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-0 top-2.5 text-gray-600" size={14} />
                                        <input value={currentDraft.link || ''} onChange={e => updateDraft({ link: e.target.value })} className="w-full bg-transparent border-b border-gray-800 py-2 pl-6 text-white outline-none focus:border-emerald-500 text-sm placeholder-gray-700 font-mono" placeholder="Add a destination link" />
                                    </div>
                               </div>

                               <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Location</label>
                                    {currentDraft.location ? (
                                        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-emerald-500" />
                                                <span className="text-emerald-400 text-xs font-medium">{currentDraft.location.name}</span>
                                            </div>
                                            <button onClick={() => updateDraft({ location: undefined })} className="text-gray-500 hover:text-white"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <MapPin className="absolute left-0 top-2.5 text-gray-600" size={14} />
                                            <input value={locationQuery} onChange={e => setLocationQuery(e.target.value)} placeholder="Search for a place" className="w-full bg-transparent border-b border-gray-800 py-2 pl-6 text-white outline-none focus:border-emerald-500 text-sm placeholder-gray-700" />
                                            <button onClick={handleLocationSearch} disabled={isSearchingLocation} className="absolute right-0 top-2 text-gray-500 hover:text-white"><Search size={14} /></button>
                                            {locationResults.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A2436] border border-gray-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                                                    {locationResults.map((loc, i) => (
                                                        <button key={i} onClick={() => selectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700/50 text-xs text-gray-300 last:border-0">
                                                            {loc.name}
                                                            {loc.address && <span className="block text-[10px] text-gray-500 truncate">{loc.address}</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                               </div>

                               <div className="space-y-1">
                                   <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                                       <Grid size={12} /> Tags
                                   </label>
                                   <div className="flex flex-wrap gap-2 items-center">
                                       {currentDraft.tags.map(tag => (
                                           <span key={tag} className="bg-[#131B2C] border border-gray-700 text-gray-300 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 group">
                                               #{tag} <button onClick={() => removeTag(tag)} className="text-gray-600 group-hover:text-red-400"><X size={10} /></button>
                                           </span>
                                       ))}
                                       <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Type tag..." className="bg-transparent border-b border-transparent focus:border-emerald-500 text-white outline-none text-sm w-24 placeholder-gray-700 py-1" />
                                   </div>
                               </div>

                           </div>
                       </div>
                   </div>
               ) : null}
            </div>
        </div>

        <div className="p-4 bg-[#0B1120] border-t border-gray-800 flex justify-end gap-3 shrink-0">
             {drafts.length > 0 && (
                 <>
                    <button onClick={() => setDrafts([])} className="px-5 py-2 text-gray-500 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest">Discard</button>
                    <button 
                        onClick={handlePublishAll}
                        disabled={isLoading || drafts.length === 0 || drafts.filter(d => d.boardIds && d.boardIds.length > 0).length === 0}
                        className="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/20 flex items-center gap-2 uppercase tracking-widest"
                    >
                        {isLoading ? <Loader className="animate-spin" size={14} /> : 'Publish'}
                    </button>
                 </>
             )}
        </div>
      </div>
    </div>
  );
};