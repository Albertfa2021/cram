import { CLFResult } from "../../../import-handlers/CLFParser";
import { parseCLFInput } from "../../../import-handlers/CLFAutoParser";
import { DirectivityHandler } from "../../../objects/source-directivity";

export type ClfImportTarget = {
  name: string;
  directivityHandler: DirectivityHandler;
  directivityLabel: string;
};

export function applyClfTextToSource(target: ClfImportTarget, clfText: string): CLFResult {
  return applyClfDataToSource(target, clfText);
}

export function applyClfArrayBufferToSource(target: ClfImportTarget, data: ArrayBuffer): CLFResult {
  return applyClfDataToSource(target, data);
}

export function applyClfDataToSource(target: ClfImportTarget, input: string | ArrayBuffer): CLFResult {
  const parsed = parseCLFInput(input);

  if (!parsed.frequencies.length || !parsed.directivity.length) {
    throw new Error("Parsed CLF data is empty.");
  }

  target.directivityHandler = new DirectivityHandler(1, parsed);
  target.directivityLabel = `Manual CLF (${parsed.speakerName || target.name})`;

  return parsed;
}
