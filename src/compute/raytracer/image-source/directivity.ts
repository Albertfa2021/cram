import * as THREE from "three";

type DirectivityHandlerLike = {
  getRelativePressureAtPosition?: (frequency: number, phi: number, theta: number) => number;
};

export type DirectivityCapableObject = THREE.Object3D & {
  directivityHandler?: DirectivityHandlerLike;
};

export interface CramDirectionAngles {
  phi: number;
  theta: number;
}

export interface SourceDirectionDiagnostics extends CramDirectionAngles {
  emissionDirectionWorld: [number, number, number];
  emissionDirectionLocal: [number, number, number];
  sourceDirectivityPerBand: Record<string, number>;
}

function normalizeAngle360(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function extractEmissionDirectionFromPathPoints(points: THREE.Vector3[]): THREE.Vector3 | null {
  if (points.length < 2) {
    return null;
  }

  const direction = points[1].clone().sub(points[0]);
  if (direction.lengthSq() === 0) {
    return null;
  }

  return direction.normalize();
}

export function worldDirectionToSourceLocalDirection(
  source: THREE.Object3D,
  worldDirection: THREE.Vector3
): THREE.Vector3 {
  const normalized = worldDirection.clone().normalize();
  const worldQuaternion = new THREE.Quaternion();
  source.getWorldQuaternion(worldQuaternion);
  const inverseQuaternion = worldQuaternion.clone().inverse();
  return normalized.applyQuaternion(inverseQuaternion).normalize();
}

export function directionToCramAngles(direction: THREE.Vector3): CramDirectionAngles {
  const normalized = direction.clone().normalize();
  const thetaThree = Math.atan2(normalized.x, normalized.z);
  const phiThree = Math.acos(THREE.Math.clamp(normalized.y, -1, 1));

  return {
    phi: normalizeAngle360(360 - THREE.Math.radToDeg(thetaThree)),
    theta: THREE.Math.radToDeg(phiThree)
  };
}

export function worldDirectionToSourceLocalAngles(
  source: THREE.Object3D,
  worldDirection: THREE.Vector3
): CramDirectionAngles & { localDirection: THREE.Vector3 } {
  const localDirection = worldDirectionToSourceLocalDirection(source, worldDirection);
  return {
    ...directionToCramAngles(localDirection),
    localDirection
  };
}

export function getSourceDirectivityPressureScales(
  source: DirectivityCapableObject,
  frequencies: number[],
  worldDirection: THREE.Vector3
): number[] {
  const handler = source.directivityHandler;
  if (!handler || typeof handler.getRelativePressureAtPosition !== "function") {
    return frequencies.map(() => 1);
  }

  const { phi, theta } = worldDirectionToSourceLocalAngles(source, worldDirection);
  return frequencies.map((frequency) => {
    const scale = handler.getRelativePressureAtPosition!(frequency, phi, theta);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  });
}

export function applySourceDirectivityToPressures(
  source: DirectivityCapableObject,
  frequencies: number[],
  initialPressures: number[],
  worldDirection: THREE.Vector3
): number[] {
  const scales = getSourceDirectivityPressureScales(source, frequencies, worldDirection);
  return initialPressures.map((pressure, index) => pressure * (scales[index] !== undefined ? scales[index] : 1));
}

export function getSourceDirectionDiagnostics(
  source: DirectivityCapableObject,
  frequencies: number[],
  worldDirection: THREE.Vector3
): SourceDirectionDiagnostics {
  const normalizedWorldDirection = worldDirection.clone().normalize();
  const { phi, theta, localDirection } = worldDirectionToSourceLocalAngles(source, normalizedWorldDirection);
  const scales = getSourceDirectivityPressureScales(source, frequencies, normalizedWorldDirection);
  const sourceDirectivityPerBand = frequencies.reduce((acc, frequency, index) => {
    acc[`${frequency}Hz`] = parseFloat(scales[index].toFixed(6));
    return acc;
  }, {} as Record<string, number>);

  return {
    phi: parseFloat(phi.toFixed(4)),
    theta: parseFloat(theta.toFixed(4)),
    emissionDirectionWorld: normalizedWorldDirection.toArray().map((value) => parseFloat(value.toFixed(6))) as [
      number,
      number,
      number
    ],
    emissionDirectionLocal: localDirection.toArray().map((value) => parseFloat(value.toFixed(6))) as [
      number,
      number,
      number
    ],
    sourceDirectivityPerBand
  };
}
