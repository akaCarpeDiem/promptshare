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

export interface AuthEnv {
  DEV_AUTH?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  PUBLIC_ORIGIN?: string;
  /** Optional Sightengine image moderation (nudity + minor signals). */
  SIGHTENGINE_API_USER?: string;
  SIGHTENGINE_API_SECRET?: string;
}

export interface Store {
  kind: "file" | "d1";
  mediaKind: "file" | "r2";
  ready(): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByHandle(handle: string): Promise<User | null>;
  createUser(input: {
    email: string;
    handle: string;
    displayName: string;
    usernameSet?: boolean;
  }): Promise<User>;
  updateUser(
    id: string,
    patch: Partial<
      Pick<
        User,
        | "handle"
        | "displayName"
        | "bio"
        | "website"
        | "avatarUrl"
        | "socials"
        | "usernameSet"
        | "passwordHash"
        | "passwordSalt"
        | "passwordUpdatedAt"
      >
    >,
  ): Promise<User>;
  deleteAccount(userId: string): Promise<void>;
  handleTaken(handle: string, exceptUserId?: string): Promise<boolean>;
  createSession(userId: string): Promise<{ id: string; expiresAt: number }>;
  userForSession(sessionId: string): Promise<User | null>;
  deleteSession(sessionId: string): Promise<void>;
  createLoginCode(email: string): Promise<{ code: string; expiresAt: number }>;
  verifyLoginCode(email: string, code: string): Promise<"ok" | "invalid" | "expired" | "locked">;
  createOauthState(provider: string): Promise<string>;
  consumeOauthState(state: string, provider: string): Promise<boolean>;
  listFeed(opts: { q?: string; model?: string; tag?: string; following?: boolean; limit: number; offset?: number; viewerId?: string | null; mediaKind?: "image" | "video" | "all" }): Promise<{ items: Creation[]; total: number }>;
  listCreators(q?: string): Promise<PublicUser[]>;
  publicUser(handle: string, viewerId?: string | null): Promise<PublicUser | null>;
  listByUser(userId: string, viewerId?: string | null, includeHidden?: boolean): Promise<Creation[]>;
  getCreation(id: string, viewerId?: string | null): Promise<Creation | null>;
  createCreation(input: Omit<Creation, "likeCount" | "saveCount" | "liked" | "saved" | "steps"> & { steps: Omit<ChainStep, "id">[] }): Promise<Creation>;
  setFeatured(userId: string, creationId: string): Promise<void>;
  hideCreation(userId: string, creationId: string): Promise<boolean>;
  toggleLike(userId: string, creationId: string): Promise<{ liked: boolean; likeCount: number }>;
  toggleSave(userId: string, creationId: string): Promise<{ saved: boolean; saveCount: number }>;
  setFollow(followerId: string, followeeId: string, follow: boolean): Promise<void>;
  report(input: { id: string; creationId: string; reporterId: string; reason: string; createdAt: string }): Promise<void>;
  putMedia(bytes: Uint8Array, contentType: string, ext: string): Promise<string>;
  getMedia(id: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
}
