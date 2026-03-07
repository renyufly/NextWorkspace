type RawEnv = Record<string, unknown>;

type EnvironmentVariables = {
  NODE_ENV: 'development' | 'test' | 'production';
  DATABASE_URL: string;
  REDIS_URL: string;
  REDIS_QUEUE_PREFIX: string;
  REDIS_PRESENCE_TTL_SECONDS: number;
  ENABLE_REDIS_ADAPTER: boolean;
  ENABLE_BULLMQ: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  API_PORT: number;
  WEB_PORT: number;
  CORS_ORIGIN: string;
  STORAGE_DRIVER: 'local' | 'database';
  LOCAL_DATA_FILE: string;
  LOCAL_UPLOAD_DIR: string;
  EMAIL_DELIVERY_MODE: 'disabled' | 'local' | 'smtp';
  LOCAL_EMAIL_OUTBOX_FILE: string;
  EMAIL_FROM_ADDRESS: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  PUSH_DELIVERY_MODE: 'disabled' | 'local' | 'webhook';
  LOCAL_PUSH_OUTBOX_FILE: string;
  PUSH_WEBHOOK_URL: string;
};

function readRequiredString(env: RawEnv, key: keyof RawEnv): string {
  const value = env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${String(key)} is required.`);
  }

  return value.trim();
}

function readPort(env: RawEnv, key: keyof RawEnv, fallback: number): number {
  const value = env[key];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Environment variable ${String(key)} must be a valid TCP port.`);
  }

  return parsed;
}

function readOptionalString(env: RawEnv, key: keyof RawEnv, fallback: string): string {
  const value = env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
}

function readBoolean(env: RawEnv, key: keyof RawEnv, fallback: boolean): boolean {
  const value = env[key];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable ${String(key)} must be a boolean-like string.`);
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Environment variable ${String(key)} must be one of true/false/1/0.`);
}

function readNodeEnv(env: RawEnv): 'development' | 'test' | 'production' {
  const value = readOptionalString(env, 'NODE_ENV', 'development');

  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new Error('Environment variable NODE_ENV must be development, test, or production.');
  }

  return value;
}

function readStorageDriver(env: RawEnv): 'local' | 'database' {
  const value = readOptionalString(env, 'STORAGE_DRIVER', 'local');

  if (value !== 'local' && value !== 'database') {
    throw new Error('Environment variable STORAGE_DRIVER must be either local or database.');
  }

  return value;
}

function readEmailDeliveryMode(env: RawEnv): 'disabled' | 'local' | 'smtp' {
  const value = readOptionalString(env, 'EMAIL_DELIVERY_MODE', 'local');

  if (value !== 'disabled' && value !== 'local' && value !== 'smtp') {
    throw new Error('Environment variable EMAIL_DELIVERY_MODE must be disabled, local, or smtp.');
  }

  return value;
}

function readPushDeliveryMode(env: RawEnv): 'disabled' | 'local' | 'webhook' {
  const value = readOptionalString(env, 'PUSH_DELIVERY_MODE', 'local');

  if (value !== 'disabled' && value !== 'local' && value !== 'webhook') {
    throw new Error('Environment variable PUSH_DELIVERY_MODE must be disabled, local, or webhook.');
  }

  return value;
}

export function validateEnv(env: RawEnv): EnvironmentVariables {
  const nodeEnv = readNodeEnv(env);
  const webPort = readPort(env, 'WEB_PORT', 3000);
  const storageDriver = readStorageDriver(env);
  const redisUrl = readOptionalString(env, 'REDIS_URL', '');
  const redisEnabled = redisUrl.length > 0;
  const emailDeliveryMode = readEmailDeliveryMode(env);
  const pushDeliveryMode = readPushDeliveryMode(env);

  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL:
      storageDriver === 'database'
        ? readRequiredString(env, 'DATABASE_URL')
        : readOptionalString(env, 'DATABASE_URL', ''),
    REDIS_URL: redisUrl,
    REDIS_QUEUE_PREFIX: readOptionalString(env, 'REDIS_QUEUE_PREFIX', 'worknext'),
    REDIS_PRESENCE_TTL_SECONDS: readPort(env, 'REDIS_PRESENCE_TTL_SECONDS', 45),
    ENABLE_REDIS_ADAPTER: readBoolean(env, 'ENABLE_REDIS_ADAPTER', redisEnabled),
    ENABLE_BULLMQ: readBoolean(env, 'ENABLE_BULLMQ', redisEnabled),
    JWT_ACCESS_SECRET: readRequiredString(env, 'JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: readRequiredString(env, 'JWT_REFRESH_SECRET'),
    API_PORT: readPort(env, 'API_PORT', 3001),
    WEB_PORT: webPort,
    CORS_ORIGIN: readOptionalString(env, 'CORS_ORIGIN', `http://localhost:${webPort}`),
    STORAGE_DRIVER: storageDriver,
    LOCAL_DATA_FILE: readOptionalString(env, 'LOCAL_DATA_FILE', '.data/worknext.json'),
    LOCAL_UPLOAD_DIR: readOptionalString(env, 'LOCAL_UPLOAD_DIR', '.uploads'),
    EMAIL_DELIVERY_MODE: emailDeliveryMode,
    LOCAL_EMAIL_OUTBOX_FILE: readOptionalString(env, 'LOCAL_EMAIL_OUTBOX_FILE', '.data/email-outbox.jsonl'),
    EMAIL_FROM_ADDRESS: readOptionalString(env, 'EMAIL_FROM_ADDRESS', 'no-reply@worknext.local'),
    SMTP_HOST: emailDeliveryMode === 'smtp' ? readRequiredString(env, 'SMTP_HOST') : readOptionalString(env, 'SMTP_HOST', ''),
    SMTP_PORT: readPort(env, 'SMTP_PORT', 587),
    SMTP_SECURE: readBoolean(env, 'SMTP_SECURE', false),
    SMTP_USER: readOptionalString(env, 'SMTP_USER', ''),
    SMTP_PASS: readOptionalString(env, 'SMTP_PASS', ''),
    PUSH_DELIVERY_MODE: pushDeliveryMode,
    LOCAL_PUSH_OUTBOX_FILE: readOptionalString(env, 'LOCAL_PUSH_OUTBOX_FILE', '.data/push-outbox.jsonl'),
    PUSH_WEBHOOK_URL:
      pushDeliveryMode === 'webhook'
        ? readRequiredString(env, 'PUSH_WEBHOOK_URL')
        : readOptionalString(env, 'PUSH_WEBHOOK_URL', ''),
  };
}