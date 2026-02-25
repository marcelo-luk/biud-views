export type CurrentEnvironment = 'development' | 'production' | 'test';

export interface GlobalConfiguration {
  appName: string;
  currentEnvironment: CurrentEnvironment;
  cache: {
    store: string;
    host?: string;
    port?: number;
    password?: string;
  };
  database: {
    url: string;
    alies: string;
  };
  loggerOptions: {
    logLevel?: string;
  };
}
