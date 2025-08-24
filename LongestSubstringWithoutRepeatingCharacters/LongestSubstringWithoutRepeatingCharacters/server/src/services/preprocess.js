export function preprocessText(rawText) {
  const cleaned = rawText
    .toLowerCase()
    // Replace most punctuation/symbols with space (avoid unicode classes for broader compatibility)
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, ' ')
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();

  if (!cleaned) return [];
  return cleaned.split(' ');
}


