import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SchemaValidatorService } from './schema-validator.service';

@Module({
  imports: [HttpModule],
  controllers: [HealthController],
  providers: [HealthService, SchemaValidatorService],
  exports: [HealthService, SchemaValidatorService],
})
export class HealthModule {}