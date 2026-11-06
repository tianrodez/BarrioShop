/**
 * The mockup gives every comercio an icon instead of a photo, so a card reads
 * at a glance before the neighbour parses the name. `store_type` is free text
 * written by the merchant, so matching is normalized and word-wise: "Panadería
 * y cafetería" still gets the bread, and anything unknown gets the shop.
 */
const ICONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/panader|panificad/, "🥖"],
  [/fruver|frut|verdul|legumbr/, "🍊"],
  [/miscelan|abarr/, "🧺"],
  [/droguer|farmac/, "💊"],
  [/carnic|carne/, "🥩"],
  [/cafeter|\bcafe\b/, "☕"],
  [/restaurant|comida|asader|corrient/, "🍽️"],
  [/licor|estanco/, "🍾"],
  [/ferret|pintur/, "🔧"],
  [/tienda|minimercad|superet|autoserv|market/, "🏪"],
];

const FALLBACK = "🏪";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function storeTypeIcon(storeType: string): string {
  const normalized = normalize(storeType);
  if (!normalized) return FALLBACK;

  const match = ICONS.find(([pattern]) => pattern.test(normalized));
  return match ? match[1] : FALLBACK;
}
