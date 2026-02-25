import * as dotenv from 'dotenv';
import * as redisStore from 'cache-manager-ioredis';
import { ConfigService } from '@nestjs/config';
import { CurrentEnvironment, GlobalConfiguration } from './config.model';

dotenv.config();

const defineCacheMode = () => {
  return process.env.CACHE_STORE === 'REDIS_STORE' ? redisStore : 'memory';
};

export class Config {
  private configService: ConfigService;

  constructor() {
    this.configService = new ConfigService();
  }

  public getGlobalConfiguration(): GlobalConfiguration {
    return {
      appName: process.env.APP_NAME || 'buid-product',
      currentEnvironment: process.env.CURRENT_ENVIRONMENT as CurrentEnvironment,
      cache: {
        store: defineCacheMode(),
        host: process.env.CACHE_HOST,
        port: process.env.CACHE_PORT ? parseInt(process.env.CACHE_PORT, 10) : undefined,
        password: process.env.REDIS_PWD,
      },
      database: {
        url: process.env.DATABASE_URL || 'default_database_url',
        alies: process.env.DATABASE_ALIES || '',
      },
      loggerOptions: {
        logLevel: process.env.LOG_LEVEL,
      },
      
    };
  }
}
