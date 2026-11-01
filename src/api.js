import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export async function predict(payload) {
  const { data } = await api.post('/api/v1/predict', payload);
  return data;
}

export async function health() {
  const { data } = await api.get('/health');
  return data;
}

export async function getModelInfo() {
  const { data } = await api.get('/api/v1/model-info');
  return data;
}