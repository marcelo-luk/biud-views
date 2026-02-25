import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-ioredis';
import { CacheService } from './cache.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const cacheConfig = configService.get('cache');
        if (cacheConfig?.store === 'REDIS_STORE' && cacheConfig.host && cacheConfig.port) {
          return {
            store: cacheConfig.store,
            host: cacheConfig.host,
            port: cacheConfig.port,

            ttl: 600,
          };
        }
        return {
          ttl: 600,
          max: 100,
        };
      },
    }),
  ],
  exports: [CacheModule, CacheService],
  providers: [CacheService],
})
export class CacheManagerModule {}
