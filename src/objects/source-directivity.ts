import * as ac from "../compute/acoustics";
import { CLFResult } from "../import-handlers/CLFParser";
import { dirinterp, dirDataPoint } from "../common/dir-interpolation";

export class DirectivityHandler {
  private dirDataList: directivityData[];
  public frequencies: number[];
  public sensitivity: number[];
  public sourceDirType: number;
  public phi: number[];
  public theta: number[];
  public clfData;

  constructor(sourceType: number, importData?: CLFResult) {
    this.sourceDirType = sourceType;

    switch (sourceType) {
      case 0:
        this.frequencies = [0];
        this.dirDataList = [];
        this.phi = [];
        this.theta = [];
        this.sensitivity = [90];
        break;

      case 1:
        if (importData) {
          this.frequencies = importData.frequencies;
          this.dirDataList = importData.directivity;
          this.phi = importData.phi;
          this.theta = importData.theta;
          this.sensitivity = importData.sensitivity;
          this.clfData = importData;
        } else {
          console.error("DH CLF Import Type specified but no CLFResult data was provided");
          this.frequencies = [0];
          this.dirDataList = [];
          this.phi = [];
          this.theta = [];
          this.sensitivity = [];
          this.clfData = importData;
        }
        break;

      default:
        this.frequencies = [0];
        this.dirDataList = [];
        this.phi = [];
        this.theta = [];
        this.sensitivity = [];
        console.error("Unknown Source Directivity Type");
        break;
    }
  }

  private normalizePhi(phi: number): number {
    const normalized = phi % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  private clampTheta(theta: number): number {
    const maxTheta = this.theta.length > 0 ? this.theta[this.theta.length - 1] : 180;
    return Math.max(0, Math.min(theta, maxTheta));
  }

  private getFrequencyIndex(frequency: number): number {
    const exact = this.frequencies.indexOf(frequency);
    if (exact !== -1) {
      return exact;
    }

    if (this.frequencies.length === 0) {
      return -1;
    }

    let bestIndex = 0;
    let bestDistance = Math.abs(this.frequencies[0] - frequency);
    for (let i = 1; i < this.frequencies.length; i++) {
      const distance = Math.abs(this.frequencies[i] - frequency);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  private getDirectivityDbAtPosition(frequency: number, phi: number, theta: number): number {
    if (this.sourceDirType !== 1 || !this.clfData || this.dirDataList.length === 0) {
      return 0;
    }

    const angularRes = this.clfData.angleres;
    const normalizedPhi = this.normalizePhi(phi);
    const clampedTheta = this.clampTheta(theta);

    let nearestPhi = Math.round(normalizedPhi / angularRes) * angularRes;

    let upperPhi: number;
    let lowerPhi: number;

    if (nearestPhi > normalizedPhi) {
      upperPhi = nearestPhi;
      lowerPhi = upperPhi - angularRes;
    } else {
      lowerPhi = nearestPhi;
      upperPhi = lowerPhi + angularRes;
    }

    if (upperPhi === 360) {
      upperPhi = 0;
    }

    let nearestTheta = Math.round(clampedTheta / angularRes) * angularRes;

    let upperTheta: number;
    let lowerTheta: number;

    if (nearestTheta > clampedTheta) {
      upperTheta = nearestTheta;
      lowerTheta = upperTheta - angularRes;
    } else {
      lowerTheta = nearestTheta;
      upperTheta = lowerTheta + angularRes;
    }

    const maxTheta = this.theta[this.theta.length - 1];
    lowerTheta = Math.max(0, Math.min(lowerTheta, maxTheta));
    upperTheta = Math.max(0, Math.min(upperTheta, maxTheta));

    const fIndex = this.getFrequencyIndex(frequency);
    if (fIndex === -1) {
      return 0;
    }

    const lowerPhiIndex = Math.floor(lowerPhi / angularRes);
    const upperPhiIndex = Math.floor(upperPhi / angularRes);
    const lowerThetaIndex = Math.floor(lowerTheta / angularRes);
    const upperThetaIndex = Math.floor(upperTheta / angularRes);

    if (lowerTheta === upperTheta || lowerPhi === upperPhi) {
      return this.dirDataList[fIndex].directivity[lowerPhiIndex][lowerThetaIndex];
    }

    const p1: dirDataPoint = {
      phi: lowerPhi,
      theta: lowerTheta,
      directivity: this.dirDataList[fIndex].directivity[lowerPhiIndex][lowerThetaIndex]
    };

    const p2: dirDataPoint = {
      phi: lowerPhi,
      theta: upperTheta,
      directivity: this.dirDataList[fIndex].directivity[lowerPhiIndex][upperThetaIndex]
    };

    const p3: dirDataPoint = {
      phi: upperPhi,
      theta: lowerTheta,
      directivity: this.dirDataList[fIndex].directivity[upperPhiIndex][lowerThetaIndex]
    };

    const p4: dirDataPoint = {
      phi: upperPhi,
      theta: upperTheta,
      directivity: this.dirDataList[fIndex].directivity[upperPhiIndex][upperThetaIndex]
    };

    return dirinterp(normalizedPhi, clampedTheta, p1, p2, p3, p4);
  }

  public getRelativePressureAtPosition(frequency: number, phi: number, theta: number): number {
    switch (this.sourceDirType) {
      case 0:
        return 1;
      case 1: {
        const directivityDb = this.getDirectivityDbAtPosition(frequency, phi, theta);
        const onAxisDb = this.getDirectivityDbAtPosition(frequency, 0, 0);
        return Math.pow(10, (directivityDb - onAxisDb) / 20);
      }
      default:
        return 1;
    }
  }

  getPressureAtPosition(gain: number, frequency: number, phi: number, theta: number) {
    switch (this.sourceDirType) {
      case 0:
        return ac.Lp2P(this.sensitivity[0] + gain);

      case 1: {
        const fIndex = this.getFrequencyIndex(frequency);
        if (fIndex === -1) {
          return ac.Lp2P(gain);
        }
        const directivityDb = this.getDirectivityDbAtPosition(frequency, phi, theta);
        return ac.Lp2P(directivityDb + this.sensitivity[fIndex] + gain);
      }

      default:
        return ac.Lp2P(this.sensitivity[0] + gain);
    }
  }
}

export interface directivityData {
  frequency: number;
  directivity: number[][];
}
