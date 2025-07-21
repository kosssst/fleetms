import api from '../lib/axios';

export const getCompany = async () => {
  const { data } = await api.get('/company');
  return data;
};

export const createCompany = async (name: string) => {
  const { data } = await api.post('/company/create', { name });
  return data;
};
