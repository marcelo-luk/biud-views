import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SchemaValidationResult {
  status: 'synchronized' | 'out_of_sync';
  summary: {
    totalEntities: number;
    synchronizedEntities: number;
    entitiesWithIssues: number;
    totalIssues: number;
  };
  entities: EntityValidationResult[];
  globalIssues: string[];
}

export interface EntityValidationResult {
  entityName: string;
  tableName: string;
  status: 'synchronized' | 'missing_table' | 'structure_mismatch';
  issues: SchemaIssue[];
  details: {
    expectedColumns: number;
    actualColumns: number;
    expectedIndices: number;
    actualIndices: number;
    recordCount?: number;
  };
}

export interface SchemaIssue {
  type: 'missing_table' | 'missing_column' | 'column_type_mismatch' | 'missing_index' | 'extra_column' | 'constraint_mismatch';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  expected?: any;
  actual?: any;
  suggestion?: string;
}

@Injectable()
export class SchemaValidatorService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async validateSchema(): Promise<SchemaValidationResult> {
    const entities = this.dataSource.entityMetadatas;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const result: SchemaValidationResult = {
        status: 'synchronized',
        summary: {
          totalEntities: entities.length,
          synchronizedEntities: 0,
          entitiesWithIssues: 0,
          totalIssues: 0,
        },
        entities: [],
        globalIssues: [],
      };

      const currentSchema = await queryRunner.query('SELECT current_schema()');
      const schemaName = currentSchema[0].current_schema;

      const dbTables = await queryRunner.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [schemaName]);

      const dbTableNames = dbTables.map(t => t.table_name);

      for (const entity of entities) {
        const entityResult = await this.validateEntity(entity, queryRunner, schemaName);
        result.entities.push(entityResult);

        if (entityResult.status === 'synchronized') {
          result.summary.synchronizedEntities++;
        } else {
          result.summary.entitiesWithIssues++;
          result.status = 'out_of_sync';
        }

        result.summary.totalIssues += entityResult.issues.length;
      }

      const entityTableNames = entities.map(e => e.tableName);
      const extraTables = dbTableNames.filter(tableName => 
        !entityTableNames.includes(tableName) && 
        !['migrations', 'typeorm_metadata'].includes(tableName)
      );

      if (extraTables.length > 0) {
        result.globalIssues.push(
          `Found ${extraTables.length} extra tables in database: ${extraTables.join(', ')}`
        );
      }

      return result;

    } finally {
      await queryRunner.release();
    }
  }

  private async validateEntity(
    entity: any,
    queryRunner: any,
    schemaName: string
  ): Promise<EntityValidationResult> {
    const result: EntityValidationResult = {
      entityName: entity.name,
      tableName: entity.tableName,
      status: 'synchronized',
      issues: [],
      details: {
        expectedColumns: entity.columns.length,
        actualColumns: 0,
        expectedIndices: entity.indices.length,
        actualIndices: 0,
      },
    };

    try {
      const tableExists = await queryRunner.hasTable(entity.tableName);
      
      if (!tableExists) {
        result.status = 'missing_table';
        result.issues.push({
          type: 'missing_table',
          severity: 'critical',
          message: `Table '${entity.tableName}' does not exist in database`,
          suggestion: `Run migrations or create table manually`,
        });
        return result;
      }

      const dbColumns = await queryRunner.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          udt_name
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [schemaName, entity.tableName]);

      result.details.actualColumns = dbColumns.length;

      const dbConstraints = await queryRunner.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = $1 AND tc.table_name = $2
      `, [schemaName, entity.tableName]);

      const dbIndices = await queryRunner.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = $1 AND tablename = $2
      `, [schemaName, entity.tableName]);

      result.details.actualIndices = dbIndices.length;

      await this.validateColumns(entity, dbColumns, result);

      await this.validateConstraints(entity, dbConstraints, result);

      await this.validateIndices(entity, dbIndices, result);

      try {
        const countResult = await queryRunner.query(`SELECT COUNT(*) as count FROM "${entity.tableName}"`);
        result.details.recordCount = parseInt(countResult[0].count);
      } catch (error) {
        // Ignorar erro de contagem
      }

      if (result.issues.some(issue => issue.severity === 'critical')) {
        result.status = 'structure_mismatch';
      } else if (result.issues.length > 0) {
        result.status = 'structure_mismatch';
      }

    } catch (error) {
      result.status = 'missing_table';
      result.issues.push({
        type: 'missing_table',
        severity: 'critical',
        message: `Error validating entity: ${error.message}`,
      });
    }

    return result;
  }

  private async validateConstraints(entity: any, dbConstraints: any[], result: EntityValidationResult) {
    const primaryColumns = entity.columns.filter(col => col.isPrimary);
    const dbPrimaryKeys = dbConstraints.filter(c => c.constraint_type === 'PRIMARY KEY');
    
    if (primaryColumns.length !== dbPrimaryKeys.length) {
      result.issues.push({
        type: 'constraint_mismatch',
        severity: 'critical',
        message: `Primary key constraint mismatch`,
        expected: primaryColumns.map(col => col.databaseName),
        actual: dbPrimaryKeys.map(pk => pk.column_name),
      });
    }

    const relations = entity.relations.filter(rel => rel.foreignKeys && rel.foreignKeys.length > 0);
    const dbForeignKeys = dbConstraints.filter(c => c.constraint_type === 'FOREIGN KEY');
    
  }

  private async validateIndices(entity: any, dbIndices: any[], result: EntityValidationResult) {
    const uniqueColumns = entity.columns.filter(col => col.isUnique);
    const dbUniqueIndices = dbIndices.filter(idx => idx.indexdef.includes('UNIQUE'));
    
  }

  private normalizeColumnType(type: any): string {
    if (typeof type === 'function') {
      return type.name.toLowerCase();
    }
    
    const typeStr = String(type).toLowerCase();
    
    const typeMapping: Record<string, string> = {
      'varchar': 'character varying',
      'int': 'integer',
      'int4': 'integer',
      'int8': 'bigint',
      'bool': 'boolean',
      'timestamp': 'timestamp without time zone',
      'timestamptz': 'timestamp with time zone',
      'text': 'text',
      'uuid': 'uuid',
      'decimal': 'numeric',
      'float': 'double precision',
      'json': 'json',
      'jsonb': 'jsonb',
    };

    return typeMapping[typeStr] || typeStr;
  }

  private areTypesCompatible(expected: string, actual: string): boolean {
    const compatibleTypes: Record<string, string[]> = {
      'integer': ['int4', 'int', 'serial', 'number'],
      'bigint': ['int8', 'bigserial'],
      'character varying': ['varchar', 'text', 'string'],
      'text': ['character varying', 'varchar', 'string'],
      'boolean': ['bool'],
      'timestamp without time zone': ['timestamp'],
      'numeric': ['decimal'],
      'date': ['timestamp without time zone', 'datetime'],
      'char': ['character', 'string'],
    };

    return expected == 'enum' || compatibleTypes[expected]?.includes(actual) || 
           compatibleTypes[actual]?.includes(expected) || 
           false;
  }
  
  private async validateColumns(entity: any, dbColumns: any[], result: EntityValidationResult) {
    const dbColumnMap = new Map(dbColumns.map(col => [col.column_name, col]));
    const entityColumnMap = new Map(entity.columns.map(col => [col.databaseName, col]));

    // Verificar colunas esperadas pela entidade
    for (const entityColumn of entity.columns) {
      const dbColumn = dbColumnMap.get(entityColumn.databaseName);
      
      if (!dbColumn) {
        result.issues.push({
          type: 'missing_column',
          severity: 'critical',
          message: `Column '${entityColumn.databaseName}' is missing in table '${result.tableName}'`,
          expected: {
            name: entityColumn.databaseName,
            type: this.getEntityColumnType(entityColumn),
            nullable: entityColumn.isNullable,
            isPrimary: entityColumn.isPrimary,
            isUnique: entityColumn.isUnique,
            length: entityColumn.length,
            precision: entityColumn.precision,
            scale: entityColumn.scale,
            default: entityColumn.default,
          },
          suggestion: `ALTER TABLE "${result.tableName}" ADD COLUMN "${entityColumn.databaseName}" ${this.getEntityColumnType(entityColumn)}${entityColumn.isNullable ? '' : ' NOT NULL'};`,
        });
        continue;
      }

      // Verificar tipo da coluna
      const expectedType = this.normalizeColumnType(entityColumn.type);
      const actualType = this.normalizeColumnType(dbColumn.data_type);
      
      if (expectedType !== actualType && !this.areTypesCompatible(expectedType, actualType)) {
        result.issues.push({
          type: 'column_type_mismatch',
          severity: 'warning',
          message: `Column '${entityColumn.databaseName}' in table '${result.tableName}' has type mismatch`,
          expected: expectedType,
          actual: actualType,
          suggestion: `ALTER TABLE "${result.tableName}" ALTER COLUMN "${entityColumn.databaseName}" TYPE ${expectedType};`,
        });
      }

      const expectedNullable = entityColumn.isNullable ? 'YES' : 'NO';
      if (dbColumn.is_nullable !== expectedNullable) {
        result.issues.push({
          type: 'constraint_mismatch',
          severity: 'warning',
          message: `Column '${entityColumn.databaseName}' in table '${result.tableName}' has nullable constraint mismatch`,
          expected: expectedNullable,
          actual: dbColumn.is_nullable,
          suggestion: expectedNullable === 'YES' 
            ? `ALTER TABLE "${result.tableName}" ALTER COLUMN "${entityColumn.databaseName}" DROP NOT NULL;`
            : `ALTER TABLE "${result.tableName}" ALTER COLUMN "${entityColumn.databaseName}" SET NOT NULL;`,
        });
      }

      if (entityColumn.length.toString() && dbColumn.character_maximum_length && 
          entityColumn.length.toString() !== dbColumn.character_maximum_length.toString()) {
        result.issues.push({
          type: 'column_type_mismatch',
          severity: 'info',
          message: `Column '${entityColumn.databaseName}' in table '${result.tableName}' has length mismatch`,
          expected: entityColumn.length,
          actual: dbColumn.character_maximum_length,
          suggestion: `ALTER TABLE "${result.tableName}" ALTER COLUMN "${entityColumn.databaseName}" TYPE VARCHAR(${entityColumn.length});`,
        });
      }
    }

    for (const dbColumn of dbColumns) {
      if (!entityColumnMap.has(dbColumn.column_name)) {
        result.issues.push({
          type: 'extra_column',
          severity: 'info',
          message: `Extra column '${dbColumn.column_name}' found in table '${result.tableName}' (not defined in entity '${result.entityName}')`,
          actual: {
            name: dbColumn.column_name,
            type: dbColumn.data_type,
            nullable: dbColumn.is_nullable,
            length: dbColumn.character_maximum_length,
            default: dbColumn.column_default,
          },
          suggestion: `Remove column from database: ALTER TABLE "${result.tableName}" DROP COLUMN "${dbColumn.column_name}"; -- WARNING: This will delete data!`,
        });
      }
    }
  }

  private getEntityColumnType(column: any): string {
    let type = String(column.type).toLowerCase();
    
    const typeMapping: Record<string, string> = {
      'varchar': 'VARCHAR',
      'text': 'TEXT',
      'int': 'INTEGER',
      'integer': 'INTEGER',
      'bigint': 'BIGINT',
      'decimal': 'DECIMAL',
      'numeric': 'NUMERIC',
      'float': 'REAL',
      'double': 'DOUBLE PRECISION',
      'boolean': 'BOOLEAN',
      'bool': 'BOOLEAN',
      'date': 'DATE',
      'time': 'TIME',
      'timestamp': 'TIMESTAMP',
      'timestamptz': 'TIMESTAMP WITH TIME ZONE',
      'uuid': 'UUID',
      'json': 'JSON',
      'jsonb': 'JSONB',
    };

    type = typeMapping[type] || type.toUpperCase();

    if (column.length) {
      type += `(${column.length})`;
    } else if (column.precision && column.scale) {
      type += `(${column.precision},${column.scale})`;
    } else if (column.precision) {
      type += `(${column.precision})`;
    }

    return type;
  }
}