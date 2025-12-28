export type Visibility = 'private' | 'public' | 'unlisted';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  following?: string[];
  isAdmin?: boolean;
}

export interface PinnedImage {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  isFavorite?: boolean;
  likedBy?: string[];
  sourceUrl?: string;
  groupId?: string;
  ownerId: string;
  visibility: Visibility;
  mediaType?: 'image' | 'video';
  thumbnailUrl?: string;
  isCustomThumbnail?: boolean;
  videoMetadata?: {
    type: 'native' | 'youtube' | 'vimeo' | 'generic-url';
    id?: string;
    duration?: number;
  };
}

export interface PinGroup {
  id: string;
  title: string;
  imageIds: string[];
  createdAt: number;
  boardIds: string[];
  ownerId: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  coverImageId?: string;
  ownerId: string;
  collectionIds: string[]; 
  collectionId?: string; 
}

export interface Collection {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
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

export type ViewType = 'all' | 'boards' | 'board-detail' | 'favorites' | 'collection-detail' | 'community' | 'discovery';

export interface AppState {
  images: PinnedImage[];
  boards: Board[];
  collections: Collection[];
  activeView: ViewType;
  selectedBoardId: string | null;
  selectedCollectionId: string | null;
}

// UPDATED: Added 'images' property to the group type so MasonryGrid works
export type GridItem = 
  | { type: 'image'; data: PinnedImage }
  | { type: 'group'; data: PinGroup; images: PinnedImage[] };

// UPDATED: Expanded sort options to match what Sidebar and App use
export type PinSortOption = 'newest' | 'oldest' | 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';
export type ItemSortOption = 'alpha' | 'newest-created' | 'oldest-created' | 'newest-updated' | 'oldest-updated' | 'newest' | 'oldest' | 'name-asc' | 'name-desc';
