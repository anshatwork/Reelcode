Unique Hashtag Generator

A minimal full-stack app that extracts words from a post, finds the longest substring without repeating characters per word, and suggests hashtags.

Stack
- Frontend: React + Vite
- Backend: Node.js + Express

Getting Started
1) Install dependencies
   - cd server
   - npm i
   - cd ../client
   - npm i

2) Run backend
   - cd server
   - npm run dev

3) Run frontend (new terminal)
   - cd client
   - npm run dev

4) Optional: Configure API base
   - Create client/.env with VITE_API_BASE=http://localhost:4000

API
- POST /generate-hashtags
  - body: { "text": string }
  - response: { "hashtags": string[], "words": string[] }

Notes
- Algorithm implementation is in server/src/services/algorithms/longestUniqueSubstring.js and can be swapped later.

