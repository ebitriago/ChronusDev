import { logger } from './logger';

// Configuración de retry
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // ms
    retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeouts, rate limits, server errors
};

interface ApiFetchOptions extends RequestInit {
    skipRetry?: boolean;
    skipLogging?: boolean;
}

/**
 * Helper genérico para fetch con manejo de errores, retry logic y logging
 */
export async function apiFetch<T>(
    url: string,
    options: ApiFetchOptions = {}
): Promise<T> {
    const { skipRetry = false, skipLogging = false, ...fetchOptions } = options;

    let lastError: Error | null = null;
    const maxAttempts = skipRetry ? 1 : RETRY_CONFIG.maxRetries;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url, fetchOptions);

            // Verificar si la respuesta es exitosa
            if (!res.ok) {
                // Intentar parsear error del backend
                const errorData = await res.json().catch(() => ({
                    error: `HTTP ${res.status}: ${res.statusText}`,
                }));

                const errorMessage = errorData.error || errorData.message || `Error ${res.status}`;
                const error = new Error(errorMessage);

                // Log del error
                if (!skipLogging) {
                    logger.apiError(url, error, res.status);
                }

                // Verificar si debemos reintentar
                const shouldRetry =
                    !skipRetry &&
                    attempt < maxAttempts &&
                    RETRY_CONFIG.retryableStatuses.includes(res.status);

                if (shouldRetry) {
                    logger.warn(`Retrying request (${attempt}/${maxAttempts})`, { url, status: res.status });
                    await sleep(RETRY_CONFIG.retryDelay * attempt); // Exponential backoff
                    continue;
                }

                throw error;
            }

            // Parsear respuesta exitosa
            const data = await res.json();

            if (!skipLogging && process.env.NODE_ENV === 'development') {
                logger.debug('API Success', { url, method: fetchOptions.method || 'GET' });
            }

            return data as T;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Si es un error de red (no HTTP), reintentar
            const isNetworkError = !lastError.message.includes('HTTP');
            const shouldRetry = !skipRetry && attempt < maxAttempts && isNetworkError;

            if (shouldRetry) {
                logger.warn(`Network error, retrying (${attempt}/${maxAttempts})`, { url, error: lastError.message });
                await sleep(RETRY_CONFIG.retryDelay * attempt);
                continue;
            }

            // Log final del error
            if (!skipLogging) {
                logger.apiError(url, lastError);
            }

            throw lastError;
        }
    }

    // Si llegamos aquí, todos los reintentos fallaron
    throw lastError || new Error('Request failed after retries');
}

/**
 * Helper para requests GET
 */
export async function apiGet<T>(url: string, options?: ApiFetchOptions): Promise<T> {
    return apiFetch<T>(url, { ...options, method: 'GET' });
}

/**
 * Helper para requests POST
 */
export async function apiPost<T>(
    url: string,
    body: any,
    options?: ApiFetchOptions
): Promise<T> {
    return apiFetch<T>(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(body),
    });
}

/**
 * Helper para requests PUT
 */
export async function apiPut<T>(
    url: string,
    body: any,
    options?: ApiFetchOptions
): Promise<T> {
    return apiFetch<T>(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

/**
 * Helper para requests DELETE
 */
export async function apiDelete<T>(url: string, options?: ApiFetchOptions): Promise<T> {
    return apiFetch<T>(url, { ...options, method: 'DELETE' });
}

/**
 * Utility: Sleep function para delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
