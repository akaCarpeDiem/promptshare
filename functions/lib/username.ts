/** Username (= handle) rules, reserved names, and NSFW/blocklist checks. Server is authoritative. */

const RESERVED = new Set([
  "admin", "administrator", "promptshare", "support", "help", "me", "you", "api",
  "null", "undefined", "root", "system", "mod", "moderator", "staff", "official",
  "login", "logout", "signup", "signin", "register", "settings", "account", "profile",
  "about", "contact", "privacy", "terms", "cookies", "discover", "upload", "archive",
  "creators", "creator", "gallery", "feed", "home", "www", "mail", "email", "status",
  "security", "billing", "payment", "paypal", "stripe", "owner", "founder",
]);

/** Exact-match only (short tokens that would false-positive as substrings). */
const BLOCK_EXACT = new Set([
  "ass", "sex", "cum", "tit", "fag", "gay", "hoe", "std", "hiv", "kkk", "nsfw",
]);

/** Substring blocklist (checked against raw + leetspeak-folded handle). */
const BLOCK_SUBSTR = [
  "porn", "porno", "xxx", "nude", "nudes", "naked", "onlyfans", "ofans",
  "fuck", "fck", "fuk", "shit", "bitch", "bastard", "dick", "cock", "pussy",
  "penis", "vagina", "boob", "boobs", "tits", "anal", "anus", "rape", "rapist",
  "molest", "pedo", "paedo", "pedophile", "childporn", "cporn", "incest",
  "slut", "whore", "blowjob", "handjob", "rimjob", "deepthroat", "hentai",
  "erotic", "fetish", "bdsm", "bondage", "orgasm", "orgy", "threesome",
  "nigg", "retard", "faggot", "tranny", "shemale", "killall", "hitler", "nazi",
  "holocaust", "terrorist", "goebbels", "jihad",
  "bigdick", "hugecock", "sextoy", "dildo", "masterbate", "masturbat",
];

export function cleanUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

/** Fold common leetspeak so d1ck / b1gdick / fuk map into blocklist tokens. */
export function foldLeetspeak(value: string): string {
  return value
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
}

export function validUsernameFormat(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

export type UsernameIssue =
  | { ok: true; username: string }
  | { ok: false; error: string };

function hitsBlocklist(normalized: string): boolean {
  if (BLOCK_EXACT.has(normalized)) return true;
  const folded = foldLeetspeak(normalized);
  for (const token of BLOCK_SUBSTR) {
    if (normalized.includes(token) || folded.includes(token)) return true;
  }
  return false;
}

export function evaluateUsername(raw: string): UsernameIssue {
  const username = cleanUsername(raw);
  if (!validUsernameFormat(username)) {
    return { ok: false, error: "Usernames are 3–20 characters: letters, numbers, underscore." };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: "That username is reserved." };
  }
  if (hitsBlocklist(username)) {
    return { ok: false, error: "That username isn’t allowed." };
  }
  if (/^tmp[a-f0-9]{8,}$/.test(username)) {
    return { ok: false, error: "That username isn’t allowed." };
  }
  return { ok: true, username };
}

export function isPlaceholderHandle(handle: string): boolean {
  return /^tmp[a-f0-9]{8,}$/.test(handle);
}

export function makePlaceholderHandle(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `tmp${hex}`.slice(0, 20);
}
