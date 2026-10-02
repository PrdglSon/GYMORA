import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import api from './routes/index.js';
import { errorHandler, notFoundRoute } from './middleware/error.js';
import { UPLOAD_DIR } from './utils/upload.js';

const app = express();
const origins = env.clientUrl.split(',').map((s) => s.trim());

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/api', api);
app.get('/', (req, res) => res.json({ name: 'GYMORA API', health: '/api/health' }));

app.use(notFoundRoute);
app.use(errorHandler);

export default app;
