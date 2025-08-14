import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { API_CONFIG } from '../tokens/api-config.token';
import { AiRequest, AiResponse } from '../models/dto';
import { retry } from 'rxjs/operators';
import { timer } from 'rxjs';
import { expBackoffDelay } from '../utils/backoff';

@Injectable({ providedIn: 'root' })
export class AiService {
  private api = inject(ApiService);
  private cfg = inject(API_CONFIG);

  ask(payload: AiRequest) {
    return this.api.post<AiResponse>(this.cfg.aiEndpoint, payload).pipe(
      retry({
        count: this.cfg.maxRetries, // сколько раз повторять
        // retryCount начинается с 1 для первой повторной попытки
        delay: (error, retryCount) => timer(expBackoffDelay(retryCount, this.cfg.baseRetryDelayMs)),
        // при необходимости можно фильтровать ошибки, которые стоит ретраить:
        // resetOnSuccess: true — поведение по умолчанию в RxJS 7.8+
      }),
    );
  }
}
