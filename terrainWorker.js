importScripts('https://unpkg.com/simplex-noise@2.4.0/simplex-noise.js');

let mapData = null;
let WORLD_TO_VORONOI = 1;
const detailNoise = new SimplexNoise(4);

function sampleNoise(noise, x, y, octaves, persistence = 0.5, scale = 1) {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * (noise.noise2D(x * frequency, y * frequency) + 1) / 2;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

function getBiome(e, m, t) {
  if (e < 0.15) return 'deepOcean';
  if (e < 0.25) return 'ocean';
  if (e < 0.3) return 'beach';

  if (e < 0.6) {
    if (t < 0.3) {
      return m < 0.3 ? 'tundra' : 'snowyForest';
    } else if (t < 0.6) {
      if (m < 0.2) return 'desert';
      if (m < 0.5) return 'grassland';
      return 'forest';
    } else {
      if (m < 0.2) return 'desert';
      if (m < 0.4) return 'savanna';
      if (m < 0.7) return 'rainforest';
      return 'swamp';
    }
  } else if (e < 0.8) {
    return t < 0.3 ? 'snowyMountain' : 'mountain';
  } else {
    return 'peak';
  }
}

const biomeColors = {
  deepOcean: [10, 30, 60],
  ocean: [20, 50, 90],
  beach: [230, 210, 170],
  desert: [230, 200, 150],
  grassland: [120, 180, 80],
  forest: [50, 120, 60],
  rainforest: [30, 90, 50],
  savanna: [180, 160, 100],
  swamp: [60, 80, 60],
  tundra: [200, 200, 180],
  snowyForest: [180, 200, 180],
  mountain: [140, 130, 120],
  snowyMountain: [220, 220, 230],
  peak: [250, 250, 255]
};

function sampleDetailedTerrain(worldX, worldY) {
  const vx = worldX * WORLD_TO_VORONOI;
  const vy = worldY * WORLD_TO_VORONOI;

  const gridX = Math.floor(vx / mapData.spatialCellSize);
  const gridY = Math.floor(vy / mapData.spatialCellSize);

  let nearest = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = gridX + dx;
      const gy = gridY + dy;
      if (gx >= 0 && gx < mapData.spatialGridSize && gy >= 0 && gy < mapData.spatialGridSize) {
        const cells = mapData.spatialGrid[gy * mapData.spatialGridSize + gx];
        for (let cellId of cells) {
          const ddx = mapData.points[cellId].x - vx;
          const ddy = mapData.points[cellId].y - vy;
          const distSq = ddx * ddx + ddy * ddy;
          nearest.push({ cell: cellId, distSq });
        }
      }
    }
  }

  if (nearest.length === 0) {
    const nearestCell = Math.floor(vx) + Math.floor(vy) * mapData.voronoiSize;
    const cellId = Math.min(mapData.numRegions - 9, Math.max(0, nearestCell));
    nearest.push({ cell: cellId, distSq: 0 });
  }

  nearest.sort((a, b) => a.distSq - b.distSq);
  nearest = nearest.slice(0, 4);

  const weights = [];
  let totalWeight = 0;
  for (let i = 0; i < nearest.length; i++) {
    const dist = Math.sqrt(nearest[i].distSq);
    const w = 1 / (dist + 0.01);
    weights.push(w);
    totalWeight += w;
  }

  let elevation = 0,
    moisture = 0,
    temperature = 0,
    region = -1;
  for (let i = 0; i < weights.length; i++) {
    const cell = nearest[i].cell;
    const w = weights[i] / totalWeight;
    elevation += mapData.elevation[cell] * w;
    moisture += mapData.moisture[cell] * w;
    temperature += mapData.temperature[cell] * w;
  }

  if (Math.sqrt(nearest[0].distSq) < 1) {
    region = mapData.regions[nearest[0].cell];
  }

  const detailScale = 0.005;
  const detail = sampleNoise(detailNoise, worldX * detailScale, worldY * detailScale, mapData.detailOctaves || 3, 0.6, 1);

  elevation = Math.max(0, Math.min(1, elevation + (detail - 0.5) * 0.1));
  moisture = Math.max(0, Math.min(1, moisture + (detail - 0.5) * 0.2));

  return {
    elevation,
    moisture,
    temperature,
    region,
    biome: getBiome(elevation, moisture, temperature)
  };
}

function generateChunk(params) {
  const { xStart, yStart, width, height, xScale, yScale, offsetX, offsetY, zoom, viewMode, id, canvasId, key } = params;
  const imageData = new ImageData(width, height);
  const out = imageData.data;
  let idx = 0;
  for (let y = 0; y < height; y++) {
    const worldY = offsetY + (yStart + y) * yScale / zoom;
    for (let x = 0; x < width; x++) {
      const worldX = offsetX + (xStart + x) * xScale / zoom;
      if (worldX < 0 || worldX >= mapData.mapScale || worldY < 0 || worldY >= mapData.mapScale) {
        out[idx++] = 20;
        out[idx++] = 20;
        out[idx++] = 20;
        out[idx++] = 255;
        continue;
      }
      const terrain = sampleDetailedTerrain(worldX, worldY);
      let color;
      if (viewMode === 'elevation') {
        const g = Math.floor(terrain.elevation * 255);
        color = [g, g, g];
      } else if (viewMode === 'moisture') {
        const b = Math.floor(terrain.moisture * 255);
        color = [0, b / 2, b];
      } else if (viewMode === 'temperature') {
        const t = Math.floor(terrain.temperature * 255);
        color = [t, t / 2, 255 - t];
      } else {
        color = biomeColors[terrain.biome] || [100, 100, 100];
      }

      out[idx++] = color[0];
      out[idx++] = color[1];
      out[idx++] = color[2];
      out[idx++] = 255;
    }
  }

  postMessage({ type: 'chunkResult', canvasId, key, xStart, yStart, imageData });
}

onmessage = function (e) {
  const data = e.data;
  if (data.type === 'init') {
    mapData = data.mapData;
    WORLD_TO_VORONOI = mapData.voronoiSize / mapData.mapScale;
  } else if (data.type === 'generateChunk') {
    generateChunk(data);
  }
};