import React, { useState } from 'react';
import { Layout, Plus, Layers, Folder, Trash2, Heart, Link as LinkIcon, Settings, Shield, ArrowDownAZ, ArrowUpNarrowWide, Github, ChevronsUp, ChevronLeft, ChevronRight, FolderInput, X, Check, Pencil, MoreHorizontal, Layers2, ChartNoAxesGantt } from 'lucide-react';
import { Collection, Board, User } from '../types';
import { dataService } from '../services/dataService';

interface SidebarProps {
    isOpen: boolean;
    activeFilter: { type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string };
    onFilterChange: (filter: { type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string }) => void;
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

    const [boardToMove, setBoardToMove] = useState<Board | null>(null);

    // Renaming State
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // --- SEPARATE NEW STEMS BOARD ---
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

    const startRenaming = (e: React.MouseEvent, id: string, currentTitle: string) => {
        e.stopPropagation();
        e.preventDefault();
        setRenamingId(id);
        setRenameValue(currentTitle);
    };

    const submitRename = async (type: 'collection' | 'board') => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        try {
            if (type === 'collection') {
                await dataService.updateCollection(renamingId!, { title: renameValue });
            } else {
                await dataService.updateBoard(renamingId!, { title: renameValue });
            }
            onUpdate();
        } catch (e: any) {
            alert(e.message || "Rename failed");
        } finally {
            setRenamingId(null);
        }
    };

    const handleDeleteCollection = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Delete this collection? Boards inside will be moved to "Boards".')) {
            await dataService.deleteCollection(id);
            onUpdate();
        }
    };

    const handlePinDropOnBoard = (pinId: string, boardId: string) => {
        dataService.addPinToBoard(pinId, boardId);
        onUpdate();
        setDragOverId(null);
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

    const handleFilterClick = (type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string) => {
        onFilterChange({ type, id });
        if (window.innerWidth < 768) onCloseMobile();
    };

    const handleLogoClick = () => {
        onFilterChange({ type: 'all', id: '' });
        if (window.innerWidth < 768) onCloseMobile();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={onCloseMobile}
                />
            )}

            {/* --- MOVE BOARD MODAL --- */}
            {boardToMove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBoardToMove(null)}>
                    <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                            <h3 className="font-bold text-white text-sm">Move "{boardToMove.title}"</h3>
                            <button onClick={() => setBoardToMove(null)}><X size={18} className="text-slate-400 hover:text-white transition-colors" /></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <button
                                onClick={() => handleMoveBoard(boardToMove.id, undefined)}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center gap-3 transition-colors group"
                            >
                                <Layout size={18} className="text-slate-500 group-hover:text-teal-500 transition-colors" />
                                <span className="font-medium text-sm">Unorganized</span>
                                {!boardToMove.collectionId && <Check size={16} className="ml-auto text-teal-500" />}
                            </button>
                            {collections.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => handleMoveBoard(boardToMove.id, col.id)}
                                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center gap-3 transition-colors group"
                                >
                                    <MoreHorizontal size={18} className="text-slate-500 group-hover:text-teal-500 transition-colors" />
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
          flex flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl h-screen
          fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full w-0 md:opacity-100 md:translate-x-0 md:w-20'}
        `}
            >
                <button
                    onClick={onToggleSidebar}
                    className="absolute -right-3 top-9 z-50 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white p-1 rounded-full shadow-lg transition-colors hidden md:flex items-center justify-center h-6 w-6"
                    title={isOpen ? "Collapse" : "Expand"}
                >
                    {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                <div className={`h-20 flex items-center shrink-0 transition-all ${isOpen ? 'px-6 justify-start' : 'px-0 justify-center'}`}>
                    <button
                        onClick={handleLogoClick}
                        className="flex items-center gap-3 group"
                        title="Reset Filters"
                    >
                        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20 group-hover:bg-teal-500 group-hover:scale-105 transition-all">
                            <ChevronsUp className="text-white w-5 h-5" strokeWidth={3} />
                        </div>
                        <span className={`text-lg font-bold text-white tracking-tight group-hover:text-teal-400 transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
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
                                <button
                                    onClick={() => handleFilterClick('all', '')}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeFilter.type === 'all' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${!isOpen ? 'justify-center' : ''}`}
                                    title="Tallos"
                                >
                                    <Layout size={20} strokeWidth={1.5} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Tallos</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => handleFilterClick('favorites', '')}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeFilter.type === 'favorites' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${!isOpen ? 'justify-center' : ''}`}
                                    title="Favorites"
                                >
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
                                <button
                                    onClick={() => { setCreationMode('collection'); setCreationName(''); }}
                                    className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
                                >
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
                                                onKeyDown={e => e.key === 'Enter' && submitRename('collection')}
                                                onBlur={() => submitRename('collection')}
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
                                                {/* --- SHARE BUTTON ADDED HERE --- */}
                                                <button onClick={(e) => handleShare(e, 'collection', col.id)} className="p-1 text-slate-500 hover:text-white" title="Share Collection">
                                                    <LinkIcon size={12} />
                                                </button>
                                                <button onClick={(e) => startRenaming(e, col.id, col.title)} className="p-1 text-slate-500 hover:text-teal-400" title="Rename">
                                                    <Pencil size={12} />
                                                </button>
                                                <button onClick={(e) => handleDeleteCollection(e, col.id)} className="p-1 text-slate-500 hover:text-red-500" title="Delete">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* Nested Boards */}
                                    {(activeFilter.id === col.id || activeFilter.type === 'board') && (
                                        <ul className="ml-4 mt-0.5 border-l border-slate-800 pl-2 space-y-0.5">
                                            {sortedBoards(boards.filter(b => b.collectionId === col.id)).map(board => (
                                                <li
                                                    key={board.id}
                                                    draggable
                                                    onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)}
                                                    className="group/board relative"
                                                >
                                                    {renamingId === board.id ? (
                                                        <div className="px-1 py-0.5">
                                                            <input
                                                                autoFocus
                                                                value={renameValue}
                                                                onChange={e => setRenameValue(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && submitRename('board')}
                                                                onBlur={() => submitRename('board')}
                                                                className="w-full bg-slate-900 border border-teal-500 rounded px-2 py-1 text-xs text-white outline-none"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleFilterClick('board', board.id)}
                                                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                                                            >
                                                                <Folder size={14} />
                                                                <span className="truncate pr-12">{board.title}</span>
                                                            </button>

                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/board:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur rounded px-1">
                                                                <button onClick={(e) => handleShare(e, 'board', board.id)} className="p-1 text-slate-500 hover:text-white" title="Share">
                                                                    <LinkIcon size={12} />
                                                                </button>
                                                                <button onClick={(e) => startRenaming(e, board.id, board.title)} className="p-1 text-slate-500 hover:text-teal-400" title="Rename">
                                                                    <Pencil size={12} />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setBoardToMove(board); }} className="p-1 text-slate-500 hover:text-teal-400" title="Move">
                                                                    <FolderInput size={12} />
                                                                </button>
                                                                <button onClick={(e) => handleDeleteBoard(e, board.id)} className="p-1 text-slate-500 hover:text-red-500" title="Delete">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
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
                                <button
                                    onClick={() => { setCreationMode('board'); setCreationName(''); }}
                                    className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            {creationMode === 'board' && (
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
                                {/* --- PINNED "NEW STEMS" BOARD --- */}
                                {newStemsBoard && (
                                    <li className="mb-2 border-b border-slate-800/50 pb-2">
                                        <button
                                            onClick={() => handleFilterClick('board', newStemsBoard.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${activeFilter.type === 'board' && activeFilter.id === newStemsBoard.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                                        >
                                            {/* Circle Highlight Wrapper */}
                                            <div className={`p-1.5 rounded-full ${activeFilter.id === newStemsBoard.id ? 'bg-teal-500 text-white' : 'bg-teal-500/20 text-teal-500 group-hover:bg-teal-500 group-hover:text-white'} transition-colors`}>
                                                <ChartNoAxesGantt size={14} strokeWidth={2.5} />
                                            </div>
                                            <span className="font-medium text-sm">New Stems</span>
                                        </button>
                                    </li>
                                )}

                                {/* Regular User Boards */}
                                {sortedBoards(userBoards.filter(b => !b.collectionId)).map(board => (
                                    <li
                                        key={board.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)}
                                        className="group relative"
                                    >
                                        {renamingId === board.id ? (
                                            <div className="px-2 py-1">
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && submitRename('board')}
                                                    onBlur={() => submitRename('board')}
                                                    className="w-full bg-slate-900 border border-teal-500 rounded px-2 py-1 text-sm text-white outline-none"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleFilterClick('board', board.id)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                                                >
                                                    <Folder size={16} strokeWidth={1.5} />
                                                    <span className="font-medium text-sm truncate pr-14">{board.title}</span>
                                                </button>

                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur rounded px-1 py-0.5 border border-slate-800/50 shadow-sm">
                                                    <button onClick={(e) => handleShare(e, 'board', board.id)} className="p-1 text-slate-500 hover:text-white" title="Share">
                                                        <LinkIcon size={12} />
                                                    </button>
                                                    <button onClick={(e) => startRenaming(e, board.id, board.title)} className="p-1 text-slate-500 hover:text-teal-400" title="Rename">
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setBoardToMove(board); }} className="p-1 text-slate-500 hover:text-teal-400" title="Move">
                                                        <FolderInput size={12} />
                                                    </button>
                                                    <button onClick={(e) => handleDeleteBoard(e, board.id)} className="p-1 text-slate-500 hover:text-red-500" title="Delete">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 shrink-0 space-y-1">
                    <button
                        onClick={onOpenSettings}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors group ${!isOpen ? 'justify-center' : ''}`}
                        title="Settings"
                    >
                        <Settings size={20} strokeWidth={1.5} />
                        <span className={`font-medium text-sm transition-all ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Settings</span>
                    </button>

                    {currentUser.role === 'admin' && (
                        <button
                            onClick={onOpenAdmin}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-teal-500 hover:bg-teal-500/10 rounded-lg transition-colors group ${!isOpen ? 'justify-center' : ''}`}
                            title="Admin"
                        >
                            <Shield size={20} strokeWidth={1.5} />
                            <span className={`font-medium text-sm transition-all ${!isOpen ? 'w-0 opacity-0 overflow-hidden hidden' : 'block'}`}>Admin</span>
                        </button>
                    )}

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