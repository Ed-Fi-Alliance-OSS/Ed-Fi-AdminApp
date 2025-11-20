import { Logger } from '@nestjs/common';

// Define AggregateError interface for TypeScript compatibility
interface AggregateErrorLike extends Error {
  errors: unknown[];
  name: 'AggregateError';
}

// Type guard for database-related errors
interface DatabaseError extends Error {
  code?: string;
}

export class AggregateErrorHandler {
  private static readonly logger = new Logger(AggregateErrorHandler.name);

  /**
   * Safely handle AggregateError by extracting and logging individual errors
   */
  static handle(error: unknown): { isDatabaseRelated: boolean; safeMessage: string } {
    if (this.isAggregateError(error)) {
      const aggregateError = error as AggregateErrorLike;

      this.logger.debug(`AggregateError detected with ${aggregateError.errors.length} individual errors:`);

      let databaseErrorCount = 0;
      let connectionErrorCount = 0;
      let otherErrorCount = 0;

      // Analyze individual errors within the AggregateError
      aggregateError.errors.forEach((individualError, index) => {
        const errorMessage = individualError instanceof Error ? individualError.message : String(individualError);
        const errorCode = (individualError as DatabaseError)?.code;

        // Log each individual error for debugging
        this.logger.debug(`  [${index + 1}] ${errorMessage} ${errorCode ? `(${errorCode})` : ''}`);

        // Categorize errors
        if (this.isDatabaseConnectionError(individualError)) {
          databaseErrorCount++;
        } else if (this.isConnectionError(individualError)) {
          connectionErrorCount++;
        } else {
          otherErrorCount++;
        }
      });

      const isDatabaseRelated = databaseErrorCount > 0 || connectionErrorCount > 0;

      if (isDatabaseRelated) {
        this.logger.warn(`AggregateError: ${databaseErrorCount} database errors, ${connectionErrorCount} connection errors, ${otherErrorCount} other errors`);
        return {
          isDatabaseRelated: true,
          safeMessage: 'Database connection issues detected'
        };
      } else {
        this.logger.error(`AggregateError: ${otherErrorCount} non-database errors detected`);
        return {
          isDatabaseRelated: false,
          safeMessage: 'Multiple system errors occurred'
        };
      }
    }

    // Not an AggregateError, handle as single error
    if (this.isDatabaseConnectionError(error) || this.isConnectionError(error)) {
      return {
        isDatabaseRelated: true,
        safeMessage: 'Database connection error'
      };
    }

    return {
      isDatabaseRelated: false,
      safeMessage: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }

  /**
   * Check if an error is an AggregateError
   */
  static isAggregateError(error: unknown): error is AggregateErrorLike {
    return error instanceof Error &&
           error.name === 'AggregateError' &&
           'errors' in error &&
           Array.isArray((error as AggregateErrorLike).errors);
  }

  /**
   * Check if an individual error is database-related
   */
  private static isDatabaseConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const code = (error as DatabaseError)?.code;

    return message.includes('database') ||
           message.includes('connection') ||
           message.includes('postgres') ||
           message.includes('pgboss') ||
           message.includes('typeorm') ||
           code === 'ECONNREFUSED' ||
           code === 'ECONNRESET' ||
           code === '57P01' || // admin_shutdown
           code === '57P03' || // cannot_connect_now
           code === '08000' || // connection_exception
           code === '08003' || // connection_does_not_exist
           code === '08006';   // connection_failure
  }

  /**
   * Check if an individual error is a general connection error
   */
  private static isConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const code = (error as DatabaseError)?.code;

    return message.includes('connect') ||
           message.includes('timeout') ||
           message.includes('refused') ||
           message.includes('reset') ||
           code?.startsWith('ECONN');
  }

  /**
   * Extract all error messages from an AggregateError for detailed logging
   */
  static extractAllMessages(error: unknown): string[] {
    if (this.isAggregateError(error)) {
      const aggregateError = error as AggregateErrorLike;
      return aggregateError.errors.map(err =>
        err instanceof Error ? err.message : String(err)
      );
    }

    return [error instanceof Error ? error.message : String(error)];
  }
}
