import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { SchemaValidatorService } from './schema-validator.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, CheckResult>;
}

export interface CheckResult {
  status: 'up' | 'down';
  responseTime?: number;
  message: string;
  details?: any;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private httpService: HttpService,
    private schemaValidator: SchemaValidatorService,
  ) {}

  async performHealthCheck(): Promise<HealthStatus> {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.CURRENT_ENVIRONMENT || 'development',
      checks: {},
    };

    // Executa todos os checks em paralelo
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkSchemaValidation(),
      this.checkExternalAPIs(),
      this.checkMemory(),
      this.checkRabbitMQ(),
    ]);

    // Processa resultados
    const [database, schema, apis, memory, rabbitmq] = checks;

    if (database.status === 'fulfilled') {
      health.checks.database = database.value;
    } else {
      health.checks.database = { status: 'down', message: database.reason?.message || 'Database check failed' };
      health.status = 'unhealthy';
    }

    if (schema.status === 'fulfilled') {
      health.checks.schema_validation = schema.value;
      if (schema.value.status === 'down') {
        health.status = 'unhealthy';
      }
    } else {
      health.checks.schema_validation = { status: 'down', message: 'Schema validation failed' };
      health.status = 'unhealthy';
    }

    if (apis.status === 'fulfilled') {
      health.checks = { ...health.checks, ...apis.value };
    }

    if (memory.status === 'fulfilled') {
      health.checks.memory = memory.value;
    }

    if (rabbitmq.status === 'fulfilled') {
      health.checks.rabbitmq = rabbitmq.value;
    }

    return health;
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    
    try {
      await this.dataSource.query('SELECT 1 as test');
      
      const [dbInfo] = await this.dataSource.query(`
        SELECT 
          version() as version,
          current_database() as database_name,
          current_user as current_user,
          current_schema() as current_schema
      `);

      return {
        status: 'up',
        responseTime: Date.now() - start,
        message: 'Database connection successful',
        details: {
          database: dbInfo.database_name,
          user: dbInfo.current_user,
          schema: dbInfo.current_schema,
          version: dbInfo.version.split(' ').slice(0, 2).join(' '),
          isInitialized: this.dataSource.isInitialized,
        },
      };
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  private async checkSchemaValidation(): Promise<CheckResult> {
    const start = Date.now();
    
    try {
      const validation = await this.schemaValidator.validateSchema();
      
      const criticalIssues = validation.entities
        .flatMap(e => e.issues)
        .filter(issue => issue.severity === 'critical');

      const warningIssues = validation.entities
        .flatMap(e => e.issues)
        .filter(issue => issue.severity === 'warning');

      const isHealthy = validation.status === 'synchronized';

      // Organizar problemas por tipo para melhor visualização
      const missingTables = validation.entities
        .filter(e => e.status === 'missing_table')
        .map(e => ({
          entity: e.entityName,
          table: e.tableName,
          issues: e.issues.filter(i => i.type === 'missing_table')
        }));

      const missingColumns = validation.entities
        .filter(e => e.issues.some(i => i.type === 'missing_column'))
        .map(e => ({
          entity: e.entityName,
          table: e.tableName,
          missingColumns: e.issues
            .filter(i => i.type === 'missing_column')
            .map(i => ({
              column: i.expected?.name || 'unknown',
              type: i.expected?.type || 'unknown',
              nullable: i.expected?.nullable,
              message: i.message,
              suggestion: i.suggestion
            }))
        }));

      const typeMismatches = validation.entities
        .filter(e => e.issues.some(i => i.type === 'column_type_mismatch'))
        .map(e => ({
          entity: e.entityName,
          table: e.tableName,
          columnMismatches: e.issues
            .filter(i => i.type === 'column_type_mismatch')
            .map(i => ({
              column: i.message.match(/'([^']+)'/)?.[1] || 'unknown',
              expected: i.expected,
              actual: i.actual,
              message: i.message
            }))
        }));

      const extraColumns = validation.entities
        .filter(e => e.issues.some(i => i.type === 'extra_column'))
        .map(e => ({
          entity: e.entityName,
          table: e.tableName,
          extraColumns: e.issues
            .filter(i => i.type === 'extra_column')
            .map(i => ({
              column: i.actual?.name || 'unknown',
              type: i.actual?.type || 'unknown',
              nullable: i.actual?.nullable,
              message: i.message
            }))
        }));

      return {
        status: isHealthy ? 'up' : 'down',
        responseTime: Date.now() - start,
        message: isHealthy 
          ? `All ${validation.summary.totalEntities} entities are synchronized`
          : `Found ${criticalIssues.length} critical issues and ${warningIssues.length} warnings`,
        details: {
          summary: validation.summary,
          criticalIssues: criticalIssues.length,
          warningIssues: warningIssues.length,
          infoIssues: validation.entities
            .flatMap(e => e.issues)
            .filter(issue => issue.severity === 'info').length,
        
          missingTables: missingTables.length > 0 ? missingTables : undefined,
          missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
          typeMismatches: typeMismatches.length > 0 ? typeMismatches : undefined,
          extraColumns: extraColumns.length > 0 ? extraColumns : undefined,
        
          entitiesWithIssues: validation.entities
            .filter(e => e.issues.length > 0)
            .map(e => ({
              entity: e.entityName,
              table: e.tableName,
              status: e.status,
              totalIssues: e.issues.length,
              criticalIssues: e.issues.filter(i => i.severity === 'critical').length,
              warningIssues: e.issues.filter(i => i.severity === 'warning').length,
              infoIssues: e.issues.filter(i => i.severity === 'info').length,
              problemTypes: [...new Set(e.issues.map(i => i.type))],
            })),
        
          globalIssues: validation.globalIssues,
        
          quickFixes: this.generateQuickFixes(validation),
        },
      };
    } catch (error) {
      throw new Error(`Schema validation failed: ${error.message}`);
    }
  }

  private async checkExternalAPIs(): Promise<Record<string, CheckResult>> {
    const results: Record<string, CheckResult> = {};

    // MIA API Check
    if (process.env.MIA_BASE_URL) {
      try {
        const start = Date.now();
        const response = await firstValueFrom(
          this.httpService.get(process.env.MIA_BASE_URL+'/check_key?key='+process.env.MIA_API_KEY).pipe(
            timeout(5000),
            catchError(err => { throw err; })
          )
        );

        results.mia_api = {
          status: 'up',
          responseTime: Date.now() - start,
          message: 'MIA API accessible',
          details: {
            url: process.env.MIA_BASE_URL,
            statusCode: response.status,
            model: process.env.MIA_MODEL,
          },
        };
      } catch (error) {
        results.mia_api = {
          status: 'down',
          message: `MIA API unreachable: ${error.message}`,
          details: { url: process.env.MIA_BASE_URL },
        };
      }
    }

    return results;
  }

  private async checkMemory(): Promise<CheckResult> {
    const memUsage = process.memoryUsage();
    const memLimit = 512 * 1024 * 1024; // 512MB limit
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const limitMB = Math.round(memLimit / 1024 / 1024);

    const isHealthy = memUsage.heapUsed < memLimit;

    return {
      status: isHealthy ? 'up' : 'down',
      message: `Memory usage: ${heapUsedMB}MB / ${limitMB}MB limit`,
      details: {
        heapUsedMB,
        limitMB,
        usagePercentage: Math.round((memUsage.heapUsed / memLimit) * 100),
      },
    };
  }

  private async checkRabbitMQ(): Promise<CheckResult> {
    const rabbitUrl = process.env.RABBIT_MQ_URL;
    
    if (!rabbitUrl) {
      return {
        status: 'down',
        message: 'RabbitMQ URL not configured',
      };
    }

    const hasQueue = !!process.env.RABBIT_MQ_QUEUE;
    const hasExchange = !!process.env.RABBIT_MQ_EXCHANGE;

    return {
      status: hasQueue && hasExchange ? 'up' : 'down',
      message: hasQueue && hasExchange 
        ? 'RabbitMQ configuration valid'
        : 'RabbitMQ configuration incomplete',
      details: {
        queue: process.env.RABBIT_MQ_QUEUE,
        exchange: process.env.RABBIT_MQ_EXCHANGE,
        enabled: process.env.CONSUMER_ENAMBLE === 'true',
      },
    };
  }

  private generateQuickFixes(validation: any): any[] {
    const fixes = [];

    // Tabelas faltantes
    validation.entities
      .filter(e => e.status === 'missing_table')
      .forEach(entity => {
        fixes.push({
          priority: 'CRITICAL',
          type: 'CREATE_TABLE',
          entity: entity.entityName,
          table: entity.tableName,
          action: `Create table "${entity.tableName}" for entity ${entity.entityName}`,
          sql: `-- Run TypeORM migration or create table manually\n-- Entity: ${entity.entityName}\nCREATE TABLE "${entity.tableName}" (\n  -- Add columns based on entity definition\n);`
        });
      });

    // Colunas faltantes
    validation.entities.forEach(entity => {
      const missingColumns = entity.issues.filter(i => i.type === 'missing_column');
      missingColumns.forEach(issue => {
        fixes.push({
          priority: 'HIGH',
          type: 'ADD_COLUMN',
          entity: entity.entityName,
          table: entity.tableName,
          column: issue.expected?.name,
          action: `Add column "${issue.expected?.name}" to table "${entity.tableName}"`,
          sql: `ALTER TABLE "${entity.tableName}" ADD COLUMN "${issue.expected?.name}" ${issue.expected?.type}${issue.expected?.nullable ? '' : ' NOT NULL'};`
        });
      });
    });

    // Tipos incompatíveis
    validation.entities.forEach(entity => {
      const typeMismatches = entity.issues.filter(i => i.type === 'column_type_mismatch');
      typeMismatches.forEach(issue => {
        const columnName = issue.message.match(/'([^']+)'/)?.[1];
        fixes.push({
          priority: 'MEDIUM',
          type: 'ALTER_COLUMN_TYPE',
          entity: entity.entityName,
          table: entity.tableName,
          column: columnName,
          action: `Change column "${columnName}" type from ${issue.actual} to ${issue.expected}`,
          sql: `ALTER TABLE "${entity.tableName}" ALTER COLUMN "${columnName}" TYPE ${issue.expected};`
        });
      });
    });

    return fixes.sort((a, b) => {
      const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}