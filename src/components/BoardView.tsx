import React from 'react';
import { Board, PinnedImage } from '../../shared/types';
import { Trash2, Layout, Plus, ArrowRight } from 'lucide-react';

interface BoardViewProps {
  boards: Board[];
  images: PinnedImage[];
  onSelectBoard: (boardId: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onCreateBoard: () => void;
}

const BoardView: React.FC<BoardViewProps> = ({ 
  boards, 
  images, 
  onSelectBoard, 
  onDeleteBoard,
  onCreateBoard
}) => {
  
  const getBoardStats = (board: Board) => {
    const boardImages = images.filter(img => img.boardIds.includes(board.id));
    
    // Determine Cover Image
    let coverImage = null;
    if (board.coverImageId) {
      coverImage = images.find(img => img.id === board.coverImageId);
    }
    // Fallback to first image
    if (!coverImage && boardImages.length > 0) {
      coverImage = boardImages[0];
    }

    return {
      count: boardImages.length,
      coverUrl: coverImage ? (coverImage.thumbnailUrl || coverImage.url) : null,
    };
  };

  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-100 tracking-tight mb-2">My Boards</h1>
          <p className="text-slate-400 text-lg">Organize your inspiration into collections.</p>
        </div>
        
        <button 
          onClick={onCreateBoard}
          className="group flex items-center gap-3 bg-rose-600 hover:bg-rose-500 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-rose-900/20 hover:scale-105 active:scale-95"
        >
          <div className="bg-white/20 p-1 rounded-lg">
            <Plus className="w-5 h-5" />
          </div>
          Create New Board
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* New Board Card */}
        <button 
          onClick={onCreateBoard}
          className="group relative h-80 rounded-[2rem] border-3 border-dashed border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center gap-4 text-slate-600 hover:text-rose-500"
        >
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 group-hover:border-rose-500/50 group-hover:scale-110 transition-all flex items-center justify-center">
            <Plus className="w-8 h-8" />
          </div>
          <span className="font-bold text-lg">New Board</span>
        </button>

        {boards.map(board => {
          const stats = getBoardStats(board);
          
          return (
            <div 
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className="group relative h-80 rounded-[2rem] bg-slate-900 overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all hover:-translate-y-1"
            >
              {/* Cover Image */}
              {stats.coverUrl ? (
                <>
                  <img 
                    src={stats.coverUrl} 
                    alt={board.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 group-hover:bg-slate-800 transition-colors">
                  <Layout className="w-16 h-16 text-slate-800 group-hover:text-slate-700 transition-colors" />
                </div>
              )}

              {/* Text Overlay */}
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-black text-white leading-tight line-clamp-2">
                      {board.name}
                    </h3>
                  </div>
                  
                  {board.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 mb-4 group-hover:text-slate-300 transition-colors">
                      {board.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        {stats.count} Pins
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300 delay-75">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm('Are you sure you want to delete this board?')) onDeleteBoard(board.id);
                        }}
                        className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoardView;