import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app/app.routes';
import { API_CONFIG } from './app/core/tokens/api-config.token';
import { environment } from './environments/environment';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { timeoutInterceptor } from './app/core/interceptors/timeout.interceptor';
import { retryInterceptor } from './app/core/interceptors/retry.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, timeoutInterceptor, retryInterceptor, errorInterceptor]),
    ),
    {
      provide: API_CONFIG,
      useValue: {
        baseUrl: environment.apiBaseUrl,
        classifierEndpoint: environment.classifierEndpoint,
        aiEndpoint: environment.aiEndpoint,
        timeoutMs: environment.request.timeoutMs,
        maxRetries: environment.request.maxRetries,
        baseRetryDelayMs: environment.request.baseRetryDelayMs,
      },
    },
  ],
};
