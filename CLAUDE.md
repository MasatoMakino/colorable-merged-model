# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library for Three.js that provides colorable merged geometries with both mesh bodies and edge lines. The library allows dynamic color changes on geometries after they have been merged, which is useful for performance optimization in Three.js applications.

## Key Architecture Components

### Core Classes

- **ColorableMergedView**: Main container class that combines body and edge components
- **ColorableMergedBody**: Handles mesh geometry with colorable materials
- **ColorableMergedEdge**: Handles edge line geometry with colorable materials
- **GeometryMerger**: Base class for merging multiple geometries into single buffers
- **TweenableColorMap**: Manages color animations and transitions

### Material System

- **ColorableMergedMaterial**: Base material class with color change capabilities
- **ColorableMergedBodyMaterial**: Specialized material for mesh bodies with GLSL shaders
- **ColorableMergedEdgeMaterial**: Specialized material for edge lines with GLSL shaders
- Custom GLSL shaders enable per-geometry color changes after merging

### WebGPU Support

- Located in `webgpu/` directory
- **ColorableMergedBodyNodeMaterial**: WebGPU node material for bodies
- **ColorableMergedEdgeNodeMaterial**: WebGPU node material for edges

## Development Commands

**IMPORTANT**: All npm/npx commands MUST be executed via DevContainer. Do NOT run npm or npx directly on the host.

```bash
# Start DevContainer (if not running)
devcontainer up --workspace-folder .

# Build TypeScript
devcontainer exec --workspace-folder . npm run buildTS

# Run tests
devcontainer exec --workspace-folder . npm run test

# Run tests with coverage
devcontainer exec --workspace-folder . npm run coverage

# Start development server with file watching
devcontainer exec --workspace-folder . npm run start:dev

# Build everything (TypeScript, docs, demo)
devcontainer exec --workspace-folder . npm run build
```

## Testing

- Uses Vitest with jsdom environment
- Tests located in `__test__/` directory
- Run single test file: `devcontainer exec --workspace-folder . npx vitest run __test__/SpecificTest.spec.ts`
- Coverage reports generated in `coverage/` directory

## Build System

- TypeScript compilation target: ES2021
- Module system: ES2022 with bundler resolution
- Output directory: `dist/`
- Uses Biome for formatting and linting
- DevContainer-based Git hooks for pre-commit/pre-push checks

## Demo Development

- Demo source files in `demoSrc/`
- Built demos in `docs/demo/`
- Uses @masatomakino/gulptask-demo-page for demo compilation
- Browser-sync server for live reloading during development

## Key Dependencies

- **three**: Core Three.js library (peer dependency >=0.167.0)
- **@masatomakino/tweenable-color**: Color animation utilities (peer dependency)
- **eventemitter3**: Event system (peer dependency)

## Geometry Naming Convention

The library expects geometries to follow a specific naming pattern for ID extraction:
`{prefix}_{category}_{id}` where the ID is extracted using regex `.*_.*_(\d+)`
Customize the `getGeometryID` function in ColorableMergedView if using different naming conventions.
