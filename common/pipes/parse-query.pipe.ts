import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseQueryPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'query') {
      return value;
    }

    const parsedQuery = {};

    for (const key in value) {
      const val = value[key];

      // Verifica se o valor parece ser um array ou objeto JSON
      if (/^\[.*\]$/.test(val) || /^\{.*\}$/.test(val)) {
        try {
          parsedQuery[key] = JSON.parse(val);
        } catch (e) {
          throw new BadRequestException(`Invalid JSON format for ${key}`);
        }
      } 
      // Verifica se é número
      else if (!isNaN(val)) {
        parsedQuery[key] = Number(val);
      } 
      // Mantém como string
      else {
        parsedQuery[key] = val;
      }
    }

    return parsedQuery;
  }
}
