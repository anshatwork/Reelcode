import { Router } from 'express';
import { preprocessText } from '../services/preprocess.js';
import { longestUniqueSubstring } from '../services/algorithms/longestUniqueSubstring.js';

export const generateHashtagsRouter = Router();

generateHashtagsRouter.post('/', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const words = preprocessText(text);

  const hashtagSet = new Set();
  for (const word of words) {
    if (!word) continue;
    const unique = longestUniqueSubstring(word);
    if (unique && unique.length >= 2) {
      hashtagSet.add(`#${unique}`);
    }
  }

  const hashtags = Array.from(hashtagSet)
    .sort((a, b) => b.length - a.length)
    .slice(0, 20);

  res.json({ hashtags, words });
});


