import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  async check(@Res() res: Response) {
    const health = await this.healthService.performHealthCheck();
    const statusCode = health.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(health);
  }

  @Get('live')
  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    try {
      const health = await this.healthService.performHealthCheck();
      const isReady = health.checks.database?.status === 'up' && 
                     health.checks.schema?.status === 'up';
      
      const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json({
        status: isReady ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
        critical_checks: {
          database: health.checks.database?.status,
          schema: health.checks.schema?.status,
        },
      });
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}