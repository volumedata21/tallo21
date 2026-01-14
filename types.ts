export type Role = 'admin' | 'user' | 'guest';

// --- FRONTEND ONLY TYPE ---
export interface ActiveFilter {
    type: 'all' | 'collection' | 'board' | 'tag' | 'favorites' | 'created' | 'discovery';
    id: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  usedQuota: string;
  maxQuota: string;
  inviteCode?: string;
  avatarSeed: string;
  apiToken?: string;
  homePagePreference?: 'all' | 'created';
}

export interface Collection {
  id: string;
  title: string;
  ownerId: string;
}

export interface Board {
  id: string;
  title: string;
  collectionId?: string;
  ownerId: string;
  visibility?: 'private' | 'public';
  coverImage?: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

export interface Pin {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  thumbnail?: string;
  gallery?: string[];
  boardIds: string[];
  link?: string;
  location?: LocationData;
  aspectRatio: number;
  tags: string[];
  ownerId: string;
  ownerName?: string;
  ownerAvatar?: string;
  createdAt: number;
  favorite: boolean;
  deletedAt?: number;
}

export interface UserSettings {
  hideTitles: boolean;
  hideDescriptions: boolean;
  showTags: boolean;
  darkMode: boolean;
}

export interface SystemSettings {
  maxUploadSize: string;
  maxUsers: number;
  isServerOpen: boolean;
  ssrfWhitelist?: string;
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';