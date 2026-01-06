import React, { useState } from 'react';
import { Layout, Plus, Layers, Folder, Trash2, Heart, Link as LinkIcon, Settings, Shield, ArrowDownAZ, ArrowUpNarrowWide, Github, ChevronsUp, ChevronLeft, ChevronRight, FolderInput, X, Check, Pencil, MoreHorizontal, Activity, User as UserIcon, Lock, Globe, EyeOff } from 'lucide-react';
import { Collection, Board, User, ActiveFilter } from '../types';
import { dataService } from '../services/dataService';

interface SidebarProps {
    isOpen: boolean;
    activeFilter: ActiveFilter;
    onFilterChange: (filter: ActiveFilter) => void;
    collections: Collection[];
    boards: Board[];
    allTags: string[];
    currentUser: User;
    onUpdate: () => void;
    onCloseMobile: () => void;
    onOpenSettings: () => void;
    onOpenAdmin: () => void;
    onToggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    activeFilter,
    onFilterChange,
    collections,
    boards,
    currentUser,
    onUpdate,
    onCloseMobile,
    onOpenSettings,
    onOpenAdmin,
    onToggleSidebar
}) => {
    const [creationMode, setCreationMode] = useState<'collection' | 'board' | null>(null);
    const [creationName, setCreationName] = useState('');
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [sortList, setSortList] = useState<'az' | 'newest'>('az');

    // --- BOARD EDITING STATE ---
    const [boardToEdit, setBoardToEdit] = useState<Board | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editVisibility, setEditVisibility] = useState<'private' | 'public' | 'unlisted'>('private');

    // --- BOARD MOVING STATE ---
    const [boardToMove, setBoardToMove] = useState<Board | null>(null);

    // --- COLLECTION RENAMING STATE ---
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const newStemsBoard = boards.find(b => b.id === 'b-new-stems' || b.title === 'New Stems');
    const userBoards = boards.filter(b => b.id !== 'b-new-stems' && b.title !== 'New Stems');

    const sortedCollections = [...collections].sort((a, b) => {
        if (sortList === 'az') return a.title.localeCompare(b.title);
        return b.id.localeCompare(a.id);
    });

    const sortedBoards = (list: Board[]) => {
        return [...list].sort((a, b) => {
            if (sortList === 'az') return a.title.localeCompare(b.title);
            return b.id.localeCompare(a.id);
        });
    };

    const handleCreateItem = async () => {
        if (!creationName.trim()) {
            setCreationMode(null);
            return;
        }
        try {
            if (creationMode === 'collection') {
                await dataService.createCollection(creationName, currentUser.id);
            } else if (creationMode === 'board') {
                await dataService.createBoard(creationName, undefined, currentUser.id);
            }
            setCreationName('');
            setCreationMode(null);
            onUpdate();
        } catch (e: any) {
            alert(e.message || "Failed to create item");
        }
    };

    const startRenamingCollection = (e: React.MouseEvent, id: string, currentTitle: string) => {
        e.stopPropagation();
        e.preventDefault();
        setRenamingId(id);
        setRenameValue(currentTitle);
    };

    const submitCollectionRename = async () => {
        if (!renamingId || !renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        try {
            await dataService.updateCollection(renamingId, { title: renameValue });
            onUpdate();
        } catch (e: any) {
            alert(e.message || "Rename failed");
        } finally {
            setRenamingId(null);
        }
    };

    const openEditBoardModal = (e: React.MouseEvent, board: Board) => {
        e.stopPropagation();
        setBoardToEdit(board);
        setEditTitle(board.title);
        setEditVisibility(board.visibility || 'private');
    };

    const handleUpdateBoard = async () => {
        if (!boardToEdit || !editTitle.trim()) return;
        try {
            await dataService.updateBoard(boardToEdit.id, { 
                title: editTitle,
                visibility: editVisibility 
            });
            onUpdate();
            setBoardToEdit(null);
        } catch (e: any) {
            alert(e.message || "Update failed");
        }
    };

    const handleDeleteCollection = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Delete this collection? Boards inside will be moved to "Boards".')) {
            await dataService.deleteCollection(id);
            onUpdate();
        }
    };

    const handleBoardDropOnCollection = (boardId: string, collectionId: string) => {
        dataService.updateBoard(boardId, { collectionId });
        onUpdate();
        setDragOverId(null);
    };

    const handleMoveBoard = (boardId: string, collectionId?: string) => {
        dataService.updateBoard(boardId, { collectionId: collectionId || undefined });
        onUpdate();
        setBoardToMove(null);
    };

    const handleDeleteBoard = (e: React.MouseEvent, boardId: string) => {
        e.stopPropagation();
        if (confirm('Delete this board? Pins will remain but will be uncategorized.')) {
            dataService.deleteBoard(boardId);
            onUpdate();
        }
    };

    const handleShare = (e: React.MouseEvent, type: string, id: string) => {
        e.stopPropagation();
        const url = `${window.location.origin}?${type}=${id}`;
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
    };

    const handleFilterClick = (type: ActiveFilter['type'], id: string) => {
        onFilterChange({ type, id });
        if (window.innerWidth < 768) onCloseMobile();
    };

    const handleLogoClick = () => {
        onFilterChange({ type: 'all', id: '' });
        if (window.innerWidth < 768) onCloseMobile();
    };

    const getVisibilityIcon = (vis?: string) => {
        if (vis === 'public') return <Globe size={10} className="text-teal-400" />;
        if (vis === 'unlisted') return <EyeOff size={10} className="text-slate-400" />;
        return <Lock size={10} className="text-slate-500" />;
    };

    return (
        <>
            {/* Mobile Backdrop - Closes sidebar when clicking outside */}
            <div
                className={`
                    fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden
                    ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onCloseMobile}
            />

            {/* --- EDIT BOARD MODAL --- */}
            {boardToEdit && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBoardToEdit(null)}>
                    <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                            <h3 className="font-bold text-white text-sm">Edit Board</h3>
                            <button onClick={() => setBoardToEdit(null)}><X size={18} className="text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Board Title</label>
                                <input
                                    autoFocus
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Visibility</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { id: 'private', label: 'Private', icon: Lock, desc: 'Only you can see this board' },
                                        { id: 'unlisted', label: 'Unlisted', icon: EyeOff, desc: 'Anyone with the link can view' },
                                        { id: 'public', label: 'Public', icon: Globe, desc: 'Visible on your profile' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setEditVisibility(opt.id as any)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${editVisibility === opt.id ? 'bg-teal-500/10 border-teal-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                                        >
                                            <div className={`p-2 rounded-full ${editVisibility === opt.id ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                <opt.icon size={16} />
                                            </div>
                                            <div>
                                                <div className={`text-sm font-medium ${editVisibility === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.label}</div>
                                                <div className="text-[10px] text-slate-500">{opt.desc}</div>
                                            </div>
                                            {editVisibility === opt.id && <Check size={16} className="ml-auto text-teal-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-[#020617] border-t border-slate-800 flex justify-end gap-2">
                            <button onClick={() => setBoardToEdit(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white">Cancel</button>
                            <button onClick={handleUpdateBoard} className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MOVE BOARD MODAL --- */}
            {boardToMove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBoardToMove(null)}>
                    <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                            <h3 className="font-bold text-white text-sm">Move "{boardToMove.title}"</h3>
                            <button onClick={() => setBoardToMove(null)}><X size={18} className="text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <button
                                onClick={() => handleMoveBoard(boardToMove.id, undefined)}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center gap-3 transition-colors group"
                            >
                                <Layout size={18} className="text-slate-500 group-hover:text-teal-500" />
                                <span className="font-medium text-sm">Unorganized</span>
                                {!boardToMove.collectionId && <Check size={16} className="ml-auto text-teal-500" />}
                            </button>
                            {collections.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => handleMoveBoard(boardToMove.id, col.id)}
                                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center gap-3 transition-colors group"
                                >
                                    <MoreHorizontal size={18} className="text-slate-500 group-hover:text-teal-500" />
                                    <span className="font-medium text-sm truncate">{col.title}</span>
                                    {boardToMove.collectionId === col.id && <Check size={16} className="ml-auto text-teal-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <aside
                className={`
                    fixed left-0 top-0 h-full z-50
                    flex flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl
                    transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                    
                    /* Mobile: Slide in from left */
                    ${isOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full w-72 shadow-none'}
                    
                    /* Desktop: Always visible, changing width */
                    md:translate-x-0 
                    ${isOpen ? 'md:w-64' : 'md:w-20'}
                `}
            >
                {/* Mobile Close Button */}
                <div className="md:hidden absolute right-4 top-4">
                     <button onClick={onCloseMobile} className="p-2 text-slate-400 hover:text-white"><X size={20}/></button>
                </div>

                {/* Desktop Toggle Button */}
                <button
                    onClick={onToggleSidebar}
                    className="absolute -right-3 top-9 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white p-1 rounded-full shadow-lg transition-colors hidden md:flex items-center justify-center h-6 w-6 z-50"
                    title={isOpen ? "Collapse" : "Expand"}
                >
                    {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                <div className={`h-20 flex items-center shrink-0 transition-all ${isOpen ? 'px-6 justify-start' : 'px-0 justify-center'}`}>
                    <button onClick={handleLogoClick} className="flex items-center gap-3 group" title="Reset Filters">
                        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20 group-hover:bg-teal-500 group-hover:scale-105 transition-all">
                            <ChevronsUp className="text-white w-5 h-5" strokeWidth={3} />
                        </div>
                        <span className={`text-lg font-bold text-white tracking-tight group-hover:text-teal-400 transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>
                            Tallo
                        </span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-8">
                    {/* Library Section */}
                    <div>
                        {isOpen && <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">Library</h3>}
                        <ul className="space-y-1">
                            <li>
                                <button onClick={() => handleFilterClick('all', '')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeFilter.type === 'all' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${!isOpen ? 'justify-center' : ''}`} title="Tallos">
                                    <Layout size={20} strokeWidth={1.5} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Tallos</span>
                                </button>
                            </li>
                            <li>
                                <button onClick={() => handleFilterClick('created', currentUser.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeFilter.type === 'created' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${!isOpen ? 'justify-center' : ''}`} title="Mis Tallos">
                                    <UserIcon size={20} strokeWidth={1.5} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Mis Tallos</span>
                                </button>
                            </li>
                            <li>
                                <button onClick={() => handleFilterClick('favorites', '')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeFilter.type === 'favorites' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${!isOpen ? 'justify-center' : ''}`} title="Favorites">
                                    <Heart size={20} strokeWidth={1.5} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Favorites</span>
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Collections & Boards */}
                    <div className={`transition-opacity duration-200 ${!isOpen ? 'opacity-0 hidden' : 'opacity-100 block'}`}>
                        <div className="flex justify-between items-center mb-2 px-3">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Collections</h3>
                            <div className="flex gap-1">
                                <button onClick={() => setSortList(prev => prev === 'az' ? 'newest' : 'az')} className="text-slate-600 hover:text-teal-500 p-1">
                                    {sortList === 'az' ? <ArrowDownAZ size={12} /> : <ArrowUpNarrowWide size={12} />}
                                </button>
                                <button onClick={() => { setCreationMode('collection'); setCreationName(''); }} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        {creationMode === 'collection' && (
                            <div className="mb-2 px-2">
                                <input
                                    autoFocus
                                    value={creationName}
                                    onChange={e => setCreationName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateItem()}
                                    onBlur={handleCreateItem}
                                    placeholder="Name..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-teal-500 outline-none"
                                />
                            </div>
                        )}

                        <ul className="space-y-0.5">
                            {sortedCollections.map(col => (
                                <li
                                    key={col.id}
                                    className="group relative"
                                    onDragOver={(e) => { e.preventDefault(); setDragOverId(col.id); }}
                                    onDragLeave={() => setDragOverId(null)}
                                    onDrop={(e) => {
                                        const boardId = e.dataTransfer.getData('boardId');
                                        if (boardId) handleBoardDropOnCollection(boardId, col.id);
                                        setDragOverId(null);
                                    }}
                                >
                                    {renamingId === col.id ? (
                                        <div className="px-2 py-1">
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && submitCollectionRename()}
                                                onBlur={() => submitCollectionRename()}
                                                className="w-full bg-slate-900 border border-teal-500 rounded px-2 py-1 text-sm text-white outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleFilterClick('collection', col.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'collection' && activeFilter.id === col.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${dragOverId === col.id ? 'bg-slate-800 ring-1 ring-teal-500' : ''}`}
                                            >
                                                <Layers size={16} strokeWidth={1.5} />
                                                <span className="font-medium text-sm truncate pr-8">{col.title}</span>
                                            </button>

                                            <div className="absolute right-1 top-2 hidden group-hover:flex gap-1 bg-slate-950/80 backdrop-blur rounded px-1">
                                                <button onClick={(e) => handleShare(e, 'collection', col.id)} className="p-1 text-slate-500 hover:text-white" title="Share Collection"><LinkIcon size={12} /></button>
                                                <button onClick={(e) => startRenamingCollection(e, col.id, col.title)} className="p-1 text-slate-500 hover:text-teal-400" title="Rename"><Pencil size={12} /></button>
                                                <button onClick={(e) => handleDeleteCollection(e, col.id)} className="p-1 text-slate-500 hover:text-red-500" title="Delete"><Trash2 size={12} /></button>
                                            </div>
                                        </>
                                    )}

                                    {(activeFilter.id === col.id || activeFilter.type === 'board') && (
                                        <ul className="ml-4 mt-0.5 border-l border-slate-800 pl-2 space-y-0.5">
                                            {sortedBoards(boards.filter(b => b.collectionId === col.id)).map(board => (
                                                <li key={board.id} draggable onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)} className="group/board relative">
                                                    <button onClick={() => handleFilterClick('board', board.id)} className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                                        <Folder size={14} />
                                                        <span className="truncate pr-12">{board.title}</span>
                                                        <div className="ml-auto scale-75">{getVisibilityIcon(board.visibility)}</div>
                                                    </button>
                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/board:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur rounded px-1">
                                                        <button onClick={(e) => handleShare(e, 'board', board.id)} className="p-1 text-slate-500 hover:text-white"><LinkIcon size={12} /></button>
                                                        <button onClick={(e) => openEditBoardModal(e, board)} className="p-1 text-slate-500 hover:text-teal-400"><Pencil size={12} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setBoardToMove(board); }} className="p-1 text-slate-500 hover:text-teal-400"><FolderInput size={12} /></button>
                                                        <button onClick={(e) => handleDeleteBoard(e, board.id)} className="p-1 text-slate-500 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="mt-8">
                            <div className="flex justify-between items-center mb-2 px-3">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Boards</h3>
                                <button onClick={() => { setCreationMode('board'); setCreationName(''); }} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded">
                                    <Plus size={14} />
                                </button>
                            </div>
                            {creationMode === 'board' && (
                                <div className="mb-2 px-2">
                                    <input autoFocus value={creationName} onChange={e => setCreationName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateItem()} onBlur={handleCreateItem} placeholder="Name..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-teal-500 outline-none" />
                                </div>
                            )}

                            <ul className="space-y-0.5">
                                {newStemsBoard && (
                                    <li className="mb-2 border-b border-slate-800/50 pb-2">
                                        <button onClick={() => handleFilterClick('board', newStemsBoard.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${activeFilter.type === 'board' && activeFilter.id === newStemsBoard.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}>
                                            <div className={`p-1.5 rounded-full ${activeFilter.id === newStemsBoard.id ? 'bg-teal-500 text-white' : 'bg-teal-500/20 text-teal-500 group-hover:bg-teal-500 group-hover:text-white'} transition-colors`}>
                                                <Activity size={14} strokeWidth={2.5} />
                                            </div>
                                            <span className="font-medium text-sm">New Stems</span>
                                        </button>
                                    </li>
                                )}

                                {sortedBoards(userBoards.filter(b => !b.collectionId)).map(board => (
                                    <li key={board.id} draggable onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)} className="group relative">
                                        <button onClick={() => handleFilterClick('board', board.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}>
                                            <Folder size={16} strokeWidth={1.5} />
                                            <span className="font-medium text-sm truncate pr-14">{board.title}</span>
                                            <div className="ml-auto">{getVisibilityIcon(board.visibility)}</div>
                                        </button>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur rounded px-1 py-0.5 border border-slate-800/50 shadow-sm">
                                            <button onClick={(e) => handleShare(e, 'board', board.id)} className="p-1 text-slate-500 hover:text-white"><LinkIcon size={12} /></button>
                                            <button onClick={(e) => openEditBoardModal(e, board)} className="p-1 text-slate-500 hover:text-teal-400"><Pencil size={12} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setBoardToMove(board); }} className="p-1 text-slate-500 hover:text-teal-400"><FolderInput size={12} /></button>
                                            <button onClick={(e) => handleDeleteBoard(e, board.id)} className="p-1 text-slate-500 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 shrink-0 space-y-1 bg-slate-950">
                    <button onClick={onOpenSettings} className={`w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors group ${!isOpen ? 'justify-center' : ''}`} title="Settings">
                        <Settings size={20} strokeWidth={1.5} />
                        <span className={`font-medium text-sm transition-all ${!isOpen ? 'hidden' : 'block'}`}>View Settings</span>
                    </button>
                    
                    <div className={`pt-4 flex items-center gap-4 text-xs text-slate-600 px-3 ${!isOpen ? 'justify-center' : ''}`}>
                        <a href="https://github.com/volumedata21/tallo21/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                            <Github size={14} />
                            <span className={`${!isOpen ? 'hidden' : 'block'}`}>GitHub</span>
                        </a>
                        <span className={`${!isOpen ? 'hidden' : 'block'}`}>v1.0</span>
                    </div>
                </div>
            </aside>
        </>
    );
};