import { CLFParser, CLFResult } from "./CLFParser";
import { directivityData } from "../objects/source-directivity";

const LEGACY_OCTAVE_BANDS = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const LEGACY_THIRD_OCTAVE_BANDS = [
  31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
  4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

const CF1_V1E_DIRECTIVITY_START = 0x23a8;
const CF2_V1_DIRECTIVITY_START = 0x15af8;

export type CLFImportInput = string | ArrayBuffer | Uint8Array;

export function parseCLFInput(input: CLFImportInput): CLFResult {
  if (typeof input === "string") {
    return new CLFParser(input).parse();
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (isTextClf(bytes)) {
    return new CLFParser(decodeText(bytes)).parse();
  }

  return parseBinaryClf(bytes);
}

function parseBinaryClf(bytes: Uint8Array): CLFResult {
  const typeByte = bytes[0];
  if (typeByte !== 0x40 && typeByte !== 0x41) {
    throw new Error("Unsupported CLF file. Expected text CLF, CF1, or CF2.");
  }

  const clfversion = typeByte === 0x40 ? 1 : 2;
  const distributionVersion = readFixedString(bytes, 0x14, 16);
  const majorVersion = parseDistributionMajor(distributionVersion);

  if (clfversion === 1) {
    return parseBinaryCf1(bytes, distributionVersion, majorVersion);
  }

  return parseBinaryCf2(bytes, distributionVersion, majorVersion);
}

function parseBinaryCf1(bytes: Uint8Array, distributionVersion: string, majorVersion: number): CLFResult {
  const minBandIndex = readUint32(bytes, 0x1210);
  const maxBandIndex = readUint32(bytes, 0x1214);
  const frequencies = LEGACY_OCTAVE_BANDS.slice(minBandIndex, maxBandIndex + 1);
  const phi = createAngleList(0, 10, 350);
  const theta = createAngleList(0, 10, 180);
  const sensitivity = createFallbackSensitivity(frequencies.length);

  if (majorVersion !== 1) {
    throw new Error(`Unsupported CF1 distribution version: ${distributionVersion}`);
  }

  return {
    clfversion: 1,
    speakerName: readFixedString(bytes, 0x138),
    speakerDescription: readFixedString(bytes, 0x338),
    speakerType: readFixedString(bytes, 0x53c) || "<Passive>",
    symmetry: "<none>",
    arcorder: "<default>",
    sign: "<actual>",
    reference: "<relative>",
    measurementDistance: 1,
    phi,
    theta,
    frequencies,
    minband: frequencies[0],
    maxband: frequencies[frequencies.length - 1],
    angleres: 10,
    sensitivity,
    impedance: createFallbackImpedance(frequencies.length),
    axialspectrum: [],
    directivity: readDirectivityBlocks(bytes, CF1_V1E_DIRECTIVITY_START, frequencies, phi.length, theta.length)
  };
}

function parseBinaryCf2(bytes: Uint8Array, distributionVersion: string, majorVersion: number): CLFResult {
  if (majorVersion !== 1 && majorVersion !== 2) {
    throw new Error(`Unsupported CF2 distribution version: ${distributionVersion}`);
  }

  const minBandIndex = readUint32(bytes, 0x1210);
  const maxBandIndex = readUint32(bytes, 0x1214);
  const bandCount = majorVersion === 1 ? maxBandIndex - minBandIndex + 2 : maxBandIndex - minBandIndex + 1;
  const baseStartIndex = majorVersion === 1 ? minBandIndex : minBandIndex - 1;
  const frequencies = LEGACY_THIRD_OCTAVE_BANDS.slice(baseStartIndex, baseStartIndex + bandCount);

  if (!frequencies.length) {
    throw new Error("Unable to infer CF2 frequency bands from distribution file.");
  }

  const phi = createAngleList(0, 5, 355);
  const theta = createAngleList(0, 5, 180);
  const sensitivity = createFallbackSensitivity(frequencies.length);
  const directivityStart = majorVersion === 1 ? CF2_V1_DIRECTIVITY_START : detectCf2V2DirectivityStart(bytes, frequencies.length);

  return {
    clfversion: 2,
    speakerName: readFixedString(bytes, 0x138),
    speakerDescription: readFixedString(bytes, 0x338),
    speakerType: "<Passive>",
    symmetry: "<none>",
    arcorder: "<default>",
    sign: "<actual>",
    reference: "<relative>",
    measurementDistance: 1,
    phi,
    theta,
    frequencies,
    minband: frequencies[0],
    maxband: frequencies[frequencies.length - 1],
    angleres: 5,
    sensitivity,
    impedance: createFallbackImpedance(frequencies.length),
    axialspectrum: [],
    directivity: readDirectivityBlocks(bytes, directivityStart, frequencies, phi.length, theta.length)
  };
}

function detectCf2V2DirectivityStart(bytes: Uint8Array, bandCount: number): number {
  const stride = 72 * 37 * 4;
  const total = stride * bandCount;
  const latestStart = bytes.length - total;

  for (let offset = 0x1500; offset <= latestStart; offset += 4) {
    const startsAtZero = sampleBandStarts(bytes, offset, stride, bandCount);
    if (!startsAtZero) {
      continue;
    }

    const sample = readFloatSample(bytes, offset, [0, 4, 8, 12, 16, 20, 24, 28, 128, 256, 512, 1024, 2048, 4096]);
    const plausible = sample.filter((value) => value >= -80 && value <= 20).length;
    const nonTiny = sample.filter((value) => Math.abs(value) >= 0.01).length;

    if (plausible === sample.length && nonTiny >= 8) {
      return offset;
    }
  }

  throw new Error("Unable to locate CF2 v2 directivity payload.");
}

function sampleBandStarts(bytes: Uint8Array, start: number, stride: number, bandCount: number): boolean {
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex++) {
    const value = readFloat32(bytes, start + bandIndex * stride);
    if (!isFinite(value) || Math.abs(value) > 0.001) {
      return false;
    }
  }

  return true;
}

function readFloatSample(bytes: Uint8Array, start: number, offsets: number[]): number[] {
  return offsets.map((offset) => readFloat32(bytes, start + offset));
}

function readDirectivityBlocks(
  bytes: Uint8Array,
  start: number,
  frequencies: number[],
  phiCount: number,
  thetaCount: number
): directivityData[] {
  const stride = phiCount * thetaCount * 4;

  return frequencies.map((frequency, bandIndex) => {
    const bandStart = start + bandIndex * stride;
    const directivity: number[][] = [];

    for (let phiIndex = 0; phiIndex < phiCount; phiIndex++) {
      const row: number[] = [];
      for (let thetaIndex = 0; thetaIndex < thetaCount; thetaIndex++) {
        row.push(readFloat32(bytes, bandStart + (phiIndex * thetaCount + thetaIndex) * 4));
      }
      directivity.push(row);
    }

    return {
      frequency,
      directivity
    };
  });
}

function isTextClf(bytes: Uint8Array): boolean {
  const probeLength = Math.min(bytes.length, 32);
  const probe = decodeText(bytes.slice(0, probeLength)).trim();
  return probe.indexOf("<CLF") === 0;
}

function parseDistributionMajor(version: string): number {
  const match = version.match(/v(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readFloat32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, true);
}

function readFixedString(bytes: Uint8Array, offset: number, length: number = 256): string {
  const view = bytes.slice(offset, Math.min(bytes.length, offset + length));
  let text = "";

  for (let index = 0; index < view.length; index++) {
    const code = view[index];
    if (code === 0) {
      break;
    }

    if (code < 32 || code > 126) {
      if (text.length > 0) {
        break;
      }
      continue;
    }

    text += String.fromCharCode(code);
  }

  text = text.trim();

  if (!text) {
    return "";
  }

  text = text.replace(/^[^A-Za-z0-9<@#/\-]+/, "");
  if (text.indexOf("http") > 0) {
    text = text.substring(text.indexOf("http"));
  }

  return text.trim();
}

function decodeText(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("latin1").decode(bytes);
  }

  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function createAngleList(min: number, increment: number, max: number): number[] {
  const angles: number[] = [];
  for (let angle = min; angle <= max; angle += increment) {
    angles.push(angle);
  }
  return angles;
}

function createFallbackSensitivity(length: number): number[] {
  return Array(length).fill(90);
}

function createFallbackImpedance(length: number): number[] {
  return Array(length).fill(8);
}
