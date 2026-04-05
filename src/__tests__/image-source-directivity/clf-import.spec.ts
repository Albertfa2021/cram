import { DirectivityHandler } from "../../objects/source-directivity";
import { applyClfArrayBufferToSource, applyClfTextToSource } from "../../components/parameter-config/image-source-tab/clf-import";
import { createTestClf } from "../../test-fixtures/image-source-directivity/clf";
const fs = require("fs");
const path = require("path");

describe("image-source CLF import helper", () => {
  it("applies parsed CLF data to a source-like target", () => {
    const target = {
      name: "Test Source",
      directivityHandler: new DirectivityHandler(0),
      directivityLabel: "Omni"
    };

    const parsed = applyClfTextToSource(target, createTestClf());

    expect(parsed.speakerName).toBe("CRAM-DEFAULT-TEST-SPEAKER");
    expect(target.directivityHandler.sourceDirType).toBe(1);
    expect(target.directivityLabel).toContain("Manual CLF");
  });

  it("imports an official binary CF2 file into a source-like target", () => {
    const target = {
      name: "Test Source",
      directivityHandler: new DirectivityHandler(0),
      directivityLabel: "Omni"
    };
    const fixturePath = path.resolve(__dirname, "../../test-fixtures/image-source-directivity/clfgroup/Coax8.CF2");
    const buffer = fs.readFileSync(fixturePath);
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const parsed = applyClfArrayBufferToSource(target, bytes);

    expect(parsed.speakerName).toBe("Coax 8");
    expect(target.directivityHandler.sourceDirType).toBe(1);
    expect(target.directivityLabel).toContain("Manual CLF");
  });
});
