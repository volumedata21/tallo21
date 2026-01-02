export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  maxQuota: string;
  usedQuota: string;
  inviteCode?: string;
  avatarSeed: string;
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
  ownerName?: string;   // <--- NEW
  ownerAvatar?: string; // <--- NEW
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
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';

export interface ActiveFilter {
  type: 'all' | 'collection' | 'board' | 'tag' | 'favorites' | 'created';
  id: string;
}