# CRAM - Computational Room Acoustic Module

<p align="center" width="100%">
    <img width="50%" src="https://github.com/gregzanch/gregzan.ch/raw/main/public/img/cram.gif">
</p>

CRAM is a browser-based application for simulating and exploring acoustic properties of modeled spaces. Built with React, Three.js, and TypeScript, it implements multiple computational acoustics solvers including ray tracing, image source method, FDTD, and statistical reverberation time calculations.

## Environment Requirements

Before running CRAM, ensure you have the following installed:

- **Node.js**: Version 16.x or 14.x (recommended)
  - ⚠️ **Important**: Node.js v17+ requires legacy OpenSSL provider (configured in package.json)
  - Download: [https://nodejs.org/](https://nodejs.org/)
- **npm**: Version 6.x or higher (comes with Node.js)
- **Git**: For cloning the repository

### Checking Your Environment

```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Albertfa2021/cram_mnodify.git
cd cram_mnodify
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React and React DOM
- Three.js for 3D rendering
- TypeScript compiler
- Webpack build tools
- Various acoustic computation libraries

Installation may take 2-5 minutes depending on your network speed.

## Running the Application

### Development Server

To start the development server:

```bash
npm start
```

This will:
- Start the webpack development server
- Automatically open your browser at `http://localhost:3000`
- Enable hot module reloading (changes will auto-refresh)

### Build for Production

To create an optimized production build:

```bash
npm run build
```

The production files will be created in the `build/` directory.

## Quick Start Guide

### 1. Import 3D Model

Once the application is running:
- Click **File → Import**
- Select a 3D model file (supported formats: OBJ, DXF, STL, DAE, 3DS)
- The room geometry will appear in the 3D viewport

### 2. Add Source and Receiver

- Click **Add → Source** to add a sound source (green sphere)
- Click **Add → Receiver** to add a measurement point (red sphere)
- Drag objects in the 3D view to position them

### 3. Assign Materials

- Click on a surface in the 3D view
- In the Object Viewer panel, click the material button
- Search and select an acoustic material from the database (1000+ materials)
- Repeat for all surfaces

### 4. Run Simulations

#### Statistical RT60
- Click **Add → Statistical RT**
- Click **Update** to calculate reverberation time
- Results show Sabine, Eyring, and Arau-Puchades estimates

#### Ray Tracer
- Click **Add → Ray Tracer**
- Select source and receiver
- Check **Running** to start simulation
- Download impulse response as WAV file when complete

#### Image Source Method
- Click **Add → Image Source**
- Set maximum reflection order (typically 3-6)
- Click **Update** to find early reflections
- View level-time progression chart

### 5. Save/Load Projects

- **Save**: Click **File → Save** to download project as JSON
- **Load**: Click **File → Open** to restore a saved project

## Features

### Solvers
- **Statistical RT60**: Sabine, Eyring, and Arau-Puchades reverberation time calculations
- **Ray Tracer**: Stochastic ray tracing with impulse response generation
- **Image Source Method**: Deterministic early reflection finder
- **2D FDTD**: GPU-accelerated wave equation solver
- **Energy Decay Analyzer**: Extract T20, T30, T60, EDT, C80, STI from impulse responses

### Supported Import Formats
- **OBJ** (Wavefront) - General 3D models
- **DXF** (AutoCAD) - Preserves layer information
- **STL** - Binary STL files
- **DAE** (Collada) - XML-based 3D format
- **3DS** - 3D Studio files
- **WAV** - Impulse responses for analysis

### Export Capabilities
- Project files (JSON)
- Impulse responses (WAV)
- Statistical results (CSV)
- Charts and visualizations (PNG via Plotly)

## Project Structure

```
cram/
├── src/
│   ├── components/       # React UI components
│   ├── compute/          # Acoustic solvers
│   ├── objects/          # Scene objects (Room, Source, Receiver)
│   ├── render/           # Three.js rendering
│   ├── store/            # Zustand state management
│   ├── import-handlers/  # File parsers
│   └── db/               # Material database
├── public/               # Static assets
├── config/               # Webpack configuration
└── scripts/              # Build scripts
```

## Troubleshooting

### Issue: "digital envelope routines::unsupported" error

This occurs with Node.js v17+. The project has been configured to use the legacy OpenSSL provider in `package.json`. If you still encounter this error:

**Windows (PowerShell)**:
```powershell
$env:NODE_OPTIONS="--openssl-legacy-provider"
npm start
```

**Linux/macOS**:
```bash
export NODE_OPTIONS=--openssl-legacy-provider
npm start
```

### Issue: Port 3000 already in use

If port 3000 is occupied, the server will prompt you to use an alternative port. Press `Y` to accept.

### Issue: Module not found errors

Try reinstalling dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Material Database

CRAM includes 1000+ acoustic materials with frequency-dependent absorption coefficients (63Hz - 8kHz octave bands). Materials are sourced from textbooks and the University of Hartford Acoustic Material Database.

**Note**: Material values are lab-measured and should be used as estimates.

## Known Limitations

- FDTD solver is 2D only (WebGL 1.0 constraints)
- Air absorption coefficients hardcoded for 20°C, 40% RH
- No UI for adding custom materials at runtime
- Material database is read-only

## Development

### Tech Stack
- **React** 16.8.4 - UI framework
- **TypeScript** 4.1.3 - Type safety
- **Three.js** 0.111.0 - 3D rendering
- **Zustand** - State management
- **Webpack** 4.19.1 - Build system
- **Immer** - Immutable state updates

### Key Files
- `src/index.tsx` - Application entry point
- `src/render/renderer.ts` - Three.js renderer setup
- `src/store/` - Zustand state stores
- `src/compute/` - Acoustic solver implementations
- `CLAUDE.md` - Detailed developer documentation

## License

MIT License - Free and open source

## Credits

Original project by Greg Zanchelli and contributors.

Modified version maintained at: https://github.com/Albertfa2021/cram_mnodify

## References

For detailed theory and implementation:
- [CRAM Final Paper (May 2021)](https://drive.google.com/file/d/1UA8e-UVUFJ3vohHSwflnjhcNNE7uAwlD/view?usp=sharing)
- Original repository: https://github.com/gregzanch/cram

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/Albertfa2021/cram_mnodify/issues
