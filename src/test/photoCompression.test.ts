import { describe, expect, it, vi } from "vitest";

import {
  type LeadPhotoCompressionDeps,
  compressLeadPhoto,
  prepareLeadPhotoForUpload,
} from "@/lib/photoCompression";

interface MockDepsOptions {
  width?: number;
  height?: number;
  blobSize?: number;
  blobType?: string;
  loadError?: boolean;
  missingContext?: boolean;
  toBlobNull?: boolean;
}

function createMockDeps(options: MockDepsOptions = {}): LeadPhotoCompressionDeps {
  const {
    width = 3200,
    height = 2400,
    blobSize = 400_000,
    blobType = "image/jpeg",
    loadError = false,
    missingContext = false,
    toBlobNull = false,
  } = options;

  return {
    createObjectUrl: vi.fn(() => "blob:photo-test"),
    revokeObjectUrl: vi.fn(),
    createImage: () => {
      const image: Partial<HTMLImageElement> = {
        width,
        height,
        onload: null,
        onerror: null,
      };

      Object.defineProperty(image, "src", {
        set() {
          if (loadError) {
            image.onerror?.(new Event("error"));
            return;
          }
          image.onload?.(new Event("load"));
        },
      });

      return image as HTMLImageElement;
    },
    createCanvas: () => {
      const canvas: Partial<HTMLCanvasElement> = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => {
          if (missingContext) {
            return null;
          }
          return {
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D;
        }),
        toBlob: vi.fn((callback: BlobCallback) => {
          if (toBlobNull) {
            callback(null);
            return;
          }

          callback(new Blob([new Uint8Array(blobSize)], { type: blobType }));
        }),
      };

      return canvas as HTMLCanvasElement;
    },
  };
}

describe("compressLeadPhoto", () => {
  it("compresses supported image files when output is smaller", async () => {
    const input = new File([new Uint8Array(1_200_000)], "kitchen-before.png", {
      type: "image/png",
    });

    const compressed = await compressLeadPhoto(input, createMockDeps({ blobSize: 350_000 }));

    expect(compressed).not.toBe(input);
    expect(compressed.type).toBe("image/jpeg");
    expect(compressed.name).toBe("kitchen-before.jpg");
    expect(compressed.size).toBeLessThan(input.size);
  });

  it("returns original file for HEIC uploads", async () => {
    const input = new File([new Uint8Array(1_000_000)], "before.heic", {
      type: "image/heic",
    });

    const compressed = await compressLeadPhoto(input, createMockDeps());

    expect(compressed).toBe(input);
  });

  it("returns original file when compression is not smaller", async () => {
    const input = new File([new Uint8Array(800_000)], "before.jpg", {
      type: "image/jpeg",
    });

    const compressed = await compressLeadPhoto(input, createMockDeps({ blobSize: 900_000 }));

    expect(compressed).toBe(input);
  });

  it("returns original file when compression fails", async () => {
    const input = new File([new Uint8Array(1_000_000)], "before.webp", {
      type: "image/webp",
    });

    const compressed = await compressLeadPhoto(input, createMockDeps({ loadError: true }));

    expect(compressed).toBe(input);
  });
});

describe("prepareLeadPhotoForUpload", () => {
  it("accepts an oversized file when compression brings it under the limit", async () => {
    const input = new File([new Uint8Array(12_000_000)], "before.png", {
      type: "image/png",
    });

    const prepared = await prepareLeadPhotoForUpload(
      input,
      10 * 1024 * 1024,
      createMockDeps({ blobSize: 5_000_000 }),
    );

    expect(prepared).not.toBeNull();
    expect(prepared?.size).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(prepared?.type).toBe("image/jpeg");
  });

  it("rejects a file when the prepared upload is still above the limit", async () => {
    const input = new File([new Uint8Array(12_000_000)], "before.png", {
      type: "image/png",
    });

    const prepared = await prepareLeadPhotoForUpload(
      input,
      10 * 1024 * 1024,
      createMockDeps({ blobSize: 11_000_000 }),
    );

    expect(prepared).toBeNull();
  });
});
