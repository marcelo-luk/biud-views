export class SchemaValidationQueryDto {
  detailed?: boolean;
  severity?: 'critical' | 'warning' | 'info';
  entity?: string;
}

export class SchemaValidationResponseDto {
  status: 'synchronized' | 'out_of_sync';
  summary: {
    totalEntities: number;
    synchronizedEntities: number;
    entitiesWithIssues: number;
    totalIssues: number;
  };
  timestamp: string;
  executionTime: number;
}