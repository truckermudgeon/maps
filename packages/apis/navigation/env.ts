import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().default(62840),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true'),
  ALLOWED_ORIGIN: z.coerce.string().url().default('http://localhost:5173'),

  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform(val => val === 'true'),

  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true'),
  METRICS_COLLECTOR_BEARER_TOKEN: z.coerce.string().default('dummytoken'),

  LOKI_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true'),
  LOKI_HOST: z.coerce.string().default('http://localhost:3100'),
  LOKI_USER_ID: z.coerce.string().default('admin'),
  LOKI_PASSWORD: z.coerce.string().default('admin'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
});

console.log('raw, process.env', process.env);
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables');
  console.error(parsed.error.format());
  process.exit(1);
}

// a typed version of process.env, containing only the keys defined in the
// schema above.
export const env = parsed.data;
console.log(env);
