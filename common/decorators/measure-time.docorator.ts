import { performance } from 'node:perf_hooks';

export function MensureTime(label = 'Execution Time') {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        return await original.apply(this, args);
      } finally {
        const end = performance.now();
        const duration = (end - start).toFixed(2);
        console.log(`${label}: ${duration} ms`);
      }
    };
    return descriptor;
  };
}
