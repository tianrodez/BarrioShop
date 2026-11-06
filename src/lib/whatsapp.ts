/**
 * WhatsApp deep links (HU02 CA3 contact, HU06 order hand-off).
 *
 * `stores.whatsapp` stores digits with the country code (the column check is
 * `^[0-9]{8,15}$`), which is exactly what wa.me expects, so a stray "+57 (300)"
 * typed by a merchant cannot break the link.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    throw new Error(
      "Esta tienda no tiene un número de WhatsApp válido todavía.",
    );
  }

  const base = `https://wa.me/${digits}`;
  if (!message) return base;

  return `${base}?text=${encodeURIComponent(message)}`;
}
