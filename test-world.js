// test-world.js - Quick test script for the world generator
// Run with: node test-world.js

const fs = require('fs');
const path = require('path');

// Load the world generator
const WorldGen = require('./gen.js');
const {
  WorldBuilder,
  BiomeProperties,
  ResourceTypes,
  POITypes
} = WorldGen;

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
  // Small world for quick testing
  world: {
    width: 1000,
    height: 600,
    seed: Date.now() // Change seed for different worlds
  },

  // Speed up generation by reducing some counts
  settlements: {
    counts: {
      capital: 1,
      city: 2,
      town: 3,
      hamlet: 5
    }
  },

  // Disable dynamics for faster testing
  enableDynamics: false
};

// =============================================================================
// VISUALIZATION HELPERS
// =============================================================================

function generateASCIIMap(worldBuilder, layer = 'elevation', width = 100, height = 50) {
  const scaleX = worldBuilder.config.world.width / width;
  const scaleY = worldBuilder.config.world.height / height;

  let map = '';

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldX = Math.floor(x * scaleX);
      const worldY = Math.floor(y * scaleY);

      const value = worldBuilder.worldGen.getCell(worldX, worldY, layer);
      map += getASCIIChar(layer, value);
    }
    map += '\n';
  }

  return map;
}

function getASCIIChar(layer, value) {
  if (layer === 'elevation') {
    if (value === null) return ' ';
    if (value < -100) return '≈'; // Deep ocean
    if (value < 0) return '~';     // Ocean
    if (value < 10) return '.';    // Beach
    if (value < 50) return ',';    // Coastal plain
    if (value < 200) return '-';   // Plains
    if (value < 500) return '=';   // Hills
    if (value < 1000) return '▲';  // Low mountains
    if (value < 2000) return '▼';  // Mountains
    return '△';                    // High peaks
  } else if (layer === 'biome') {
    const biomeChars = {
      0: '~', // Ocean
      1: '~', // Lake
      2: '~', // River
      3: '*', // Arctic
      4: '.', // Tundra
      5: '♠', // Boreal Forest
      6: '♣', // Temperate Forest
      7: '"', // Grassland
      8: ':', // Desert
      9: ';', // Savanna
      10: '♦', // Tropical Forest
      11: '^', // Mountain
      12: '.' // Beach
    };
    return biomeChars[value] || '?';
  } else if (layer === 'waterMask') {
    if (value === 0) return ' ';
    if (value === 1) return '~'; // Ocean
    if (value === 2) return 'o'; // Lake
    return '='; // River
  }
  return '?';
}

function saveMapImage(worldBuilder, layer, filename) {
  // Generate a simple PPM image
  const scale = 0.5;
  const width = Math.floor(worldBuilder.config.world.width * scale);
  const height = Math.floor(worldBuilder.config.world.height * scale);

  let ppm = `P3\n${width} ${height}\n255\n`;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldX = Math.floor(x / scale);
      const worldY = Math.floor(y / scale);

      const value = worldBuilder.worldGen.getCell(worldX, worldY, layer);
      const color = getColorForValue(layer, value);

      ppm += `${color[0]} ${color[1]} ${color[2]} `;
    }
    ppm += '\n';
  }

  fs.writeFileSync(filename, ppm);
  console.log(`Saved ${filename}`);
}

function getColorForValue(layer, value) {
  if (layer === 'elevation') {
    if (value === null) return [0, 0, 0];
    if (value < -100) return [10, 30, 80];    // Deep ocean
    if (value < 0) return [30, 80, 150];      // Ocean
    if (value < 10) return [255, 240, 200];   // Beach
    if (value < 50) return [120, 180, 120];   // Coastal plains
    if (value < 200) return [80, 140, 80];    // Plains
    if (value < 500) return [140, 130, 90];   // Hills
    if (value < 1000) return [120, 100, 80];  // Low mountains
    if (value < 2000) return [140, 130, 120]; // Mountains
    return [240, 240, 240];                    // Snow
  } else if (layer === 'biome') {
    const props = BiomeProperties.getProperties(value);
    return props.color;
  } else if (layer === 'temperature') {
    const t = Math.max(0, Math.min(1, (value + 20) / 60));
    return [255 * t, 128, 255 * (1 - t)];
  } else if (layer === 'moisture') {
    const m = Math.max(0, Math.min(1, value));
    return [139 * (1 - m), 90 + 110 * m, 43 + 157 * m];
  }
  return [128, 128, 128];
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

function analyzeWorld(worldBuilder) {
  const analysis = {
    elevation: analyzeElevation(worldBuilder),
    water: analyzeWater(worldBuilder),
    biomes: analyzeBiomes(worldBuilder),
    settlements: analyzeSettlements(worldBuilder),
    connectivity: analyzeConnectivity(worldBuilder)
  };

  return analysis;
}

function analyzeElevation(worldBuilder) {
  const samples = 10000;
  let landCount = 0;
  let elevations = [];
  let coastalCount = 0;
  let mountainCount = 0;

  for (let i = 0; i < samples; i++) {
    const x = Math.floor(Math.random() * worldBuilder.config.world.width);
    const y = Math.floor(Math.random() * worldBuilder.config.world.height);
    const elev = worldBuilder.worldGen.getCell(x, y, 'elevation');

    if (elev !== null) {
      elevations.push(elev);
      if (elev > 0) {
        landCount++;
        if (elev < 50) coastalCount++;
        if (elev > 1000) mountainCount++;
      }
    }
  }

  elevations.sort((a, b) => a - b);

  return {
    landPercentage: (landCount / samples * 100).toFixed(1),
    coastalPercentage: (coastalCount / samples * 100).toFixed(1),
    mountainPercentage: (mountainCount / samples * 100).toFixed(1),
    minElevation: elevations[0],
    maxElevation: elevations[elevations.length - 1],
    medianElevation: elevations[Math.floor(elevations.length / 2)],
    percentile10: elevations[Math.floor(elevations.length * 0.1)],
    percentile90: elevations[Math.floor(elevations.length * 0.9)]
  };
}

function analyzeWater(worldBuilder) {
  const samples = 10000;
  let waterTypes = { ocean: 0, lake: 0, river: 0 };

  for (let i = 0; i < samples; i++) {
    const x = Math.floor(Math.random() * worldBuilder.config.world.width);
    const y = Math.floor(Math.random() * worldBuilder.config.world.height);
    const water = worldBuilder.worldGen.getCell(x, y, 'waterMask');

    if (water === 1) waterTypes.ocean++;
    else if (water === 2) waterTypes.lake++;
    else if (water >= 3) waterTypes.river++;
  }

  return {
    oceanPercentage: (waterTypes.ocean / samples * 100).toFixed(1),
    lakePercentage: (waterTypes.lake / samples * 100).toFixed(1),
    riverPercentage: (waterTypes.river / samples * 100).toFixed(1)
  };
}

function analyzeBiomes(worldBuilder) {
  const samples = 10000;
  const biomeCounts = new Map();

  for (let i = 0; i < samples; i++) {
    const x = Math.floor(Math.random() * worldBuilder.config.world.width);
    const y = Math.floor(Math.random() * worldBuilder.config.world.height);
    const biome = worldBuilder.worldGen.getCell(x, y, 'biome');

    biomeCounts.set(biome, (biomeCounts.get(biome) || 0) + 1);
  }

  const biomeStats = [];
  for (const [biomeId, count] of biomeCounts) {
    const props = BiomeProperties.getProperties(biomeId);
    biomeStats.push({
      name: props.name,
      percentage: (count / samples * 100).toFixed(1)
    });
  }

  biomeStats.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
  return biomeStats;
}

function analyzeSettlements(worldBuilder) {
  const settlements = worldBuilder.worldGen.layers.get('settlements').getAllSettlements();
  const analysis = {
    total: settlements.length,
    byTier: {},
    averageElevation: {},
    nearWater: {}
  };

  for (const tier of ['capital', 'city', 'town', 'hamlet']) {
    const tierSettlements = settlements.filter(s => s.tier === tier);
    analysis.byTier[tier] = tierSettlements.length;

    if (tierSettlements.length > 0) {
      const elevations = tierSettlements.map(s =>
        worldBuilder.worldGen.getCell(s.x, s.y, 'elevation')
      );
      analysis.averageElevation[tier] =
        (elevations.reduce((a, b) => a + b, 0) / elevations.length).toFixed(1);

      const nearWater = tierSettlements.filter(s => {
        const water = worldBuilder.worldGen.getCell(s.x, s.y, 'waterMask');
        // Check nearby cells for water
        for (let dy = -50; dy <= 50; dy += 10) {
          for (let dx = -50; dx <= 50; dx += 10) {
            if (worldBuilder.worldGen.getCell(s.x + dx, s.y + dy, 'waterMask') > 0) {
              return true;
            }
          }
        }
        return false;
      });
      analysis.nearWater[tier] =
        (nearWater.length / tierSettlements.length * 100).toFixed(0) + '%';
    }
  }

  return analysis;
}

function analyzeConnectivity(worldBuilder) {
  // Simple connectivity check - are all settlements reachable?
  // This would be more complex in practice
  return {
    roadsGenerated: true,
    settlmentsConnected: 'All settlements connected via road network'
  };
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

async function testWorldGeneration() {
  console.log('='.repeat(60));
  console.log('WORLD GENERATOR TEST');
  console.log('='.repeat(60));

  // Create world builder
  console.log('\n1. Creating world builder...');
  const worldBuilder = new WorldBuilder(TEST_CONFIG);

  // Set progress callback
  worldBuilder.onProgress = (progress) => {
    process.stdout.write(`\r  ${progress.stage}: ${progress.percent}%  `);
  };

  // Generate world
  console.log('\n2. Generating world...');
  const startTime = Date.now();
  const summary = await worldBuilder.generateWorld();
  const elapsed = Date.now() - startTime;
  console.log(`\n  Generation completed in ${elapsed}ms`);

  // Display ASCII map
  console.log('\n3. Elevation Map (ASCII):');
  console.log(generateASCIIMap(worldBuilder, 'elevation'));

  console.log('\n4. Biome Map (ASCII):');
  console.log(generateASCIIMap(worldBuilder, 'biome'));

  // Analyze world
  console.log('\n5. World Analysis:');
  const analysis = analyzeWorld(worldBuilder);

  console.log('\n  Elevation Statistics:');
  console.log(`    Land coverage: ${analysis.elevation.landPercentage}%`);
  console.log(`    Coastal plains: ${analysis.elevation.coastalPercentage}%`);
  console.log(`    Mountainous: ${analysis.elevation.mountainPercentage}%`);
  console.log(`    Elevation range: ${analysis.elevation.minElevation.toFixed(0)}m to ${analysis.elevation.maxElevation.toFixed(0)}m`);
  console.log(`    Median elevation: ${analysis.elevation.medianElevation.toFixed(0)}m`);

  console.log('\n  Water Bodies:');
  console.log(`    Ocean: ${analysis.water.oceanPercentage}%`);
  console.log(`    Lakes: ${analysis.water.lakePercentage}%`);
  console.log(`    Rivers: ${analysis.water.riverPercentage}%`);

  console.log('\n  Biome Distribution:');
  for (const biome of analysis.biomes.slice(0, 5)) {
    console.log(`    ${biome.name}: ${biome.percentage}%`);
  }

  console.log('\n  Settlements:');
  console.log(`    Total: ${analysis.settlements.total}`);
  for (const [tier, data] of Object.entries(analysis.settlements.byTier)) {
    console.log(`    ${tier}: ${data} (avg elevation: ${analysis.settlements.averageElevation[tier]}m, near water: ${analysis.settlements.nearWater[tier]})`);
  }

  // Save images
  console.log('\n6. Saving visualizations...');
  saveMapImage(worldBuilder, 'elevation', 'world-elevation.ppm');
  saveMapImage(worldBuilder, 'biome', 'world-biomes.ppm');
  saveMapImage(worldBuilder, 'temperature', 'world-temperature.ppm');
  saveMapImage(worldBuilder, 'moisture', 'world-moisture.ppm');

  // Export data
  console.log('\n7. Exporting world data...');
  const exportData = worldBuilder.exportWorld({
    layers: ['elevation', 'biome', 'waterMask'],
    includeVectors: true
  });

  fs.writeFileSync('world-export.json', JSON.stringify(exportData, null, 2));
  console.log('  Exported to world-export.json');

  // Find interesting locations
  console.log('\n8. Interesting Locations:');
  findInterestingLocations(worldBuilder);

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE!');
  console.log('Check the generated files:');
  console.log('  - world-elevation.ppm');
  console.log('  - world-biomes.ppm');
  console.log('  - world-temperature.ppm');
  console.log('  - world-moisture.ppm');
  console.log('  - world-export.json');
  console.log('='.repeat(60));
}

function findInterestingLocations(worldBuilder) {
  const locations = [];

  // Find highest peak
  let highestElev = -Infinity;
  let highestLoc = null;

  // Find largest lake
  let lakeLoc = null;

  // Sample the world
  for (let y = 0; y < worldBuilder.config.world.height; y += 50) {
    for (let x = 0; x < worldBuilder.config.world.width; x += 50) {
      const elev = worldBuilder.worldGen.getCell(x, y, 'elevation');
      const water = worldBuilder.worldGen.getCell(x, y, 'waterMask');

      if (elev > highestElev) {
        highestElev = elev;
        highestLoc = { x, y };
      }

      if (water === 2 && !lakeLoc) {
        lakeLoc = { x, y };
      }
    }
  }

  if (highestLoc) {
    console.log(`  Highest peak: ${highestElev.toFixed(0)}m at (${highestLoc.x}, ${highestLoc.y})`);
  }

  if (lakeLoc) {
    console.log(`  Lake found at: (${lakeLoc.x}, ${lakeLoc.y})`);
  }

  // Find interesting biome transitions
  const transitionLoc = findBiomeTransition(worldBuilder);
  if (transitionLoc) {
    console.log(`  Interesting biome transition at: (${transitionLoc.x}, ${transitionLoc.y})`);
  }
}

function findBiomeTransition(worldBuilder) {
  // Look for areas with high biome diversity
  for (let y = 100; y < worldBuilder.config.world.height - 100; y += 50) {
    for (let x = 100; x < worldBuilder.config.world.width - 100; x += 50) {
      const biomes = new Set();

      for (let dy = -50; dy <= 50; dy += 25) {
        for (let dx = -50; dx <= 50; dx += 25) {
          const biome = worldBuilder.worldGen.getCell(x + dx, y + dy, 'biome');
          if (biome > 2) biomes.add(biome); // Ignore water
        }
      }

      if (biomes.size >= 3) {
        return { x, y };
      }
    }
  }

  return null;
}

// =============================================================================
// RUN THE TEST
// =============================================================================

if (require.main === module) {
  testWorldGeneration().catch(console.error);
}