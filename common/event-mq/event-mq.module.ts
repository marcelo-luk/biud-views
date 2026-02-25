import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventService } from './services/send-service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('rabbitmq.url') || 'amqp://localhost:5672'],
            queue: configService.get<string>('rabbitmq.queue') || 'biud_esg_queue',
            queueOptions: {
              durable: true,
            },
            socketOptions: {
              heartbeatIntervalInSeconds: 5,
              reconnectTimeInSeconds: 5,
            },
            connectionTimeout: 10000,
            prefetchCount: 1,
            isGlobalPrefetchCount: false,
            noAck: false,
            manualAck: true,
            noAutoAck: true,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule, EventService],
  providers: [EventService],
})
export class EventMQModule {}
