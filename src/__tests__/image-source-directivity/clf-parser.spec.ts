import { CLFParser } from "../../import-handlers/CLFParser";
import { parseCLFInput } from "../../import-handlers/CLFAutoParser";
import { DirectivityHandler } from "../../objects/source-directivity";
import { createTestClf } from "../../test-fixtures/image-source-directivity/clf";
const fs = require("fs");
const path = require("path");

describe("image-source directivity / CLF parsing", () => {
  it("parses the bundled CLF sample into valid metadata and directivity grids", () => {
    const parser = new CLFParser(createTestClf());
    const result = parser.parse();

    expect(result.clfversion).toBe(1);
    expect(result.angleres).toBe(10);
    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.frequencies[0]).toBe(125);
    expect(result.directivity.length).toBe(result.frequencies.length);
    expect(result.phi[0]).toBe(0);
    expect(result.theta[0]).toBe(0);
    expect(result.directivity[0].directivity.length).toBe(result.phi.length);
    expect(result.directivity[0].directivity[0].length).toBe(result.theta.length);
  });

  it("keeps omni directivity as a unity pressure ratio", () => {
    const handler = new DirectivityHandler(0);
    expect(handler.getRelativePressureAtPosition(1000, 0, 0)).toBeCloseTo(1, 6);
    expect(handler.getRelativePressureAtPosition(1000, 180, 90)).toBeCloseTo(1, 6);
  });

  it("returns lower relative pressure for an off-axis CLF direction than on-axis", () => {
    const parser = new CLFParser(createTestClf());
    const result = parser.parse();
    const handler = new DirectivityHandler(1, result);

    const onAxis = handler.getRelativePressureAtPosition(125, 0, 0);
    const rearAxis = handler.getRelativePressureAtPosition(125, 180, 180);

    expect(onAxis).toBeCloseTo(1, 4);
    expect(rearAxis).toBeLessThan(onAxis);
  });

  it("parses an official clfgroup Coax8.CF2 distribution file", () => {
    const fixturePath = path.resolve(__dirname, "../../test-fixtures/image-source-directivity/clfgroup/Coax8.CF2");
    const buffer = fs.readFileSync(fixturePath);
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = parseCLFInput(bytes);

    expect(result.clfversion).toBe(2);
    expect(result.speakerName).toBe("Coax 8");
    expect(result.angleres).toBe(5);
    expect(result.frequencies[0]).toBe(125);
    expect(result.frequencies[result.frequencies.length - 1]).toBe(16000);
    expect(result.directivity.length).toBe(result.frequencies.length);
    expect(result.directivity[0].directivity.length).toBe(72);
    expect(result.directivity[0].directivity[0].length).toBe(37);
    expect(result.directivity[0].directivity[0][0]).toBeCloseTo(0, 4);
    expect(result.directivity[0].directivity[0][1]).toBeLessThan(0);
  });

  it("parses an official clfgroup cal-3150.CF1 distribution file", () => {
    const fixturePath = path.resolve(__dirname, "../../test-fixtures/image-source-directivity/clfgroup/cal-3150.CF1");
    const buffer = fs.readFileSync(fixturePath);
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = parseCLFInput(bytes);

    expect(result.clfversion).toBe(1);
    expect(result.speakerName).toBe("CAL-3150");
    expect(result.angleres).toBe(10);
    expect(result.frequencies[0]).toBe(63);
    expect(result.frequencies[result.frequencies.length - 1]).toBe(16000);
    expect(result.directivity.length).toBe(result.frequencies.length);
    expect(result.directivity[0].directivity.length).toBe(36);
    expect(result.directivity[0].directivity[0].length).toBe(19);
    expect(result.directivity[0].directivity[0][0]).toBeCloseTo(0, 4);
  });
});
