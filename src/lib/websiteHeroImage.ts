export const WEBSITE_HERO_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

export function getWebsiteHeroImageValidationError(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please upload an image file";
  }

  if (file.size > WEBSITE_HERO_IMAGE_MAX_FILE_SIZE) {
    return "Hero image must be 5MB or smaller";
  }

  return null;
}

export function getWebsiteHeroImageStoragePath(
  accountId: string,
  timestamp: number,
  fileExtension: string,
) {
  return `website/${accountId}/hero-${timestamp}.${fileExtension}`;
}

export function getWebsiteServiceImageStoragePath(
  accountId: string,
  serviceKey: string,
  timestamp: number,
  fileExtension: string,
) {
  const safeServiceKey = serviceKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedServiceKey = safeServiceKey || "service";
  return `website/${accountId}/services/${normalizedServiceKey}-${timestamp}.${fileExtension}`;
}

export function getWebsiteAboutImageStoragePath(
  accountId: string,
  variant: "before" | "after",
  timestamp: number,
  fileExtension: string,
) {
  return `website/${accountId}/about/${variant}-${timestamp}.${fileExtension}`;
}

export function getWebsiteTestimonialImageStoragePath(
  accountId: string,
  testimonialKey: string,
  timestamp: number,
  fileExtension: string,
) {
  const safeTestimonialKey = testimonialKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedTestimonialKey = safeTestimonialKey || "testimonial";
  return `website/${accountId}/testimonials/${normalizedTestimonialKey}-${timestamp}.${fileExtension}`;
}
