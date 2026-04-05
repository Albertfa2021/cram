jest.mock("../../render/renderer", () => ({
  renderer: {
    markup: {
      add: jest.fn(),
      remove: jest.fn(),
      addPoint: jest.fn(),
      addLine: jest.fn(),
      clearPoints: jest.fn(),
      clearLines: jest.fn()
    }
  }
}));

jest.mock("../../audio-engine/audio-engine", () => ({
  audioEngine: {
    sampleRate: 44100,
    createOfflineContext: jest.fn(),
    createFilteredSource: jest.fn(),
    createMerger: jest.fn(),
    renderContextAsync: jest.fn()
  }
}));

import * as THREE from "three";
import { CLFParser } from "../../import-handlers/CLFParser";
import { DirectivityHandler } from "../../objects/source-directivity";
import { ImageSourceIntersection, ImageSourcePath } from "../../compute/raytracer/image-source";
import { createTestClf } from "../../test-fixtures/image-source-directivity/clf";

function createSourceWithHandler(handler: DirectivityHandler) {
  const source = new THREE.Object3D() as any;
  source.directivityHandler = handler;
  source.updateMatrixWorld(true);
  return source;
}

function createPath(baseSource: any, points: THREE.Vector3[]): ImageSourcePath {
  const intersections: ImageSourceIntersection[] = points.map((point, index) => ({
    point,
    reflectingSurface: null,
    angle: index === 0 || index === points.length - 1 ? null : 0
  }));
  return new ImageSourcePath(intersections, baseSource);
}

describe("image-source arrival pressure directivity integration", () => {
  it("keeps omni paths equivalent regardless of emission direction", () => {
    const source = createSourceWithHandler(new DirectivityHandler(0));
    const pathA = createPath(source, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
    const pathB = createPath(source, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);

    const pressureA = pathA.arrivalPressure([100], [1000]);
    const pressureB = pathB.arrivalPressure([100], [1000]);

    expect(pressureA[0]).toBeCloseTo(pressureB[0], 6);
  });

  it("reduces off-axis image-source arrival pressure for CLF directivity", () => {
    const parser = new CLFParser(createTestClf());
    const source = createSourceWithHandler(new DirectivityHandler(1, parser.parse()));

    const onAxisPath = createPath(source, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
    const rearAxisPath = createPath(source, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);

    const onAxisPressure = onAxisPath.arrivalPressure([100], [125]);
    const rearAxisPressure = rearAxisPath.arrivalPressure([100], [125]);

    expect(onAxisPressure[0]).toBeGreaterThan(rearAxisPressure[0]);
  });

  it("provides direction diagnostics for exported path metadata", () => {
    const parser = new CLFParser(createTestClf());
    const source = createSourceWithHandler(new DirectivityHandler(1, parser.parse()));
    const path = createPath(source, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);

    const diagnostics = path.getSourceDirectionDiagnostics([125, 250]);

    expect(diagnostics?.emissionDirectionWorld).toHaveLength(3);
    expect(diagnostics?.sourceDirectivityPerBand["125Hz"]).toBeCloseTo(1, 4);
  });
});
