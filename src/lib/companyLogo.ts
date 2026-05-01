export const COMPANY_LOGO_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const COMPANY_LOGO_MIN_ASPECT_RATIO = 1;
export const COMPANY_LOGO_MAX_ASPECT_RATIO = 4;

export function getCompanyLogoValidationError(
  file: File,
  dimensions: { width: number; height: number },
) {
  if (!file.type.startsWith("image/")) {
    return "Please upload an image file";
  }

  if (file.size > COMPANY_LOGO_MAX_FILE_SIZE) {
    return "Logo image must be 5MB or smaller";
  }

  if (!dimensions.width || !dimensions.height) {
    return "Unable to read logo dimensions";
  }

  const aspectRatio = dimensions.width / dimensions.height;
  if (
    aspectRatio < COMPANY_LOGO_MIN_ASPECT_RATIO ||
    aspectRatio > COMPANY_LOGO_MAX_ASPECT_RATIO
  ) {
    return "Logo must be between 1:1 and 4:1";
  }

  return null;
}

export function loadImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.width, height: image.height });
      URL.revokeObjectURL(imageUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Unable to read logo dimensions"));
    };

    image.src = imageUrl;
  });
}

export function getCompanyLogoStoragePath(accountId: string, timestamp: number, fileExtension: string) {
  return `website/${accountId}/company-logo-${timestamp}.${fileExtension}`;
}
