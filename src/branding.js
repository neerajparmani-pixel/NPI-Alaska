// The build detects public/npi-emblem.png/.jpg/.webp and sets this public URL.
// Until the original file is supplied, render an explicit NPI wordmark fallback.
const logoUrl = import.meta.env.VITE_LOGO_URL || "";
export function brandMark(large = false) {
  const size = large ? " brand-mark-large" : "";
  return logoUrl
    ? `<img class="brand-mark${size}" src="${logoUrl}" alt="NPI Alaska winged lion emblem" width="${large ? 240 : 48}" height="${large ? 240 : 48}">`
    : `<span class="brand-monogram${size}" role="img" aria-label="NPI wordmark">NPI<span aria-hidden="true">★</span></span>`;
}
