export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'patient' | 'doctor' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  phoneVerified: boolean;
  profileImage?: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  userId: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  medicalHistory?: any;
  allergies?: any;
  currentMedications?: any;
  bloodType?: string;
  height?: number;
  weight?: number;
}

export interface Doctor {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string;
  bio?: string;
  consultationFee: number;
  experienceYears?: number;
  education?: any[];
  certifications?: any[];
  languages?: string[];
  availability?: any;
  isAvailable: boolean;
  rating: number;
  totalReviews: number;
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  type: 'consultation' | 'follow_up' | 'emergency' | 'routine_checkup';
  reasonForVisit?: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  consultationFee: number;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  startedAt?: string;
  endedAt?: string;
  notes?: string;
  meetingRoomId?: string;
  videoCallUrl?: string;
  createdAt: string;
  doctor?: {
    id: string;
    name: string;
    specialization: string;
    profileImage?: string;
  };
  patient?: {
    name: string;
    profileImage?: string;
    emergencyContact?: {
      name: string;
      phone: string;
    };
  };
}

export interface HealthRecord {
  id: string;
  recordType: 'lab_result' | 'imaging' | 'prescription' | 'note' | 'vaccination' | 'vital_signs' | 'other';
  title: string;
  description?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  vitalSigns?: any;
  labResults?: any;
  medicationsPrescribed?: any;
  recordDate: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
  doctor?: {
    name: string;
    email?: string;
  };
  patient?: {
    name: string;
    email?: string;
  };
}

export interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  quantity: number;
  refillsAllowed: number;
  refillsRemaining: number;
  prescribedDate: string;
  expiryDate: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  pharmacy?: {
    name: string;
    address: string;
    phone: string;
  };
  isControlledSubstance: boolean;
  sideEffects?: string;
  contraindications?: string;
  createdAt: string;
  doctor?: {
    name: string;
    profileImage?: string;
    email?: string;
  };
  patient?: {
    name: string;
    profileImage?: string;
    email?: string;
    phone?: string;
  };
}

export interface Billing {
  id: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  paymentMethod: 'credit_card' | 'debit_card' | 'bank_transfer' | 'insurance' | 'cash';
  transactionId?: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  lineItems?: any[];
  insuranceClaim?: any;
  createdAt: string;
  appointment?: {
    date: string;
    type: string;
    durationMinutes: number;
  };
  doctor?: {
    name: string;
  };
  patient?: {
    name: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'text' | 'image' | 'file' | 'prescription' | 'lab_result';
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentSize?: number;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface PaginationResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'patient' | 'doctor';
  dateOfBirth?: string;
  address?: string;
  specialization?: string;
  consultationFee?: number;
}

export interface VideoCallData {
  roomId: string;
  videoCallUrl: string;
  appointmentId: string;
  appointment: Appointment;
}
