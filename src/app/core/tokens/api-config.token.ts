import { InjectionToken } from '@angular/core';

export interface ApiConfigToken {
  baseUrl: string;
  classifierEndpoint: string;
  aiEndpoint: string;
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
}

export const API_CONFIG = new InjectionToken<ApiConfigToken>('API_CONFIG');
