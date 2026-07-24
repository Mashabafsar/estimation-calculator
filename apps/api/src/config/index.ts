import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4001),
  host: process.env.API_HOST ?? '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  appName: process.env.APP_NAME ?? 'Project Estimation',
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
  targetMargin: Number(process.env.TARGET_MARGIN ?? 0.5),
  databaseUrl: process.env.DATABASE_URL ?? '',
};
