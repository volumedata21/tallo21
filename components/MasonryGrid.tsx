import React, { useState, useEffect } from 'react';
import { Pin, UserSettings } from '../types';
import { PinCard } from './PinCard';
import { Loader2, Plus } from 'lucide-react';

interface MasonryGridProps {
    pins: Pin[];
    searchQuery: string;
    isSidebarOpen: boolean;
    settings: UserSettings;
    isFetchingMore: boolean;
    // Selection Props
    isSelectionMode: boolean;
    selectedPinIds: string[];
    onToggleSelection: (id: string, e: React.MouseEvent) => void;
    // Click Handlers
    onPinClick: (pin: Pin, e: React.MouseEvent) => void;
    onUserClick: (userId: string) => void;
    onCreatePin: () => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
    pins,
    searchQuery,
    isSidebarOpen,
    settings,
    isFetchingMore,
    isSelectionMode,
    selectedPinIds,
    onToggleSelection,
    onPinClick,
    onUserClick,
    onCreatePin
}) => {
    // We moved the window width state HERE.
    // App.tsx no longer needs to know how wide the screen is!
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // This is the "Card Dealer" math
    const getMasonryColumns = () => {
        const isMobile = windowWidth < 768;
        let sidebarWidth = 0;
        
        // Calculate available space based on sidebar
        if (!isMobile) {
            sidebarWidth = isSidebarOpen ? 256 : 80;
        }

        const availableWidth = windowWidth - sidebarWidth;
        
        // Determine number of columns based on screen width
        let colCount = 2;
        if (availableWidth >= 1600) colCount = 5;
        else if (availableWidth >= 1100) colCount = 4;
        else if (availableWidth >= 800) colCount = 3;
        else if (availableWidth < 320) colCount = 1;
        else if (availableWidth < 800) colCount = 2;

        // Create empty piles
        const columns: Pin[][] = Array.from({ length: colCount }, () => []);
        const colHeights = new Array(colCount).fill(0);

        // Deal the cards
        pins.forEach((pin) => {
            let minHeight = colHeights[0];
            let minColIndex = 0;
            
            // Find the shortest pile
            for (let i = 1; i < colCount; i++) {
                if (colHeights[i] < minHeight) {
                    minHeight = colHeights[i];
                    minColIndex = i;
                }
            }
            
            // Add pin to that pile
            columns[minColIndex].push(pin);
            
            // Estimate new height
            const aspectRatio = typeof pin.aspectRatio === 'number' ? pin.aspectRatio : 1;
            const estimatedHeight = (1 / aspectRatio) + 0.2;
            colHeights[minColIndex] += estimatedHeight;
        });

        return columns;
    };

    const masonryColumns = getMasonryColumns();

    // 1. Handle Empty State
    if (pins.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                    <Plus size={40} className="text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">No Stems Found</h3>
                <p className="mb-6">{searchQuery ? `No results for "${searchQuery}"` : 'Upload an image to get started.'}</p>
                <button onClick={onCreatePin} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-medium transition">Add Stem</button>
            </div>
        );
    }

    // 2. Render Grid
    return (
        <>
            <div className="flex gap-2 sm:gap-4 justify-center mx-auto max-w-[2400px]">
                {masonryColumns.map((colPins, colIndex) => (
                    <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                        {colPins.map(pin => (
                            <PinCard
                                key={pin.id}
                                pin={pin}
                                settings={settings}
                                onClick={onPinClick}
                                onUserClick={onUserClick}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedPinIds.includes(pin.id)}
                                onToggleSelection={onToggleSelection}
                            />
                        ))}
                    </div>
                ))}
            </div>
            {isFetchingMore && (
                <div className="w-full py-8 flex justify-center text-teal-500">
                    <Loader2 className="animate-spin w-8 h-8" />
                </div>
            )}
        </>
    );
};