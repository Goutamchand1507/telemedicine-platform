import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-toastify';

// ✅ Correct API Base URL (MUST include /api)
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://telemedicine-platform-h2xc.onrender.com/api";

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  // ============================================
  // Generic HTTP Methods
  // ============================================
  get(url: string, config?: any) {
    return this.api.get(url, config);
  }

  post(url: string, data?: any, config?: any) {
    return this.api.post(url, data, config);
  }

  put(url: string, data?: any, config?: any) {
    return this.api.put(url, data, config);
  }

  delete(url: string, config?: any) {
    return this.api.delete(url, config);
  }

  patch(url: string, data?: any, config?: any) {
    return this.api.patch(url, data, config);
  }

  // ============================================
  // Interceptors (Token + Errors)
  // ============================================
  private setupInterceptors() {
    // Add token to every request
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle errors globally
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;

          switch (status) {
            case 401:
              toast.error("Session expired. Please login again.");
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              window.location.href = "/login";
              break;

            case 403:
              toast.error("Access denied");
              break;

            case 404:
              toast.error("Resource not found");
              break;

            case 422:
              if (Array.isArray(data.errors)) {
                data.errors.forEach((e: any) => toast.error(e.msg));
              } else {
                toast.error(data.message || "Validation failed");
              }
              break;

            case 500:
              toast.error("Server error, please try again later.");
              break;

            default:
              toast.error(data.message || "An error occurred");
          }
        } else {
          toast.error("Network error. Please try again.");
        }

        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // Auth Endpoints
  // ============================================
  login(credentials: { email: string; password: string }) {
    return this.api.post("/auth/login", credentials);
  }

  register(userData: any) {
    return this.api.post("/auth/register", userData);
  }

  logout() {
    return this.api.post("/auth/logout");
  }

  getCurrentUser() {
    return this.api.get("/auth/me");
  }

  verifyEmail(token: string) {
    return this.api.post("/auth/verify-email", { token });
  }

  forgotPassword(email: string) {
    return this.api.post("/auth/forgot-password", { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.api.post("/auth/reset-password", { token, newPassword });
  }

  // ============================================
  // Users, Appointments, Records, Admin, Billing...
  // (NO CHANGES NEEDED — Only the baseURL was wrong)
  // ============================================
  getProfile() { return this.api.get('/users/profile'); }
  updateProfile(data: any) { return this.api.put('/users/profile', data); }
  uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('profileImage', file);
    return this.api.post('/users/upload-profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  getDoctors(params?: any) { return this.api.get('/users/doctors', { params }); }
  getDoctorDetails(id: string) { return this.api.get(`/users/doctors/${id}`); }

  getPatients(params?: any) { return this.api.get('/users/patients', { params }); }

  createAppointment(data: any) { return this.api.post('/appointments', data); }
  getAppointments(params?: any) { return this.api.get('/appointments', { params }); }
  getAppointmentDetails(id: string) { return this.api.get(`/appointments/${id}`); }

  updateAppointmentStatus(id: string, status: string, notes?: string) {
    return this.api.put(`/appointments/${id}/status`, { status, notes });
  }
  cancelAppointment(id: string) { return this.api.delete(`/appointments/${id}`); }

  createVideoRoom(appointmentId: string) {
    return this.api.post('/video/create-room', { appointmentId });
  }
  getVideoRoom(id: string) { return this.api.get(`/video/room/${id}`); }

  getHealthRecords(params?: any) { return this.api.get('/health-records', { params }); }
  getHealthRecordDetails(id: string) { return this.api.get(`/health-records/${id}`); }

  createPrescription(data: any) { return this.api.post('/prescriptions', data); }
  getPrescriptions(params?: any) { return this.api.get('/prescriptions', { params }); }

  // admin
  getAdminDashboard() { return this.api.get('/admin/dashboard'); }
  getAdminUsers(params?: any) { return this.api.get('/admin/users', { params }); }

}

const apiService = new ApiService();
export default apiService;
