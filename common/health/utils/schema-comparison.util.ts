export class SchemaComparisonUtil {
  static compareColumnTypes(entityType: any, dbType: string): boolean {
    const normalizedEntityType = this.normalizeEntityType(entityType);
    const normalizedDbType = this.normalizeDbType(dbType);
    
    return normalizedEntityType === normalizedDbType || 
           this.areTypesCompatible(normalizedEntityType, normalizedDbType);
  }

  static normalizeEntityType(type: any): string {
    if (typeof type === 'function') {
      const typeName = type.name.toLowerCase();
      
      const typeMapping: Record<string, string> = {
        'string': 'varchar',
        'number': 'integer',
        'boolean': 'boolean',
        'date': 'timestamp',
      };
      
      return typeMapping[typeName] || typeName;
    }
    
    return String(type).toLowerCase();
  }

  static normalizeDbType(dbType: string): string {
    const typeMapping: Record<string, string> = {
      'character varying': 'varchar',
      'timestamp without time zone': 'timestamp',
      'timestamp with time zone': 'timestamptz',
      'double precision': 'float',
      'bigint': 'int8',
      'integer': 'int4',
    };

    return typeMapping[dbType.toLowerCase()] || dbType.toLowerCase();
  }

  static areTypesCompatible(type1: string, type2: string): boolean {
    const compatibilityGroups = [
      ['varchar', 'text', 'character varying'],
      ['integer', 'int4', 'int', 'serial'],
      ['bigint', 'int8', 'bigserial'],
      ['timestamp', 'timestamp without time zone'],
      ['timestamptz', 'timestamp with time zone'],
      ['float', 'double precision', 'real'],
      ['decimal', 'numeric'],
      ['boolean', 'bool'],
    ];

    return compatibilityGroups.some(group => 
      group.includes(type1) && group.includes(type2)
    );
  }

  static generateMigrationSQL(issue: any, entityName: string, tableName: string): string {
    switch (issue.type) {
      case 'missing_table':
        return `-- Create table for entity ${entityName}
CREATE TABLE "${tableName}" (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- Add other columns based on entity definition
);`;

      case 'missing_column':
        const columnDef = this.generateColumnDefinition(issue.expected);
        return `-- Add missing column
ALTER TABLE "${tableName}" ADD COLUMN ${columnDef};`;

      case 'column_type_mismatch':
        return `-- Fix column type mismatch
ALTER TABLE "${tableName}" ALTER COLUMN "${issue.expected?.name}" TYPE ${issue.expected?.type};`;

      case 'extra_column':
        return `-- Remove extra column (WARNING: This will delete data!)
-- ALTER TABLE "${tableName}" DROP COLUMN "${issue.actual?.name}";`;

      case 'constraint_mismatch':
        return `-- Fix constraint mismatch
-- Review and adjust constraints for table "${tableName}"`;

      default:
        return `-- Manual review required for ${issue.type}`;
    }
  }

  private static generateColumnDefinition(columnInfo: any): string {
    if (!columnInfo) return 'column_name TYPE';
    
    const { name, type, nullable, length, precision, scale } = columnInfo;
    
    let definition = `"${name}" ${type}`;
    
    if (length) {
      definition += `(${length})`;
    } else if (precision && scale) {
      definition += `(${precision},${scale})`;
    } else if (precision) {
      definition += `(${precision})`;
    }
    
    if (!nullable) {
      definition += ' NOT NULL';
    }
    
    return definition;
  }
}