import { CacheService } from '../cache/cache.service';

export function Cacheable(keyPrefix: string, ttl: number = 600): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const context = this;
      const key = `${keyPrefix}_${args[0]}`;
      const cachedResult = await context.cacheService.get(key);
      if (cachedResult) {
        return cachedResult;
      }
      
      const result = await originalMethod.apply(context, args);
      await context.cacheService.set(key, result, ttl);
      return result;
    };
    return descriptor;
  };
}
