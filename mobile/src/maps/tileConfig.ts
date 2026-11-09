export const APP_VERSION = "0.3.4";
export const TILE_CACHE_VERSION = "osm-v2";
export const OPENSTREETMAP_TILE_HOST = "tile.openstreetmap.org";
export const TILE_USER_AGENT = `DISPUTE/${APP_VERSION} (sg.claimproof.mobile; Android; +https://github.com/)`;

export function buildOpenStreetMapTileUrl(zoom: number, x: number, y: number): string {
  return `https://${OPENSTREETMAP_TILE_HOST}/${zoom}/${x}/${y}.png#${TILE_CACHE_VERSION}`;
}
