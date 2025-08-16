export const environment = {
  production: false,
  apiBaseUrl: 'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-classifier',
  classifierEndpoint: '/classifier/predict',
  aiEndpoint: '/ml/generate',
  request: {
    timeoutMs: 15000,
    maxRetries: 2,
    baseRetryDelayMs: 300,
  },
};
