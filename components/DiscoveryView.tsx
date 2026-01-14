import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { Plus, Trash2, ExternalLink, Loader2, Rss, X, Check, Search, Wifi, Sparkles, RefreshCw, ArrowUpRight } from 'lucide-react';

interface DiscoveryItem {
    id: string;
    title: string;
    link: string;
    imageUrl: string;
    feedName: string;
    pubDate: number;
}

interface Feed {
    id: string;
    url: string;
    name: string;
}

interface DiscoveryViewProps {
    onSave: () => void;
}

// --- HELPER FUNCTIONS ---
const getProxiedUrl = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// --- PIN CARD COMPONENT ---
const PinCard = React.memo(({ 
    item, 
    isSaved, 
    onSave, 
    onFilter,
    activeFilter, 
    feedLink 
}: { 
    item: DiscoveryItem, 
    isSaved: boolean, 
    onSave: (item: DiscoveryItem) => void,
    onFilter: (name: string) => void,
    activeFilter: string,
    feedLink: string
}) => {
    return (
        <div className="group flex flex-col bg-[#0B1120] border border-slate-800 rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]">
            <div className="relative bg-[#020617] overflow-hidden">
                <img 
                    src={getProxiedUrl(item.imageUrl)} 
                    className="w-full h-auto object-contain transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                    alt={item.title}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<div class="w-full h-32 flex flex-col items-center justify-center text-slate-700 bg-slate-950 p-4 text-center"><div class="mb-2">⚠️</div><div class="text-[10px] font-mono">Image Unavailable</div></div>`;
                    }}
                />
                
                {/* Top-Right Circular Action Buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                    <a 
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/40 hover:bg-teal-600 backdrop-blur-md text-white border border-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                        title="Open Pin"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={14} strokeWidth={2.5} />
                    </a>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            !isSaved && onSave(item);
                        }}
                        disabled={isSaved}
                        className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 shadow-lg ${
                            isSaved 
                            ? 'bg-teal-500 text-white border-teal-500 cursor-default' 
                            : 'bg-black/40 text-white border-white/10 hover:bg-teal-600 hover:border-teal-500 hover:scale-110'
                        }`}
                        title={isSaved ? "Saved" : "Save to Library"}
                    >
                        {isSaved ? <Check size={16} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
                    </button>
                </div>
            </div>

            <div className="p-3 md:p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <h4 className="text-white font-bold text-sm leading-snug line-clamp-2 mb-2" title={item.title}>
                        {item.title || "Untitled"}
                    </h4>
                    
                    {/* Updated Footer Metadata Row */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider flex-wrap">
                        <button 
                            onClick={() => onFilter(item.feedName)}
                            className={`font-bold truncate max-w-[100px] transition-colors text-left ${activeFilter === item.feedName ? 'text-teal-400 underline decoration-teal-500/50' : 'text-teal-500 hover:text-teal-400 hover:underline'}`}
                            title={activeFilter === item.feedName ? "Clear Filter" : "Filter by Feed"}
                        >
                            {item.feedName}
                        </button>
                        
                        <span className="text-slate-700">•</span>
                        <span>{formatDate(item.pubDate)}</span>

                        {/* Moved External Link to Far Right & Increased Size */}
                        <a 
                            href={feedLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-slate-600 hover:text-white transition-colors bg-slate-800/50 hover:bg-teal-500 p-1.5 rounded-full"
                            title={`Go to ${item.feedName} on Pinterest`}
                        >
                            <ArrowUpRight size={14} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ onSave }) => {
    const [items, setItems] = useState<DiscoveryItem[]>([]);
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showManage, setShowManage] = useState(false);
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [savingIds, setSavingIds] = useState<string[]>([]);
    
    // Filter State
    const [activeFilter, setActiveFilter] = useState<string>('all');

    // Layout State for Masonry
    const [colCount, setColCount] = useState(2);

    useEffect(() => {
        loadData();
        
        const handleResize = () => {
            const width = window.innerWidth;
            if (width >= 1280) setColCount(4); // lg/xl
            else if (width >= 768) setColCount(3); // md
            else setColCount(2); // mobile
        };

        window.addEventListener('resize', handleResize);
        handleResize(); 

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [feedList, discoveryItems] = await Promise.all([
                dataService.getFeeds(),
                dataService.getDiscoveryItems()
            ]);
            setFeeds(feedList);
            setItems(discoveryItems);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredItems = useMemo(() => {
        if (activeFilter === 'all') return items;
        return items.filter(item => item.feedName === activeFilter);
    }, [items, activeFilter]);

    // Masonry Distribution Logic
    const columns = useMemo(() => {
        const cols: DiscoveryItem[][] = Array.from({ length: colCount }, () => []);
        filteredItems.forEach((item, i) => {
            cols[i % colCount].push(item);
        });
        return cols;
    }, [filteredItems, colCount]);

    // NEW: Smart Toggle Logic
    const toggleFilter = (feedName: string) => {
        setActiveFilter(prev => prev === feedName ? 'all' : feedName);
    };

    const handleAddFeed = async () => {
        if (!newFeedUrl.trim()) return;
        
        let urlToSubmit = newFeedUrl.trim();
        if (!urlToSubmit.startsWith('http')) {
            urlToSubmit = 'https://' + urlToSubmit;
        }

        if (urlToSubmit.includes('pinterest.com') && !urlToSubmit.endsWith('.rss')) {
            if (urlToSubmit.endsWith('/')) urlToSubmit = urlToSubmit.slice(0, -1);
            const pathSegments = new URL(urlToSubmit).pathname.split('/').filter(Boolean);
            if (pathSegments.length >= 2) urlToSubmit += '.rss';
            else urlToSubmit += '/feed.rss';
        }

        setIsAdding(true);
        try {
            await dataService.addFeed(urlToSubmit);
            setNewFeedUrl('');
            await loadData();
        } catch (e) {
            alert("Could not validate feed.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteFeed = async (id: string) => {
        if (confirm("Unsubscribe?")) {
            await dataService.deleteFeed(id);
            loadData();
        }
    };

    const handleSaveItem = async (item: DiscoveryItem) => {
        setSavingIds(prev => [...prev, item.id]);
        try {
            await dataService.addPin({
                title: item.title,
                description: `Saved from ${item.feedName}`,
                imageUrl: item.imageUrl,
                link: item.link,
                tags: ['discovery', item.feedName.toLowerCase().replace(/\s+/g, '-')],
                boardIds: [],
                aspectRatio: 1 // Default, server will calc real ratio
            });
            onSave();
        } catch (e) {
            alert("Failed to save.");
            setSavingIds(prev => prev.filter(id => id !== item.id));
        }
    };

    const getFeedLink = (feedName: string) => {
        const feed = feeds.find(f => f.name === feedName);
        if (!feed) return '#';
        return feed.url.replace('/feed.rss', '').replace('.rss', '');
    };

    return (
        <div className="bg-[#000208] min-h-full pb-20">
            {/* Header */}
            <div className="pt-6 px-6 relative group">
                <div className="relative bg-gradient-to-r from-[#0B1120] to-teal-950/30 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 shadow-2xl overflow-hidden">
                    
                    <div className="absolute top-0 left-0 w-96 h-full bg-teal-500/5 blur-3xl pointer-events-none" />

                    <div className="flex flex-col relative z-10">
                        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3 drop-shadow-[0_0_15px_rgba(20,184,166,0.25)]">
                            Discovery
                        </h1>
                        
                        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                                <Rss size={12} className="text-teal-400" />
                                Live Feed
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span>{feeds.length} Subscription{feeds.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <button 
                            onClick={loadData}
                            disabled={isLoading}
                            className={`h-10 w-10 rounded-xl flex items-center justify-center border border-white/5 hover:border-white/10 text-slate-300 hover:text-white transition-all bg-black/20 ${isLoading ? 'animate-spin opacity-50' : 'hover:bg-white/5'}`}
                            title="Refresh Feed"
                        >
                            <RefreshCw size={16} />
                        </button>

                        <button 
                            onClick={() => setShowManage(!showManage)}
                            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-wider border ${showManage ? 'bg-teal-500/10 text-teal-400 border-teal-500/50' : 'text-slate-300 hover:text-white hover:bg-white/5 border-white/5 hover:border-white/10 bg-black/20'}`}
                        >
                            {showManage ? <X size={16} /> : <Plus size={16} />}
                            <span className="inline">{showManage ? 'Close Manager' : 'Manage Feeds'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Feed Manager Panel */}
            <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] px-6 ${showManage ? 'max-h-[600px] mt-6 opacity-100' : 'max-h-0 mt-0 opacity-0'}`}>
                <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input 
                                value={newFeedUrl}
                                onChange={e => setNewFeedUrl(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddFeed()}
                                placeholder="Paste Pinterest URL (pinterest.com/username) or RSS link..."
                                className="w-full bg-black/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-medium"
                            />
                        </div>
                        <button 
                            onClick={handleAddFeed}
                            disabled={isAdding}
                            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wide text-xs transition-all shadow-lg shadow-teal-900/20"
                        >
                            {isAdding ? <Loader2 className="animate-spin" /> : 'Subscribe'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {feeds.map(feed => (
                            <div key={feed.id} className="flex justify-between items-center p-3 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                        <Wifi size={14} className="text-slate-400"/>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-slate-200 font-bold text-sm truncate">{feed.name}</div>
                                        <div className="text-[10px] text-slate-600 font-mono truncate">{feed.url}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteFeed(feed.id)} 
                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter Pills Bar */}
            {feeds.length > 0 && (
                <div className="px-6 mt-6 overflow-x-auto no-scrollbar pb-2">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setActiveFilter('all')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap shadow-lg ${
                                activeFilter === 'all' 
                                ? 'bg-gradient-to-r from-teal-900/40 to-teal-800/40 border-teal-500/50 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]' 
                                : 'bg-gradient-to-b from-slate-900/50 to-black/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                            }`}
                        >
                            All Feeds
                        </button>
                        
                        <div className="w-px h-4 bg-slate-800 mx-1 shrink-0"></div>

                        {feeds.map(feed => (
                            <button 
                                key={feed.id}
                                onClick={() => toggleFilter(feed.name)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap flex items-center gap-2 shadow-lg ${
                                    activeFilter === feed.name 
                                    ? 'bg-gradient-to-r from-teal-900/40 to-teal-800/40 border-teal-500/50 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]' 
                                    : 'bg-gradient-to-b from-slate-900/50 to-black/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                }`}
                            >
                                {feed.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Grid (Controlled Masonry) */}
            <div className="px-4 md:px-6 py-6">
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-teal-500 w-8 h-8" />
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Feeds...</span>
                        </div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                            <Sparkles className="text-slate-600" size={24} />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1">Nothing to see here</h3>
                        <p className="text-slate-500 text-sm max-w-xs">
                            {activeFilter !== 'all' ? `No posts found in ${activeFilter}` : 'Add a Pinterest user or RSS feed to start curating.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-4 md:gap-6 items-start max-w-[1800px] mx-auto">
                        {columns.map((colItems, colIndex) => (
                            <div key={colIndex} className="flex-1 flex flex-col gap-4 md:gap-6 min-w-0">
                                {colItems.map(item => (
                                    <PinCard 
                                        key={item.id} 
                                        item={item} 
                                        isSaved={savingIds.includes(item.id)}
                                        onSave={handleSaveItem}
                                        onFilter={toggleFilter}
                                        activeFilter={activeFilter}
                                        feedLink={getFeedLink(item.feedName)}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};