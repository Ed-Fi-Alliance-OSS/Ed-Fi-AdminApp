import axios from 'axios';

axios.defaults.baseURL = `${import.meta.env.VITE_API_URL}/api/`;

export const apiClient = axios.create({
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if ([401].includes(error?.response?.status)) {
      console.info('Redirecting to login');
      window.location.href = `${window.location.origin}/login?redirect=${encodeURIComponent(
        window.location.href.replace(window.location.origin, '')
      )}`;
    } else {
      throw error?.response?.data ?? error;
    }
  }
);
