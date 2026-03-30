const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const COMPRESSED_OUTPUT_TYPE = "image/jpeg";
const MAX_DIMENSION = 1920;
const TARGET_MAX_BYTES = 2 * 1024 * 1024;
const INITIAL_QUALITY = 0.82;
const MIN_QUALITY = 0.58;
const QUALITY_STEP = 0.08;

export interface LeadPhotoCompressionDeps {
  createImage: () => HTMLImageElement;
  createCanvas: () => HTMLCanvasElement;
  createObjectUrl: (file: File) => string;
  revokeObjectUrl: (url: string) => void;
}

const defaultDeps: LeadPhotoCompressionDeps = {
  createImage: () => new Image(),
  createCanvas: () => document.createElement("canvas"),
  createObjectUrl: (file: File) => URL.createObjectURL(file),
  revokeObjectUrl: (url: string) => URL.revokeObjectURL(url),
};

function getOutputFilename(filename: string) {
  const dotIndex = filename.lastIndexOf(".");
  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${baseName}.jpg`;
}

function getScaledDimensions(width: number, height: number) {
  const longestSide = Math.max(width, height);
  if (longestSide <= MAX_DIMENSION) {
    return { width, height };
  }

  const scale = MAX_DIMENSION / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function loadImageFromFile(file: File, deps: LeadPhotoCompressionDeps) {
  let objectUrl: string | null = null;

  try {
    objectUrl = deps.createObjectUrl(file);

    const image = deps.createImage();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode image"));
      image.src = objectUrl as string;
    });

    return image;
  } finally {
    if (objectUrl) {
      deps.revokeObjectUrl(objectUrl);
    }
  }
}

export async function compressLeadPhoto(
  file: File,
  deps: LeadPhotoCompressionDeps = defaultDeps,
) {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file, deps);
    const { width, height } = image;
    const { width: scaledWidth, height: scaledHeight } = getScaledDimensions(width, height);

    const canvas = deps.createCanvas();
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, scaledWidth, scaledHeight);

    let quality = INITIAL_QUALITY;
    let compressedBlob: Blob | null = null;

    while (quality >= MIN_QUALITY) {
      const candidateBlob = await canvasToBlob(canvas, COMPRESSED_OUTPUT_TYPE, quality);
      if (!candidateBlob) {
        break;
      }

      compressedBlob = candidateBlob;
      if (candidateBlob.size <= TARGET_MAX_BYTES) {
        break;
      }

      quality = Number((quality - QUALITY_STEP).toFixed(2));
    }

    if (!compressedBlob || compressedBlob.size >= file.size) {
      return file;
    }

    return new File([compressedBlob], getOutputFilename(file.name), {
      type: COMPRESSED_OUTPUT_TYPE,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function prepareLeadPhotoForUpload(
  file: File,
  maxBytes: number,
  deps: LeadPhotoCompressionDeps = defaultDeps,
) {
  const preparedFile = await compressLeadPhoto(file, deps);
  if (preparedFile.size > maxBytes) {
    return null;
  }

  return preparedFile;
}
