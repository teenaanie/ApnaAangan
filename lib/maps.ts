/**
 * Mirrors is_google_maps_url() in migration 0017.
 *
 * Duplicated deliberately: this one gives a helpful message while typing, that
 * one is the guarantee. If they ever disagree, the database wins and the form
 * is the bug.
 */
export function isGoogleMapsUrl(u: string): boolean {
  if (u.length > 500) return false;
  return (
    /^https:\/\/(www\.)?google\.(com|co\.in)\/maps(\/|\?|$)/i.test(u) ||
    /^https:\/\/maps\.google\.(com|co\.in)(\/|\?|$)/i.test(u) ||
    /^https:\/\/maps\.app\.goo\.gl\//i.test(u) ||
    /^https:\/\/goo\.gl\/maps\//i.test(u)
  );
}
