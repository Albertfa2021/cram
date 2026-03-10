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
 * Convert CRAM exportRayPathsData() JSON to a SAPF RenderFrame object.
 *
 * Gain conversion: 1 kHz SPL relative to direct path → linear gain clamped to [0, 4.0].
 * Phase 01 assumption: CRAM and SAPF share the same coordinate system (no axis remapping).
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

  const paths = validPaths.map(path => {
    const spl_1k =
      path.arrivalPressure && path.arrivalPressure['1000Hz'] != null
        ? path.arrivalPressure['1000Hz']
        : SPL_direct_1k;

    const gainLinear = Math.min(Math.pow(10, (spl_1k - SPL_direct_1k) / 20), 4.0);

    return {
      pathId: path.pathUUID || '',
      order: path.order || 0,
      active: true,
      virtualPosM: getVirtualPos(path),
      gainLinear,
      delayS: 0.0,
      arrivalTimeS: path.arrivalTime || 0.0
    };
  });

  const receiverPosM = getReceiverPos(validPaths.length > 0 ? validPaths : (rayPaths || []));
  const sceneId = metadata && metadata.solverUUID ? metadata.solverUUID : '';

  return {
    sceneId,
    frameSeq,
    timestampUs: BigInt(Date.now() * 1000),
    receiverPosM,
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
 * @param {object} cramData   - { metadata, rayPaths }
 * @param {number} frameCount - number of frames to generate (default 300 = 6 s @ 20 ms)
 * @returns {object[]} RenderFrame[]
 */
function buildReplayFrames(cramData, frameCount = 300) {
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

  const paths = validPaths.map(path => {
    const spl_1k =
      path.arrivalPressure && path.arrivalPressure['1000Hz'] != null
        ? path.arrivalPressure['1000Hz']
        : SPL_direct_1k;

    const gainLinear = Math.min(Math.pow(10, (spl_1k - SPL_direct_1k) / 20), 4.0);

    return {
      pathId: path.pathUUID || '',
      order: path.order || 0,
      active: true,
      virtualPosM: getVirtualPos(path),
      gainLinear,
      delayS: 0.0,
      arrivalTimeS: path.arrivalTime || 0.0
    };
  });

  const receiverPosM = getReceiverPos(validPaths.length > 0 ? validPaths : (rayPaths || []));
  const sceneId = metadata && metadata.solverUUID ? metadata.solverUUID : '';
  const baseTimestampUs = Date.now() * 1000;
  const intervalUs = 20000; // 20 ms in microseconds

  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      sceneId,
      frameSeq: i + 1,
      timestampUs: baseTimestampUs + i * intervalUs,
      receiverPosM,
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
