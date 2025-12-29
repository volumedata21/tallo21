import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import BoardView from '../components/BoardView';

export const BoardsIndexPage: React.FC = () => {
  const { boards, images, deleteBoard, addBoard } = useData();
  const navigate = useNavigate();

  // Create Board wrapper (the modal logic is handled in Layout, but we can trigger it or handle simplistic creation here)
  // Actually, the Layout handles the "Create Board" modal globally. 
  // We can pass a dummy function or use context to trigger the modal if we want the button inside BoardView to work.
  // For now, let's assume the Sidebar "+" button is the primary way, or we pass a prop to open it.
  // Ideally, we'd have a UIContext for modals, but let's keep it simple.
  
  return (
    <BoardView
      boards={boards}
      images={images}
      onSelectBoard={(id) => navigate(`/board/${id}`)}
      onDeleteBoard={deleteBoard}
      onCreateBoard={() => {
        // Trigger global modal? 
        // For this refactor, let's assume the user uses the Sidebar or Header button.
        // Or we can add a local state here if specifically needed for the big card.
        alert("Please use the + button in the header to create a board.");
      }}
    />
  );
};