import React, { useState, useEffect, useRef } from 'react';
import { PinnedImage, Visibility, Board } from '../../shared/types';
import { storage } from '../services/storageService';
import { authService } from '../services/authService';
import { X, Upload, Check, Link as LinkIcon, Image as ImageIcon, MapPin, Search, Loader2, Film, Globe, Lock, Link, Folder, Plus, Play } from 'lucide-react';
import { generateId } from '../utils/helpers';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (images: PinnedImage[]) => void;
  ownerId: string;
  boards: Board[];
  initialBoardId?: string | null;
  onCreateBoard?: () => void;
  initialFiles?: File[];
}

interface LocationResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

interface PendingUpload {
  id: string;
  file?: File;
  preview: string; // Thumbnail for grid
  originalUrl?: string; // For URL uploads or DataURL for files
  title: string;
  mediaType: 'image' | 'video';
  videoMetadata?: PinnedImage['videoMetadata'];
  description?: string; // New field for scraped description
  sourceUrl?: string;
}

interface ScrapedData {
  images: string[];
  title: string;
  description: string;
  url: string;
}

// Fallback placeholder generator
const getPlaceholderThumbnail = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a'; // slate-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Abstract Play Icon Background
    ctx.beginPath();
    ctx.arc(240, 135, 40, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fill();
  }
  return canvas.toDataURL('image/jpeg', 0.5);
};

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, ownerId, boards, initialBoardId, onCreateBoard, initialFiles }) => {
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  
  // Pending Uploads State
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  
  // FIX: Track generated URLs in a Ref so they persist across renders and are cleaned up only on unmount
  const generatedUrls = useRef<string[]>([]);

  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Common Metadata State
  const [commonTitle, setCommonTitle] = useState(''); 
  const [commonDescription, setCommonDescription] = useState('');
  const [commonSourceUrl, setCommonSourceUrl] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState<string>(initialBoardId || '');
  
  // Scraper State
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [selectedScrapedImages, setSelectedScrapedImages] = useState<Set<string>>(new Set());

  // Initialize visibility from user preferences (defaulting to private)
  const [visibility, setVisibility] = useState<Visibility>(() => {
    const stored = localStorage.getItem(`pinspire_default_visibility_${ownerId}`) as Visibility;
    return stored || 'private';
  });
  
  // Board Creation auto-selection logic
  const [isWaitingForBoard, setIsWaitingForBoard] = useState(false);
  const prevBoardsLength = useRef(boards.length);

  // Auto-select newly created board
  useEffect(() => {
    if (boards.length > prevBoardsLength.current && isWaitingForBoard) {
       // Get the board with the latest createdAt
       if (boards.length > 0) {
         const newBoard = boards.reduce((prev, current) => (prev.createdAt > current.createdAt) ? prev : current);
         if (newBoard) {
           setSelectedBoardId(newBoard.id);
           setIsWaitingForBoard(false);
         }
       }
    }
    prevBoardsLength.current = boards.length;
  }, [boards, isWaitingForBoard]);
  
  // Geocoding state
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'none' | 'found' | 'not-found'>('none');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);

  // CLEANUP: Only runs once when the component unmounts
  useEffect(() => {
    return () => {
      generatedUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleLookupLocation = async () => {
    if (!location) return;
    setIsLocating(true);
    setSearchResults([]);
    setCoords(null);
    setLocationStatus('none');

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

  // --- Thumbnail Generators ---

  const generateImageThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          const scale = MAX_WIDTH / img.width;
          
          if (scale < 1) {
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const generateVideoThumbnail = (source: File | string): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous'; // Important for external URLs
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      let url = '';
      if (source instanceof File) {
        url = URL.createObjectURL(source);
      } else {
        url = source;
      }
      video.src = url;

      let resolved = false;
      const safeResolve = (val: string) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
          if (source instanceof File) URL.revokeObjectURL(url);
          video.remove();
        }
      };

      const timeout = setTimeout(() => {
        safeResolve(''); 
      }, 8000);

      video.onloadeddata = () => {
        const time = Math.min(1, video.duration > 0 ? video.duration * 0.2 : 0.5); 
        video.currentTime = time;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        const scale = Math.min(1, MAX_WIDTH / width);
        
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            safeResolve(canvas.toDataURL('image/jpeg', 0.7));
          } catch (e) {
            console.warn('Canvas tainted by cross-origin video, using placeholder.');
            safeResolve('');
          }
        } else {
          safeResolve('');
        }
        clearTimeout(timeout);
      };

      video.onerror = () => {
        console.warn('Error loading video for thumbnail');
        safeResolve('');
        clearTimeout(timeout);
      };
    });
  };

  // --- Processing Logic ---

  const processFiles = async (filesToProcess: File[]) => {
    const config = authService.getServerConfig();
    const maxBytes = config.maxFileSize || 2 * 1024 * 1024 * 1024; // Default 2GB

    const validFiles: File[] = [];
    for (const file of filesToProcess) {
      if (file.size > maxBytes) {
        alert(`File "${file.name}" exceeds the maximum upload size.`);
        continue;
      }
      validFiles.push(file);
    }

    const newUploads = await Promise.all(validFiles.map(async (file) => {
      const isVideo = file.type.startsWith('video/');
      let preview = '';
      
      // FIX: Use createObjectURL instead of FileReader (readAsDataURL)
      const objectUrl = URL.createObjectURL(file);
      
      // Track the URL so we can revoke it later
      generatedUrls.current.push(objectUrl);

      if (isVideo) {
        preview = await generateVideoThumbnail(file);
        if (!preview) preview = getPlaceholderThumbnail();
      } else {
        preview = await generateImageThumbnail(file);
      }

      return {
        id: generateId(),
        file,
        preview: preview || objectUrl, 
        originalUrl: objectUrl, // Store the pointer, not the data
        title: file.name.split('.')[0],
        mediaType: isVideo ? 'video' : 'image',
        videoMetadata: isVideo ? { type: 'native' } : undefined
      } as PendingUpload;
    }));
    
    setUploads(prev => [...prev, ...newUploads]);
    
    if (validFiles.length === 1 && uploads.length === 0) {
      setCommonTitle(validFiles[0].name.split('.')[0]);
    }
  };

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      await processFiles(selectedFiles);
    }
  };

  const parseVideoUrl = async (url: string): Promise<Partial<PendingUpload> | null> => {
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
      const id = ytMatch[2];
      return {
        mediaType: 'video',
        videoMetadata: { type: 'youtube', id },
        preview: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`, 
        originalUrl: url,
        title: 'YouTube Video'
      };
    }

    const vimeoRegExp = /(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i;
    const vimeoMatch = url.match(vimeoRegExp);
    if (vimeoMatch && vimeoMatch[1]) {
      const id = vimeoMatch[1];
      try {
        const res = await fetch(`https://vimeo.com/api/v2/video/${id}.json`);
        const data = await res.json();
        return {
          mediaType: 'video',
          videoMetadata: { type: 'vimeo', id },
          preview: data[0].thumbnail_large,
          originalUrl: url,
          title: data[0].title || 'Vimeo Video'
        };
      } catch (e) {
        return {
          mediaType: 'video',
          videoMetadata: { type: 'vimeo', id },
          preview: getPlaceholderThumbnail(), 
          originalUrl: url,
          title: 'Vimeo Video'
        };
      }
    }

    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
      return {
        mediaType: 'image',
        preview: url,
        originalUrl: url,
        title: 'Image Link'
      };
    }

    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
      const generated = await generateVideoThumbnail(url);
      return {
         mediaType: 'video',
         videoMetadata: { type: 'generic-url' },
         preview: generated || getPlaceholderThumbnail(), 
         originalUrl: url,
         title: 'External Video'
      };
    }

    return null; // Not a direct media link
  };

  const scrapeWebsite = async (url: string) => {
    setIsScraping(true);
    setScrapedData(null);
    setSelectedScrapedImages(new Set());

    try {
      // Use our new Backend Endpoint
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) throw new Error("Failed to fetch page data");
      
      const data: ScrapedData = await response.json();
      
      if (!data.images || data.images.length === 0) {
        throw new Error("No images found");
      }

      setScrapedData({
        url: data.url,
        title: data.title || 'Scraped Page',
        description: data.description || '',
        images: data.images
      });

    } catch (err) {
      console.error("Scraping failed:", err);
      // Fallback to adding as a simple link if scraping fails
      const newUpload: PendingUpload = {
        id: generateId(),
        preview: 'https://placehold.co/400x400/1e293b/475569?text=Link',
        originalUrl: url,
        title: 'Linked Content',
        mediaType: 'image'
      };
      setUploads(prev => [...prev, newUpload]);
      setUrlInput('');
    } finally {
      setIsScraping(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    // Check if it looks like a media file or video service first
    const parsed = await parseVideoUrl(urlInput);
    
    if (parsed) {
       const newUpload: PendingUpload = {
         id: generateId(),
         preview: parsed.preview || 'https://placehold.co/400x400/1e293b/475569?text=No+Preview',
         originalUrl: parsed.originalUrl!,
         title: parsed.title || 'New Tallo',
         mediaType: parsed.mediaType || 'image',
         videoMetadata: parsed.videoMetadata
       };
       setUploads(prev => [...prev, newUpload]);
       setUrlInput('');
       if (uploads.length === 0) setCommonTitle(parsed.title || '');
    } else {
      // Assume it's a website and try to scrape
      await scrapeWebsite(urlInput);
    }
  };

  const handleScrapedSelection = () => {
    if (!scrapedData) return;

    const newUploads = Array.from(selectedScrapedImages).map(imgUrl => ({
      id: generateId(),
      preview: imgUrl,
      originalUrl: imgUrl,
      title: scrapedData.title,
      description: scrapedData.description,
      mediaType: 'image' as const,
      sourceUrl: scrapedData.url // Save the origin page URL
    }));

    setUploads(prev => [...prev, ...newUploads]);
    
    // Auto-fill common fields if this is the first batch
    if (uploads.length === 0 && newUploads.length > 0) {
      setCommonTitle(scrapedData.title);
      setCommonDescription(scrapedData.description);
      setCommonSourceUrl(scrapedData.url);
      setUrlInput(''); // Clear input
    }
    
    setScrapedData(null); // Close scraper view
    setSelectedScrapedImages(new Set());
  };

  const toggleScrapedImage = (imgUrl: string) => {
    const newSet = new Set(selectedScrapedImages);
    if (newSet.has(imgUrl)) {
      newSet.delete(imgUrl);
    } else {
      newSet.add(imgUrl);
    }
    setSelectedScrapedImages(newSet);
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const handleSave = async () => {
    if (uploads.length === 0) return;

    setIsSaving(true);
    
    try {
      const rawTags = tags.split(',').map(t => t.trim()).filter(t => t !== '');
      const uniqueTags = Array.from(new Set(rawTags));
      
      const newImages: PinnedImage[] = [];

      for (const upload of uploads) {
        const newImage: PinnedImage = {
          id: crypto.randomUUID(),
          url: upload.originalUrl || upload.preview, 
          thumbnailUrl: upload.preview, 
          title: commonTitle.trim() || upload.title || 'Untitled Tallo',
          description: commonDescription.trim() || upload.description || '',
          tags: uniqueTags,
          boardIds: selectedBoardId ? [selectedBoardId] : [],
          createdAt: Date.now(),
          location: location.trim(),
          latitude: coords?.lat,
          longitude: coords?.lng,
          mediaType: upload.mediaType,
          videoMetadata: upload.videoMetadata,
          visibility: visibility, 
          ownerId: ownerId,
          sourceUrl: commonSourceUrl.trim() || (upload as any).sourceUrl
        };
        
        // --- OPTIMIZATION START ---
        // Create a lightweight copy for the server (remove massive base64 strings)
        // The server will generate the correct 'url' from the file.
        const imageForServer = { ...newImage };
        if (upload.file) {
            imageForServer.url = ''; 
            // Only clear thumbnail if it's auto-generated from the file (base64)
            // If it's a URL (scraped), keep it.
            if (imageForServer.thumbnailUrl.startsWith('data:')) {
                imageForServer.thumbnailUrl = ''; 
            }
        }
        // --- OPTIMIZATION END ---

        await storage.saveImage(imageForServer, upload.file);
        
        newImages.push(newImage);
      }

      onUpload(newImages);
    } catch (err) {
      console.error(err);
      alert('Failed to save content. Please try fewer items or smaller files.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---

  if (scrapedData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-rose-500" />
                Select Images from Webpage
              </h2>
              <p className="text-sm text-slate-400 mt-1 line-clamp-1">{scrapedData.title}</p>
            </div>
            <button onClick={() => setScrapedData(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {scrapedData.images.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No suitable images found on this page.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {scrapedData.images.map((img, idx) => {
                   const isSelected = selectedScrapedImages.has(img);
                   return (
                     <div 
                        key={idx} 
                        onClick={() => toggleScrapedImage(img)}
                        className={`aspect-square relative rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                     >
                       <img src={img} className="w-full h-full object-cover" alt="" />
                       <div className={`absolute inset-0 bg-black/40 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-rose-500 text-white' : 'bg-slate-900/80 text-slate-400 border border-slate-600'}`}>
                            {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </div>
                       </div>
                     </div>
                   );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-950">
             <div className="text-sm text-slate-400">
               {selectedScrapedImages.size} selected
             </div>
             <div className="flex gap-3">
               <button onClick={() => setScrapedData(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-100 transition-all">Cancel</button>
               <button 
                 onClick={handleScrapedSelection}
                 disabled={selectedScrapedImages.size === 0}
                 className="px-6 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
               >
                 Add Selected
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-100">Add Tallos</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="flex bg-slate-950 p-1 rounded-xl flex-shrink-0">
            <button 
              onClick={() => { setUploadType('file'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${uploadType === 'file' ? 'bg-slate-800 shadow-sm text-rose-500' : 'text-slate-500 hover:text-slate-400'}`}
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </button>
            <button 
              onClick={() => { setUploadType('url'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${uploadType === 'url' ? 'bg-slate-800 shadow-sm text-rose-500' : 'text-slate-500 hover:text-slate-400'}`}
            >
              <LinkIcon className="w-4 h-4" />
              From URL
            </button>
          </div>

          {/* Input Area */}
          <div className="space-y-4">
            {uploadType === 'file' ? (
               <div className="border-3 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center py-12 px-6 transition-colors hover:border-rose-900 group relative bg-slate-950/50">
                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-slate-800">
                  <Film className="w-6 h-6 text-slate-600 group-hover:text-rose-500" />
                </div>
                <p className="text-slate-400 font-medium mb-1 text-sm">Drop photos or videos here</p>
                <p className="text-slate-600 text-xs">Supports Images & MP4/WebM Videos</p>
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <form onSubmit={handleUrlSubmit} className="flex gap-2 relative">
                <input 
                  type="url" 
                  placeholder="https://... (Images, YouTube, or Article URL)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-rose-500/20 transition-all text-sm text-slate-200 placeholder-slate-700"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isScraping}
                />
                <button 
                  type="submit"
                  disabled={!urlInput || isScraping}
                  className="bg-slate-800 text-slate-200 px-4 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 min-w-[3rem] flex items-center justify-center"
                >
                  {isScraping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              </form>
            )}
            {uploadType === 'url' && !isScraping && (
                <p className="text-xs text-slate-500 px-1">
                    Tip: Paste a website URL to scan it for images.
                </p>
            )}
          </div>

          {/* Previews Grid */}
          {uploads.length > 0 && (
            <div className="animate-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{uploads.length} Selected</h3>
                <button onClick={() => setUploads([])} className="text-xs text-red-500 hover:text-red-400">Clear All</button>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {uploads.map((upload) => (
                  <div key={upload.id} className="aspect-square rounded-xl overflow-hidden border border-slate-800 relative group bg-slate-950">
                    <img src={upload.preview} alt="" className="w-full h-full object-cover" />
                    
                    {upload.mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                         <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                         </div>
                      </div>
                    )}

                    <button 
                      onClick={() => removeUpload(upload.id)}
                      className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-slate-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {upload.title}
                    </div>
                  </div>
                ))}
                 {uploadType === 'file' && (
                  <div className="aspect-square rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center hover:border-slate-700 hover:bg-slate-800/20 cursor-pointer relative transition-colors">
                    <Plus className="w-6 h-6 text-slate-600" />
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                    />
                  </div>
                )}
              </div>

              {/* Metadata Form - Applies to ALL */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-rose-500 rounded-full"></div>
                  <h3 className="text-sm font-bold text-slate-200">Details</h3>
                  <span className="text-xs text-slate-500 ml-auto">Applies to all {uploads.length} items</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Visibility</label>
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['private', 'public', 'unlisted'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setVisibility(v)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                            visibility === v 
                              ? 'bg-slate-800 text-rose-500 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {v === 'private' && <Lock className="w-3 h-3" />}
                          {v === 'public' && <Globe className="w-3 h-3" />}
                          {v === 'unlisted' && <Link className="w-3 h-3" />}
                          <span className="capitalize">{v}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Add to Board</label>
                    <div className="relative">
                        <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                        value={selectedBoardId}
                        onChange={(e) => {
                          if (e.target.value === 'CREATE_NEW') {
                            if (onCreateBoard) {
                                setIsWaitingForBoard(true);
                                onCreateBoard();
                            }
                          } else {
                            setSelectedBoardId(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:border-rose-500 outline-none appearance-none transition-all cursor-pointer hover:border-slate-700 text-sm"
                        >
                        <option value="">No Board</option>
                        {boards.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                        {onCreateBoard && <option value="CREATE_NEW" className="font-bold text-rose-400">+ Create New Board</option>}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title (Optional Override)</label>
                    <input 
                      type="text" 
                      value={commonTitle}
                      onChange={(e) => setCommonTitle(e.target.value)}
                      placeholder={uploads.length === 1 ? "Enter title..." : "Leave empty to keep filenames"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors"
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description (Optional)</label>
                     <textarea 
                      value={commonDescription}
                      onChange={(e) => setCommonDescription(e.target.value)}
                      placeholder="Add a description for these items..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors resize-none h-20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Source URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                        type="url" 
                        value={commonSourceUrl}
                        onChange={(e) => setCommonSourceUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tags</label>
                    <input 
                      type="text" 
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="modern, interior, design..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location</label>
                    <div className="relative z-10">
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
                              setSearchResults([]);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookupLocation()}
                            placeholder="Add a location..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isLocating ? (
                              <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                            ) : locationStatus === 'found' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : locationStatus === 'not-found' ? (
                              <span className="text-[10px] text-red-500 font-bold uppercase">Invalid</span>
                            ) : null}
                          </div>
                        </div>
                        <button 
                          onClick={handleLookupLocation}
                          disabled={isLocating || !location}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
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
                        </div>
                      )}
                      
                       {coords && (
                        <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Pinned at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button 
            disabled={isSaving}
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={uploads.length === 0 || isSaving}
            onClick={handleSave}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all ${
              uploads.length === 0 || isSaving 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
            }`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {uploads.length > 1 ? `Save ${uploads.length} Tallos` : 'Save Tallos'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;