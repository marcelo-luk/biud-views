export interface DatabaseInfo {
  database: string;
  user: string;
  schema: string;
  version: string;
  isInitialized: boolean;
}

export interface EntityColumnInfo {
  name: string;
  databaseName: string;
  type: string;
  isNullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface EntityRelationInfo {
  propertyName: string;
  type: string;
  target: string;
  joinColumn?: string;
  foreignKey?: string;
}

export interface EntityInfo {
  name: string;
  tableName: string;
  columns: EntityColumnInfo[];
  relations: EntityRelationInfo[];
  indices: any[];
}

export interface DatabaseTableInfo {
  tableName: string;
  columns: DatabaseColumnInfo[];
  constraints: DatabaseConstraintInfo[];
  indices: DatabaseIndexInfo[];
}

export interface DatabaseColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
}

export interface DatabaseConstraintInfo {
  constraintName: string;
  constraintType: string;
  columnName: string;
  foreignTableName?: string;
  foreignColumnName?: string;
}

export interface DatabaseIndexInfo {
  indexName: string;
  indexDefinition: string;
}