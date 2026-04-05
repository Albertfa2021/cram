import * as THREE from "three";
import { CLFParser } from "../../import-handlers/CLFParser";
import { DirectivityHandler } from "../../objects/source-directivity";
import {
  applySourceDirectivityToPressures,
  directionToCramAngles,
  extractEmissionDirectionFromPathPoints,
  getSourceDirectionDiagnostics,
  worldDirectionToSourceLocalAngles
} from "../../compute/raytracer/image-source/directivity";
import { cramangle2threejsangle } from "../../common/dir-angle-conversions";
import { createTestClf } from "../../test-fixtures/image-source-directivity/clf";

function createDirectivityObject() {
  const parser = new CLFParser(createTestClf());
  const result = parser.parse();
  const object = new THREE.Object3D() as THREE.Object3D & { directivityHandler: DirectivityHandler };
  object.directivityHandler = new DirectivityHandler(1, result);
  object.updateMatrixWorld(true);
  return object;
}

describe("image-source directivity helpers", () => {
  it("converts a Three.js direction back into CRAM phi/theta", () => {
    const [phiThree, thetaThree] = cramangle2threejsangle(90, 45);
    const direction = new THREE.Vector3().setFromSphericalCoords(1, phiThree, thetaThree);
    const angles = directionToCramAngles(direction);

    expect(angles.phi).toBeCloseTo(90, 4);
    expect(angles.theta).toBeCloseTo(45, 4);
  });

  it("converts world directions into source-local angles using the source rotation", () => {
    const object = new THREE.Object3D();
    object.rotation.z = Math.PI / 2;
    object.updateMatrixWorld(true);

    const worldDirection = new THREE.Vector3(0, 1, 0).applyEuler(object.rotation).normalize();
    const angles = worldDirectionToSourceLocalAngles(object, worldDirection);

    expect(angles.theta).toBeCloseTo(0, 4);
    expect(angles.phi).toBeCloseTo(0, 4);
  });

  it("extracts the emission direction from the first path segment", () => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(1, 2, 0)
    ];
    const direction = extractEmissionDirectionFromPathPoints(points);

    expect(direction?.x).toBeCloseTo(0, 6);
    expect(direction?.y).toBeCloseTo(1, 6);
    expect(direction?.z).toBeCloseTo(0, 6);
  });

  it("applies lower pressure to off-axis directions for CLF-based sources", () => {
    const source = createDirectivityObject();
    const initialPressures = [1];

    const onAxis = applySourceDirectivityToPressures(source, [125], initialPressures, new THREE.Vector3(0, 1, 0));
    const rearAxis = applySourceDirectivityToPressures(source, [125], initialPressures, new THREE.Vector3(0, -1, 0));

    expect(onAxis[0]).toBeGreaterThan(rearAxis[0]);
  });

  it("produces export-friendly direction diagnostics", () => {
    const source = createDirectivityObject();
    const diagnostics = getSourceDirectionDiagnostics(source, [125, 250], new THREE.Vector3(0, 1, 0));

    expect(diagnostics.emissionDirectionWorld).toHaveLength(3);
    expect(diagnostics.emissionDirectionLocal).toHaveLength(3);
    expect(diagnostics.phi).toBeCloseTo(0, 4);
    expect(diagnostics.theta).toBeCloseTo(0, 4);
    expect(diagnostics.sourceDirectivityPerBand["125Hz"]).toBeCloseTo(1, 4);
  });
});
