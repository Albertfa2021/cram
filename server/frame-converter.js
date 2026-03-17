'use strict';

/**
 * Extract virtual source position from a ray path.
 *
 * Reflected paths: last element of imageSources array.
 * Direct path (order 0): source intersection position.
 */
function getVirtualPos(path) {
  if (path.imageSources && path.imageSources.length > 0) {
    const last = path.imageSources[path.imageSources.length - 1];
    if (last && last.position) {
      return { x: last.position.x, y: last.position.y, z: last.position.z };
    }
  }
  // Direct path fallback: find source-type intersection
  if (path.intersections && path.intersections.length > 0) {
    const sourceInter = path.intersections.find(i => i.type === 'source');
    if (sourceInter && sourceInter.position) {
      return {
        x: sourceInter.position.x,
        y: sourceInter.position.y,
        z: sourceInter.position.z
      };
    }
  }
  return { x: 0, y: 0, z: 0 };
}

/**
 * Extract receiver position from the ray path list.
 * The last intersection in any path is the receiver.
 */
function getReceiverPos(rayPaths) {
  for (const path of rayPaths) {
    if (path.intersections && path.intersections.length > 0) {
      const last = path.intersections[path.intersections.length - 1];
      if (last && last.position) {
        return { x: last.position.x, y: last.position.y, z: last.position.z };
      }
    }
  }
  return { x: 0, y: 0, z: 0 };
}

/**
 * Coordinate transform: CRAM (Three.js Y-up) → SAPF (Z-up right-hand)
 *
 * CRAM: +X=right, +Y=up, +Z=toward camera (≈ behind listener)
 * SAPF: +X=front,  +Y=left, +Z=up
 *
 * Mapping derived from axis alignment:
 *   sapf.x = -cram.z   (front = negative camera-toward)
 *   sapf.y = -cram.x   (left  = negative right)
 *   sapf.z =  cram.y   (up    = up)
 *
 * Apply AFTER computing the relative vector (virtualPos - receiverPos)
 * in CRAM space; SAPF uses this relative direction for VBAP.
 */
function cramToSapf(pos) {
  return {
    x: -pos.z,
    y: -pos.x,
    z:  pos.y
  };
}

/**
 * Convert CRAM exportRayPathsData() JSON to a SAPF RenderFrame object.
 *
 * Gain conversion: 1 kHz SPL relative to direct path → linear gain clamped to [0, 4.0].
 *
 * Coordinate fix (Phase 07):
 *   virtualPosM is now a SAPF-space relative direction vector:
 *   cramToSapf(virtualPosWorld - receiverPosWorld)
 *   positionsAreWorld is kept false — FrameNormalizer skips subtraction.
 *   receiverPosM is zeroed out (relative coords, receiver at origin).
 *
 * @param {object} cramData  - Full CRAM export: { metadata: {...}, rayPaths: [...] }
 * @param {number} frameSeq  - Monotonically increasing frame sequence number (uint64)
 * @returns {object} RenderFrame proto message object
 */
function convertToRenderFrame(cramData, frameSeq) {
  const { metadata, rayPaths } = cramData;

  // Find the direct path (order 0) as SPL reference
  const directPath = Array.isArray(rayPaths)
    ? rayPaths.find(p => p.order === 0)
    : null;

  const SPL_direct_1k =
    directPath &&
    directPath.arrivalPressure &&
    directPath.arrivalPressure['1000Hz'] != null
      ? directPath.arrivalPressure['1000Hz']
      : 100;

  // Only transmit valid paths
  const validPaths = Array.isArray(rayPaths)
    ? rayPaths.filter(p => p.isValid !== false)
    : [];

  const rxWorld = getReceiverPos(validPaths.length > 0 ? validPaths : (rayPaths || []));

  const paths = validPaths.map(path => {
    const spl_1k =
      path.arrivalPressure && path.arrivalPressure['1000Hz'] != null
        ? path.arrivalPressure['1000Hz']
        : SPL_direct_1k;

    const gainLinear = Math.min(Math.pow(10, (spl_1k - SPL_direct_1k) / 20), 4.0);

    const vPosWorld = getVirtualPos(path);
    // Relative vector in CRAM (Three.js Y-up) space
    const vRelCram = {
      x: vPosWorld.x - rxWorld.x,
      y: vPosWorld.y - rxWorld.y,
      z: vPosWorld.z - rxWorld.z
    };
    // Transform to SAPF (Z-up) space
    const virtualPosM = cramToSapf(vRelCram);

    return {
      pathId: path.pathUUID || '',
      order: path.order || 0,
      active: true,
      virtualPosM,
      gainLinear,
      delayS: 0.0,
      arrivalTimeS: path.arrivalTime || 0.0
    };
  });

  const sceneId = metadata && metadata.solverUUID ? metadata.solverUUID : '';

  return {
    sceneId,
    frameSeq,
    timestampUs: BigInt(Date.now() * 1000),
    receiverPosM: { x: 0, y: 0, z: 0 },
    positionsAreWorld: false,
    sources: [
      {
        sourceId: 1,
        inputBusId: 1,
        paths
      }
    ]
  };
}

/**
 * Build a RenderFrame[] array suitable for ts_auralization_controller --replay-file.
 *
 * All frames carry the same path data (static acoustic scene); only frameSeq and
 * timestampUs differ. timestampUs is a plain number (JSON does not support BigInt).
 *
 * @param {object} cramData      - { metadata, rayPaths }
 * @param {number} frameCount    - number of frames to generate (default 300 = 6 s @ 20 ms)
 * @param {number} startSeq      - starting frame sequence number (monotonically increasing across sends)
 * @param {boolean} directPathOnly - when true, only include order=0 (direct) paths
 * @returns {object[]} RenderFrame[]
 */
function buildReplayFrames(cramData, frameCount = 300, startSeq = 1, directPathOnly = false) {
  const { metadata, rayPaths } = cramData;

  const directPath = Array.isArray(rayPaths)
    ? rayPaths.find(p => p.order === 0)
    : null;

  const SPL_direct_1k =
    directPath &&
    directPath.arrivalPressure &&
    directPath.arrivalPressure['1000Hz'] != null
      ? directPath.arrivalPressure['1000Hz']
      : 100;

  const validPaths = Array.isArray(rayPaths)
    ? rayPaths.filter(p => p.isValid !== false)
    : [];

  // Direct-path-only mode: keep only order=0 paths
  const filteredPaths = directPathOnly
    ? validPaths.filter(p => p.order === 0)
    : validPaths;

  const rxWorld = getReceiverPos(filteredPaths.length > 0 ? filteredPaths : (rayPaths || []));

  if (directPathOnly) {
    console.log(`[frame-converter] directPathOnly=true: ${filteredPaths.length}/${validPaths.length} paths kept`);
  }

  const paths = filteredPaths.map(path => {
    const spl_1k =
      path.arrivalPressure && path.arrivalPressure['1000Hz'] != null
        ? path.arrivalPressure['1000Hz']
        : SPL_direct_1k;

    const gainLinear = Math.min(Math.pow(10, (spl_1k - SPL_direct_1k) / 20), 4.0);

    const vPosWorld = getVirtualPos(path);
    // Relative vector in CRAM (Three.js Y-up) space
    const vRelCram = {
      x: vPosWorld.x - rxWorld.x,
      y: vPosWorld.y - rxWorld.y,
      z: vPosWorld.z - rxWorld.z
    };
    // Transform to SAPF (Z-up) space
    const virtualPosM = cramToSapf(vRelCram);

    // Diagnostic: log SAPF azimuth for each path (remove after validation)
    const azimuth_rad = Math.atan2(virtualPosM.y, virtualPosM.x);
    const azimuth_deg = azimuth_rad * 180 / Math.PI;
    console.log(
      `[frame-debug] path order=${path.order} ` +
      `vPosWorld=(${vPosWorld.x.toFixed(2)},${vPosWorld.y.toFixed(2)},${vPosWorld.z.toFixed(2)}) ` +
      `rxWorld=(${rxWorld.x.toFixed(2)},${rxWorld.y.toFixed(2)},${rxWorld.z.toFixed(2)}) ` +
      `→ sapf=(${virtualPosM.x.toFixed(2)},${virtualPosM.y.toFixed(2)},${virtualPosM.z.toFixed(2)}) ` +
      `azimuth=${azimuth_deg.toFixed(1)}°`
    );

    return {
      pathId: path.pathUUID || '',
      order: path.order || 0,
      active: true,
      virtualPosM,
      gainLinear,
      delayS: 0.0,
      arrivalTimeS: path.arrivalTime || 0.0
    };
  });

  const sceneId = metadata && metadata.solverUUID ? metadata.solverUUID : '';
  const baseTimestampUs = Date.now() * 1000;
  const intervalUs = 20000; // 20 ms in microseconds

  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      sceneId,
      frameSeq: startSeq + i,
      timestampUs: baseTimestampUs + i * intervalUs,
      receiverPosM: { x: 0, y: 0, z: 0 },
      positionsAreWorld: false,
      sources: [
        {
          sourceId: 1,
          inputBusId: 1,
          paths
        }
      ]
    });
  }
  return frames;
}

module.exports = { convertToRenderFrame, buildReplayFrames };
