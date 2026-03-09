/**
 * Opens the device's preferred maps app with directions to the given address.
 * - iOS: Opens Apple Maps
 * - Android/Other: Opens Google Maps
 */
export function openMapsWithAddress(address: string) {
  if (!address) return;
  
  const encodedAddress = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // Apple Maps URL scheme
    window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`, "_blank");
  } else {
    // Google Maps for Android and web
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, "_blank");
  }
}
