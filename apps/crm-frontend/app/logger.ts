// Logger centralizado para la aplicación CRM
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: string;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV !== 'production';

    private log(level: LogLevel, message: string, data?: any) {
        const entry: LogEntry = {
            level,
            message,
            data,
            timestamp: new Date().toISOString(),
        };

        // En desarrollo, usar console con colores
        if (this.isDevelopment) {
            const styles: Record<LogLevel, string> = {
                debug: 'color: #888',
                info: 'color: #0ea5e9',
                warn: 'color: #f59e0b',
                error: 'color: #ef4444; font-weight: bold',
            };

            const emoji: Record<LogLevel, string> = {
                debug: '🔍',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌',
            };

            console.log(
                `%c${emoji[level]} [${level.toUpperCase()}] ${message}`,
                styles[level],
                data || ''
            );
        }

        // En producción, solo errores y warnings
        if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
            console.error(`[${level.toUpperCase()}] ${message}`, data);

            // TODO: Enviar a servicio de logging externo (Sentry, LogRocket, etc.)
            // this.sendToExternalService(entry);
        }
    }

    debug(message: string, data?: any) {
        this.log('debug', message, data);
    }

    info(message: string, data?: any) {
        this.log('info', message, data);
    }

    warn(message: string, data?: any) {
        this.log('warn', message, data);
    }

    error(message: string, data?: any) {
        this.log('error', message, data);
    }

    // Helper para errores de API
    apiError(endpoint: string, error: any, status?: number) {
        this.error('API Error', {
            endpoint,
            status,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

// Exportar instancia singleton
export const logger = new Logger();
