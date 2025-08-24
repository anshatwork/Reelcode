// Sliding window algorithm to find the longest substring without repeating characters
export function longestUniqueSubstring(input) {
  if (!input) return '';
  let start = 0;
  let maxLen = 0;
  let bestStart = 0;
  const lastSeenIndex = new Map();

  for (let end = 0; end < input.length; end++) {
    const ch = input[end];
    if (lastSeenIndex.has(ch) && lastSeenIndex.get(ch) >= start) {
      start = lastSeenIndex.get(ch) + 1;
    }
    lastSeenIndex.set(ch, end);
    const windowLen = end - start + 1;
    if (windowLen > maxLen) {
      maxLen = windowLen;
      bestStart = start;
    }
  }

  return input.substring(bestStart, bestStart + maxLen);
}


