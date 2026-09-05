import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { renderFilteredImage } from "~/services/filter-processor.server";

describe("server-side filter processor", () => {
  async function readFirstRgb(buffer: Buffer) {
    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    return [...data.subarray(0, 3)];
  }

  it("renders a filtered JPEG from an image buffer", async () => {
    const source = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 220, g: 40, b: 40 } } }).png().toBuffer();
    const result = await renderFilteredImage({ sourceBuffer: source, filterCss: "grayscale(100%) sepia(0%) blur(0px) brightness(100%) hue-rotate(0deg) saturate(100%) opacity(100%) contrast(100%) invert(0%)" });
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(result.equals(source)).toBe(false);
  });

  it("honors partial grayscale and sepia values instead of treating them as 100%", async () => {
    const source = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 220, g: 40, b: 40 } } }).png().toBuffer();
    const defaults = "blur(0px) brightness(100%) hue-rotate(0deg) saturate(100%) opacity(100%) contrast(100%) invert(0%)";
    const partialGrayscale = await renderFilteredImage({ sourceBuffer: source, filterCss: `grayscale(50%) sepia(0%) ${defaults}` });
    const fullGrayscale = await renderFilteredImage({ sourceBuffer: source, filterCss: `grayscale(100%) sepia(0%) ${defaults}` });
    const partialSepia = await renderFilteredImage({ sourceBuffer: source, filterCss: `grayscale(0%) sepia(35%) ${defaults}` });
    const fullSepia = await renderFilteredImage({ sourceBuffer: source, filterCss: `grayscale(0%) sepia(100%) ${defaults}` });

    expect(await readFirstRgb(partialGrayscale)).not.toEqual(await readFirstRgb(fullGrayscale));
    expect(await readFirstRgb(partialSepia)).not.toEqual(await readFirstRgb(fullSepia));
  });

  it("honors partial invert values", async () => {
    const source = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 220, g: 40, b: 40 } } }).png().toBuffer();
    const defaults = "grayscale(0%) sepia(0%) blur(0px) brightness(100%) hue-rotate(0deg) saturate(100%) opacity(100%) contrast(100%)";
    const original = await readFirstRgb(source);
    const partialInvert = await readFirstRgb(await renderFilteredImage({ sourceBuffer: source, filterCss: `${defaults} invert(15%)` }));
    const fullInvert = await readFirstRgb(await renderFilteredImage({ sourceBuffer: source, filterCss: `${defaults} invert(100%)` }));

    expect(partialInvert).not.toEqual(original);
    expect(partialInvert).not.toEqual(fullInvert);
  });
});
