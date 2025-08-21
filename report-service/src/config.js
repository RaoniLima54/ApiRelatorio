import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    db: Number(process.env.REDIS_DB || 0)
  },
  storageDir: process.env.STORAGE_DIR || './storage',
  queueName: process.env.QUEUE_NAME || 'report-generation',
  concurrency: Number(process.env.JOB_CONCURRENCY || 4),
  job: {
    timeout: Number(process.env.JOB_TIMEOUT_MS || 600000),
    attempts: Number(process.env.JOB_ATTEMPTS || 3),
    backoff: Number(process.env.JOB_BACKOFF_MS || 15000)
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
};
