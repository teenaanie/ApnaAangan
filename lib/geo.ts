/**
 * Which society is nearest, worked out on the device.
 *
 * Lifted out of the provider sign-up picker when the resident side needed the
 * same thing. One copy, because two copies of a distance function drift and
 * only one of them gets the bug fixed.
 *
 * Nothing here talks to a server. The browser hands over a position, it is
 * compared against a list that came down with the page, and a name comes back.
 * The position is not sent anywhere and not stored.
 */

export type Placeable = {
  slug?: string;
  id?: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
};

/** Great-circle distance in km. Good to a few metres at this scale, and short
 *  enough to read — a society two streets away and one twenty minutes away are
 *  never a close call. */
export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Beyond this, "nearest" stops meaning "yours".
 *
 * Preselecting a society across the city would be worse than preselecting
 * nothing, because a wrong answer already filled in is the one nobody
 * re-reads. Aangan's two societies are about 20km apart at opposite ends of
 * Pune, so in practice this is either obviously right or silent.
 */
export const NEAR_KM = 3;

export function nearest<T extends Placeable>(
  list: T[],
  lat: number,
  lng: number
): { item: T; distance: number } | null {
  let best: { item: T; distance: number } | null = null;
  for (const item of list) {
    if (item.lat == null || item.lng == null) continue;
    const d = km(lat, lng, item.lat, item.lng);
    if (!best || d < best.distance) best = { item, distance: d };
  }
  return best;
}
