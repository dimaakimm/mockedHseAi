export const environment = {
  production: false,
  apiBaseUrl: 'https://api.example.com',
  classifierEndpoint: '/ml/classify',
  aiEndpoint: '/ml/generate',
  request: {
    timeoutMs: 15000,
    maxRetries: 2,
    baseRetryDelayMs: 300
  },
};
