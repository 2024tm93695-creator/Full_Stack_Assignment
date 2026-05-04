const api = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: { headers: { common: {} } },
  interceptors: { response: { use: jest.fn() } },
};

export default api;
