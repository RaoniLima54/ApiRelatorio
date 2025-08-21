import { Queue, QueueEvents, Worker } from "bullmq";
import { config } from "./config.js";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  db: process.env.REDIS_DB || config.redis.db,
});

export const reportQueue = new Queue(config.queueName, { connection });
export const reportQueueEvents = new QueueEvents(config.queueName, { connection });

export function createWorker(processor) {
  return new Worker(config.queueName, processor, {
    connection,
    concurrency: config.concurrency,
    lockDuration: 600000, // 10 min
    autorun: true,
  });
}
