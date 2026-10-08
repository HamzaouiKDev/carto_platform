// scripts/test_tile_count.mjs
const DEFAULT_BBOX = {
  minLon: 7.52,
  minLat: 30.24,
  maxLon: 11.60,
  maxLat: 37.56,
};

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

let grandTotal = 0;
for (let z = 6; z <= 16; z++) {
  const minX = lon2tile(DEFAULT_BBOX.minLon, z);
  const maxX = lon2tile(DEFAULT_BBOX.maxLon, z);
  const minY = lat2tile(DEFAULT_BBOX.maxLat, z);
  const maxY = lat2tile(DEFAULT_BBOX.minLat, z);

  const count = (Math.abs(maxX - minX) + 1) * (Math.abs(maxY - minY) + 1);
  grandTotal += count;
  console.log(`Zoom ${z.toString().padStart(2)}: ${count.toLocaleString().padStart(8)} tuiles (Cumul 6..${z}: ${grandTotal.toLocaleString().padStart(10)} tuiles)`);
}
