const PHI_STEPS = Array.from({ length: 36 }, (_, index) => index * 10);
const THETA_STEPS = Array.from({ length: 19 }, (_, index) => index * 10);

function createBandRows(scale: number): string[] {
  return PHI_STEPS.map((phi) =>
    THETA_STEPS.map((theta) => {
      const value = -((phi / 10) * 0.15 + (theta / 10) * scale);
      return value.toFixed(2);
    }).join("\t")
  );
}

export function createDefaultImageSourceClf(): string {
  const header = [
    "<CLF1>",
    "<VERSION>\t1",
    "<MODELNAME>\tCRAM-DEFAULT-TEST-SPEAKER",
    "<DESCRIPTION>\tBuilt-in CLF sample for Image Source directivity testing",
    "<TYPE>\t<Passive>",
    "<MINBAND>\t125",
    "<MAXBAND>\t250",
    "<RADIATION>\t<Fullsphere>",
    "<MEASUREMENT-DISTANCE>\t1",
    "<BALLOON-SYMMETRY>\t<none>",
    "<BALLOON-ARC-ORDER>\t<default>",
    "<BALLOON-REF>\t<relative>",
    "<SIGN>\t<actual>",
    "<SENSITIVITY>\t90\t90",
    "<IMPEDANCE>\t8\t8",
    "<AXIAL-SPECTRUM>\t0\t0"
  ];

  const band125 = ["<BAND>\t125", ...createBandRows(0.2)];
  const band250 = ["<BAND>\t250", ...createBandRows(0.3)];

  return [...header, ...band125, ...band250].join("\n");
}

export const DEFAULT_IMAGE_SOURCE_CLF = createDefaultImageSourceClf();
