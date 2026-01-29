# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CRAM (Computational Room Acoustic Module) is a browser-based application for simulating and exploring acoustic properties of modeled spaces. Built with React, Three.js, and TypeScript, it implements multiple computational acoustics solvers including ray tracing, image source method, FDTD, and statistical reverberation time calculations.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (opens at localhost:3000)
npm start

# Build for production
npm run build

# Run tests
npm test
```

The build system uses custom webpack configuration in `config/webpack.config.js` with support for:
- TypeScript compilation
- GLSL shader loading (glslify-loader)
- Web Workers (worker-loader)
- Hot module reloading in development

## Core Architecture

### Layered Architecture Pattern

CRAM follows a layered architecture with clear separation:

1. **Presentation Layer** (`src/components/`) - React UI components
2. **State Management Layer** (`src/store/`) - Zustand stores with Immer
3. **Business Logic Layer** (`src/compute/`) - Acoustic solvers and algorithms
4. **Data Layer** (`src/objects/`) - Scene object models
5. **Rendering Layer** (`src/render/`) - Three.js 3D visualization

### Dual Messaging Systems

The application uses **two messaging patterns** (both in `src/messenger.ts`):

1. **Legacy Messenger Pattern** (string-based pub-sub):
   - Used in `src/index.tsx` for application bootstrap
   - Pattern: `messenger.addMessageHandler("EVENT_NAME", handler)`
   - Examples: `SHOULD_ADD_SOURCE`, `IMPORT_FILE`, `SAVE`

2. **Modern Event System** (type-safe event emitter):
   - Used in store modules and newer code
   - Pattern: `on("EVENT_NAME", handler)` with before/after hooks
   - Events registered in `src/events.ts`, `src/objects/events.ts`, `src/compute/events.ts`
   - **Prefer this for new code**

### State Management (Zustand)

All application state is managed through Zustand stores in `src/store/`:

| Store | Purpose | Key Properties |
|-------|---------|----------------|
| `container-store.ts` | Scene objects | `containers: KVP<Container>`, `selectedObjects` |
| `solver-store.ts` | Simulation solvers | `solvers: KVP<Solver>` |
| `result-store.ts` | Computation results | `results: KVP<Result<ResultKind>>` |
| `app-store.ts` | Global UI state | `projectName`, `units`, undo/redo |
| `material-store.ts` | Acoustic materials | Indexed material database |
| `settings-store.ts` | Renderer settings | Camera, grid, lighting config |

**Update pattern** (uses Immer for immutability):
```typescript
useContainer.getState().set(draft => {
  draft.containers[uuid].property = value; // Mutative syntax via Immer proxy
});
```

**Global helpers** for common operations:
- `addContainer(ContainerClass)(instance)` - Adds container to store + renderer
- `removeContainer(uuid)` - Disposes and removes from store
- `setContainerProperty({uuid, property, value})` - Type-safe updates
- Similar pattern: `addSolver`, `removeSolver`, `setSolverProperty`

### Data Flow Architecture

```
User Input (React)
  → Event Emission (emit("ADD_RAYTRACER"))
  → Event Handlers (addSolver(RayTracer))
  → Zustand Stores (useSolver.getState().set(...))
  → React Re-renders + Solver Execution
  → Renderer Updates (Three.js) + Results Store
```

### Object Model

All scene objects extend `Container` class (`src/objects/container.ts`), which extends `THREE.Group`:

**Base properties:**
- `kind`: String identifier ("room", "source", "receiver", "surface")
- `selected`: Selection state
- `save()`/`restore()`: Serialization to/from JSON
- `dispose()`: Cleanup method
- `onModeChange(mode)`: React to editor mode changes

**Object hierarchy:**
```
Container (THREE.Group)
├── Room
│   └── surfaces (Container)
│       └── Surface (multiple)
│           └── mesh (THREE.Mesh)
├── Source
│   └── mesh (THREE.Mesh) [green sphere]
└── Receiver
    └── mesh (THREE.Mesh) [red sphere]
```

**Key classes:**

- **Room** (`src/objects/room.ts`):
  - Contains `surfaces` collection of Surface objects
  - `volumeOfMesh()`: Calculates volume via signed triangle volumes
  - `surfaceMap`: UUID-indexed map for fast surface lookup
  - Stores import metadata (`originalFileName`, `originalFileData`)

- **Surface** (`src/objects/surface.ts`):
  - `_acousticMaterial`: Frequency-dependent absorption coefficients
  - `_triangles`: Array of THREE.Triangle for ray intersection
  - `scatteringCoefficient`: Controls diffuse vs specular reflection
  - Visualization includes transparent mesh, optional wireframe, and edge lines

- **Source/Receiver** (`src/objects/source.ts`, `receiver.ts`):
  - Signal generation: OSCILLATOR, PINK_NOISE, WHITE_NOISE, PULSE
  - Spherical directivity via `theta`, `phi` angles
  - Optional directivity patterns from CLF data

### Solver Architecture

All solvers extend `Solver` class (`src/compute/solver.ts`):

**Required implementations:**
- `kind`: Solver type identifier
- `running`: Execution state
- `save()`/`restore()`: Serialization methods

**Statistical RT60** (`src/compute/rt/index.ts`):
- Implements Sabine, Eyring, and Arau-Puchades equations
- `calculate()`: Runs all methods, emits results to result store
- Air absorption hardcoded for 20°C, 40% RH

**Ray Tracer** (`src/compute/raytracer/index.ts`):
- Stochastic ray tracing using BVH acceleration (`three-mesh-bvh`)
- `shootRay()`: Casts rays with frequency-dependent energy attenuation
- Supports hybrid mode: Image Source (early) + ray tracing (late)
- Uses Web Workers for audio filtering (`filter.worker.ts`)
- Generates octave-band impulse responses exportable as WAV
- Real-time visualization with custom shaders (`src/compute/raytracer/shaders/points`)

**Image Source Method** (`src/compute/raytracer/image-source/index.ts`):
- Deterministic early reflection finder using mirror image sources
- `constructImageSourceTreeRecursive()`: Builds reflection tree up to `maxReflectionOrder`
- `constructPathsForAllDescendents()`: Extracts valid ray paths with visibility testing
- Output: Level-time progression showing discrete early reflections

**2D FDTD** (`src/compute/2d-fdtd/index.ts`):
- GPU-accelerated wave propagation using `GPUComputationRenderer`
- GLSL shaders for wave equation updates (`src/compute/2d-fdtd/shaders/`)
- Real-time pressure field visualization
- Supports Neumann and PML boundary conditions

**Energy Decay Analyzer** (`src/compute/energy-decay.ts`):
- Post-processes impulse responses to extract T20, T30, T60, EDT
- Speech clarity metrics: C80, STI
- Octave-band filtering via Schroeder integration

### Renderer Integration

The `Renderer` class (`src/render/renderer.ts`) is the central hub connecting compute and visualization:

**Key responsibilities:**
- Scene management: `workspace`, `interactables`, `fdtdItems`, `markup`
- Dual camera system (perspective/orthographic) with OrbitControls
- Selection via `PickHelper` (raycasting) with `OutlinePass` highlighting
- Render loop driven by `requestAnimationFrame` when `needsToRender = true`
- Post-processing effects (outline, FXAA)

**Important:** Solvers directly manipulate Three.js objects (tight coupling between compute and render layers for performance).

## File Import/Export

### Import Pipeline (`src/import-handlers/`)

**Supported formats:**
- **OBJ** (`obj.ts`) - General 3D models, preserves groups
- **DXF** (`dxf.ts`) - AutoCAD files, preserves layers as surfaces
- **STL** (`stl.ts`) - Binary STL, single mesh
- **DAE** (`dae.ts`) - Collada XML
- **3DS** (`tds.ts`) - 3D Studio files
- **WAV** (inline) - Impulse responses for analysis

**Import flow:**
1. User selects file → `emit("IMPORT_FILE", files)`
2. Handler in `index.tsx` determines file type
3. Import handler parses file → returns plain geometry data
4. Handler constructs object (e.g., `new Surface(...)` → `new Room(...)`)
5. `emit("ADD_ROOM", room)` adds to state + renderer

**Key architectural decision:** Import handlers return geometry data, not scene objects. Object construction happens in message handlers.

### Export Architecture (`src/store/io.ts`)

**Save format (JSON):**
```json
{
  "meta": {
    "version": "0.2.1",
    "name": "project name",
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "containers": [/* ContainerSaveObject[] */],
  "solvers": [/* SolverSaveObject[] */]
}
```

**Save flow:**
1. `emit("SAVE")` → Iterates all stores
2. Calls `.save()` on each object
3. FileSaver downloads JSON blob

**Load flow:**
1. `emit("OPEN")` → File picker → Parse JSON
2. `emit("RESTORE", { json })` → Version check
3. `emit("RESTORE_CONTAINERS", json.containers)` → Reconstructs via `.restore()`
4. `emit("RESTORE_SOLVERS", json.solvers)` → Recreates solvers

**Version compatibility:** Check `gte(version, "0.2.1")` to handle legacy formats.

**Result export:**
- **CSV**: Direct blob creation for RT60 results
- **WAV**: Ray tracer audio buffers via FileSaver
- **Charts**: Plotly.js built-in download

## Material Database

Acoustic materials are stored as static JSON (`src/db/material.json`) containing 1000+ materials with octave-band absorption coefficients (63Hz - 8kHz).

**Search:** Uses `fast-fuzzy` library for material name search.

**Assignment:** Materials are assigned per-surface with frequency-dependent absorption:
- `absorptionFunction(freq)`: Interpolates between octave bands
- `reflectionCoefficient(freq)`: `sqrt(1 - absorption)`

**Limitation:** No UI for adding custom materials at runtime.

## Key Files to Understand First

1. **`src/index.tsx`** - Application bootstrap, legacy message handlers
2. **`src/store/index.ts`** - State management exports
3. **`src/messenger.ts`** - Dual messaging systems
4. **`src/render/renderer.ts`** - Rendering + scene management
5. **`src/objects/container.ts`** - Base object model
6. **`src/compute/solver.ts`** - Base solver class

## Adding New Features

### Adding a New Solver

1. Create class extending `Solver` in `src/compute/`
2. Implement `save()`/`restore()` methods
3. Add event handlers in `src/compute/events.ts`:
   ```typescript
   on("ADD_MYSOLVER", addSolver(MySolver));
   on("REMOVE_MYSOLVER", removeSolver);
   ```
4. Create UI component in `src/components/parameter-config/`
5. Wire up to `App.tsx` via store subscription

### Adding a New Object Type

1. Extend `Container` in `src/objects/`
2. Implement `save()`/`restore()` with proper typing
3. Add event handlers in `src/objects/events.ts`
4. Add renderer integration in `src/render/renderer.ts`
5. Create UI controls in `ObjectView.tsx`

## Important Architectural Decisions

1. **Dual messaging systems coexist** - Legacy code uses string-based messenger, new code uses typed events. Gradually migrate to typed events.

2. **Zustand + Immer over Redux** - Less boilerplate, "mutative" syntax with immutability, simpler mental model.

3. **Three.js tightly coupled with compute layer** - Solvers directly manipulate Three.js objects for performance. Trade-off: less separation of concerns.

4. **Web Workers for audio processing** - Audio filtering is CPU-intensive, offloaded to `filter.worker.ts`.

5. **GPU compute for FDTD** - Uses `GPUComputationRenderer` with GLSL shaders. Limited to 2D due to WebGL 1.0 constraints.

6. **Solvers own visualization logic** - Each solver manages its own display (e.g., ray tracer adds point shader meshes to scene). Keeps related code together but couples compute and rendering.

## Common Patterns

### Subscribing to Store Changes in React

```typescript
const { containers, selectedObjects } = useContainer(state => ({
  containers: state.containers,
  selectedObjects: state.selectedObjects
}));
```

### Emitting Events

```typescript
import { emit } from './messenger';

// Legacy style (still used in index.tsx)
messenger.addMessageHandler("EVENT_NAME", handler);

// Modern style (preferred)
emit("ADD_RAYTRACER", rayTracerInstance);
```

### Accessing Current Store State

```typescript
import { useContainer, useSolver } from './store';

// Get current state without subscription
const containers = useContainer.getState().containers;

// Update state
useContainer.getState().set(draft => {
  draft.containers[uuid].name = "New Name";
});
```

## Known Limitations

- FDTD is 2D only (GPU texture limitations in WebGL 1.0)
- Air absorption coefficients hardcoded for 20°C, 40% RH
- No UI for custom material creation
- Material database is read-only at runtime
