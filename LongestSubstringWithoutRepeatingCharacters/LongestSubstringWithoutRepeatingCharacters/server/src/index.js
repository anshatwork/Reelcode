import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateHashtagsRouter } from './routes/generateHashtags.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/generate-hashtags', generateHashtagsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


