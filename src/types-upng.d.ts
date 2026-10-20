declare module "upng-js" {
  const UPNG: {
    /** `cnum` = number of palette colours (2–256) for lossy output, or 0 for lossless. */
    encode(frames: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[]): ArrayBuffer;
  };
  export default UPNG;
  export const encode: typeof UPNG.encode;
}
