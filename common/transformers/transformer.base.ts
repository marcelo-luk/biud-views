import { BadRequestException, Injectable } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { Request } from 'express';

export interface TransformerInterface {
  transform(request: Request): Promise<any>;
}

@Injectable()
export abstract class TransformerBase implements TransformerInterface {
  protected page?: string;
  protected rowsPerPage?: string;

  /**
   * Populates the transformer properties from the request body
   */
  protected populate(request: Request): void {
    const requestBody = request.body;
    
    for (const [property, value] of Object.entries(requestBody)) {
      if (property in this && value !== '') {
        this[property] = value;
      }
    }
  }

  /**
   * Validates the transformer using class-validator
   */
  protected async validate(): Promise<void> {
    const errors = await validate(this);
    
    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages
      });
    }
  }

  /**
   * Formats validation errors into a consistent structure
   */
  private formatValidationErrors(errors: ValidationError[]): any[] {
    const errorMessages = [];
    
    for (const error of errors) {
      if (error.constraints) {
        for (const [constraintType, message] of Object.entries(error.constraints)) {
          errorMessages.push({
            property: error.property,
            value: error.value,
            message: message
          });
        }
      }
      
      if (error.children && error.children.length > 0) {
        errorMessages.push(...this.formatValidationErrors(error.children));
      }
    }
    
    return errorMessages;
  }

  /**
   * Populates pagination-related properties from the request
   */
  protected populatePagination(request: Request): void {
    this.populateByRequestAndKey(request, ['page', 'rowsPerPage']);
  }

  /**
   * Populates specific properties from the request query parameters
   */
  protected populateByRequestAndKey(request: Request, arrayKeys: string[]): void {
    for (const property of arrayKeys) {
      if (property in this) {
        this[property] = request.query[property] as string;
      }
    }
  }

  /**
   * Gets the page number as an integer
   */
  protected getPage(): number | null {
    return this.page !== undefined ? parseInt(this.page, 10) : null;
  }

  /**
   * Gets the rows per page as an integer
   */
  protected getRowsPerPage(): number | null {
    return this.rowsPerPage !== undefined ? parseInt(this.rowsPerPage, 10) : null;
  }

  /**
   * Transform method to be implemented by subclasses
   */
  abstract transform(request: Request): Promise<any>;
}
