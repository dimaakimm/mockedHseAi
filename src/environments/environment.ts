export const environment = {
  production: false,
  apiBaseUrl: 'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-classifier',
  authToken: 'Basic ZGV2ZWxvcGVyOmExNTU2MmViYjNjOTk3NmU=',
  classifierEndpoint: '/classifier/predict',
  aiEndpoint: '/ml/generate',
  request: {
    timeoutMs: 15000,
    maxRetries: 2,
    baseRetryDelayMs: 300,
  },
};
