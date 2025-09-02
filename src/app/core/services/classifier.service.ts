import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { API_CONFIG } from '../tokens/api-config.token';
import { ClassifierRequest, ClassifierResponse } from '../models/dto';
import { retry } from 'rxjs/operators';
import { throwError, timer } from 'rxjs';
import { expBackoffDelay } from '../utils/backoff';

@Injectable({ providedIn: 'root' })
export class ClassifierService {
  private api = inject(ApiService);
  private cfg = inject(API_CONFIG);

  classify(question: string) {
    const body: ClassifierRequest = {
      inputs: [{ name: 'question', datatype: 'str', data: question, shape: 0 }],
      output_fields: [
        { name: 'question', datatype: 'str' },
        { name: 'predicted_category', datatype: 'str' },
        { name: 'confidence', datatype: 'FP64' },
      ],
    };

    return this.api.post<ClassifierResponse>(this.cfg.classifierEndpoint, body).pipe(
      retry({
        count: this.cfg.maxRetries,
        delay: (_error, retryCount) =>
          timer(expBackoffDelay(retryCount, this.cfg.baseRetryDelayMs)),
        // при желании можно фильтровать ошибки (например, не ретраить 4xx)
      }),
    );
  }
}
