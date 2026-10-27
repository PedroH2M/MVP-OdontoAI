export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

export interface Dentist {
  id: string;
  name: string;
  cro: string;
  specialty: string;
  color: string;
}

export interface Procedure {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface Clinic {
  id: string;
  name: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
  brandColor: string;
  acceptedInsurances: string[];
  aiAssistantName: string;
  aiCustomRules: string;
  isBotActive: boolean;
  dentists: Dentist[];
  procedures: Procedure[];
}

export interface AppointmentItem {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  bookedByAi: boolean;
  reminderSent: boolean;
  notes?: string;
  patient: { id: string; name: string; phone: string; insuranceName?: string };
  dentist: Dentist;
  procedure: Procedure;
}

export interface MessageItem {
  id: string;
  sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF';
  content: string;
  mediaType: string;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  status: 'AI_HANDLING' | 'WAITING_HUMAN' | 'HUMAN_HANDLING' | 'RESOLVED';
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  handoffReason?: string | null;
  lastMessageAt: string;
  patient: { id: string; name: string; phone: string; insuranceName?: string };
  messages: MessageItem[];
}

export interface AvailableSlot {
  dentistId: string;
  dentistName: string;
  specialty: string;
  startTime: string;
  endTime: string;
}
