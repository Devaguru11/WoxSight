import { apiBase } from "./api";

// Resolving server-minted media paths against the API, not the page.
// ------------------------------------------------------------------
// Poster frames and transcoded clips are signed with an HMAC in the query
// string rather than a bearer token, because <img> and <video> cannot set an
// Authorization header. The server hands those out as ROOT-RELATIVE paths
// ("/api/inference/poster/123?e=..&s=.."), which the browser resolves against
// the PAGE's origin - not the API's.
//
// That is only the same origin when the SPA is served by the box that also
// answers /api. Deployments that set VITE_API_BASE to an absolute URL (the
// checked-in client/.env points at http://127.0.0.1:4001/api) put the API
// somewhere else, and every one of those paths then resolves to a URL the
// front-end host does not serve. The symptom is specific and matches what was
// reported: stills small enough to be sent as S3 presigned URLs still render
// (those are absolute), while transcoded videos and the large images that go
// through the poster cache silently fail.
//
// The app is also built with `base: '/enterprise/'`, so a page path prefix is
// in play as well - one more reason these must be resolved deliberately rather
// than left to the browser.

/**
 * The API's root, i.e. `apiBase` minus its trailing `/api` segment.
 *
 * Stripping the segment rather than taking `new URL(apiBase).origin` is what
 * keeps this correct when the API is mounted under a path prefix
 * (`https://host/backend/api` -> `https://host/backend`), because the paths the
 * server mints already carry their own leading `/api`.
 */
const API_ROOT = apiBase.replace(/\/api$/, "");

/**
 * Make a URL handed back by the API safe to drop into `src`/`href`.
 *
 * Absolute URLs - S3 presigned links, anything already fully qualified - are
 * returned untouched. Server-relative paths are re-anchored onto the API root.
 */
export function resolveMediaUrl(url: string): string;
export function resolveMediaUrl(url: string | null | undefined): string | undefined;
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  const raw = String(url || "").trim();
  if (!raw) return undefined;
  // Absolute, protocol-relative, or a data/blob URI: already resolvable.
  if (/^(https?:)?\/\//i.test(raw) || /^(data|blob):/i.test(raw)) return raw;
  if (!raw.startsWith("/")) return raw;
  return `${API_ROOT}${raw}`;
}

/** The API root, for callers building a media path by hand. */
export { API_ROOT };
