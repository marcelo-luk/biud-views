/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface QueueMessage {
  id?: string | number;
  type?: string;
  payload: any;
  timestamp?: number;
  [key: string]: any;
}

export interface SendMessageOptions {
  persistent?: boolean;
  priority?: number;
  contentType?: string;
  messageId?: string;
  headers?: Record<string, any>;
}

@Injectable()
export class EventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly url: string;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.get<string>('rabbitmq.url', 'amqp://localhost');
  }

  async onModuleInit() {
    try {
      await this.connect();
      this.logger.log('Conectado com sucesso ao serviço RabbitMQ');
    } catch (error) {
      this.logger.error(`Falha ao conectar ao serviço RabbitMQ: ${error.message}`, error.stack);
    }
  }

  private async connect() {
    if (this.connected && this.channel) return;

    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      const exchange = this.configService.get<string>('rabbitmq.notificationExchange', 'delayed_exchange');
      await this.channel.assertExchange(exchange, 'x-delayed-message', {
        durable: true,
        arguments: { 'x-delayed-type': 'direct' },
      });

      this.connection.on('error', (err) => {
        this.logger.error(`Erro na conexão RabbitMQ: ${err.message}`);
        this.connected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('Conexão RabbitMQ fechada');
        this.connected = false;
      });

      this.connected = true;
    } catch (error) {
      this.logger.error(`Erro ao conectar ao RabbitMQ: ${error.message}`);
      this.connected = false;
      throw error;
    }
  }

  private async assertQueue(queueName: string): Promise<amqp.Replies.AssertQueue> {
    return this.channel.assertQueue(queueName, { durable: true });
  }

  async sendMessageToQueue(message: QueueMessage): Promise<boolean> {
    const defaultQueue = this.configService.get<string>('rabbitmq.queue', 'default_queue');
    return this.sendMessage(message, defaultQueue);
  }

  async sendMessage(
    message: any,
    queueName: string,
    pattern: string = 'message_pattern',
    options?: SendMessageOptions
  ): Promise<boolean> {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        throw new Error(`Serviço de mensageria indisponível: ${error.message}`);
      }
    }

    await this.assertQueue(queueName);

    if (!message.timestamp) message.timestamp = Date.now();

    const messageWithPattern = {
      pattern,
      data: message,
    };

    const messageOptions: amqp.Options.Publish = {
      persistent: options?.persistent !== false,
      priority: options?.priority,
      contentType: options?.contentType || 'application/json',
      messageId: options?.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      headers: {
        'x-pattern': pattern,
        ...(options?.headers || {}),
      },
    };

    const isNotificationQueue = queueName === this.configService.get<string>('rabbitmq.notificationQueue');
    const exchange = this.configService.get<string>('rabbitmq.notificationExchange', 'delayed_exchange');

    try {
      const content = Buffer.from(JSON.stringify(messageWithPattern));

      if (isNotificationQueue) {
        await this.channel.bindQueue(queueName, exchange, queueName);
        const result = this.channel.publish(exchange, queueName, content, messageOptions);
        if (result) {
          this.logger.log(`Mensagem com delay enviada para fila "${queueName}" via exchange ${exchange}`);
        } else {
          this.logger.warn(`Mensagem para fila "${queueName}" não foi confirmada imediatamente`);
        }
        return result;
      }

      const result = this.channel.sendToQueue(queueName, content, messageOptions);
      if (result) {
        this.logger.log(`Mensagem enviada com sucesso para fila "${queueName}"`);
      } else {
        this.logger.warn(`Mensagem não foi entregue imediatamente à fila "${queueName}"`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para fila ${queueName}: ${error.message}`, error.stack);
      if (
        error.message.includes('channel closed') ||
        error.message.includes('connection closed') ||
        error.message.includes('channel ended')
      ) {
        this.connected = false;
        this.logger.warn('Conexão perdida - marcando para reconexão na próxima tentativa');
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.connected = false;
      this.logger.log('Conexão RabbitMQ encerrada corretamente');
    } catch (error) {
      this.logger.error(`Erro ao fechar conexão RabbitMQ: ${error.message}`);
    }
  }
}