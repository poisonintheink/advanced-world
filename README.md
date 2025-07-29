# Procedural World Generator - Quick Test Guide

## 🚀 Quick Start

### Option 1: Node.js Testing (Recommended for Analysis)

1. Make sure you have Node.js installed (v14+)

2. Run the test script:
   ```bash
   node test-world.js
   ```

3. This will:
   - Generate a test world
   - Display ASCII maps in the console
   - Analyze world statistics
   - Save visualization images as `.ppm` files
   - Export world data to `world-export.json`

### Option 2: Browser Testing (Recommended for Visual Iteration)

1. Start a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server -p 8000
   ```

2. Open your browser to: `http://localhost:8000/test.html`

3. Click "Generate World" and explore the visualizations

## 📁 File Structure

```
your-folder/
├── gen.js              # The complete world generator
├── test-world.js       # Node.js test script
├── test.html          # Browser visualization
├── package.json       # Node.js package info
└── README.md          # This file
```

## 🔧 Customization

### Change World Parameters

Edit the configuration in `test-world.js`:

```javascript
const TEST_CONFIG = {
    world: {
        width: 2000,    // World width in tiles
        height: 1200,   // World height in tiles
        seed: 'myseed'  // World seed
    },
    settlements: {
        counts: {
            capital: 1,
            city: 3,
            town: 8,
            hamlet: 15
        }
    }
};
```

### Modify Generation

The world generation has several key parameters you can tune:

1. **Continental Shape** - In `ImprovedElevationLayer.initializeContinentFeatures()`:
   - Number of continent blobs
   - Blob positions and sizes
   - Coastline roughness

2. **Mountain Placement** - Adjust mountain ranges:
   - Western spine position/height
   - Secondary ranges
   - Isolated peaks

3. **Biome Thresholds** - In the config:
   - Temperature ranges
   - Moisture levels
   - Biome-specific parameters

## 🔍 What to Look For

When testing your world, check:

1. **Continental Shape**
   - Is it a cohesive landmass?
   - Are the coastlines interesting?
   - Do bays and peninsulas look natural?

2. **Elevation Distribution**
   - Coastal plains near ocean
   - Gradual rise inland
   - Mountain ranges in logical places
   - Valleys between mountains

3. **River Flow**
   - Rivers start in mountains
   - Flow downhill to ocean
   - Form natural deltas

4. **Settlement Placement**
   - Near water sources
   - On flat land
   - Connected by roads
   - Logical hierarchy (capitals → cities → towns)

5. **Biome Distribution**
   - Rain shadows east of mountains
   - Temperature gradients north-south
   - Logical transitions

## 📊 Output Files

After running `test-world.js`:

- **world-elevation.ppm** - Elevation map image
- **world-biomes.ppm** - Biome distribution
- **world-temperature.ppm** - Temperature gradient
- **world-moisture.ppm** - Moisture levels
- **world-export.json** - Complete world data

PPM files can be opened in most image editors or converted:
```bash
# Convert to PNG (requires ImageMagick)
convert world-elevation.ppm world-elevation.png
```

## 🎯 Next Steps for Improvement

Based on your testing, you might want to:

1. **Adjust Continental Shape**
   - Add more blob seeds for complex shapes
   - Modify blob merging parameters
   - Increase coastline detail

2. **Refine Terrain**
   - Add more mountain ranges
   - Create larger valleys/basins
   - Adjust elevation gradients

3. **Improve Hydrology**
   - Tune river spawning thresholds
   - Add more lakes
   - Create wetlands/marshes

4. **Enhance Settlements**
   - Add more settlement tiers
   - Improve placement logic
   - Create trade routes

5. **Add Features**
   - Volcanic islands
   - Archipelagos
   - Inland seas
   - Canyons/rifts

## 🐛 Troubleshooting

- **"Can't find gen.js"** - Make sure all files are in the same directory
- **Blank maps** - Check browser console for errors
- **Poor performance** - Reduce world size or visualization scale
- **Weird terrain** - Try different seeds, some produce better results

## 💡 Tips

1. Start with small worlds (500x300) for quick iteration
2. Use the browser tool for visual feedback
3. Use the Node.js tool for detailed analysis
4. Try many different seeds to see variety
5. Save good seeds for future reference

Happy world building! 🌍