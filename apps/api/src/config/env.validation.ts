type RawEnv = Record<string, unknown>;

type EnvironmentVariables = {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  API_PORT: number;
  WEB_PORT: number;
  CORS_ORIGIN: string;
  STORAGE_DRIVER: 'local' | 'database';
  LOCAL_DATA_FILE: string;
  LOCAL_UPLOAD_DIR: string;
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

function readStorageDriver(env: RawEnv): 'local' | 'database' {
  const value = readOptionalString(env, 'STORAGE_DRIVER', 'local');

  if (value !== 'local' && value !== 'database') {
    throw new Error('Environment variable STORAGE_DRIVER must be either local or database.');
  }

  return value;
}

export function validateEnv(env: RawEnv): EnvironmentVariables {
  const webPort = readPort(env, 'WEB_PORT', 3000);
  const storageDriver = readStorageDriver(env);

  return {
    DATABASE_URL:
      storageDriver === 'database'
        ? readRequiredString(env, 'DATABASE_URL')
        : readOptionalString(env, 'DATABASE_URL', ''),
    REDIS_URL: readOptionalString(env, 'REDIS_URL', ''),
    JWT_ACCESS_SECRET: readRequiredString(env, 'JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: readRequiredString(env, 'JWT_REFRESH_SECRET'),
    API_PORT: readPort(env, 'API_PORT', 3001),
    WEB_PORT: webPort,
    CORS_ORIGIN: readOptionalString(env, 'CORS_ORIGIN', `http://localhost:${webPort}`),
    STORAGE_DRIVER: storageDriver,
    LOCAL_DATA_FILE: readOptionalString(env, 'LOCAL_DATA_FILE', '.data/worknext.json'),
    LOCAL_UPLOAD_DIR: readOptionalString(env, 'LOCAL_UPLOAD_DIR', '.uploads'),
  };
}