export type Visibility = 'private' | 'public' | 'unlisted';

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Hashed password
  createdAt: number;
  following?: string[];
  isAdmin?: boolean;
}

export interface PinnedImage {
  id: string;
  url: string; // The full image URL (or local path)
  thumbnailUrl: string; // Optimized preview
  title: string;
  description: string;
  tags: string[];
  createdAt: number;
  ownerId: string;
  visibility: Visibility;
  
  // Relationships
  boardIds: string[]; // An image can belong to multiple boards
  groupId?: string;   // For grouped images (e.g. galleries)
  
  // Metadata
  mediaType: 'image' | 'video';
  isFavorite: boolean;
  likedBy: string[]; // Array of User IDs
  sourceUrl?: string; // Original website URL
  location?: string; // Text address
  latitude?: number;
  longitude?: number;
  
  // Video Specifics
  isCustomThumbnail?: boolean;
  videoMetadata?: {
    type: 'native' | 'youtube' | 'vimeo' | 'generic-url';
    id?: string;
    duration?: number;
  };
}

export interface Board {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  ownerId: string;
  visibility: Visibility;
  
  // Relationships
  collectionIds: string[]; // A board can belong to multiple collections
  
  // UI Specific
  coverImageId?: string; // The ID of the image to show as the "Hero" background
}

export interface Collection {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface PinGroup {
  id: string;
  title: string;
  imageIds: string[];
  createdAt: number;
  boardIds: string[];
  ownerId: string;
}

export interface DiscoverySource {
  id: string;
  name: string;
  type: string;
  feedUrl: string;
  enabled: boolean;
  ownerId: string;
  createdAt: number;
  lastFetchedAt?: number;
}

// UI State Types
export type ViewType = 'all' | 'boards' | 'board-detail' | 'favorites' | 'collection-detail' | 'community' | 'discovery';

export type PinSortOption = 'newest' | 'oldest' | 'alphabetical';

export type GridItem = 
  | { type: 'image'; data: PinnedImage; images?: never }
  | { type: 'group'; data: PinGroup; images: PinnedImage[] };