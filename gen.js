// complete-world-generator.js - Complete integrated world generation system
// Brings together all components into a unified API

// =============================================================================
// IMPROVED ELEVATION LAYER
// =============================================================================

class ImprovedElevationLayer extends LayerGenerator {
  constructor(worldGen, layerId) {
    super(worldGen, layerId);

    // Extract config
    this.config = worldGen.config;
    this.continentScale = this.config.continent.continentNoiseScale;
    this.mountainIntensity = this.config.continent.mountainIntensity;
    this.shelfWidth = this.config.continent.shelfWidth;
    this.coastlineRoughness = this.config.continent.coastlineRoughness;

    this.seaLevel = this.config.elevation.seaLevel;
    this.maxElevation = this.config.elevation.maxElevation;
    this.minElevation = this.config.elevation.minElevation;

    // Continental shape parameters
    this.continentSeeds = null;
    this.mountainRanges = null;
    this.majorValleys = null;

    // Initialize continental features
    this.initializeContinentFeatures();
  }

  initializeContinentFeatures() {
    const rng = new SeededRandom(this.worldGen.seed, 'continent-features', 0, 0);
    const worldWidth = this.config.world.width;
    const worldHeight = this.config.world.height;

    // Generate continent seeds (blob centers)
    this.continentSeeds = [];
    const numSeeds = 4; // 3-5 blobs that will merge

    // Place main blob roughly in center
    this.continentSeeds.push({
      x: worldWidth * 0.5 + rng.uniform(-worldWidth * 0.1, worldWidth * 0.1),
      y: worldHeight * 0.5 + rng.uniform(-worldHeight * 0.1, worldHeight * 0.1),
      radius: rng.uniform(worldWidth * 0.3, worldWidth * 0.4),
      strength: 1.0
    });

    // Add secondary blobs around it
    for (let i = 1; i < numSeeds; i++) {
      const angle = (i / (numSeeds - 1)) * Math.PI * 2;
      const distance = rng.uniform(worldWidth * 0.2, worldWidth * 0.35);

      this.continentSeeds.push({
        x: worldWidth * 0.5 + Math.cos(angle) * distance,
        y: worldHeight * 0.5 + Math.sin(angle) * distance,
        radius: rng.uniform(worldWidth * 0.15, worldWidth * 0.25),
        strength: rng.uniform(0.6, 0.9)
      });
    }

    // Define mountain ranges
    this.mountainRanges = [];

    // Western spine (main mountain range)
    this.mountainRanges.push({
      type: 'spine',
      points: this.generateMountainSpine(rng, worldWidth, worldHeight, 'western'),
      width: rng.uniform(worldWidth * 0.05, worldWidth * 0.08),
      height: rng.uniform(0.7, 0.9)
    });

    // Secondary mountain range (eastern, lower)
    this.mountainRanges.push({
      type: 'spine',
      points: this.generateMountainSpine(rng, worldWidth, worldHeight, 'eastern'),
      width: rng.uniform(worldWidth * 0.03, worldWidth * 0.05),
      height: rng.uniform(0.4, 0.6)
    });

    // Some isolated mountain clusters
    for (let i = 0; i < 3; i++) {
      this.mountainRanges.push({
        type: 'cluster',
        x: rng.uniform(worldWidth * 0.3, worldWidth * 0.7),
        y: rng.uniform(worldHeight * 0.3, worldHeight * 0.7),
        radius: rng.uniform(worldWidth * 0.02, worldWidth * 0.04),
        height: rng.uniform(0.3, 0.5)
      });
    }

    // Define major valleys/basins
    this.majorValleys = [];
    for (let i = 0; i < 3; i++) {
      this.majorValleys.push({
        x: rng.uniform(worldWidth * 0.3, worldWidth * 0.7),
        y: rng.uniform(worldHeight * 0.3, worldHeight * 0.7),
        radius: rng.uniform(worldWidth * 0.05, worldWidth * 0.1),
        depth: rng.uniform(0.3, 0.5)
      });
    }
  }

  generateMountainSpine(rng, worldWidth, worldHeight, side) {
    const points = [];
    const numPoints = 8;

    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const baseX = side === 'western' ? worldWidth * 0.25 : worldWidth * 0.75;

      points.push({
        x: baseX + rng.uniform(-worldWidth * 0.05, worldWidth * 0.05),
        y: worldHeight * (0.1 + t * 0.8),
        width: rng.uniform(50, 150)
      });
    }

    return points;
  }

  generateChunk(chunkX, chunkY, lod = 0) {
    const chunkSize = this.worldGen.chunkSize;
    const overlap = this.worldGen.chunkOverlap;

    // Create tile with overlap
    const tileSize = chunkSize + overlap * 2;
    const worldOrigin = {
      x: chunkX * chunkSize - overlap,
      y: chunkY * chunkSize - overlap
    };

    const tile = new RasterTile(tileSize, tileSize, 'float32', worldOrigin);

    // Create RNG for this chunk
    const rng = new SeededRandom(this.worldGen.seed, this.layerId, chunkX, chunkY);
    const noise = new NoiseGenerator(rng);

    // Generate elevation for each cell
    for (let y = 0; y < tileSize; y++) {
      for (let x = 0; x < tileSize; x++) {
        const worldX = worldOrigin.x + x;
        const worldY = worldOrigin.y + y;

        // Skip out-of-bounds
        if (worldX < 0 || worldY < 0 ||
          worldX >= this.config.world.width ||
          worldY >= this.config.world.height) {
          tile.set(x, y, this.minElevation);
          continue;
        }

        const elevation = this.generateElevation(worldX, worldY, noise);
        tile.set(x, y, elevation);
      }
    }

    return tile;
  }

  generateElevation(worldX, worldY, noise) {
    const worldWidth = this.config.world.width;
    const worldHeight = this.config.world.height;

    // 1. Generate continent shape using blob merging
    let continentValue = this.calculateContinentShape(worldX, worldY, noise);

    // 2. Calculate base elevation from continental features
    let baseElevation = this.calculateBaseElevation(worldX, worldY, continentValue, noise);

    // 3. Add mountain ranges
    let mountainContribution = this.calculateMountainContribution(worldX, worldY, noise);

    // 4. Apply valleys/basins
    let valleyModifier = this.calculateValleyModifier(worldX, worldY);

    // 5. Combine all elevation components
    let elevation = baseElevation * valleyModifier + mountainContribution;

    // 6. Add fine detail noise
    elevation = this.addDetailNoise(worldX, worldY, elevation, continentValue, noise);

    // 7. Apply coastal effects
    elevation = this.applyCostalEffects(worldX, worldY, elevation, continentValue);

    // 8. Final mapping to elevation range
    if (continentValue < 0.01) {
      // Deep ocean
      elevation = this.minElevation + (continentValue * 10) * Math.abs(this.minElevation);
    } else if (elevation < 0) {
      // Shallow ocean/coastal
      elevation = elevation * Math.abs(this.minElevation) * 0.1;
    } else {
      // Land - scale to max elevation
      elevation = elevation * this.maxElevation;
    }

    return elevation;
  }

  calculateContinentShape(worldX, worldY, noise) {
    // Use metaball-like distance fields to merge blobs
    let totalInfluence = 0;
    let maxInfluence = 0;

    for (const seed of this.continentSeeds) {
      const dx = worldX - seed.x;
      const dy = worldY - seed.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Metaball falloff function
      if (distance < seed.radius * 2) {
        let influence = 1.0 - (distance / (seed.radius * 2));
        influence = Math.pow(influence, 2); // Smooth falloff
        influence *= seed.strength;

        totalInfluence += influence;
        maxInfluence = Math.max(maxInfluence, influence);
      }
    }

    // Add noise for coastline detail
    const noiseScale = 0.003;
    const coastNoise = noise.fbm(
      worldX * noiseScale,
      worldY * noiseScale,
      5, // More octaves for detailed coastline
      0.6, // Higher persistence for rougher coast
      2.2
    );

    // Domain warping for more interesting shapes
    const warpScale = 0.001;
    const warpX = noise.fbm(worldX * warpScale, worldY * warpScale, 2, 0.5, 2.0) * 100;
    const warpY = noise.fbm(worldX * warpScale + 1000, worldY * warpScale + 1000, 2, 0.5, 2.0) * 100;

    const warpedNoise = noise.fbm(
      (worldX + warpX) * noiseScale * 2,
      (worldY + warpY) * noiseScale * 2,
      3, 0.5, 2.0
    );

    // Combine influences with noise
    let continentValue = totalInfluence;
    continentValue += (coastNoise * 0.3 + warpedNoise * 0.2) * this.coastlineRoughness;

    // Sharp transition at coast
    const threshold = 0.5;
    if (continentValue > threshold) {
      continentValue = 1.0 - Math.exp(-(continentValue - threshold) * 3);
    } else {
      continentValue = -Math.exp(-(threshold - continentValue) * 3);
    }

    return Math.max(-1, Math.min(1, continentValue));
  }

  calculateBaseElevation(worldX, worldY, continentValue, noise) {
    if (continentValue <= 0) {
      return continentValue; // Ocean
    }

    // Base elevation increases with distance from coast
    const coastalDistance = this.estimateCoastalDistance(worldX, worldY, continentValue);

    let baseElevation = 0;

    // Coastal plains (0-50km from coast)
    if (coastalDistance < 50000) {
      baseElevation = (coastalDistance / 50000) * 0.02; // 0-20m
    }
    // Rolling hills (50-150km)
    else if (coastalDistance < 150000) {
      baseElevation = 0.02 + ((coastalDistance - 50000) / 100000) * 0.08; // 20-100m
    }
    // Highlands (150km+)
    else {
      baseElevation = 0.1 + ((coastalDistance - 150000) / 200000) * 0.1; // 100-200m base
    }

    // Add some broad variation
    const broadScale = 0.0005;
    const broadNoise = noise.fbm(worldX * broadScale, worldY * broadScale, 3, 0.5, 2.0);
    baseElevation += broadNoise * 0.05;

    return Math.max(0, baseElevation);
  }

  estimateCoastalDistance(worldX, worldY, continentValue) {
    // Simple approximation based on continent value
    // In a real implementation, we might do a proper distance transform
    return Math.max(0, continentValue * 200000); // Rough approximation
  }

  calculateMountainContribution(worldX, worldY, noise) {
    let mountainHeight = 0;

    for (const range of this.mountainRanges) {
      if (range.type === 'spine') {
        // Calculate distance to mountain spine
        let minDist = Infinity;

        for (let i = 0; i < range.points.length - 1; i++) {
          const p1 = range.points[i];
          const p2 = range.points[i + 1];

          // Distance to line segment
          const dist = this.distanceToLineSegment(worldX, worldY, p1, p2);
          minDist = Math.min(minDist, dist);
        }

        if (minDist < range.width) {
          // Mountain profile (ridge-like)
          let profile = 1.0 - (minDist / range.width);
          profile = Math.pow(profile, 0.7); // Sharper peaks

          // Add ridged noise for mountain texture
          const mountainScale = 0.002;
          const ridgeNoise = noise.ridgedNoise(
            worldX * mountainScale,
            worldY * mountainScale,
            4, 0.5, 2.3
          );

          mountainHeight = Math.max(mountainHeight,
            profile * range.height * (0.7 + ridgeNoise * 0.3));
        }
      } else if (range.type === 'cluster') {
        // Isolated mountain cluster
        const dist = Math.sqrt(
          Math.pow(worldX - range.x, 2) +
          Math.pow(worldY - range.y, 2)
        );

        if (dist < range.radius) {
          let profile = 1.0 - (dist / range.radius);
          profile = Math.pow(profile, 1.5);

          // Add noise
          const clusterScale = 0.003;
          const clusterNoise = noise.fbm(
            worldX * clusterScale,
            worldY * clusterScale,
            3, 0.5, 2.0
          );

          mountainHeight = Math.max(mountainHeight,
            profile * range.height * (0.5 + clusterNoise * 0.5));
        }
      }
    }

    return mountainHeight * this.mountainIntensity;
  }

  calculateValleyModifier(worldX, worldY) {
    let valleyModifier = 1.0;

    for (const valley of this.majorValleys) {
      const dist = Math.sqrt(
        Math.pow(worldX - valley.x, 2) +
        Math.pow(worldY - valley.y, 2)
      );

      if (dist < valley.radius) {
        const influence = 1.0 - (dist / valley.radius);
        const depression = Math.pow(influence, 2) * valley.depth;
        valleyModifier = Math.min(valleyModifier, 1.0 - depression);
      }
    }

    return valleyModifier;
  }

  addDetailNoise(worldX, worldY, elevation, continentValue, noise) {
    if (continentValue <= 0) {
      // Ocean floor detail
      const oceanScale = 0.002;
      const oceanNoise = noise.fbm(worldX * oceanScale, worldY * oceanScale, 3, 0.5, 2.0);
      return elevation + oceanNoise * 0.02;
    }

    // Land detail varies by elevation
    let detailAmplitude = 0.1;
    if (elevation > 0.5) {
      detailAmplitude = 0.2; // More variation in mountains
    } else if (elevation > 0.2) {
      detailAmplitude = 0.15; // Moderate in hills
    }

    // Multi-scale detail
    const fine = noise.fbm(worldX * 0.01, worldY * 0.01, 4, 0.5, 2.0);
    const medium = noise.fbm(worldX * 0.003, worldY * 0.003, 3, 0.5, 2.0);

    return elevation + (fine * 0.7 + medium * 0.3) * detailAmplitude;
  }

  applyCostalEffects(worldX, worldY, elevation, continentValue) {
    // Continental shelf
    if (continentValue < 0 && continentValue > -0.3) {
      // Gradual shelf
      elevation = continentValue * 0.1;
    }

    // Beach/tidal zones
    if (continentValue > 0 && continentValue < 0.1 && elevation < 0.01) {
      elevation = 0.001; // Very low elevation for beaches
    }

    // Cliffs (where mountains meet ocean)
    if (continentValue > 0 && continentValue < 0.2 && elevation > 0.3) {
      elevation *= 1.2; // Enhance cliff effect
    }

    return elevation;
  }

  distanceToLineSegment(px, py, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return Math.sqrt(Math.pow(px - p1.x, 2) + Math.pow(py - p1.y, 2));
    }

    let t = ((px - p1.x) * dx + (py - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;

    return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
  }

  smoothstep(edge0, edge1, x) {
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
  }
}

// =============================================================================
// WORLD BUILDER - HIGH LEVEL API
// =============================================================================

class WorldBuilder {
  constructor(config = {}) {
    // Merge with defaults
    this.config = this.mergeDeepConfig(this.getDefaultConfig(), config);

    // Create world generator
    this.worldGen = new WorldGenerator(this.config);

    // Register all layers
    this.registerAllLayers();

    // Create dynamic manager if enabled
    if (this.config.enableDynamics) {
      this.dynamicManager = new DynamicWorldManager(this.worldGen);
      this.dynamicManager.initialize(this.config.world.seed);
    }

    // Generation progress tracking
    this.generationProgress = {
      stage: 'idle',
      percent: 0,
      message: ''
    };
  }

  getDefaultConfig() {
    return {
      world: {
        width: 22000,   // Manhattan-sized
        height: 13000,
        seed: Date.now()
      },
      enableDynamics: true,
      outputFormat: 'json',  // 'json', 'binary', 'tiles'
      visualization: {
        enabled: false,
        scale: 0.1  // Downsample for visualization
      },
      generation: {
        stages: ['terrain', 'hydrology', 'climate', 'settlements', 'ecology'],
        parallel: false  // Future enhancement
      }
    };
  }

  mergeDeepConfig(target, source) {
    const output = Object.assign({}, target);

    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeepConfig(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  registerAllLayers() {
    const layers = this.worldGen.layers;

    // Terrain - Use improved elevation generation
    layers.set('elevation', new ImprovedElevationLayer(this.worldGen, 'elevation'));
    layers.set('slope', new SlopeLayer(this.worldGen, 'slope'));

    // Hydrology
    layers.set('flowDirection', new FlowDirectionLayer(this.worldGen, 'flowDirection'));
    layers.set('flowAccumulation', new FlowAccumulationLayer(this.worldGen, 'flowAccumulation'));
    layers.set('waterMask', new WaterMaskLayer(this.worldGen, 'waterMask'));
    layers.set('riverNetwork', new RiverNetworkLayer(this.worldGen, 'riverNetwork'));

    // Climate
    layers.set('temperature', new TemperatureLayer(this.worldGen, 'temperature'));
    layers.set('moisture', new MoistureLayer(this.worldGen, 'moisture'));
    layers.set('biome', new BiomeLayer(this.worldGen, 'biome'));

    // Settlements
    layers.set('settlements', new SettlementLayer(this.worldGen, 'settlements'));
    layers.set('roadCost', new RoadCostLayer(this.worldGen, 'roadCost'));
    layers.set('roadNetwork', new RoadNetworkLayer(this.worldGen, 'roadNetwork'));

    // Ecology
    layers.set('vegetation', new VegetationLayer(this.worldGen, 'vegetation'));
    layers.set('resources', new ResourceLayer(this.worldGen, 'resources'));
    layers.set('pois', new POILayer(this.worldGen, 'pois'));
  }

  // ==========================================================================
  // GENERATION METHODS
  // ==========================================================================

  async generateWorld(options = {}) {
    const stages = options.stages || this.config.generation.stages;

    console.log(`Generating world (${this.config.world.width}x${this.config.world.height})...`);
    console.log(`Seed: ${this.config.world.seed}`);

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      this.updateProgress(stage, (i / stages.length) * 100);

      await this.generateStage(stage);

      // Allow UI updates
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.updateProgress('complete', 100);
    console.log('World generation complete!');

    return this.getWorldSummary();
  }

  async generateStage(stage) {
    console.log(`\nGenerating ${stage}...`);
    const startTime = Date.now();

    switch (stage) {
      case 'terrain':
        await this.generateTerrain();
        break;
      case 'hydrology':
        await this.generateHydrology();
        break;
      case 'climate':
        await this.generateClimate();
        break;
      case 'settlements':
        await this.generateSettlements();
        break;
      case 'ecology':
        await this.generateEcology();
        break;
      default:
        console.warn(`Unknown stage: ${stage}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`  ${stage} completed in ${elapsed}ms`);
  }

  async generateTerrain() {
    // Force generation of a few chunks to prime the cache
    const samplePoints = [
      { x: 0, y: 0 },
      { x: this.worldGen.chunksX - 1, y: 0 },
      { x: 0, y: this.worldGen.chunksY - 1 },
      { x: this.worldGen.chunksX - 1, y: this.worldGen.chunksY - 1 },
      { x: Math.floor(this.worldGen.chunksX / 2), y: Math.floor(this.worldGen.chunksY / 2) }
    ];

    for (const point of samplePoints) {
      this.worldGen.getChunk('elevation', point.x, point.y);
      this.worldGen.getChunk('slope', point.x, point.y);
    }
  }

  async generateHydrology() {
    // Generate flow and rivers
    const centerX = Math.floor(this.worldGen.chunksX / 2);
    const centerY = Math.floor(this.worldGen.chunksY / 2);

    this.worldGen.getChunk('flowDirection', centerX, centerY);
    this.worldGen.getChunk('flowAccumulation', centerX, centerY);
    this.worldGen.getChunk('waterMask', centerX, centerY);
    this.worldGen.getChunk('riverNetwork', centerX, centerY);
  }

  async generateClimate() {
    const centerX = Math.floor(this.worldGen.chunksX / 2);
    const centerY = Math.floor(this.worldGen.chunksY / 2);

    this.worldGen.getChunk('temperature', centerX, centerY);
    this.worldGen.getChunk('moisture', centerX, centerY);
    this.worldGen.getChunk('biome', centerX, centerY);
  }

  async generateSettlements() {
    // Settlements generate globally, so just trigger generation
    const settlementLayer = this.worldGen.layers.get('settlements');
    settlementLayer.getAllSettlements();

    // Generate some road chunks
    const settlements = settlementLayer.getAllSettlements();
    if (settlements.length > 0) {
      const s = settlements[0];
      const chunkX = Math.floor(s.x / this.worldGen.chunkSize);
      const chunkY = Math.floor(s.y / this.worldGen.chunkSize);
      this.worldGen.getChunk('roadNetwork', chunkX, chunkY);
    }
  }

  async generateEcology() {
    const centerX = Math.floor(this.worldGen.chunksX / 2);
    const centerY = Math.floor(this.worldGen.chunksY / 2);

    this.worldGen.getChunk('vegetation', centerX, centerY);
    this.worldGen.getChunk('resources', centerX, centerY);
    this.worldGen.getChunk('pois', centerX, centerY);
  }

  updateProgress(stage, percent, message = '') {
    this.generationProgress = {
      stage,
      percent: Math.round(percent),
      message
    };

    if (this.onProgress) {
      this.onProgress(this.generationProgress);
    }
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  getCellInfo(x, y) {
    const info = {
      coordinates: { x, y },
      terrain: {},
      hydrology: {},
      climate: {},
      ecology: {},
      features: []
    };

    // Terrain
    info.terrain.elevation = this.worldGen.getCell(x, y, 'elevation');
    info.terrain.slope = this.worldGen.getCell(x, y, 'slope');

    // Hydrology
    const waterType = this.worldGen.getCell(x, y, 'waterMask');
    info.hydrology.waterType = this.getWaterTypeName(waterType);
    info.hydrology.flowAccumulation = this.worldGen.getCell(x, y, 'flowAccumulation');

    // Climate
    info.climate.temperature = this.worldGen.getCell(x, y, 'temperature');
    info.climate.moisture = this.worldGen.getCell(x, y, 'moisture');
    const biomeId = this.worldGen.getCell(x, y, 'biome');
    info.climate.biome = BiomeProperties.getProperties(biomeId).name;

    // Ecology
    info.ecology.vegetation = this.worldGen.getCell(x, y, 'vegetation');

    // Dynamic state if available
    if (this.dynamicManager) {
      const weather = this.dynamicManager.weatherSystem.getWeatherAt(x, y);
      info.climate.currentWeather = weather;

      const season = this.dynamicManager.seasonalSystem.getCurrentSeason();
      info.climate.season = season;
    }

    return info;
  }

  getWaterTypeName(waterType) {
    const names = ['None', 'Ocean', 'Lake', 'Small River', 'Medium River', 'Large River'];
    return names[waterType] || 'Unknown';
  }

  findNearestSettlement(x, y) {
    const settlements = this.worldGen.layers.get('settlements').getAllSettlements();

    let nearest = null;
    let minDistance = Infinity;

    for (const settlement of settlements) {
      const distance = Math.sqrt(
        Math.pow(settlement.x - x, 2) +
        Math.pow(settlement.y - y, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = settlement;
      }
    }

    return { settlement: nearest, distance: minDistance };
  }

  getWorldSummary() {
    const summary = {
      dimensions: {
        width: this.config.world.width,
        height: this.config.world.height,
        area: this.config.world.width * this.config.world.height,
        chunks: this.worldGen.chunksX * this.worldGen.chunksY
      },
      seed: this.config.world.seed,
      statistics: this.calculateStatistics(),
      settlements: this.getSettlementSummary(),
      biomes: this.getBiomeSummary()
    };

    return summary;
  }

  calculateStatistics() {
    const stats = {
      elevation: { min: Infinity, max: -Infinity, mean: 0 },
      landPercent: 0,
      waterPercent: 0
    };

    // Sample the world for statistics
    const sampleSize = 1000;
    let landCount = 0;
    let elevSum = 0;

    for (let i = 0; i < sampleSize; i++) {
      const x = Math.floor(Math.random() * this.config.world.width);
      const y = Math.floor(Math.random() * this.config.world.height);

      const elev = this.worldGen.getCell(x, y, 'elevation');
      if (elev !== null) {
        if (elev > 0) landCount++;
        elevSum += elev;
        stats.elevation.min = Math.min(stats.elevation.min, elev);
        stats.elevation.max = Math.max(stats.elevation.max, elev);
      }
    }

    stats.elevation.mean = elevSum / sampleSize;
    stats.landPercent = (landCount / sampleSize) * 100;
    stats.waterPercent = 100 - stats.landPercent;

    return stats;
  }

  getSettlementSummary() {
    const settlements = this.worldGen.layers.get('settlements').getAllSettlements();
    const summary = {
      total: settlements.length,
      byTier: {
        capital: 0,
        city: 0,
        town: 0,
        hamlet: 0
      },
      totalPopulation: 0
    };

    for (const settlement of settlements) {
      summary.byTier[settlement.tier]++;
      summary.totalPopulation += settlement.population;
    }

    return summary;
  }

  getBiomeSummary() {
    const biomeCounts = new Map();
    const sampleSize = 1000;

    for (let i = 0; i < sampleSize; i++) {
      const x = Math.floor(Math.random() * this.config.world.width);
      const y = Math.floor(Math.random() * this.config.world.height);

      const biomeId = this.worldGen.getCell(x, y, 'biome');
      biomeCounts.set(biomeId, (biomeCounts.get(biomeId) || 0) + 1);
    }

    const summary = [];
    for (const [biomeId, count] of biomeCounts) {
      const biomeProps = BiomeProperties.getProperties(biomeId);
      summary.push({
        name: biomeProps.name,
        percent: (count / sampleSize) * 100
      });
    }

    summary.sort((a, b) => b.percent - a.percent);
    return summary;
  }

  // ==========================================================================
  // EXPORT METHODS
  // ==========================================================================

  exportWorld(options = {}) {
    const format = options.format || this.config.outputFormat;

    switch (format) {
      case 'json':
        return this.exportJSON(options);
      case 'binary':
        return this.exportBinary(options);
      case 'tiles':
        return this.exportTiles(options);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  exportJSON(options = {}) {
    const {
      bounds = null,
      layers = ['elevation', 'biome', 'waterMask'],
      includeVectors = true,
      includeDynamicState = true
    } = options;

    const startX = bounds?.startX || 0;
    const startY = bounds?.startY || 0;
    const endX = bounds?.endX || this.config.world.width;
    const endY = bounds?.endY || this.config.world.height;

    const data = {
      metadata: {
        version: '1.0',
        generator: 'ProceduralWorldEngine',
        seed: this.config.world.seed,
        dimensions: {
          width: endX - startX,
          height: endY - startY,
          originalWidth: this.config.world.width,
          originalHeight: this.config.world.height
        },
        bounds: { startX, startY, endX, endY },
        exportDate: new Date().toISOString()
      },
      layers: {}
    };

    // Export raster layers
    for (const layerId of layers) {
      data.layers[layerId] = this.worldGen.exportRegion(
        [layerId], startX, startY, endX, endY
      ).layers[layerId];
    }

    // Export vector data
    if (includeVectors) {
      data.vectors = {
        settlements: this.worldGen.layers.get('settlements').getAllSettlements(),
        rivers: this.exportRiverNetwork(bounds),
        roads: this.exportRoadNetwork(bounds)
      };
    }

    // Export dynamic state
    if (includeDynamicState && this.dynamicManager) {
      data.dynamicState = this.dynamicManager.saveState();
    }

    return data;
  }

  exportRiverNetwork(bounds) {
    // Collect all river segments within bounds
    const rivers = [];
    const startChunkX = Math.floor((bounds?.startX || 0) / this.worldGen.chunkSize);
    const endChunkX = Math.ceil((bounds?.endX || this.config.world.width) / this.worldGen.chunkSize);
    const startChunkY = Math.floor((bounds?.startY || 0) / this.worldGen.chunkSize);
    const endChunkY = Math.ceil((bounds?.endY || this.config.world.height) / this.worldGen.chunkSize);

    for (let cy = startChunkY; cy < endChunkY; cy++) {
      for (let cx = startChunkX; cx < endChunkX; cx++) {
        const chunk = this.worldGen.getChunk('riverNetwork', cx, cy);
        rivers.push(...chunk.nodes);
      }
    }

    return rivers;
  }

  exportRoadNetwork(bounds) {
    // Similar to rivers
    const roads = [];
    const startChunkX = Math.floor((bounds?.startX || 0) / this.worldGen.chunkSize);
    const endChunkX = Math.ceil((bounds?.endX || this.config.world.width) / this.worldGen.chunkSize);
    const startChunkY = Math.floor((bounds?.startY || 0) / this.worldGen.chunkSize);
    const endChunkY = Math.ceil((bounds?.endY || this.config.world.height) / this.worldGen.chunkSize);

    for (let cy = startChunkY; cy < endChunkY; cy++) {
      for (let cx = startChunkX; cx < endChunkX; cx++) {
        const chunk = this.worldGen.getChunk('roadNetwork', cx, cy);
        if (chunk.edges.length > 0) {
          roads.push({
            chunk: { x: cx, y: cy },
            nodes: chunk.nodes,
            edges: chunk.edges
          });
        }
      }
    }

    return roads;
  }

  exportBinary(options = {}) {
    // Placeholder for binary export
    throw new Error('Binary export not yet implemented');
  }

  exportTiles(options = {}) {
    // Placeholder for tile-based export
    throw new Error('Tile export not yet implemented');
  }

  // ==========================================================================
  // VISUALIZATION HELPER
  // ==========================================================================

  async generatePreviewImage(canvas, options = {}) {
    const {
      layer = 'elevation',
      colorMap = null
    } = options;

    const ctx = canvas.getContext('2d');
    const scale = this.config.visualization.scale;

    const width = Math.floor(this.config.world.width * scale);
    const height = Math.floor(this.config.world.height * scale);

    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    console.log(`Generating preview (${width}x${height})...`);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = Math.floor(x / scale);
        const worldY = Math.floor(y / scale);

        const value = this.worldGen.getCell(worldX, worldY, layer);
        const color = this.getColorForValue(layer, value, colorMap);

        const idx = (y * width + x) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }

      // Update progress
      if (y % 50 === 0) {
        this.updateProgress('visualization', (y / height) * 100);
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    console.log('Preview complete!');
  }

  getColorForValue(layer, value, customColorMap) {
    if (customColorMap) {
      return customColorMap(value);
    }

    // Default color maps
    switch (layer) {
      case 'elevation':
        return this.elevationToColor(value);
      case 'biome':
        return BiomeProperties.getProperties(value).color;
      case 'temperature':
        return this.temperatureToColor(value);
      case 'moisture':
        return this.moistureToColor(value);
      default:
        return [128, 128, 128];  // Gray
    }
  }

  elevationToColor(elevation) {
    if (elevation < 0) {
      // Ocean - deeper = darker blue
      const depth = Math.abs(elevation) / Math.abs(this.worldGen.config.elevation.minElevation);
      return [
        50 * (1 - depth * 0.5),
        100 * (1 - depth * 0.5),
        200 * (1 - depth * 0.3)
      ];
    } else {
      // Land gradient
      const height = elevation / this.worldGen.config.elevation.maxElevation;

      if (height < 0.1) return [100, 150, 100];  // Coastal green
      if (height < 0.3) return [150, 200, 100];  // Lowland
      if (height < 0.5) return [200, 180, 140];  // Hills
      if (height < 0.7) return [180, 140, 100];  // Mountains
      if (height < 0.9) return [240, 240, 240];  // Snow
      return [255, 255, 255];  // Peak
    }
  }

  temperatureToColor(temp) {
    // Blue (cold) to Red (hot)
    const normalized = (temp + 20) / 60;  // Assuming -20 to 40 range
    const cold = [0, 0, 255];
    const hot = [255, 0, 0];

    return [
      cold[0] + (hot[0] - cold[0]) * normalized,
      cold[1] + (hot[1] - cold[1]) * normalized,
      cold[2] + (hot[2] - cold[2]) * normalized
    ];
  }

  moistureToColor(moisture) {
    // Brown (dry) to Blue (wet)
    const dry = [139, 90, 43];
    const wet = [0, 100, 200];

    return [
      dry[0] + (wet[0] - dry[0]) * moisture,
      dry[1] + (wet[1] - dry[1]) * moisture,
      dry[2] + (wet[2] - dry[2]) * moisture
    ];
  }
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

async function exampleUsage() {
  console.log('='.repeat(60));
  console.log('PROCEDURAL WORLD GENERATOR - COMPLETE EXAMPLE');
  console.log('='.repeat(60));

  // Create world builder with custom config
  const worldBuilder = new WorldBuilder({
    world: {
      width: 2000,   // Smaller for demo
      height: 1200,
      seed: 42
    },
    settlements: {
      counts: {
        capital: 1,
        city: 2,
        town: 5,
        hamlet: 10
      }
    },
    visualization: {
      enabled: true,
      scale: 0.5
    }
  });

  // Set progress callback
  worldBuilder.onProgress = (progress) => {
    console.log(`  Progress: ${progress.stage} - ${progress.percent}%`);
  };

  // Generate the world
  const summary = await worldBuilder.generateWorld();

  // Display summary
  console.log('\nWorld Summary:');
  console.log('==============');
  console.log(`Dimensions: ${summary.dimensions.width}x${summary.dimensions.height}`);
  console.log(`Total area: ${(summary.dimensions.area / 1000000).toFixed(2)} km²`);
  console.log(`Land coverage: ${summary.statistics.landPercent.toFixed(1)}%`);
  console.log(`Elevation range: ${summary.statistics.elevation.min.toFixed(0)}m to ${summary.statistics.elevation.max.toFixed(0)}m`);

  console.log('\nSettlements:');
  console.log(`  Total: ${summary.settlements.total}`);
  console.log(`  Population: ${summary.settlements.totalPopulation.toLocaleString()}`);
  console.log('  By tier:');
  for (const [tier, count] of Object.entries(summary.settlements.byTier)) {
    console.log(`    ${tier}: ${count}`);
  }

  console.log('\nBiome Distribution:');
  for (const biome of summary.biomes.slice(0, 5)) {
    console.log(`  ${biome.name}: ${biome.percent.toFixed(1)}%`);
  }

  // Query specific location
  console.log('\nSample Location Info:');
  const sampleX = 1000;
  const sampleY = 600;
  const cellInfo = worldBuilder.getCellInfo(sampleX, sampleY);
  console.log(`Location (${sampleX}, ${sampleY}):`);
  console.log(`  Elevation: ${cellInfo.terrain.elevation?.toFixed(1)}m`);
  console.log(`  Biome: ${cellInfo.climate.biome}`);
  console.log(`  Temperature: ${cellInfo.climate.temperature?.toFixed(1)}°C`);
  console.log(`  Water: ${cellInfo.hydrology.waterType}`);

  const nearest = worldBuilder.findNearestSettlement(sampleX, sampleY);
  console.log(`  Nearest settlement: ${nearest.settlement.name} (${nearest.distance.toFixed(0)}m away)`);

  // Export a region
  console.log('\nExporting region...');
  const exportData = worldBuilder.exportWorld({
    bounds: {
      startX: 800,
      startY: 400,
      endX: 1200,
      endY: 800
    },
    layers: ['elevation', 'biome', 'waterMask'],
    includeVectors: true
  });

  console.log(`Export complete! Data size: ${JSON.stringify(exportData).length} bytes`);

  // Simulate some time passing if dynamics enabled
  if (worldBuilder.dynamicManager) {
    console.log('\nSimulating 30 days...');
    for (let day = 0; day < 30; day++) {
      worldBuilder.dynamicManager.update(1.0);  // 1 day
    }

    const weather = worldBuilder.dynamicManager.weatherSystem.getWeatherAt(1000, 600);
    console.log('Current weather at center:');
    console.log(`  Precipitation: ${(weather.precipitation * 100).toFixed(0)}%`);
    console.log(`  Wind speed: ${weather.windSpeed.toFixed(1)} m/s`);
    console.log(`  Season: ${worldBuilder.dynamicManager.seasonalSystem.getCurrentSeason()}`);
  }

  console.log('\n✓ World generation complete and ready for use!');
}

// =============================================================================
// EXPORTS
// =============================================================================

// Make it work in both Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WorldBuilder,
    WorldGenerator,
    LayerGenerator,
    RasterTile,
    VectorTile,
    ChunkKey,
    SeededRandom,
    NoiseGenerator,
    // ... rest of the exports
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - make everything global
  window.WorldBuilder = WorldBuilder;
  window.WorldGenerator = WorldGenerator;
  window.LayerGenerator = LayerGenerator;
  window.RasterTile = RasterTile;
  window.VectorTile = VectorTile;
  window.ChunkKey = ChunkKey;
  window.SeededRandom = SeededRandom;
  window.NoiseGenerator = NoiseGenerator;
  window.ChunkCache = ChunkCache;
  window.ImprovedElevationLayer = ImprovedElevationLayer;
  window.SlopeLayer = SlopeLayer;
  window.FlowDirectionLayer = FlowDirectionLayer;
  window.FlowAccumulationLayer = FlowAccumulationLayer;
  window.WaterMaskLayer = WaterMaskLayer;
  window.RiverNetworkLayer = RiverNetworkLayer;
  window.TemperatureLayer = TemperatureLayer;
  window.MoistureLayer = MoistureLayer;
  window.BiomeLayer = BiomeLayer;
  window.SettlementLayer = SettlementLayer;
  window.SettlementSiteScorer = SettlementSiteScorer;
  window.RoadCostLayer = RoadCostLayer;
  window.RoadNetworkLayer = RoadNetworkLayer;
  window.VegetationLayer = VegetationLayer;
  window.ResourceLayer = ResourceLayer;
  window.POILayer = POILayer;
  window.DynamicWorldManager = DynamicWorldManager;
  window.WeatherSystem = WeatherSystem;
  window.WildfireSystem = WildfireSystem;
  window.SeasonalSystem = SeasonalSystem;
  window.ErosionSystem = ErosionSystem;
  window.OverlayDelta = OverlayDelta;
  window.BiomeProperties = BiomeProperties;
  window.ResourceTypes = ResourceTypes;
  window.POITypes = POITypes;
  window.SpawnTables = SpawnTables;
}

// Run example if called directly
if (typeof require !== 'undefined' && require.main === module) {
  exampleUsage().catch(console.error);
}
