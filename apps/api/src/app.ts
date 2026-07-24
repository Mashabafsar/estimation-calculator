import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { auditLog } from './middleware/audit.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(auditLog);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: config.appName, env: config.env });
  });

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
