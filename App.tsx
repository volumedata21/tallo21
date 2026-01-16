import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MasonryGrid } from './components/MasonryGrid';
import { PinCard } from './components/PinCard';
import { AdminPanel } from './components/AdminPanel';
import { PinModal } from './components/PinModal';
import { CreatePinModal } from './components/CreatePinModal';
import { MapView } from './components/MapView';
import { DiscoveryView } from './components/DiscoveryView';
import { BulkActionBar } from './components/BulkActionBar';
import { LoginScreen } from './components/LoginScreen';
import { ProfileModal } from './components/ProfileModal';
import { CreatorProfile } from './components/CreatorProfile';
import { BoardHeader } from './components/BoardHeader';
import { CollectionHeader } from './components/CollectionHeader';
import { dataService } from './services/dataService';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { Pin, UserSettings, Collection, Board, SortOption, User } from './types';
import { EditCollectionModal } from './components/EditCollectionModal';
import { EditBoardModal } from './components/EditBoardModal';
import { Sliders, Check, MousePointer2, Shuffle, CheckSquare, Tag as TagIcon, Undo, Loader2, AlertTriangle, ArrowUpDown, ChevronDown, Globe, Lock, EyeOff, X, Plus } from 'lucide-react';

if (!(dataService as any).completePasswordReset) {
    (dataService as any).completePasswordReset = async (token: string, newPass: string) => {
        const res = await fetch('/api/auth/complete-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword: newPass })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Reset failed");
        }
        return res.json();
    };
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error?: Error }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    componentDidCatch(error: any, errorInfo: any) { console.error("Uncaught error:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                    <AlertTriangle size={48} className="text-red-500 mb-4" />
                    <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-red-200 font-mono text-xs max-w-lg overflow-auto mb-6">
                        {this.state.error?.message || "Unknown Error"}
                    </div>
                    <button onClick={() => window.location.reload()} className="bg-teal-600 px-6 py-2 rounded-lg font-bold hover:bg-teal-500 transition">Reload App</button>
                </div>
            );
        }
        return this.props.children;
    }
}

const getInitialFilter = () => {
    if (typeof window === 'undefined') return { type: 'all' as const, id: '' };
    const params = new URLSearchParams(window.location.search);
    if (params.get('collection')) return { type: 'collection' as const, id: params.get('collection')! };
    if (params.get('board')) return { type: 'board' as const, id: params.get('board')! };
    if (params.get('tag')) return { type: 'tag' as const, id: params.get('tag')! };
    if (params.get('favorites')) return { type: 'favorites' as const, id: '' };
    return { type: 'all' as const, id: '' };
};

function App() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [isServerOpen, setIsServerOpen] = useState(false); // Default to locked
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return true;
    });

    const [pins, setPins] = useState<Pin[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [boards, setBoards] = useState<Board[]>([]);
    const [trendingTags, setTrendingTags] = useState<string[]>([]);
    const [allTags, setAllTags] = useState<string[]>([]);

    // --- Collection Edit State ---
    const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);

    // --- NEW: Board Edit State ---
    const [boardToEdit, setBoardToEdit] = useState<Board | null>(null);

    // Navigation: Update URL and State
    const handleOpenProfile = (userId: string) => {
        setViewingProfileId(userId);
        setIsSidebarOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.set('profile', userId);
        window.history.pushState({ profile: userId }, '', url.toString());
    };

    // Close Profile: Clear URL and State
    const handleCloseProfile = () => {
        setViewingProfileId(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('profile');
        window.history.pushState({}, '', url.toString());
    };

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const [activeFilter, setActiveFilter] = useState(getInitialFilter());
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300); // Wait 300ms


    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const [userSettings, setUserSettings] = useState<UserSettings>({
        hideTitles: false,
        hideDescriptions: false,
        showTags: true,
        darkMode: true
    });

    const [toast, setToast] = useState<{ message: string, onUndo: () => void } | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sortRef = useRef<HTMLDivElement>(null);

    // --- EFFECTS ---

    // Listen for OIDC Login Token in URL
    // --- NEW: OIDC Token Handler ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            if (token) {
                // 1. Clean URL immediately so token doesn't sit in browser history
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                window.history.replaceState({}, '', url.toString());

                // 2. Verify token with server
                fetch('/api/users/current', {
                    headers: { 'x-api-token': token }
                })
                .then(res => res.json())
                .then(user => {
                    if (user && user.id) {
                        // 3. Save session (Logs the user in)
                        localStorage.setItem('tallo_user', JSON.stringify({ ...user, token }));
                        setCurrentUser(user);
                        // Note: The existing useEffect below will see 'currentUser' change and load your pins automatically.
                    }
                })
                .catch(err => console.error("OIDC Login Error", err));
            }
        }
    }, []);

    useEffect(() => {
        // Only run effects if user is logged in OR server is open
        if (currentUser || isServerOpen) {
            // Check if we are loading the root URL without parameters
            const params = new URLSearchParams(window.location.search);
            const hasParams = params.toString().length > 0;

            if (!hasParams && currentUser && currentUser.homePagePreference === 'created') {
                setActiveFilter({ type: 'created', id: currentUser.id });
            } else if (!hasParams) {
                // Default fallback
                setPage(1);
                setHasMore(true);
                setPins([]);
            }

            refreshData(true);
        }
    }, [currentUser, isServerOpen]);

    // FIX: Handle Browser Back Button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const params = new URLSearchParams(window.location.search);
            const profileId = params.get('profile');
            setViewingProfileId(profileId); // Will be null if back to home

            if (selectedPin) setSelectedPin(null);
            if (isCreateOpen) setIsCreateOpen(false);
            if (isAdminOpen) setIsAdminOpen(false);
            if (isProfileOpen) setIsProfileOpen(false);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedPin, isCreateOpen, isAdminOpen, isProfileOpen]);

    useEffect(() => {
        const checkAuth = async () => {
            setIsLoading(true);

            // 1. Check Server Status
            try {
                const status = await dataService.getServerStatus();
                setIsServerOpen(status.isServerOpen);
            } catch (e) {
                console.error("Failed to check server status", e);
            }

            // 2. Check User Session
            const stored = localStorage.getItem('tallo_user');
            if (stored) {
                try {
                    const localUser = JSON.parse(stored);
                    const verifiedUser = await dataService.getUserById(localUser.id);
                    setCurrentUser(verifiedUser);
                } catch (e) {
                    localStorage.removeItem('tallo_user');
                    setCurrentUser(null);
                }
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    useEffect(() => {
        // Allow deep linking if user is logged in OR server is open
        if (!currentUser && !isServerOpen) return;

        const params = new URLSearchParams(window.location.search);
        const pinId = params.get('pinId');
        if (pinId) {
            dataService.getPin(pinId)
                .then(pin => setSelectedPin(pin))
                .catch(err => console.error("Deep link pin not found", err));
        }
    }, [currentUser, isServerOpen]);

    const closeModal = () => {
        setSelectedPin(null);
        setIsCreateOpen(false);
        setIsAdminOpen(false);
        setIsProfileOpen(false);
        // Only clear params if NOT in profile view (so we don't accidentally close profile)
        if (!viewingProfileId) {
            const url = new URL(window.location.href);
            url.search = "";
            window.history.replaceState(null, '', url.toString());
        }
    };



    const refreshData = async (reset = false, searchOverride?: string) => {
        // Allow if guest AND server open
        if (!currentUser && !isServerOpen) return;
        if (activeFilter.type === 'discovery') {
            setIsLoading(false);
            return;
        }

        const targetPage = reset ? 1 : page;
        const currentUserId = currentUser ? currentUser.id : '';

        // Use override if provided, otherwise fall back to state
        const termToSearch = searchOverride !== undefined ? searchOverride : searchQuery;

        try {
            if (reset) setIsLoading(true);
            else setIsFetchingMore(true);

            // Fetch data. Note: getUsers, Collections, Boards might return empty for guests depending on backend logic
            const [usersData, collectionsData, boardsData, tagsData, allTagsData] = await Promise.all([
                dataService.getUsers().catch(() => []),
                dataService.getCollections(currentUserId).catch(() => []),
                dataService.getBoards(currentUserId).catch(() => []),
                dataService.getTrendingTags(),
                dataService.getAllTags()
            ]);

            setUsers(Array.isArray(usersData) ? usersData : []);
            setCollections(collectionsData);
            setBoards(boardsData);
            setTrendingTags(tagsData);
            setAllTags(allTagsData);

            let filterConfig: any = {};
            if (activeFilter.type === 'favorites') filterConfig.favorites = true;
            if (activeFilter.type === 'collection') filterConfig.collectionId = activeFilter.id;
            if (activeFilter.type === 'board') filterConfig.boardId = activeFilter.id;
            if (activeFilter.type === 'tag') filterConfig.tag = activeFilter.id;
            if (activeFilter.type === 'created') filterConfig.creatorId = activeFilter.id;

            const effectiveSort = isShuffle ? 'random' : sortBy;
            const newPins = await dataService.getPins(filterConfig, effectiveSort, termToSearch, currentUserId, targetPage);

            if (reset) {
                setPins(newPins);
                setHasMore(newPins.length >= 50);
            } else {
                setPins(prev => {
                    const combined = [...prev, ...newPins];
                    return Array.from(new Map(combined.map(p => [p.id, p])).values());
                });
                if (newPins.length < 50) setHasMore(false);
            }
        } catch (error: any) {
            console.error("Error refreshing data:", error);
            if (error.message !== 'Login failed' && error.message !== 'User not found') {
                setError("Failed to load data");
            }
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    };

    useEffect(() => {
        if (currentUser || isServerOpen) {
            setPage(1);
            setHasMore(true);
            setPins([]);
            refreshData(true, debouncedSearch);
        }
    }, [activeFilter, sortBy, isShuffle, debouncedSearch]);

    useEffect(() => {
        if (page > 1 && (currentUser || isServerOpen)) refreshData(false);
    }, [page]);

    const handleLogout = () => {
        dataService.logout();
        setCurrentUser(null);
        setPins([]);
        // Force reload to reset state cleanly
        window.location.reload();
    };

    const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 300 && hasMore && !isFetchingMore && !isLoading) {
            setPage(prev => prev + 1);
        }
    }, [hasMore, isFetchingMore, isLoading]);

    const showToast = (message: string, onUndo: () => void) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, onUndo });
        toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
    };

    const handlePinDelete = async (pin: Pin) => {
        setPins(current => current.filter(p => p.id !== pin.id));
        await dataService.deletePin(pin.id);
        if (selectedPin && selectedPin.id === pin.id) {
            closeModal();
        }
        showToast('Stem moved to trash', async () => {
            await dataService.restorePin(pin);
            refreshData(true);
        });
    };

    const handleBulkDelete = async (ids: string[]) => {
        await dataService.bulkDeletePins(ids);
        refreshData(true);
        setSelectedPinIds([]);
        setLastSelectedId(null);
    };

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        if (e.shiftKey && lastSelectedId && lastSelectedId !== id) {
            const currentIndex = pins.findIndex(p => p.id === id);
            const lastIndex = pins.findIndex(p => p.id === lastSelectedId);
            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = pins.slice(start, end + 1).map(p => p.id);
                setSelectedPinIds(prev => [...new Set([...prev, ...rangeIds])]);
                return;
            }
        }
        setLastSelectedId(id);
        setSelectedPinIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedPinIds.length === pins.length) {
            setSelectedPinIds([]);
            setLastSelectedId(null);
        } else {
            setSelectedPinIds(pins.map(p => p.id));
            setLastSelectedId(null);
        }
    };

    const handleSelectionModeToggle = () => {
        setIsSelectionMode(!isSelectionMode);
        if (isSelectionMode) { setSelectedPinIds([]); setLastSelectedId(null); }
    };

    const handlePinClick = (pin: Pin, e: React.MouseEvent) => {
        if (e.shiftKey) {
            if (!isSelectionMode) setIsSelectionMode(true);
            toggleSelection(pin.id, e);
        } else {
            window.history.pushState({ modal: 'pin' }, '');
            setSelectedPin(pin);
        }
    };

    const resetFilters = () => {
        // Check preference: if 'created', go to user profile; otherwise go to 'all'
        if (currentUser && currentUser.homePagePreference === 'created') {
            setActiveFilter({ type: 'created', id: currentUser.id });
        } else {
            setActiveFilter({ type: 'all', id: '' });
        }

        setSearchQuery('');
        if (viewingProfileId) handleCloseProfile();

        const url = new URL(window.location.href);
        url.search = "";
        window.history.pushState({}, '', url.toString());
    };

    const toggleTrendingTag = (tag: string) => {
        if (activeFilter.type === 'tag' && activeFilter.id === tag) {
            resetFilters();
        } else {
            setActiveFilter({ type: 'tag', id: tag });
        }
    };

    const handleSidebarNavigation = (filter: any) => {
        setActiveFilter(filter);
        // If the profile modal is open, close it so we can see the new filter
        if (viewingProfileId) {
            handleCloseProfile();
        }
    };

    // --- Collection Actions ---
    const handleOpenEditCollection = (col: Collection) => {
        setCollectionToEdit(col);
    };

    const handleDeleteCollection = async () => {
        if (!collectionToEdit) return;
        if (confirm('Delete this collection? Boards inside it will be moved to "Unorganized".')) {
            await dataService.deleteCollection(collectionToEdit.id);
            setActiveFilter({ type: 'all', id: '' });
            refreshData(true);
            setCollectionToEdit(null);
        }
    };

    const handleShareCollection = (id: string) => {
        const url = `${window.location.origin}?collection=${id}`;
        navigator.clipboard.writeText(url);
        alert('Collection link copied to clipboard');
    };

    // --- NEW: Board Actions ---
    const handleOpenEditBoard = (board: Board) => {
        setBoardToEdit(board);
    };

    const handleDeleteBoard = async () => {
        if (!boardToEdit) return;
        if (confirm('Delete this board? Pins will remain but will be uncategorized.')) {
            await dataService.deleteBoard(boardToEdit.id);
            setActiveFilter({ type: 'all', id: '' });
            refreshData(true);
            setBoardToEdit(null);
        }
    };

    const handleShareBoard = (id: string) => {
        const url = `${window.location.origin}?board=${id}`;
        navigator.clipboard.writeText(url);
        alert('Board link copied to clipboard');
    };

    const SortButton = ({ value, label, current }: { value: SortOption, label: string, current: SortOption }) => (
        <button
            onClick={() => { setSortBy(value); setIsSortOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${current === value ? 'bg-teal-500/10 text-teal-500 font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
        >
            {label} {current === value && <Check size={14} />}
        </button>
    );

    if (!currentUser && !isServerOpen) {
        if (isLoading) {
            return (
                <div className="h-[100dvh] bg-[#000208] flex items-center justify-center text-teal-500">
                    <Loader2 className="animate-spin w-10 h-10" />
                </div>
            );
        }
        if (!resetToken) {
            return <LoginScreen onLogin={setCurrentUser} />;
        }
    }

    if (showLogin) {
        return (
            <LoginScreen onLogin={(user) => {
                setCurrentUser(user);
                setShowLogin(false);
            }} />
        );
    }

    return (
        <ErrorBoundary>
            <div className="h-screen bg-[#000208] text-slate-200 font-sans selection:bg-teal-500/30 overflow-hidden flex">

                {currentUser && (
                    <Sidebar
                        isOpen={isSidebarOpen}
                        activeFilter={activeFilter}
                        onFilterChange={handleSidebarNavigation}
                        collections={collections}
                        boards={boards}
                        allTags={allTags}
                        currentUser={currentUser}
                        onUpdate={() => refreshData(true)}
                        onCloseMobile={() => setIsSidebarOpen(false)}
                        onOpenSettings={() => setShowSettings(!showSettings)}
                        onOpenAdmin={() => {
                            window.history.pushState({ modal: 'admin' }, '');
                            setIsAdminOpen(true);
                        }}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    />
                )}

                <div className={`flex flex-col h-full flex-1 min-w-0 transition-all duration-300 ease-in-out ${currentUser && isSidebarOpen ? 'md:ml-64' : (currentUser ? 'md:ml-20' : '')}`}>
                    {/* FIX: Render Header even for guests (pass null user) */}
                    <Header
                        user={currentUser as User}
                        viewMode={viewMode}
                        onToggleView={setViewMode}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onCreatePin={() => {
                            window.history.pushState({ modal: 'create' }, '');
                            setIsCreateOpen(true);
                        }}
                        onLogoClick={resetFilters}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onOpenAdmin={() => setIsAdminOpen(true)}
                        onLogout={handleLogout}
                        onOpenProfile={() => {
                            if (currentUser) handleOpenProfile(currentUser.id);
                        }}
                        onLoginClick={() => setShowLogin(true)}
                        onOpenSettings={() => setIsProfileOpen(true)}
                    />

                    <main
                        className="flex-1 relative overflow-y-auto no-scrollbar"
                        onScroll={handleScroll}
                    >
                        {viewingProfileId ? (
                            <CreatorProfile
                                userId={viewingProfileId}
                                currentUserId={currentUser?.id}
                                onClose={handleCloseProfile}
                                onPinClick={(pin) => setSelectedPin(pin)}
                                onBoardClick={(boardId) => {
                                    handleCloseProfile();
                                    setActiveFilter({ type: 'board', id: boardId });
                                }}
                            />

                        ) : activeFilter.type === 'discovery' ? (
                            // --- NEW: DISCOVERY VIEW ---
                            <DiscoveryView onSave={() => {
                                // Optional: Refresh sidebar counts if you add that later
                            }} />

                        ) : viewMode === 'map' ? (
                            <div className="w-full h-[calc(100vh-80px)] relative z-0">
                                <MapView pins={pins} onPinClick={(pin) => {
                                    window.history.pushState({ modal: 'pin' }, '');
                                    setSelectedPin(pin);
                                }} />
                            </div>
                        ) : (
                            <>
                                {showSettings && (
                                    <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md">
                                        <div className="flex items-center gap-2 text-teal-500">
                                            <Sliders size={20} strokeWidth={1.5} />
                                            <span className="font-bold">View Settings</span>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={userSettings.hideTitles} onChange={e => setUserSettings({ ...userSettings, hideTitles: e.target.checked })} className="accent-teal-600" />
                                                <span className="text-sm text-slate-300">Hide Titles</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={userSettings.hideDescriptions} onChange={e => setUserSettings({ ...userSettings, hideDescriptions: e.target.checked })} className="accent-teal-600" />
                                                <span className="text-sm text-slate-300">Hide Descriptions</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={userSettings.showTags} onChange={e => setUserSettings({ ...userSettings, showTags: e.target.checked })} className="accent-teal-600" />
                                                <span className="text-sm text-slate-300">Show Tags</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {userSettings.showTags && trendingTags.length > 0 && (
                                    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-0 overflow-x-auto no-scrollbar flex items-center gap-2">
                                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                                            <TagIcon size={10} /> Trending
                                        </div>
                                        {trendingTags.map(tag => (
                                            <button key={tag} onClick={() => toggleTrendingTag(tag)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter.type === 'tag' && activeFilter.id === tag ? 'bg-teal-500/10 border-teal-500/50 text-teal-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                                                #{tag}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="px-2 py-4 sm:px-6 lg:px-8" >

                                    {/* --- NEW: COLLECTION HEADER --- */}
                                    {activeFilter.type === 'collection' && (() => {
                                        const col = collections.find(c => c.id === activeFilter.id);
                                        if (col) {
                                            return (
                                                <CollectionHeader
                                                    collection={col}
                                                    pinCount={pins.length}
                                                    isOwner={currentUser?.id === col.ownerId || currentUser?.role === 'admin'}
                                                    onEdit={() => handleOpenEditCollection(col)}
                                                    onDelete={() => { setCollectionToEdit(col); handleDeleteCollection(); }}
                                                    onShare={() => handleShareCollection(col.id)}
                                                />
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* --- NEW: BOARD HEADER --- */}
                                    {activeFilter.type === 'board' && (() => {
                                        const board = boards.find(b => b.id === activeFilter.id);
                                        if (board) {
                                            return (
                                                <BoardHeader
                                                    board={board}
                                                    pinCount={pins.length}
                                                    isOwner={currentUser?.id === board.ownerId || currentUser?.role === 'admin'}
                                                    onEdit={() => handleOpenEditBoard(board)}
                                                    onDelete={() => { setBoardToEdit(board); handleDeleteBoard(); }}
                                                    onShare={() => handleShareBoard(board.id)}
                                                />
                                            );
                                        }
                                        return null;
                                    })()}
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-4 truncate max-w-md">
                                            {activeFilter.type !== 'board' && (
                                                <h2 className="text-xl font-bold text-white">
                                                    {activeFilter.type === 'all' && 'Community'}
                                                    {activeFilter.type === 'favorites' && 'Favorites'}
                                                    {activeFilter.type === 'collection' && collections.find(c => c.id === activeFilter.id)?.title}
                                                    {activeFilter.type === 'tag' && `#${activeFilter.id}`}
                                                    {activeFilter.type === 'created' && 'Mis Tallos'}
                                                </h2>
                                            )}

                                            {currentUser && (
                                                <div className="flex items-center bg-slate-900 rounded-full border border-slate-800 p-1 gap-1">
                                                    <button onClick={handleSelectionModeToggle} className={`p-2 rounded-full transition-all ${isSelectionMode ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Select Multiple">
                                                        <MousePointer2 size={16} />
                                                    </button>
                                                    {isSelectionMode && (
                                                        <button onClick={handleSelectAll} className={`p-2 rounded-full transition-all ${selectedPinIds.length === pins.length ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Select All">
                                                            <CheckSquare size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setIsShuffle(!isShuffle)} className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm font-medium ${isShuffle ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'}`}>
                                                <Shuffle size={14} />
                                                <span className="hidden sm:inline">Shuffle</span>
                                            </button>

                                            <div className="relative" ref={sortRef}>
                                                <button onClick={() => setIsSortOpen(!isSortOpen)} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full cursor-pointer transition-all border text-sm font-medium ${isSortOpen ? 'bg-slate-800 border-teal-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'} ${isShuffle ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isShuffle}>
                                                    <ArrowUpDown size={14} className={isSortOpen ? 'text-teal-500' : 'text-slate-400'} />
                                                    <span className="hidden sm:inline">Sort</span>
                                                    <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
                                                </button>

                                                {isSortOpen && !isShuffle && (
                                                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100] p-1">
                                                        <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</div>
                                                        <SortButton value="newest" label="Newest First" current={sortBy} />
                                                        <SortButton value="oldest" label="Oldest First" current={sortBy} />
                                                        <div className="h-px bg-slate-800 my-1"></div>
                                                        <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Title</div>
                                                        <SortButton value="az" label="Title (A-Z)" current={sortBy} />
                                                        <SortButton value="za" label="Title (Z-A)" current={sortBy} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <MasonryGrid
                                        pins={pins}
                                        searchQuery={searchQuery}
                                        isSidebarOpen={isSidebarOpen}
                                        settings={userSettings}
                                        isFetchingMore={isFetchingMore}
                                        isSelectionMode={isSelectionMode}
                                        selectedPinIds={selectedPinIds}
                                        onToggleSelection={toggleSelection}
                                        onPinClick={handlePinClick}
                                        onUserClick={handleOpenProfile}
                                        onCreatePin={() => {
                                            window.history.pushState({ modal: 'create' }, '');
                                            setIsCreateOpen(true);
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </main>
                </div>

                {selectedPinIds.length > 0 && (
                    <BulkActionBar
                        selectedIds={selectedPinIds}
                        pins={pins}
                        onClear={() => {
                            setSelectedPinIds([]);
                            setLastSelectedId(null);
                            setIsSelectionMode(false);
                        }}
                        onUpdate={() => refreshData(true)}
                        collections={collections}
                        boards={boards}
                        customDeleteHandler={handleBulkDelete}
                    />
                )}

                {currentUser && (
                    <>
                        <AdminPanel
                            isOpen={isAdminOpen}
                            onClose={closeModal}
                            users={users}
                            currentUser={currentUser} // <--- ADD THIS LINE
                            onUpdate={() => refreshData(true)}
                        />
                        <PinModal
                            pin={selectedPin} onClose={closeModal}
                            collections={collections} boards={boards}
                            onUpdate={() => refreshData(true)} onDelete={handlePinDelete}
                            pinList={pins} onNavigate={setSelectedPin}
                        />

                        <CreatePinModal isOpen={isCreateOpen} onClose={closeModal} collections={collections} boards={boards} onCreated={() => refreshData(true)} userId={currentUser ? currentUser.id : ''} />

                        <ProfileModal
                            isOpen={isProfileOpen}
                            onClose={() => setIsProfileOpen(false)}
                            user={currentUser}
                            onLogout={handleLogout}
                            onUpdate={async () => {
                                await refreshData(true);
                                if (currentUser) {
                                    try {
                                        const updatedUser = await dataService.getUserById(currentUser.id);
                                        setCurrentUser(updatedUser);
                                    } catch (e) {
                                        console.error("Failed to refresh user profile", e);
                                    }
                                }
                            }}
                        />

                        {collectionToEdit && (
                            <EditCollectionModal
                                collection={collectionToEdit}
                                onClose={() => setCollectionToEdit(null)}
                                onUpdate={() => {
                                    refreshData(true);
                                    setCollectionToEdit(null);
                                }}
                            />
                        )}

                        {boardToEdit && (
                            <EditBoardModal
                                board={boardToEdit}
                                collections={collections}
                                onClose={() => setBoardToEdit(null)}
                                onUpdate={() => {
                                    refreshData(true);
                                    setBoardToEdit(null);
                                }}
                            />
                        )}
                    </>
                )}

                {/* GUEST PIN MODAL (Read Only) */}
                {!currentUser && (
                    <PinModal
                        pin={selectedPin} onClose={closeModal}
                        collections={[]} boards={[]}
                        onUpdate={() => { }} onDelete={() => { }}
                        pinList={pins} onNavigate={setSelectedPin}
                    />
                )}

                {toast && (
                    <div className="fixed bottom-8 right-8 z-[70] bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
                        <span className="font-medium text-sm">{toast.message}</span>
                        <button onClick={() => { toast.onUndo(); setToast(null); }} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Undo size={12} /> Undo</button>
                    </div>
                )}

                {resetToken && (
                    <ResetPasswordModal
                        token={resetToken}
                        onClose={() => setResetToken(null)}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default App;