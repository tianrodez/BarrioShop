/**
 * The locality of Kennedy, Bogotá — the only area BarrioShop serves
 * (PRODUCT.md: "Alcance geográfico del prototipo: solo la localidad de
 * Kennedy").
 *
 * The outline is OpenStreetMap relation 4740229 ("Localidad Kennedy",
 * admin_level 8, wikidata Q605317), simplified with a ~30 m tolerance so the
 * browser ships 90 vertices instead of 936. It is the source of truth for
 * three things: the area the map lets you see, the mask that hides every
 * other locality, and the area a merchant may drop their pin in.
 */
export type LatLngTuple = [number, number];

/** [[lat, lng], ...] following the locality border. */
export const KENNEDY_BOUNDARY: LatLngTuple[] = [
  [4.64683, -74.18576],
  [4.62859, -74.17735],
  [4.62404, -74.17665],
  [4.62331, -74.17776],
  [4.62235, -74.17719],
  [4.62011, -74.17964],
  [4.61932, -74.1791],
  [4.61846, -74.18018],
  [4.61901, -74.18104],
  [4.61878, -74.1825],
  [4.6192, -74.18346],
  [4.61882, -74.1852],
  [4.61574, -74.18487],
  [4.61731, -74.18277],
  [4.61657, -74.1824],
  [4.61571, -74.1835],
  [4.61462, -74.18205],
  [4.61687, -74.18081],
  [4.6171, -74.17999],
  [4.61675, -74.1796],
  [4.61608, -74.17944],
  [4.61494, -74.18012],
  [4.61433, -74.18197],
  [4.61293, -74.18121],
  [4.61148, -74.1788],
  [4.60985, -74.17738],
  [4.60828, -74.1779],
  [4.60637, -74.17742],
  [4.60601, -74.17855],
  [4.60503, -74.17852],
  [4.6052, -74.17654],
  [4.60344, -74.17587],
  [4.60295, -74.17187],
  [4.60326, -74.16936],
  [4.60431, -74.16836],
  [4.60626, -74.16269],
  [4.60529, -74.15904],
  [4.6043, -74.15712],
  [4.60313, -74.15663],
  [4.60292, -74.15522],
  [4.60121, -74.15365],
  [4.60102, -74.15221],
  [4.59898, -74.15203],
  [4.59611, -74.14963],
  [4.59677, -74.15107],
  [4.59575, -74.15229],
  [4.59503, -74.1467],
  [4.59562, -74.1416],
  [4.59501, -74.1378],
  [4.59615, -74.13747],
  [4.60933, -74.12911],
  [4.62785, -74.12295],
  [4.63519, -74.11996],
  [4.63737, -74.11829],
  [4.64095, -74.12309],
  [4.64065, -74.12367],
  [4.64531, -74.12575],
  [4.64869, -74.12973],
  [4.64906, -74.1308],
  [4.64881, -74.13205],
  [4.65686, -74.13599],
  [4.65806, -74.1372],
  [4.659, -74.13733],
  [4.66051, -74.13981],
  [4.66149, -74.13986],
  [4.663, -74.14152],
  [4.66169, -74.14358],
  [4.66149, -74.14471],
  [4.66211, -74.14744],
  [4.66419, -74.15193],
  [4.66341, -74.15449],
  [4.66115, -74.15752],
  [4.66237, -74.15972],
  [4.66309, -74.16232],
  [4.66233, -74.16276],
  [4.65986, -74.16273],
  [4.65849, -74.1636],
  [4.65839, -74.16439],
  [4.65966, -74.16624],
  [4.65662, -74.16707],
  [4.65608, -74.16831],
  [4.65609, -74.16952],
  [4.65703, -74.17107],
  [4.65707, -74.17202],
  [4.65455, -74.17489],
  [4.65454, -74.17681],
  [4.65235, -74.18006],
  [4.64833, -74.18285],
  [4.64693, -74.1847],
  [4.64683, -74.18576],
];

/** Bounding box of the locality, in Leaflet's [[south, west], [north, east]] shape. */
export const KENNEDY_BOUNDS = {
  south: 4.59501,
  west: -74.18576,
  north: 4.66419,
  east: -74.11829,
} as const;

/**
 * A small margin around the bounding box. Leaflet's `maxBounds` also clamps the
 * pan it needs to keep a popup on screen; without it the photo card opens above
 * the marker and gets clipped by the map container. The margin is still covered
 * by the mask, so it never reveals a neighbouring locality.
 */
const MAX_BOUNDS_MARGIN = 0.02;

/** Six decimals keep the arithmetic from leaking float noise into `maxBounds`. */
const rounded = (value: number) => Number(value.toFixed(6));

export const KENNEDY_MAX_BOUNDS: [LatLngTuple, LatLngTuple] = [
  [
    rounded(KENNEDY_BOUNDS.south - MAX_BOUNDS_MARGIN),
    rounded(KENNEDY_BOUNDS.west - MAX_BOUNDS_MARGIN),
  ],
  [
    rounded(KENNEDY_BOUNDS.north + MAX_BOUNDS_MARGIN),
    rounded(KENNEDY_BOUNDS.east + MAX_BOUNDS_MARGIN),
  ],
];

/**
 * A ring comfortably larger than any viewport the map allows. Drawn as the
 * outer edge of the mask, with the locality as its hole, so everything outside
 * Kennedy is painted over instead of being explorable.
 */
export const KENNEDY_MASK_OUTER: LatLngTuple[] = [
  [KENNEDY_BOUNDS.south - 0.35, KENNEDY_BOUNDS.west - 0.35],
  [KENNEDY_BOUNDS.south - 0.35, KENNEDY_BOUNDS.east + 0.35],
  [KENNEDY_BOUNDS.north + 0.35, KENNEDY_BOUNDS.east + 0.35],
  [KENNEDY_BOUNDS.north + 0.35, KENNEDY_BOUNDS.west - 0.35],
];

/** Painted over every tile outside the locality; matches the card surface. */
export const KENNEDY_MASK_COLOR = "#fffdf8";

/** A point that is always inside the locality, for maps with no marker yet. */
export const KENNEDY_CENTER: LatLngTuple = [4.6287, -74.1617];

/** Below this the whole locality still fits; the mask covers the rest. */
export const KENNEDY_MIN_ZOOM = 13;
export const KENNEDY_MAX_ZOOM = 18;

/**
 * Ray casting on the simplified ring. Used to keep a merchant from dropping a
 * pin outside the locality and to keep bad seed data from moving the view.
 */
export function isInsideKennedy({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): boolean {
  let inside = false;
  for (
    let i = 0, j = KENNEDY_BOUNDARY.length - 1;
    i < KENNEDY_BOUNDARY.length;
    j = i++
  ) {
    const [latI, lngI] = KENNEDY_BOUNDARY[i];
    const [latJ, lngJ] = KENNEDY_BOUNDARY[j];
    if (
      latI > latitude !== latJ > latitude &&
      longitude < ((lngJ - lngI) * (latitude - latI)) / (latJ - latI) + lngI
    ) {
      inside = !inside;
    }
  }
  return inside;
}
