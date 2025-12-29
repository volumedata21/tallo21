import React, { useState, useEffect, useRef } from 'react';
import { PinnedImage, Board, Visibility, User } from '../../shared/types';
import { 
  X, Calendar, Hash, FolderPlus, Check, MapPin, ExternalLink, Edit2, Save, 
  Loader2, Search, Heart, Share2, Link as LinkIcon, Globe, Plus, Trash2, 
  ChevronLeft, ChevronRight, LayoutTemplate, Camera, RotateCcw, 
  Lock, Link, User as UserIcon, ChevronUp, ChevronDown, Download
} from 'lucide-react';
import { authService } from '../services/authService';

interface ImageDetailModalProps {
  image: PinnedImage;
  onClose: () => void;
  boards: Board[];
  onTogglePin: (imageId: string, boardId: string) => void;
  onUpdate: (image: PinnedImage) => void;
  onToggleFavorite: (id: string) => void;
  onDelete?: (id: string) => void;
  groupImages?: PinnedImage[];
  contextImages?: PinnedImage[]; 
  onSelectImage?: (id: string) => void;
  onSetHero?: (id: string) => void;
}

interface LocationResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

const getDomain = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch (e) {
    return url;
  }
};

const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ 
  image, onClose, boards, onTogglePin, onUpdate, onToggleFavorite, 
  onDelete = () => {}, 
  groupImages, contextImages, onSelectImage, onSetHero
}) => {
  const safeTags = image.tags || [];
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = authService.getCurrentUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const owner = users.find(u => u.id === image.ownerId);
  const isOwner = currentUser && image.ownerId === currentUser.id;
  const isLiked = currentUser && (image.likedBy || []).includes(currentUser.id);
  const isFollowing = currentUser && owner && (currentUser.following || []).includes(owner.id);

  const [isEditing, setIsEditing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const [title, setTitle] = useState(image.title);
  const [description, setDescription] = useState(image.description || '');
  const [sourceUrl, setSourceUrl] = useState(image.sourceUrl || '');
  const [location, setLocation] = useState(image.location || '');
  const [visibility, setVisibility] = useState<Visibility>(image.visibility || 'private');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(
    image.latitude && image.longitude ? { lat: image.latitude, lng: image.longitude } : null
  );
  
  const [newTag, setNewTag] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'none' | 'found' | 'not-found'>(
    image.latitude ? 'found' : 'none'
  );
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  useEffect(() => {
    setTitle(image.title);
    setDescription(image.description || '');
    setSourceUrl(image.sourceUrl || '');
    setLocation(image.location || '');
    setVisibility(image.visibility || 'private');
    setCoords(image.latitude && image.longitude ? { lat: image.latitude, lng: image.longitude } : null);
    setIsEditing(false);
    setCaptureSuccess(false);
    authService.getUsers().then(setUsers).catch(() => setUsers([]));
  }, [image]);

  const navigationList = (groupImages && groupImages.length > 0) ? groupImages : (contextImages || []);
  const currentIndex = navigationList.findIndex(i => i.id === image.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < navigationList.length - 1;

  const handleNext = () => {
    if (hasNext && onSelectImage) onSelectImage(navigationList[currentIndex + 1].id);
  };

  const handlePrev = () => {
    if (hasPrev && onSelectImage) onSelectImage(navigationList[currentIndex - 1].id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; 
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, isEditing]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe && hasNext) handleNext();
    if (isRightSwipe && hasPrev) handlePrev();
  };

  const handleLookupLocation = async () => {
    if (!location.trim()) return;
    setIsLocating(true);
    setLocationStatus('none');
    setSearchResults([]);
    setCoords(null); 
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
        headers: { 'User-Agent': 'PinSpireApp/1.0' }
      });
      const data: any[] = await res.json();
      if (data && data.length > 0) setSearchResults(data.slice(0, 5));
      else setLocationStatus('not-found');
    } catch (e) {
      console.error("Geocoding failed", e);
      setLocationStatus('not-found');
    } finally {
      setIsLocating(false);
    }
  };

  const selectLocation = (result: any) => {
    setCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setLocation(result.display_name.split(',')[0]);
    setLocationStatus('found');
    setSearchResults([]);
  };

  const handleSave = () => {
    let safeSourceUrl = sourceUrl.trim();
    if (safeSourceUrl && !/^https?:\/\//i.test(safeSourceUrl)) {
        safeSourceUrl = 'https://' + safeSourceUrl;
    }
    const updatedImage: PinnedImage = {
      ...image, title: title.trim() || 'Untitled', description: description.trim(), sourceUrl: safeSourceUrl,
      location: location.trim(), latitude: coords?.lat, longitude: coords?.lng, visibility: visibility
    };
    onUpdate(updatedImage);
    setIsEditing(false);
  };

  const handleCycleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner) return;
    const modes: Visibility[] = ['private', 'public', 'unlisted'];
    const currentIdx = modes.indexOf(image.visibility || 'private');
    onUpdate({ ...image, visibility: modes[(currentIdx + 1) % modes.length] });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const tagToAdd = newTag.trim();
      if (!safeTags.some(t => t.toLowerCase() === tagToAdd.toLowerCase())) {
        onUpdate({ ...image, tags: [...image.tags, tagToAdd] });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdate({ ...image, tags: image.tags.filter(t => t !== tagToRemove) });
  };

  const handleShare = async () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('pin', image.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } catch (err) { console.error('Failed to copy', err); }
  };

  const captureFrame = (video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    } catch (err) { console.error("Canvas draw failed", err); }
    return null;
  };

  const handleCaptureThumbnail = async () => {
    const video = videoRef.current;
    if (!video) return;
    setIsCapturing(true);
    try {
      let captureVideo = video;
      let tempVideo: HTMLVideoElement | null = null;
      if (!video.src.startsWith('blob:') && !video.src.startsWith('data:')) {
          tempVideo = document.createElement('video');
          tempVideo.crossOrigin = 'anonymous';
          tempVideo.src = video.src;
          tempVideo.currentTime = video.currentTime;
          tempVideo.muted = true;
          await new Promise((resolve, reject) => {
             tempVideo!.onloadeddata = () => { tempVideo!.currentTime = video.currentTime; };
             tempVideo!.onseeked = () => resolve(true);
             tempVideo!.onerror = () => reject(new Error('CORS load failed'));
             setTimeout(() => reject(new Error('Timeout')), 5000);
          });
          captureVideo = tempVideo;
      }
      const newThumbnail = captureFrame(captureVideo);
      if (newThumbnail) {
         onUpdate({ ...image, thumbnailUrl: newThumbnail, isCustomThumbnail: true });
         setCaptureSuccess(true);
         setTimeout(() => setCaptureSuccess(false), 2000);
      }
    } catch (e) { alert("Could not capture frame."); } finally { setIsCapturing(false); }
  };

  const handleRemoveThumbnail = async () => onUpdate({ ...image, thumbnailUrl: undefined, isCustomThumbnail: false });
  const safeImgSrc = image.url || image.thumbnailUrl || '';

  const renderMedia = () => {
    if (image.mediaType === 'video') {
      const { type, id } = image.videoMetadata || {};
      if (type === 'youtube' && id) return <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&origin=${window.location.origin}`} title={image.title} className="w-full h-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
      if (type === 'vimeo' && id) return <iframe src={`https://player.vimeo.com/video/${id}?autoplay=1`} title={image.title} className="w-full h-full aspect-video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
      return <video ref={videoRef} src={image.url} controls autoPlay className="w-full h-full object-contain bg-black" poster={image.thumbnailUrl}>Your browser does not support the video tag.</video>;
    }
    return <img src={safeImgSrc} className="w-full h-full object-contain" alt={image.title} />;
  };

  const isNativeVideo = image.mediaType === 'video' && (image.videoMetadata?.type === 'native' || image.videoMetadata?.type === 'generic-url' || !image.videoMetadata);

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black flex flex-col md:hidden animate-in fade-in duration-200">
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start bg-gradient-to-b from-black/90 via-black/50 to-transparent h-28 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg">
             {isEditing ? (
                <>
                  <button onClick={handleSave} className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold mr-1">Save</button>
                  <button onClick={() => setIsEditing(false)} className="p-2 rounded-full text-slate-300 hover:bg-white/10"><X className="w-5 h-5" /></button>
                </>
             ) : (
                <>
                  <button onClick={() => onToggleFavorite(image.id)} className={`p-2 rounded-full transition-colors ${isLiked ? 'text-rose-500 bg-rose-500/10' : 'text-white hover:bg-white/10'}`}><Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} /></button>
                  <div className="w-px h-4 bg-white/20"></div>
                  <button onClick={handleShare} className="p-2 rounded-full text-white hover:bg-white/10 transition-colors relative"><Share2 className="w-5 h-5" />{showShareTooltip && <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded whitespace-nowrap">Copied!</div>}</button>
                  {isOwner && (<><div className="w-px h-4 bg-white/20"></div><button onClick={() => { setIsEditing(true); setIsSheetOpen(true); }} className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"><Edit2 className="w-5 h-5" /></button><div className="w-px h-4 bg-white/20"></div><button onClick={() => onDelete(image.id)} className="p-2 rounded-full text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 className="w-5 h-5" /></button></>)}
                </>
             )}
          </div>
          <button onClick={onClose} className="pointer-events-auto p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 relative flex items-center justify-center bg-black h-full" onClick={() => setIsSheetOpen(false)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
           {hasPrev && <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/30 backdrop-blur-sm text-white/70 rounded-full border border-white/10"><ChevronLeft className="w-6 h-6" /></button>}
           {hasNext && <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/30 backdrop-blur-sm text-white/70 rounded-full border border-white/10"><ChevronRight className="w-6 h-6" /></button>}
           {renderMedia()}
        </div>
        <div className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl transition-all duration-300 ease-in-out z-30 flex flex-col ${isSheetOpen || isEditing ? 'h-[85vh]' : 'h-24'}`}>
          <div onClick={() => !isEditing && setIsSheetOpen(!isSheetOpen)} className="flex-shrink-0 h-24 p-4 cursor-pointer relative bg-slate-900 rounded-t-3xl active:bg-slate-800 transition-colors">
             <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-700 rounded-full" />
             <div className="mt-4 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                   {isEditing ? <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-bold" placeholder="Title" onClick={(e) => e.stopPropagation()} /> : <h2 className="text-lg font-bold text-white truncate">{image.title || 'Untitled'}</h2>}
                   <div className="flex items-center gap-2 mt-1"><div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">{owner ? owner.username.substring(0, 2).toUpperCase() : 'U'}</div><span className="text-sm text-slate-400">{owner ? owner.username : 'Unknown'}</span></div>
                </div>
                {!isEditing && <button className="text-slate-500 mt-1">{isSheetOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}</button>}
             </div>
          </div>
          <div className={`flex-1 overflow-y-auto px-6 pb-safe-bottom space-y-6 bg-slate-900 ${isSheetOpen || isEditing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             {isEditing ? <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm min-h-[100px]" placeholder="Description..." /> : image.description && <div className="text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-4">{image.description}</div>}
             {isEditing ? <div className="flex items-center gap-2 border border-slate-700 rounded px-3 py-2"><Plus className="w-4 h-4 text-slate-500" /><input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={handleAddTag} placeholder="Add tag (Enter)" className="bg-transparent outline-none text-white text-sm flex-1" /></div> : null}
             <div className="flex flex-wrap gap-2">{image.tags.map(tag => (<span key={tag} className="px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 flex items-center gap-1 border border-slate-700"><Hash className="w-3 h-3" /> {tag}{isEditing && <button onClick={() => handleRemoveTag(tag)}><X className="w-3 h-3 ml-1" /></button>}</span>))}</div>
             {isEditing ? <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm" placeholder="Source URL" /> : image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-medium py-2"><ExternalLink className="w-4 h-4" /> {getDomain(image.sourceUrl)}</a>}
             {isEditing && (<div className="space-y-2 pt-2 border-t border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Location</label><div className="flex gap-2"><div className="relative flex-1"><input type="text" value={location} onChange={(e) => { setLocation(e.target.value); setCoords(null); setLocationStatus('none'); setSearchResults([]); }} onKeyDown={(e) => e.key === 'Enter' && handleLookupLocation()} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-rose-500 outline-none" placeholder="Search location..." /><div className="absolute right-3 top-1/2 -translate-y-1/2">{isLocating ? <Loader2 className="w-4 h-4 text-rose-500 animate-spin" /> : locationStatus === 'found' ? <Check className="w-4 h-4 text-green-500" /> : null}</div></div><button onClick={handleLookupLocation} disabled={isLocating || !location} className="px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"><Search className="w-4 h-4" /></button></div>{searchResults.length > 0 && <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mt-2">{searchResults.map((result) => (<button key={result.place_id} onClick={() => selectLocation(result)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 border-b border-slate-700 last:border-0 flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" /><span className="line-clamp-2">{result.display_name}</span></button>))}</div>}</div>)}
             {currentUser && !isEditing && (<div className="pt-4 border-t border-slate-800"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Save to Boards</h3><div className="space-y-2">{boards.map(board => { const isPinned = image.boardIds.includes(board.id); return (<button key={board.id} onClick={() => onTogglePin(image.id, board.id)} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isPinned ? 'bg-rose-900/20 border-rose-500/50 text-rose-200' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}><span className="font-medium text-sm">{board.name}</span>{isPinned && <Check className="w-4 h-4 text-rose-500" />}</button>); })}</div></div>)}
             <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 pt-4 border-t border-slate-800 pb-8"><div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(image.createdAt).toLocaleDateString()}</div>{image.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{image.location}</div>}</div>
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 hidden md:flex" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-slate-900 w-full max-w-6xl rounded-[40px] overflow-hidden shadow-2xl flex h-[90vh] border border-slate-900 relative" onClick={(e) => e.stopPropagation()}>
          {hasPrev && <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"><ChevronLeft className="w-8 h-8" /></button>}
          {hasNext && <button onClick={handleNext} className="absolute right-[42%] top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"><ChevronRight className="w-8 h-8" /></button>}
          <div className="w-3/5 h-full bg-black flex items-center justify-center overflow-hidden relative group flex-shrink-0">
            {renderMedia()}
            {image.mediaType !== 'video' && <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-white/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{image.url.startsWith('data:') ? 'Local Image' : 'External URL'}</div>}
            {image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-10"><ExternalLink className="w-4 h-4" /> Visit Site</a>}
          </div>
          <div className="w-2/5 flex-1 h-full flex flex-col p-12 overflow-y-auto custom-scrollbar bg-slate-950">
            <div className="flex justify-between items-center mb-6">
               <div className="flex-1 flex items-center gap-2">
                 {groupImages && onSetHero && (currentIndex === 0 ? <span className="text-xs bg-rose-900/30 text-rose-400 px-3 py-1.5 rounded-full border border-rose-900/50 font-bold uppercase tracking-wider">Hero Image</span> : <button onClick={() => onSetHero(image.id)} className="h-9 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium flex items-center gap-1 group"><LayoutTemplate className="w-3 h-3 text-slate-400 group-hover:text-rose-400" />Make Hero</button>)}
                 {isNativeVideo && isOwner && (image.isCustomThumbnail ? <button onClick={handleRemoveThumbnail} disabled={isCapturing} className="h-9 px-3 flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium">{isCapturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}<span>Reset Thumb</span></button> : <button onClick={handleCaptureThumbnail} className="h-9 px-3 flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium">{captureSuccess ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Captured!</span></> : <><Camera className="w-3 h-3" /><span>Set Thumb</span></>}</button>)}
               </div>
               <div className="flex gap-2 flex-shrink-0 ml-auto items-center">
                 <div className="relative"><button onClick={handleShare} className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500 hover:text-blue-400"><Share2 className="w-5 h-5" /></button>{showShareTooltip && <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">Link Copied!</div>}</div>
                 <button onClick={() => onToggleFavorite(image.id)} className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${(isOwner ? image.isFavorite : isLiked) ? 'text-rose-500 bg-rose-500/10' : 'text-slate-500 hover:text-rose-500 hover:bg-slate-900'}`}><Heart className={`w-5 h-5 ${(isOwner ? image.isFavorite : isLiked) ? 'fill-current' : ''}`} /></button>
                 {isOwner ? (isEditing ? <button onClick={handleSave} className="w-9 h-9 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-colors shadow-lg shadow-rose-900/40"><Save className="w-5 h-5" /></button> : <button onClick={() => setIsEditing(true)} className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500 hover:text-rose-500"><Edit2 className="w-5 h-5" /></button>) : null}
                 {isOwner && !isEditing && <button onClick={() => onDelete(image.id)} className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>}
                 <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="space-y-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold">{owner ? owner.username.substring(0, 2).toUpperCase() : <UserIcon className="w-6 h-6" />}</div><div><p className="text-sm font-bold text-slate-200">{owner ? owner.username : 'Unknown User'}</p>{owner && <p className="text-xs text-slate-500">Community Member</p>}</div></div>
                {!isOwner && owner && <button className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${isFollowing ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800' : 'bg-rose-600 text-white hover:bg-rose-500'}`} onClick={() => alert(`Functionality to follow ${owner.username} is implemented in the App logic but simplified here.`)}>{isFollowing ? 'Following' : 'Follow'}</button>}
              </div>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="text-3xl font-black text-slate-100 bg-transparent border-b-2 border-slate-800 focus:border-rose-500 outline-none w-full pb-2 placeholder-slate-700" placeholder="Image Title" />
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:border-rose-500 outline-none text-sm min-h-[80px] resize-none placeholder-slate-600" placeholder="Add a detailed description..." />
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visibility</label><div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">{(['private', 'public', 'unlisted'] as const).map((v) => (<button key={v} onClick={() => setVisibility(v)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${visibility === v ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>{v === 'private' && <Lock className="w-3 h-3" />}{v === 'public' && <Globe className="w-3 h-3" />}{v === 'unlisted' && <Link className="w-3 h-3" />}<span className="capitalize">{v}</span></button>))}</div></div>
                    <div className="flex items-center gap-2"><LinkIcon className="w-4 h-4 text-slate-500" /><input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="flex-1 bg-transparent border-b border-slate-800 focus:border-rose-500 outline-none py-1 text-sm text-rose-400 placeholder-slate-600" placeholder="Add source URL..." /></div>
                    
                    {/* LOCATION INPUT: FIXED & RESTORED */}
                    <div className="space-y-2 pt-2 border-t border-slate-800 relative z-20">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Location</label>
                      <div className="flex gap-2 relative">
                        <div className="relative flex-1">
                          <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); setCoords(null); setLocationStatus('none'); setSearchResults([]); }} onKeyDown={(e) => e.key === 'Enter' && handleLookupLocation()} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm" placeholder="Search location..." />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">{isLocating ? <Loader2 className="w-4 h-4 text-rose-500 animate-spin" /> : locationStatus === 'found' ? <Check className="w-4 h-4 text-green-500" /> : locationStatus === 'not-found' ? <span className="text-[10px] text-red-500 font-bold uppercase">Invalid</span> : null}</div>
                        </div>
                        <button onClick={handleLookupLocation} disabled={isLocating || !location} className="px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"><Search className="w-4 h-4" /></button>
                      </div>
                      {searchResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"><div className="max-h-48 overflow-y-auto custom-scrollbar">{searchResults.map((result) => (<button key={result.place_id} onClick={() => selectLocation(result)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700 last:border-0 flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" /><span className="line-clamp-2">{result.display_name}</span></button>))}</div></div>}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl md:text-xl font-black text-slate-100 leading-tight">{image.title || 'Untitled'}</h2>
                    {image.description && <p className="text-slate-400 leading-relaxed">{image.description}</p>}
                    {image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-rose-500 hover:text-rose-400 font-medium hover:underline"><Globe className="w-4 h-4" />{getDomain(image.sourceUrl)}</a>}
                    <div className="flex items-center gap-4 text-slate-500 text-sm font-medium pt-2"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-600" />{image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown Date'}</div>{isOwner ? <button onClick={handleCycleVisibility} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs hover:border-rose-500 hover:text-rose-500 transition-colors cursor-pointer group">{image.visibility === 'public' && <Globe className="w-3 h-3 group-hover:text-rose-500" />}{image.visibility === 'unlisted' && <Link className="w-3 h-3 group-hover:text-rose-500" />}{(!image.visibility || image.visibility === 'private') && <Lock className="w-3 h-3 group-hover:text-rose-500" />}<span className="capitalize">{image.visibility || 'Private'}</span></button> : <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs">{image.visibility === 'public' && <Globe className="w-3 h-3" />}{image.visibility === 'unlisted' && <Link className="w-3 h-3" />}{(!image.visibility || image.visibility === 'private') && <Lock className="w-3 h-3" />}<span className="capitalize">{image.visibility || 'Private'}</span></div>}</div>
                  </>
                )}
              </div>
              <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Location</label>{(image.location || image.latitude) ? (<div className="flex items-center gap-2 text-slate-400 text-sm font-medium">{image.location ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(image.location)}`} target="_blank" rel="noopener noreferrer" className="hover:text-rose-400 hover:underline transition-colors flex items-center gap-1">{image.location}<ExternalLink className="w-3 h-3 opacity-50" /></a> : <span>Pinned at {image.latitude?.toFixed(4)}, {image.longitude?.toFixed(4)}</span>}</div>) : <span className="text-sm text-slate-600 italic">No location added</span>}</div>
              <div><h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Hash className="w-3 h-3" />Tags</h3><div className="flex flex-wrap gap-2 mb-3">{image.tags.map((tag, i) => (<div key={i} className="group flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-slate-300 rounded-full text-xs font-semibold border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800 transition-colors cursor-default"><span>{tag}</span>{isOwner && <button onClick={() => handleRemoveTag(tag)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all ml-1"><X className="w-3 h-3" /></button>}</div>))}{isOwner && <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/50 text-slate-400 rounded-full text-xs border border-dashed border-slate-800 hover:border-slate-600 focus-within:border-rose-500 focus-within:text-rose-500 transition-colors"><Plus className="w-3 h-3" /><input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={handleAddTag} placeholder="Add tag..." className="bg-transparent outline-none w-16 focus:w-24 transition-all placeholder-slate-600" /></div>}</div></div>
              {!isEditing && (<div className="pt-4 border-t border-slate-900"><h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><FolderPlus className="w-3 h-3" />{isOwner ? "Add to Board" : "Save to Your Board"}</h3><div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">{boards.map(board => { const isPinned = image.boardIds.includes(board.id); return (<button key={board.id} onClick={() => onTogglePin(image.id, board.id)} className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${isPinned ? 'bg-rose-900/20 border-rose-900/50 text-rose-500' : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-700 hover:bg-slate-900/50'}`}><span className="truncate">{board.name}</span>{isPinned && <Check className="w-3 h-3" />}</button>); })}{boards.length === 0 && <p className="text-xs text-slate-600 col-span-2">No boards created yet.</p>}</div></div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageDetailModal;