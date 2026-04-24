export type BrandFontOption = {
  name: string;
  css: string;
  googleParam: string;
};

export const FONT_OPTIONS: BrandFontOption[] = [
  { name: "Oswald", css: "'Oswald', sans-serif", googleParam: "Oswald:wght@400;600;700" },
  { name: "Bebas Neue", css: "'Bebas Neue', sans-serif", googleParam: "Bebas+Neue" },
  { name: "Rajdhani", css: "'Rajdhani', sans-serif", googleParam: "Rajdhani:wght@400;600;700" },
  { name: "Archivo Narrow", css: "'Archivo Narrow', sans-serif", googleParam: "Archivo+Narrow:wght@400;600;700" },
  { name: "Libre Franklin", css: "'Libre Franklin', sans-serif", googleParam: "Libre+Franklin:wght@400;600;700" },
  { name: "Cinzel", css: "'Cinzel', serif", googleParam: "Cinzel:wght@400;600;700" },
  { name: "Merriweather", css: "'Merriweather', serif", googleParam: "Merriweather:wght@400;700" },
  { name: "Lora", css: "'Lora', serif", googleParam: "Lora:ital,wght@0,400;0,600;0,700" },
];

export function getBrandFontOption(name: string | null | undefined): BrandFontOption | undefined {
  return FONT_OPTIONS.find((font) => font.name === name);
}

export function loadGoogleBrandFont(option: BrandFontOption | undefined) {
  if (!option || typeof document === "undefined") return;

  const id = `gfont-${option.name.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${option.googleParam}&display=swap`;
  document.head.appendChild(link);
}
