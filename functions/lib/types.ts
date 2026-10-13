export type MediaKind = "image" | "video" | "audio";
export type Visibility = "public" | "unlisted";

export interface SocialLink {
  label: string;
  url: string;
}

export interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string;
  website: string;
  avatarUrl: string;
  socials: SocialLink[];
  createdAt: string;
  /** False until the user explicitly chooses a username (new OTP accounts). */
  usernameSet: boolean;
  /** PBKDF2-SHA256 hash; empty if no password. Never expose to clients. */
  passwordHash: string;
  passwordSalt: string;
  passwordUpdatedAt: string;
}

export interface ChainStep {
  id: string;
  position: number;
  prompt: string;
  model: string;
  note: string;
}

export interface Creation {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  model: string;
  /** Optional display-only override. Chips map family names at display time; D1 `model` stays as stored. */
  modelVersion?: string;
  tags: string[];
  visibility: Visibility;
  mediaUrl: string;
  mediaKind: MediaKind;
  featured: boolean;
  hidden: boolean;
  createdAt: string;
  steps: ChainStep[];
  likeCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
}

export interface PublicUser {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  website: string;
  avatarUrl: string;
  socials: SocialLink[];
  followers: number;
  following: number;
  creationCount: number;
  followed: boolean;
}

/** Shared Pages env shape. Sign-in, accounts and outbound mail were removed. */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AuthEnv {}

export interface Store {
  kind: "file" | "d1";
  mediaKind: "file" | "r2";
  ready(): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  listFeed(opts: { q?: string; model?: string; tag?: string; following?: boolean; limit: number; offset?: number; viewerId?: string | null; mediaKind?: "image" | "video" | "all" }): Promise<{ items: Creation[]; total: number }>;
  listCreators(q?: string): Promise<PublicUser[]>;
  publicUser(handle: string, viewerId?: string | null): Promise<PublicUser | null>;
  listByUser(userId: string, viewerId?: string | null, includeHidden?: boolean): Promise<Creation[]>;
  getCreation(id: string, viewerId?: string | null): Promise<Creation | null>;
  getMedia(id: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
