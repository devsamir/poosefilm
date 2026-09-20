import sharp from "sharp";

type ColorMatrix = [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
];

function readCssNumber(css: string, filterType: string, fallback: number) {
  const match = css.match(new RegExp(`${filterType}\\((-?(?:\\d+\\.?\\d*|\\.\\d+))(?:%|px|deg)\\)`));
  return match ? Number(match[1]) : fallback;
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toByte(value: number) {
  return Math.round(clampUnit(value) * 255);
}

function applyColorMatrix(data: Buffer, matrix: ColorMatrix) {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const alpha = data[index + 3] / 255;
    data[index] = toByte(matrix[0] * red + matrix[1] * green + matrix[2] * blue + matrix[3] * alpha + matrix[4]);
    data[index + 1] = toByte(matrix[5] * red + matrix[6] * green + matrix[7] * blue + matrix[8] * alpha + matrix[9]);
    data[index + 2] = toByte(matrix[10] * red + matrix[11] * green + matrix[12] * blue + matrix[13] * alpha + matrix[14]);
    data[index + 3] = toByte(matrix[15] * red + matrix[16] * green + matrix[17] * blue + matrix[18] * alpha + matrix[19]);
  }
}

function grayscaleMatrix(amount: number): ColorMatrix {
  const value = clampUnit(amount / 100);
  const inverse = 1 - value;
  return [
    inverse + 0.2126 * value, 0.7152 * value, 0.0722 * value, 0, 0,
    0.2126 * value, inverse + 0.7152 * value, 0.0722 * value, 0, 0,
    0.2126 * value, 0.7152 * value, inverse + 0.0722 * value, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function sepiaMatrix(amount: number): ColorMatrix {
  const value = clampUnit(amount / 100);
  const inverse = 1 - value;
  return [
    0.393 + 0.607 * inverse, 0.769 - 0.769 * inverse, 0.189 - 0.189 * inverse, 0, 0,
    0.349 - 0.349 * inverse, 0.686 + 0.314 * inverse, 0.168 - 0.168 * inverse, 0, 0,
    0.272 - 0.272 * inverse, 0.534 - 0.534 * inverse, 0.131 + 0.869 * inverse, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function saturateMatrix(amount: number): ColorMatrix {
  const value = Math.max(0, amount / 100);
  return [
    0.213 + 0.787 * value, 0.715 - 0.715 * value, 0.072 - 0.072 * value, 0, 0,
    0.213 - 0.213 * value, 0.715 + 0.285 * value, 0.072 - 0.072 * value, 0, 0,
    0.213 - 0.213 * value, 0.715 - 0.715 * value, 0.072 + 0.928 * value, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function hueRotateMatrix(degrees: number): ColorMatrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    0.213 + 0.787 * cos - 0.213 * sin, 0.715 - 0.715 * cos - 0.715 * sin, 0.072 - 0.072 * cos + 0.928 * sin, 0, 0,
    0.213 - 0.213 * cos + 0.143 * sin, 0.715 + 0.285 * cos + 0.140 * sin, 0.072 - 0.072 * cos - 0.283 * sin, 0, 0,
    0.213 - 0.213 * cos - 0.787 * sin, 0.715 - 0.715 * cos + 0.715 * sin, 0.072 + 0.928 * cos + 0.072 * sin, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function brightnessMatrix(amount: number): ColorMatrix {
  const value = Math.max(0, amount / 100);
  return [value, 0, 0, 0, 0, 0, value, 0, 0, 0, 0, 0, value, 0, 0, 0, 0, 0, 1, 0];
}

function contrastMatrix(amount: number): ColorMatrix {
  const value = Math.max(0, amount / 100);
  const offset = 0.5 * (1 - value);
  return [value, 0, 0, 0, offset, 0, value, 0, 0, offset, 0, 0, value, 0, offset, 0, 0, 0, 1, 0];
}

function opacityMatrix(amount: number): ColorMatrix {
  const value = clampUnit(amount / 100);
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, value, 0];
}

function invertMatrix(amount: number): ColorMatrix {
  const value = clampUnit(amount / 100);
  const scale = 1 - 2 * value;
  return [scale, 0, 0, 0, value, 0, scale, 0, 0, value, 0, 0, scale, 0, value, 0, 0, 0, 1, 0];
}

async function blurRawImage(data: Buffer, width: number, height: number, amount: number) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .blur(Math.max(0.3, amount))
    .raw()
    .toBuffer();
}

export async function renderFilteredImage(input: { sourceBuffer: Buffer; filterCss: string }) {
  const grayscale = readCssNumber(input.filterCss, "grayscale", 0);
  const sepia = readCssNumber(input.filterCss, "sepia", 0);
  const blur = readCssNumber(input.filterCss, "blur", 0);
  const brightness = readCssNumber(input.filterCss, "brightness", 100);
  const hue = readCssNumber(input.filterCss, "hue-rotate", 0);
  const saturate = readCssNumber(input.filterCss, "saturate", 100);
  const opacity = readCssNumber(input.filterCss, "opacity", 100);
  const contrast = readCssNumber(input.filterCss, "contrast", 100);
  const invert = readCssNumber(input.filterCss, "invert", 0);
  const { data: rawData, info } = await sharp(input.sourceBuffer).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let data = rawData;

  applyColorMatrix(data, grayscaleMatrix(grayscale));
  applyColorMatrix(data, sepiaMatrix(sepia));
  if (blur > 0) data = await blurRawImage(data, info.width, info.height, blur);
  applyColorMatrix(data, brightnessMatrix(brightness));
  applyColorMatrix(data, hueRotateMatrix(hue));
  applyColorMatrix(data, saturateMatrix(saturate));
  applyColorMatrix(data, opacityMatrix(opacity));
  applyColorMatrix(data, contrastMatrix(contrast));
  applyColorMatrix(data, invertMatrix(invert));

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 98, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
