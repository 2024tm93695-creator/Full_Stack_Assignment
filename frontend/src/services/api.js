import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' }
});

// Restore auth from localStorage on page load
const storedToken = localStorage.getItem('token');
const storedUser  = localStorage.getItem('user');

if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}
if (storedUser) {
  try {
    const u = JSON.parse(storedUser);
    api.defaults.headers.common['x-user-id'] = u.id;
  } catch {}
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
