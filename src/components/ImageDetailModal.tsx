
import React, { useState, useEffect, useRef } from 'react';
import { PinnedImage, Board, Visibility } from '../types';
import { X, Calendar, Hash, FolderPlus, Check, MapPin, ExternalLink, Edit2, Save, Loader2, Search, Heart, Share2, Link as LinkIcon, Globe, Plus, Trash2, ChevronLeft, ChevronRight, Layers, LayoutTemplate, Camera, RotateCcw, Lock, Link, User } from 'lucide-react';
import { authService } from '../services/authService';

interface ImageDetailModalProps {
  image: PinnedImage;
  onClose: () => void;
  boards: Board[];
  onTogglePin: (imageId: string, boardId: string) => void;
  onUpdate: (image: PinnedImage) => void;
  onToggleFavorite: (id: string) => void;
  groupImages?: PinnedImage[];
  onSelectImage?: (id: string) => void;
  onSetHero?: (id: string) => void;
}

interface LocationResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ 
  image, onClose, boards, onTogglePin, onUpdate, onToggleFavorite,
  groupImages, onSelectImage, onSetHero
}) => {
  // CRITICAL FIX: Ensure safe access to arrays to prevent "Blank Screen" crash
  const safeTags = image.tags || [];
  const safeLikedBy = image.likedBy || [];
  const safeBoardIds = image.boardIds || [];

  const currentUser = authService.getCurrentUser();
  const users = authService.getUsers();
  const owner = users.find(u => u.id === image.ownerId);
  const isOwner = currentUser && image.ownerId === currentUser.id;
  const isLiked = currentUser && (image.likedBy || []).includes(currentUser.id);
  const likeCount = (image.likedBy || []).length;
  const isFollowing = currentUser && owner && (currentUser.following || []).includes(owner.id);

  const [isEditing, setIsEditing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Edit State
  const [title, setTitle] = useState(image.title);
  const [description, setDescription] = useState(image.description || '');
  const [sourceUrl, setSourceUrl] = useState(image.sourceUrl || '');
  const [location, setLocation] = useState(image.location || '');
  const [visibility, setVisibility] = useState<Visibility>(image.visibility || 'private');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(
    image.latitude && image.longitude ? { lat: image.latitude, lng: image.longitude } : null
  );
  
  // Tag Input State
  const [newTag, setNewTag] = useState('');
  
  // Geocoding state
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'none' | 'found' | 'not-found'>(
    image.latitude ? 'found' : 'none'
  );
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  // Update local state if image prop changes (e.g. external updates)
  useEffect(() => {
    setTitle(image.title);
    setDescription(image.description || '');
    setSourceUrl(image.sourceUrl || '');
    setLocation(image.location || '');
    setVisibility(image.visibility || 'private');
    setCoords(image.latitude && image.longitude ? { lat: image.latitude, lng: image.longitude } : null);
    setIsEditing(false); // Reset edit mode on image change
    setCaptureSuccess(false);
  }, [image]);

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

  const handleSave = () => {
    const updatedImage: PinnedImage = {
      ...image,
      title: title.trim() || 'Untitled',
      description: description.trim(),
      sourceUrl: sourceUrl.trim(),
      location: location.trim(),
      latitude: coords?.lat,
      longitude: coords?.lng,
      visibility: visibility
    };
    onUpdate(updatedImage);
    setIsEditing(false);
  };

  const handleCycleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner) return;

    const modes: Visibility[] = ['private', 'public', 'unlisted'];
    const currentIdx = modes.indexOf(image.visibility || 'private');
    const nextVis = modes[(currentIdx + 1) % modes.length];
    
    // Optimistic update handled by onUpdate triggering prop change
    onUpdate({ ...image, visibility: nextVis });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const tagToAdd = newTag.trim();
      const exists = safeTags.some(t => t.toLowerCase() === tagToAdd.toLowerCase());

      if (!exists) {
        const updatedTags = [...image.tags, tagToAdd];
        onUpdate({ ...image, tags: updatedTags });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = image.tags.filter(t => t !== tagToRemove);
    onUpdate({ ...image, tags: updatedTags });
  };

  const handleShare = async () => {
    // Explicitly construct URL to ensure it points to this pin
    const url = new URL(window.location.origin);
    url.searchParams.set('pin', image.id);

    try {
      await navigator.clipboard.writeText(url.toString());
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const captureFrame = (video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          return canvas.toDataURL('image/jpeg', 0.8);
        } catch (securityError) {
          console.warn("Cannot capture frame: SecurityError (CORS restriction on video source).");
          return null;
        }
      }
    } catch (err) {
      console.error("Canvas draw failed", err);
    }
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
             tempVideo!.onloadeddata = () => {
                // Ensure time is set after metadata loaded
                tempVideo!.currentTime = video.currentTime;
             };
             tempVideo!.onseeked = () => resolve(true);
             tempVideo!.onerror = () => reject(new Error('CORS load failed'));
             
             // Timeout fallback
             setTimeout(() => reject(new Error('Timeout')), 5000);
          });
          captureVideo = tempVideo;
      }
      
      const newThumbnail = captureFrame(captureVideo);
      
      if (newThumbnail) {
         onUpdate({ ...image, thumbnailUrl: newThumbnail, isCustomThumbnail: true });
         setCaptureSuccess(true);
         setTimeout(() => setCaptureSuccess(false), 2000);
      } else {
         throw new Error('Capture returned null');
      }
    } catch (e) {
       console.warn("Capture failed", e);
       alert("Could not capture frame. This usually happens with external videos due to browser security restrictions.");
    } finally {
       setIsCapturing(false);
    }
  };

  const handleRemoveThumbnail = async () => {
    // Just revert to default behavior (which might be placeholder or re-generate if file is local)
    // For local files we can re-generate, for external we might lose the thumbnail if we can't capture.
    // Ideally we should store the original thumbnail if it was generated on upload.
    // For now, let's just clear the custom flag and thumbnailUrl.
    onUpdate({ ...image, thumbnailUrl: undefined, isCustomThumbnail: false });
  };

  // Group Navigation Logic
  const currentIndex = groupImages ? groupImages.findIndex(i => i.id === image.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = groupImages ? currentIndex < groupImages.length - 1 : false;

  const handleNext = () => {
    if (hasNext && groupImages && onSelectImage) {
      onSelectImage(groupImages[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (hasPrev && groupImages && onSelectImage) {
      onSelectImage(groupImages[currentIndex - 1].id);
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; // Don't navigate while typing in inputs
      
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, isEditing]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderMedia = () => {
    if (image.mediaType === 'video') {
      const { type, id } = image.videoMetadata || {};
      
      if (type === 'youtube' && id) {
        // Use youtube-nocookie.com to prevent bot verification errors
        const origin = window.location.origin;
        return (
          <iframe 
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&origin=${origin}`}
            title={image.title}
            className="w-full h-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        );
      }
      
      if (type === 'vimeo' && id) {
        return (
          <iframe 
            src={`https://player.vimeo.com/video/${id}?autoplay=1`}
            title={image.title}
            className="w-full h-full aspect-video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        );
      }

      // Native or Generic URL
      return (
        <video 
          ref={videoRef}
          src={image.url} 
          controls 
          autoPlay 
          // Removed crossOrigin="anonymous" to ensure playback works for non-CORS sources
          className="w-full h-full object-contain bg-black"
          poster={image.thumbnailUrl}
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <img src={image.url} className="w-full h-full object-contain" alt={image.title} />
    );
  };

  const isNativeVideo = image.mediaType === 'video' && 
    (image.videoMetadata?.type === 'native' || image.videoMetadata?.type === 'generic-url' || !image.videoMetadata);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-8 bg-black/95 md:bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 w-full md:max-w-6xl md:rounded-[40px] rounded-none overflow-hidden shadow-2xl flex flex-col md:flex-row h-full md:max-h-[90vh] border-0 md:border border-slate-900 relative" onClick={(e) => e.stopPropagation()}>

        {/* Navigation Arrows for Group */}
        {groupImages && (
          <>
            {hasPrev && (
              <button 
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors hidden md:block"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            {hasNext && (
              <button 
                onClick={handleNext}
                className="absolute right-[42%] top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors hidden md:block"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </>
        )}

        {/* Left Side - Media Player - Mobile Height 65% */}
        <div className="md:w-3/5 h-[65vh] md:h-full bg-black flex items-center justify-center overflow-hidden relative group flex-shrink-0">
          {renderMedia()}
          
          {/* Only show source badge for images, not videos to avoid blocking controls */}
          {image.mediaType !== 'video' && (
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-white/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {image.url.startsWith('data:') ? 'Local Image' : 'External URL'}
            </div>
          )}

          {image.sourceUrl && (
             <a 
              href={image.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-10"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Site
            </a>
          )}
        </div>

        {/* Right Side - Details */}
        <div className="md:w-2/5 flex-1 md:h-full flex flex-col p-6 md:p-12 overflow-y-auto custom-scrollbar bg-slate-950 pb-safe-bottom">

          <div className="flex justify-between items-center mb-6">
             {/* Group Indicator / Set Hero */}
             <div className="flex-1 flex items-center gap-2">
               {groupImages && (
                 <>
                   {currentIndex === 0 ? (
                      <span className="text-xs bg-rose-900/30 text-rose-400 px-3 py-1.5 rounded-full border border-rose-900/50 font-bold uppercase tracking-wider">
                        Hero Image
                      </span>
                   ) : (
                      onSetHero && (
                        <button 
                          onClick={() => onSetHero(image.id)}
                          className="h-9 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium flex items-center gap-1 group"
                          title="Make this the cover image for the group"
                        >
                          <LayoutTemplate className="w-3 h-3 text-slate-400 group-hover:text-rose-400" />
                          Make Hero
                        </button>
                      )
                   )}
                 </>
               )}
               
               {/* Video Thumbnail Buttons */}
               {isNativeVideo && isOwner && (
                 image.isCustomThumbnail ? (
                    <button
                      onClick={handleRemoveThumbnail}
                      disabled={isCapturing}
                      className="h-9 px-3 flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium"
                      title="Reset to default thumbnail"
                    >
                      {isCapturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      <span>Reset Thumb</span>
                    </button>
                 ) : (
                    <button
                      onClick={handleCaptureThumbnail}
                      className="h-9 px-3 flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors font-medium"
                      title="Use current video frame as thumbnail"
                    >
                      {captureSuccess ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">Captured!</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3 h-3" />
                          <span>Set Thumb</span>
                        </>
                      )}
                    </button>
                 )
               )}
             </div>

             <div className="flex gap-2 flex-shrink-0 ml-auto items-center">
               <div className="relative">
                <button 
                  onClick={handleShare}
                  className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500 hover:text-blue-400"
                  title="Share Link"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                {showShareTooltip && (
                  <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                    Link Copied!
                  </div>
                )}
               </div>

               <button 
                onClick={() => onToggleFavorite(image.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                  (isOwner ? image.isFavorite : isLiked) 
                    ? 'text-rose-500 bg-rose-500/10' 
                    : 'text-slate-500 hover:text-rose-500 hover:bg-slate-900'
                }`}
                title={isOwner ? "Favorite" : "Like"}
              >
                <Heart className={`w-5 h-5 ${(isOwner ? image.isFavorite : isLiked) ? 'fill-current' : ''}`} />
              </button>

              {isOwner ? (
                isEditing ? (
                  <button 
                    onClick={handleSave} 
                    className="w-9 h-9 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-colors shadow-lg shadow-rose-900/40"
                    title="Save Changes"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500 hover:text-rose-500"
                    title="Edit Details"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )
              ) : null}
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-slate-900 rounded-full transition-colors text-slate-500">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Author Section - New */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-900">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold">
                   {owner ? owner.username.substring(0, 2).toUpperCase() : <User className="w-6 h-6" />}
                 </div>
                 <div>
                   <p className="text-sm font-bold text-slate-200">{owner ? owner.username : 'Unknown User'}</p>
                   {owner && (
                     <p className="text-xs text-slate-500">
                       {/* This could show follower count if we had it fully implemented across all users */}
                       Community Member
                     </p>
                   )}
                 </div>
              </div>
              
              {!isOwner && owner && (
                <button
                   // In a real app this would toggle follow state, passed via props
                   // For now it's visual to show the UI
                   className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                     isFollowing 
                       ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                       : 'bg-rose-600 text-white hover:bg-rose-500'
                   }`}
                   onClick={() => alert(`Functionality to follow ${owner.username} is implemented in the App logic but simplified here.`)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Title & Description */}
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-3xl font-black text-slate-100 bg-transparent border-b-2 border-slate-800 focus:border-rose-500 outline-none w-full pb-2 placeholder-slate-700"
                    placeholder="Image Title"
                  />
                   <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:border-rose-500 outline-none text-sm min-h-[80px] resize-none placeholder-slate-600"
                    placeholder="Add a detailed description..."
                  />
                  
                  {/* Visibility Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visibility</label>
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
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

                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-slate-500" />
                    <input 
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="flex-1 bg-transparent border-b border-slate-800 focus:border-rose-500 outline-none py-1 text-sm text-rose-400 placeholder-slate-600"
                      placeholder="Add source URL (e.g. https://nike.com...)"
                    />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl md:text-xl font-black text-slate-100 leading-tight">{image.title || 'Untitled'}</h2>
                  {image.description && <p className="text-slate-400 leading-relaxed">{image.description}</p>}
                  
                  {image.sourceUrl && (
                    <a 
                      href={image.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-rose-500 hover:text-rose-400 font-medium hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      {new URL(image.sourceUrl).hostname.replace('www.', '')}
                    </a>
                  )}

                  <div className="flex items-center gap-4 text-slate-500 text-sm font-medium pt-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      {image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown Date'}
                    </div>
                    {/* Visibility Badge - Clickable for Owner */}
                    {isOwner ? (
                       <button 
                          onClick={handleCycleVisibility}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs hover:border-rose-500 hover:text-rose-500 transition-colors cursor-pointer group"
                          title="Click to toggle visibility (Private -> Public -> Unlisted)"
                       >
                          {image.visibility === 'public' && <Globe className="w-3 h-3 group-hover:text-rose-500" />}
                          {image.visibility === 'unlisted' && <Link className="w-3 h-3 group-hover:text-rose-500" />}
                          {(!image.visibility || image.visibility === 'private') && <Lock className="w-3 h-3 group-hover:text-rose-500" />}
                          <span className="capitalize">{image.visibility || 'Private'}</span>
                       </button>
                    ) : (
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
                          {image.visibility === 'public' && <Globe className="w-3 h-3" />}
                          {image.visibility === 'unlisted' && <Link className="w-3 h-3" />}
                          {(!image.visibility || image.visibility === 'private') && <Lock className="w-3 h-3" />}
                          <span className="capitalize">{image.visibility || 'Private'}</span>
                       </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Location
              </label>
              
              {isEditing ? (
                 <div className="relative z-10">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
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
                          placeholder="Search location..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm"
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
                  </div>
              ) : (
                (image.location || image.latitude) ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                     {image.location ? (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(image.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-rose-400 hover:underline transition-colors flex items-center gap-1"
                      >
                        {image.location}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    ) : (
                      <span>Pinned at {image.latitude?.toFixed(4)}, {image.longitude?.toFixed(4)}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-600 italic">No location added</span>
                )
              )}
            </div>

            {/* Tags - Always Editable */}
            <div>
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Hash className="w-3 h-3" />
                Tags
              </h3>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {image.tags.map((tag, i) => (
                  <div key={i} className="group flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-slate-300 rounded-full text-xs font-semibold border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800 transition-colors cursor-default">
                    <span>{tag}</span>
                    {isOwner && (
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add Tag Input */}
                {isOwner && (
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/50 text-slate-400 rounded-full text-xs border border-dashed border-slate-800 hover:border-slate-600 focus-within:border-rose-500 focus-within:text-rose-500 transition-colors">
                    <Plus className="w-3 h-3" />
                    <input 
                      type="text" 
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Add tag..."
                      className="bg-transparent outline-none w-16 focus:w-24 transition-all placeholder-slate-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Boards / Save Section */}
            {!isEditing && (
              <div className="pt-4 border-t border-slate-900">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FolderPlus className="w-3 h-3" />
                  {isOwner ? "Add to Board" : "Save to Your Board"}
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {boards.map(board => {
                    const isPinned = image.boardIds.includes(board.id);
                    return (
                      <button
                        key={board.id}
                        onClick={() => onTogglePin(image.id, board.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${
                          isPinned 
                            ? 'bg-rose-950/20 border-rose-900/50 text-rose-500' 
                            : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-700 hover:bg-slate-900/50'
                        }`}
                      >
                        <span className="truncate">{board.name}</span>
                        {isPinned && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                  {boards.length === 0 && <p className="text-xs text-slate-600 col-span-2">No boards created yet.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDetailModal;
