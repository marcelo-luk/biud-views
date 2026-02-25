import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'public',
  synchronize: false,
  logging: true,
  entities: [],
  migrations: ['common/database/migrations/**/*.ts'],
  migrationsTableName: 'migrations',
});
