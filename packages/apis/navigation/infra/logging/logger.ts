import winston from 'winston';
import LokiTransport from 'winston-loki';
import { env } from '../../env';

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
    ...(env.LOKI_ENABLED
      ? [
          new LokiTransport({
            host: env.LOKI_HOST,
            labels: { app: 'navigator' },
            json: true,
            basicAuth: `${env.LOKI_USER_ID}:${env.LOKI_PASSWORD}`,
            format: winston.format.json(),
            replaceTimestamp: true,
            onConnectionError: err => console.error(err),
          }),
        ]
      : []),
  ],
});
