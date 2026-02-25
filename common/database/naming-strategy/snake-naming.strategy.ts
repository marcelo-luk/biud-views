import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {

  columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    return customName ?? this.camelToSnake(embeddedPrefixes.join('_') + (embeddedPrefixes.length ? '_' : '') + propertyName);
  }

  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? this.camelToSnake(targetName);
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
