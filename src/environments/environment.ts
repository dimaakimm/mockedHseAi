export const environment = {
  production: false,
  apiBaseUrl: 'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-classifier',
  classifierEndpoint: '/classifier/predict',
  authToken: 'Basic ZGV2ZWxvcGVyOmExNTU2MmViYjNjOTk3NmU=',
  aiEndpoint: '/ml/generate',
  request: {
    timeoutMs: 15000,
    maxRetries: 2,
    baseRetryDelayMs: 300,
  },
};
