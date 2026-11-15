/**
 * EARTHSCOPE WGS84 globe helpers.
 * Elevation tiles: Mapzen/Terrain Tiles public AWS dataset in Terrarium encoding.
 * Surface imagery and night-light imagery are separate NASA reference composites.
 */
export const WGS84 = Object.freeze({
  equatorialRadiusM: 6378137,
  eccentricitySquared: 0.0066943799901413165,
  polarRatio: 0.9966471893352525,
  terrainZoom: 3,
  reliefExaggeration: 5
});

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MERCATOR_LIMIT = 85.0511287798066;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

/** Rebuild a sphere's vertices as a WGS84 oblate ellipsoid using geodetic UVs. */
export function applyWgs84Ellipsoid(THREE, geometry, radius = 2) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || !uv) throw new Error("WGS84 geometry needs position and UV attributes");

  const target = position.array;
  for (let i = 0; i < position.count; i++) {
    const latitude = (uv.getY(i) - 0.5) * Math.PI;
    const longitude = uv.getX(i) * 2 * Math.PI - Math.PI;
    const sinLat = Math.sin(latitude);
    const cosLat = Math.cos(latitude);
    const primeVertical = radius / Math.sqrt(1 - WGS84.eccentricitySquared * sinLat * sinLat);

    target[i * 3] = primeVertical * cosLat * Math.cos(longitude);
    target[i * 3 + 1] = primeVertical * (1 - WGS84.eccentricitySquared) * sinLat;
    target[i * 3 + 2] = -primeVertical * cosLat * Math.sin(longitude);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new Float32Array(target);
}

/**
 * Load a global Terrarium DEM mosaic from AWS Terrain Tiles.
 * At zoom 3 this samples a 2,048 × 1,024 global mosaic (roughly ~20 km pixel
 * spacing at the equator); this is a visual terrain base, not a local survey DEM.
 * The helper fails closed when CORS or source access prevents safe pixel sampling.
 */
export async function loadGlobalTerrariumDEM({
  zoom = WGS84.terrainZoom,
  timeoutMs = 9000,
  minimumTiles = 32
} = {}) {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  const tileCount = 2 ** zoom;
  const tileSize = 256;
  const width = tileCount * tileSize;
  const height = tileCount * tileSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  let loadedTiles = 0;
  const coordinates = [];
  for (let y = 0; y < tileCount; y++) {
    for (let x = 0; x < tileCount; x++) coordinates.push([x, y]);
  }

  const loadTile = (x, y) => new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    image.onload = () => {
      try {
        context.drawImage(image, x * tileSize, y * tileSize, tileSize, tileSize);
        loadedTiles++;
        finish(true);
      } catch {
        finish(false);
      }
    };
    image.onerror = () => finish(false);
    image.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
  });

  // Six requests per batch avoids timing out images merely waiting behind the
  // browser's per-origin connection queue.
  for (let offset = 0; offset < coordinates.length; offset += 6) {
    const batch = coordinates.slice(offset, offset + 6);
    await Promise.all(batch.map(([x, y]) => loadTile(x, y)));
  }
  if (loadedTiles < minimumTiles) return null;

  let pixels;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  const decode = (x, y) => {
    const index = (clamp(y, 0, height - 1) * width + ((x % width) + width) % width) * 4;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    if (alpha === 0 || (red === 0 && green === 0 && blue === 0)) return null;
    return red * 256 + green + blue / 256 - 32768;
  };

  const sample = (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > MERCATOR_LIMIT) return 0;
    const lon = wrapLongitude(longitude);
    const latRad = clamp(latitude, -MERCATOR_LIMIT, MERCATOR_LIMIT) * RAD;
    const x = ((lon + 180) / 360) * width;
    const yNorm = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2;
    const y = clamp(yNorm * height, 0, height - 1);
    const x0 = Math.floor(x) % width;
    const y0 = Math.floor(y);
    const x1 = (x0 + 1) % width;
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = x - Math.floor(x);
    const ty = y - y0;
    const values = [decode(x0, y0), decode(x1, y0), decode(x0, y1), decode(x1, y1)];
    if (values.every(value => value == null)) return null;
    const valid = values.map((value, index) => value == null ? null : [value, index]).filter(Boolean);
    if (valid.length < 4) return valid.reduce((sum, item) => sum + item[0], 0) / valid.length;
    const top = values[0] * (1 - tx) + values[1] * tx;
    const bottom = values[2] * (1 - tx) + values[3] * tx;
    return top * (1 - ty) + bottom * ty;
  };

  return {
    width,
    height,
    zoom,
    loadedTiles,
    sample,
    source: "Mapzen/Terrain Tiles · AWS Open Data · Terrarium encoding"
  };
}

/** Sample the DEM at each geodetic vertex of an equirectangular sphere mesh. */
export function buildTerrainHeightSamples(geometry, dem) {
  if (!dem || typeof dem.sample !== "function") return null;
  const uv = geometry.attributes.uv;
  if (!uv) return null;
  const heights = new Float32Array(uv.count);
  let samples = 0;
  for (let i = 0; i < uv.count; i++) {
    const latitude = (uv.getY(i) - 0.5) * 180;
    const longitude = uv.getX(i) * 360 - 180;
    const value = dem.sample(latitude, longitude);
    if (Number.isFinite(value)) {
      heights[i] = value;
      samples++;
    }
  }
  return samples > uv.count * 0.2 ? heights : null;
}

/** Apply/remove DEM heights without losing the underlying WGS84 ellipsoid. */
export function applyTerrainDisplacement(
  THREE,
  geometry,
  basePositions,
  heights,
  { radius = 2, exaggeration = WGS84.reliefExaggeration, enabled = true } = {}
) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || !uv || !basePositions || !heights) return false;
  const target = position.array;
  const maxAbsElevation = heights.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const metresToWorld = radius / WGS84.equatorialRadiusM * exaggeration;

  for (let i = 0; i < position.count; i++) {
    const bx = basePositions[i * 3];
    const by = basePositions[i * 3 + 1];
    const bz = basePositions[i * 3 + 2];
    const latitude = (uv.getY(i) - 0.5) * Math.PI;
    const longitude = uv.getX(i) * 2 * Math.PI - Math.PI;
    const cosLat = Math.cos(latitude);
    const nx = cosLat * Math.cos(longitude);
    const ny = Math.sin(latitude);
    const nz = -cosLat * Math.sin(longitude);
    const offset = enabled ? heights[i] * metresToWorld : 0;

    target[i * 3] = bx + nx * offset;
    target[i * 3 + 1] = by + ny * offset;
    target[i * 3 + 2] = bz + nz * offset;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return maxAbsElevation;
}

/** Geodetic latitude/longitude to a point on the WGS84 ellipsoid. */
export function latLonToEarthVector(THREE, latitude, longitude, radius = 2, elevationM = 0, exaggeration = 0) {
  const lat = clamp(Number(latitude), -90, 90) * RAD;
  const lon = wrapLongitude(Number(longitude)) * RAD;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const primeVertical = radius / Math.sqrt(1 - WGS84.eccentricitySquared * sinLat * sinLat);
  const h = Number(elevationM || 0) * radius / WGS84.equatorialRadiusM * Number(exaggeration || 0);
  return new THREE.Vector3(
    (primeVertical + h) * cosLat * Math.cos(lon),
    (primeVertical * (1 - WGS84.eccentricitySquared) + h) * sinLat,
    -(primeVertical + h) * cosLat * Math.sin(lon)
  );
}

/** Convert an ECEF-like point near the WGS84 surface back to geodetic coordinates. */
export function earthPointToLatLon(point) {
  const p = Math.hypot(point.x, point.z);
  const latitude = Math.atan2(point.y, p * (1 - WGS84.eccentricitySquared)) * DEG;
  const longitude = Math.atan2(-point.z, point.x) * DEG;
  return { lat: clamp(latitude, -90, 90), lon: wrapLongitude(longitude) };
}

/** Outward WGS84 surface normal at the supplied point. */
export function wgs84SurfaceNormal(THREE, point) {
  const coords = earthPointToLatLon(point);
  const lat = coords.lat * RAD;
  const lon = coords.lon * RAD;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon)
  ).normalize();
}

/** Approximate the geocentric subsolar point from UTC using the solar ephemeris. */
export function getSolarDirection(THREE, date = new Date()) {
  const julianDate = date.getTime() / 86400000 + 2440587.5;
  const days = julianDate - 2451545.0;
  const centuries = days / 36525;
  const meanLongitude = ((280.460 + 0.9856474 * days) % 360 + 360) % 360;
  const meanAnomaly = (((357.528 + 0.9856003 * days) % 360) + 360) % 360;
  const anomaly = meanAnomaly * RAD;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439291 - 0.0130042 * centuries) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const gmst = (
    280.46061837 + 360.98564736629 * days +
    0.000387933 * centuries * centuries -
    centuries * centuries * centuries / 38710000
  ) % 360;
  const subsolarLongitude = wrapLongitude(rightAscension * DEG - gmst);
  return latLonToEarthVector(THREE, declination * DEG, subsolarLongitude, 1).normalize();
}
