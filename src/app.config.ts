import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { ClassifierService } from './app/core/services/classifier.service';
import { AiService } from './app/core/services/ai.service';
import { MockClassifierService } from './app/core/services/mock/mock-classifier.service';
import { MockAiService } from './app/core/services/mock/mock-ai.service';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { timeoutInterceptor } from './app/core/interceptors/timeout.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, timeoutInterceptor, errorInterceptor])),

    // Подмена реальных сервисов на моки
    ...(environment.mock
      ? [
          { provide: ClassifierService, useClass: MockClassifierService },
          { provide: AiService, useClass: MockAiService },
        ]
      : []),
  ],
};
