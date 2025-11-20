import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AggregateErrorHandler } from './aggregate-error-handler';

// Define AggregateError interface for TypeScript compatibility
interface AggregateErrorLike extends Error {
  errors: unknown[];
  name: 'AggregateError';
}

@Catch()
export class AggregateErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AggregateErrorFilter.name);

  // Rate limiting for database error logging
  private lastDatabaseErrorLog = 0;
  private databaseErrorCount = 0;
  private readonly LOG_INTERVAL_MS = 10000; // Log summary every 10 seconds
  private readonly DETAILED_LOG_LIMIT = 2; // Only log detailed errors for first 3 occurrences

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle AggregateError specifically
    if (AggregateErrorHandler.isAggregateError(exception)) {
      this.handleAggregateError(exception, response, request);
      return;
    }

    // Handle HttpException separately and delegate to NestJS default handling
    if (exception instanceof HttpException) {
    const httpException = exception as HttpException;
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
    return;
  }

    // Handle other errors
    if (exception instanceof Error) {
      this.handleRegularError(exception, response, request);
      return;
    }

    // Handle unknown errors
    this.handleUnknownError(exception, response, request);
  }

  private handleAggregateError(
    error: AggregateErrorLike,
    response: Response,
    request: Request
  ): void {
    const errorAnalysis = AggregateErrorHandler.handle(error);
    const allMessages = AggregateErrorHandler.extractAllMessages(error);

    if (errorAnalysis.isDatabaseRelated) {
      this.handleDatabaseRelatedError(error, request, allMessages);
    } else {
      // Log non-database AggregateErrors in full detail
      this.logger.error(
        `Non-database AggregateError on ${request.method} ${request.url}: ${errorAnalysis.safeMessage}`
      );

      this.logger.error(
        `AggregateError contains ${error.errors.length} individual errors:`
      );

      allMessages.forEach((msg, index) => {
        this.logger.error(`  [${index + 1}] ${msg}`);
      });
    }

    if (errorAnalysis.isDatabaseRelated) {
      // Database-related AggregateError - return 503 Service Unavailable
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Temporarily Unavailable',
        message: 'The database service is temporarily unavailable. Please try again in a few moments.',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } else {
      // Non-database AggregateError - return 500 Internal Server Error
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Multiple system errors occurred. Please try again or contact support.',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }

  private handleDatabaseRelatedError(
    error: AggregateErrorLike,
    request: Request,
    allMessages: string[]
  ): void {
    const now = Date.now();
    this.databaseErrorCount++;

    // Log detailed information only for the first few errors
    if (this.databaseErrorCount <= this.DETAILED_LOG_LIMIT) {
      this.logger.warn(
        `Database AggregateError #${this.databaseErrorCount} on ${request.method} ${request.url}`
      );

      this.logger.debug(
        `AggregateError contains ${error.errors.length} individual errors:`
      );

      allMessages.forEach((msg, index) => {
        this.logger.debug(`  [${index + 1}] ${msg}`);
      });
    }

    // Log periodic summary to track ongoing issues
    if (now - this.lastDatabaseErrorLog > this.LOG_INTERVAL_MS) {
      if (this.databaseErrorCount > this.DETAILED_LOG_LIMIT) {
        this.logger.warn(
          `Database connection issues ongoing - ${this.databaseErrorCount} total errors in last ${this.LOG_INTERVAL_MS / 1000}s (detailed logging suppressed to reduce noise)`
        );
      }

      this.lastDatabaseErrorLog = now;
      // Reset counter for next interval
      this.databaseErrorCount = 0;
    }
  }

  private handleRegularError(
    error: Error,
    response: Response,
    request: Request
  ): void {
    const errorAnalysis = AggregateErrorHandler.handle(error);

    if (errorAnalysis.isDatabaseRelated) {
      // Use rate-limited logging for database errors
      const now = Date.now();
      this.databaseErrorCount++;

      if (this.databaseErrorCount <= this.DETAILED_LOG_LIMIT) {
        this.logger.warn(
          `Database error #${this.databaseErrorCount} on ${request.method} ${request.url}: ${error.message}`
        );
      }

      if (now - this.lastDatabaseErrorLog > this.LOG_INTERVAL_MS) {
        if (this.databaseErrorCount > this.DETAILED_LOG_LIMIT) {
          this.logger.warn(
            `Database connection issues ongoing - ${this.databaseErrorCount} total errors in last ${this.LOG_INTERVAL_MS / 1000}s`
          );
        }
        this.lastDatabaseErrorLog = now;
        this.databaseErrorCount = 0;
      }
    } else {
      // Log non-database errors in full detail
      this.logger.error(
        `Error on ${request.method} ${request.url}: ${error.message}`,
        error.stack
      );
    }

    if (errorAnalysis.isDatabaseRelated) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Temporarily Unavailable',
        message: 'The database service is temporarily unavailable. Please try again in a few moments.',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again or contact support.',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }

  private handleUnknownError(
    error: unknown,
    response: Response,
    request: Request
  ): void {
    this.logger.error(
      `Unknown error on ${request.method} ${request.url}: ${String(error)}`
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again or contact support.',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
