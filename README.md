# colorable-merged-model

[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@masatomakino/colorable-merged-model.svg?style=flat)](https://www.npmjs.com/package/@masatomakino/colorable-merged-model)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github&style=flat)](https://github.com/MasatoMakino/colorable-merged-model)

A TypeScript library for Three.js that provides colorable merged geometries with both mesh bodies and edge lines. This library allows dynamic color changes on individual geometries after they have been merged, which is essential for performance optimization in Three.js applications.

## Features

- Performance Optimization: Merge multiple geometries into single buffers for better rendering performance
- Dynamic Color Control: Change colors of individual geometries even after merging
- Animated Color Transitions: Built-in color animation system with customizable easing functions
- Edge Line Support: Automatic edge line generation with configurable detail levels
- TypeScript Support: Full TypeScript definitions for better development experience

## Demo

[Demo Page](https://masatomakino.github.io/colorable-merged-model/demo/)

## Installation

```bash
npm install @masatomakino/colorable-merged-model
```

## Quick Start

Here's a simple example to get you started:

```typescript
import * as THREE from "three";
import {
  ColorableMergedView,
  ColorableMergedBodyMaterial,
  ColorableMergedEdgeMaterial,
  TweenableColorMap,
} from "@masatomakino/colorable-merged-model";

// Create a Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

async function createColorableMergedModel() {
  // Create the main view with body and edge options
  const view = new ColorableMergedView({
    bodyOption: { color: [1, 1, 1, 0.2] }, // White with 20% opacity
    edgeOption: { color: [1, 1, 1, 0.8] }, // White with 80% opacity
  });

  // Create color maps for managing colors
  const bodyColors = new TweenableColorMap("colors");
  const edgeColors = new TweenableColorMap("colors");

  // Create some box geometries
  const geometry1 = new THREE.BoxGeometry(1, 1, 1);
  const geometry2 = new THREE.BoxGeometry(1, 1, 1);

  // Position the second box
  geometry2.translate(2, 0, 0);

  // Add geometries with unique IDs
  const id1 = 1;
  const id2 = 2;

  // Add colors for each geometry
  bodyColors.add([1, 0, 0, 0.2], id1); // Red body
  bodyColors.add([0, 1, 0, 0.2], id2); // Green body

  edgeColors.add([1, 0, 0, 0.8], id1); // Red edges
  edgeColors.add([0, 1, 0, 0.8], id2); // Green edges

  // Add geometries to the view
  await view.body?.geometryMerger.add(geometry1, bodyColors, id1);
  await view.body?.geometryMerger.add(geometry2, bodyColors, id2);

  await view.edge?.geometryMerger.add(geometry1, edgeColors, id1);
  await view.edge?.geometryMerger.add(geometry2, edgeColors, id2);

  // Merge all geometries
  await view.merge();

  // Apply materials
  if (view.body) {
    view.body.material = new ColorableMergedBodyMaterial(bodyColors);
  }
  if (view.edge) {
    view.edge.material = new ColorableMergedEdgeMaterial(edgeColors);
  }

  // Add to scene
  scene.add(view);

  // Animate colors (optional)
  setTimeout(() => {
    bodyColors.changeColor([0, 0, 1, 0.2], id1, { duration: 2000 }); // Change to blue
    edgeColors.changeColor([0, 0, 1, 0.8], id1, { duration: 2000 });
  }, 1000);

  return view;
}

// Initialize and render
createColorableMergedModel().then(() => {
  camera.position.z = 5;

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
});
```

## API Reference

### ColorableMergedView

The main container class that combines body and edge components.

```typescript
const view = new ColorableMergedView({
  bodyOption?: {
    color: [number, number, number, number]; // RGBA values (0-1)
  };
  edgeOption?: {
    color: [number, number, number, number]; // RGBA values (0-1)
    edgeDetail?: number; // Default: 7
    useFastEdgesGeometry?: boolean;
  };
});
```

**Key Methods:**

- `merge(): Promise<void>` - Merges all added geometries
- `getGeometryID(name: string): number` - Extracts geometry ID from name (customizable)

**Properties:**

- `body?: ColorableMergedBody` - Mesh body component
- `edge?: ColorableMergedEdge` - Edge line component

### TweenableColorMap

Manages colors and animations for geometries.

```typescript
const colorMap = new TweenableColorMap("colors"); // "colors" is the uniform name in shaders

// Add a color for a geometry
colorMap.add([1, 0, 0, 1], geometryId); // Red color

// Change color with animation
colorMap.changeColor([0, 1, 0, 1], geometryId, {
  duration: 1000, // Animation duration in milliseconds
  easing: (t) => t, // Easing function
  now: Date.now(), // Start time
});

// Get color for a geometry
const color = colorMap.get(geometryId);
```

### Materials

#### ColorableMergedBodyMaterial

Material for mesh bodies with shader-based color control.

```typescript
const bodyMaterial = new ColorableMergedBodyMaterial(colorMap, {
  blending?: THREE.Blending;
  side?: THREE.Side;
});
```

#### ColorableMergedEdgeMaterial

Material for edge lines with shader-based color control.

```typescript
const edgeMaterial = new ColorableMergedEdgeMaterial(colorMap);
```

## Advanced Usage

### Creating Multiple Geometries

```typescript
async function createMultipleBoxes() {
  const view = new ColorableMergedView({
    bodyOption: { color: [1, 1, 1, 0.2] },
    edgeOption: { color: [1, 1, 1, 0.8] },
  });

  const bodyColors = new TweenableColorMap("colors");
  const edgeColors = new TweenableColorMap("colors");

  const promises = [];

  // Create a grid of boxes
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      geometry.translate(x * 2 - 4, y * 2 - 4, 0);

      const id = x * 5 + y;
      const hue = (id / 25) * 360; // Different hue for each box
      const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.5);

      bodyColors.add([color.r, color.g, color.b, 0.2], id);
      edgeColors.add([color.r, color.g, color.b, 0.8], id);

      promises.push(
        view.body?.geometryMerger.add(geometry, bodyColors, id),
        view.edge?.geometryMerger.add(geometry, edgeColors, id),
      );
    }
  }

  await Promise.all(promises);
  await view.merge();

  // Apply materials
  if (view.body) {
    view.body.material = new ColorableMergedBodyMaterial(bodyColors);
  }
  if (view.edge) {
    view.edge.material = new ColorableMergedEdgeMaterial(edgeColors);
  }

  return view;
}
```

### Custom Geometry ID Extraction

By default, the library expects geometry names to follow the pattern `{prefix}_{category}_{id}`. You can customize this:

```typescript
class CustomColorableMergedView extends ColorableMergedView {
  getGeometryID(name: string): number {
    // Custom logic to extract ID from geometry name
    const match = name.match(/customPattern_(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}
```

### Color Animation Events

Each geometry's color is managed by a TweenableColor instance from the [@masatomakino/tweenable-color](https://github.com/MasatoMakino/tweenable-color) module. You can access individual TweenableColor instances to listen to animation events:

```typescript
const colorMap = new TweenableColorMap("colors");
const geometryId = 1;

// Add a color for the geometry
colorMap.add([1, 0, 0, 1], geometryId);

// Get the TweenableColor instance for event handling
const tweenableColor = colorMap.get(geometryId);

// Start the animation
colorMap.changeColor([0, 1, 0, 1], geometryId, { duration: 2000 });
```

For detailed information about available events and event handling, please refer to the [@masatomakino/tweenable-color documentation](https://github.com/MasatoMakino/tweenable-color).

## Performance Considerations

- Geometry Merging: Always call `view.merge()` after adding all geometries and before applying materials
- Batch Operations: Add multiple geometries in parallel using `Promise.all()` for better performance
- Memory Management: Dispose of geometries after merging if they're no longer needed

## Browser Support

This library supports modern browsers with WebGL support. For WebGPU features, ensure your target browsers support WebGPU.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
