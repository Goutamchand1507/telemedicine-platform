import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // Generic HTTP methods
  async get(url: string, config?: any) {
    return this.api.get(url, config);
  }

  async post(url: string, data?: any, config?: any) {
    return this.api.post(url, data, config);
  }

  async put(url: string, data?: any, config?: any) {
    return this.api.put(url, data, config);
  }

  async delete(url: string, config?: any) {
    return this.api.delete(url, config);
  }

  async patch(url: string, data?: any, config?: any) {
    return this.api.patch(url, data, config);
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;

          switch (status) {
            case 401:
              // Unauthorized - clear token and redirect to login
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
              break;
            case 403:
              toast.error('Access denied');
              break;
            case 404:
              toast.error('Resource not found');
              break;
            case 422:
              // Validation errors
              if (data.errors && Array.isArray(data.errors)) {
                data.errors.forEach((error: any) => {
                  toast.error(error.msg || error.message);
                });
              } else {
                toast.error(data.message || 'Validation failed');
              }
              break;
            case 429:
              toast.error('Too many requests. Please try again later.');
              break;
            case 500:
              toast.error('Server error. Please try again later.');
              break;
            default:
              toast.error(data.message || 'An error occurred');
          }
        } else if (error.request) {
          toast.error('Network error. Please check your connection.');
        } else {
          toast.error('An unexpected error occurred');
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: { email: string; password: string }) {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: any) {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async logout() {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async verifyEmail(token: string) {
    const response = await this.api.post('/auth/verify-email', { token });
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }

  // User endpoints
  async getProfile() {
    const response = await this.api.get('/users/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.api.put('/users/profile', data);
    return response.data;
  }

  async uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('profileImage', file);
    
    const response = await this.api.post('/users/upload-profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getDoctors(params?: any) {
    const response = await this.api.get('/users/doctors', { params });
    return response.data;
  }

  async getDoctorDetails(id: string) {
    const response = await this.api.get(`/users/doctors/${id}`);
    return response.data;
  }

  async getPatients(params?: any) {
    const response = await this.api.get('/users/patients', { params });
    return response.data;
  }

  // Appointment endpoints
  async createAppointment(data: any) {
    const response = await this.api.post('/appointments', data);
    return response.data;
  }

  async getAppointments(params?: any) {
    const response = await this.api.get('/appointments', { params });
    return response.data;
  }

  async getAppointmentDetails(id: string) {
    const response = await this.api.get(`/appointments/${id}`);
    return response.data;
  }

  async updateAppointmentStatus(id: string, status: string, notes?: string) {
    const response = await this.api.put(`/appointments/${id}/status`, { status, notes });
    return response.data;
  }

  async cancelAppointment(id: string) {
    const response = await this.api.delete(`/appointments/${id}`);
    return response.data;
  }

  // Video endpoints
  async createVideoRoom(appointmentId: string) {
    const response = await this.api.post('/video/create-room', { appointmentId });
    return response.data;
  }

  async getVideoRoom(appointmentId: string) {
    const response = await this.api.get(`/video/room/${appointmentId}`);
    return response.data;
  }

  async endVideoCall(appointmentId: string, notes?: string) {
    const response = await this.api.post('/video/end-call', { appointmentId, notes });
    return response.data;
  }

  async getIceServers() {
    const response = await this.api.get('/video/ice-servers');
    return response.data;
  }

  async recordSession(appointmentId: string, action: 'start' | 'stop') {
    const response = await this.api.post('/video/record-session', { appointmentId, action });
    return response.data;
  }

  // Health Records endpoints
  async createHealthRecord(data: any, file?: File) {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
      }
    });
    if (file) {
      formData.append('file', file);
    }

    const response = await this.api.post('/health-records', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getHealthRecords(params?: any) {
    const response = await this.api.get('/health-records', { params });
    return response.data;
  }

  async getHealthRecordDetails(id: string) {
    const response = await this.api.get(`/health-records/${id}`);
    return response.data;
  }

  async updateHealthRecord(id: string, data: any) {
    const response = await this.api.put(`/health-records/${id}`, data);
    return response.data;
  }

  async deleteHealthRecord(id: string) {
    const response = await this.api.delete(`/health-records/${id}`);
    return response.data;
  }

  // Prescription endpoints
  async createPrescription(data: any) {
    const response = await this.api.post('/prescriptions', data);
    return response.data;
  }

  async getPrescriptions(params?: any) {
    const response = await this.api.get('/prescriptions', { params });
    return response.data;
  }

  async getPrescriptionDetails(id: string) {
    const response = await this.api.get(`/prescriptions/${id}`);
    return response.data;
  }

  async updatePrescriptionStatus(id: string, status: string) {
    const response = await this.api.put(`/prescriptions/${id}/status`, { status });
    return response.data;
  }

  async requestRefill(id: string) {
    const response = await this.api.post(`/prescriptions/${id}/refill`);
    return response.data;
  }

  // Billing endpoints
  async createPaymentIntent(appointmentId: string, amount: number) {
    const response = await this.api.post('/billing/create-payment-intent', { appointmentId, amount });
    return response.data;
  }

  async confirmPayment(paymentIntentId: string, appointmentId: string) {
    const response = await this.api.post('/billing/confirm-payment', { paymentIntentId, appointmentId });
    return response.data;
  }

  async getInvoices(params?: any) {
    const response = await this.api.get('/billing/invoices', { params });
    return response.data;
  }

  async getInvoiceDetails(id: string) {
    const response = await this.api.get(`/billing/invoices/${id}`);
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboard() {
    const response = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async getAdminUsers(params?: any) {
    const response = await this.api.get('/admin/users', { params });
    return response.data;
  }

  async updateUserStatus(id: string, status: string) {
    const response = await this.api.put(`/admin/users/${id}/status`, { status });
    return response.data;
  }

  async getAdminAppointments(params?: any) {
    const response = await this.api.get('/admin/appointments', { params });
    return response.data;
  }

  async getAdminBilling(params?: any) {
    const response = await this.api.get('/admin/billing', { params });
    return response.data;
  }

  async getAuditLogs(params?: any) {
    const response = await this.api.get('/admin/audit-logs', { params });
    return response.data;
  }

  async toggleMaintenanceMode(enabled: boolean, message?: string) {
    const response = await this.api.post('/admin/system/maintenance', { enabled, message });
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
