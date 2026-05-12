import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FightFlowApi {
  private readonly http = inject(HttpClient);

  public getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>('/api/dashboard');
  }

  public captureAttendance(request: AttendanceCaptureRequest): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>('/api/attendance', request);
  }

  public updateFinancialStatus(studentId: string, status: FinancialStatus): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>(`/api/students/${studentId}/financial-status`, { status });
  }

  public promoteStudent(studentId: string): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>(`/api/students/${studentId}/promote`, {});
  }

  public createUser(request: UserSaveRequest): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>('/api/users', request);
  }

  public updateUser(userId: string, request: UserSaveRequest): Observable<DashboardResponse> {
    return this.http.put<DashboardResponse>(`/api/users/${userId}`, request);
  }

  public setUserActive(userId: string, isActive: boolean): Observable<DashboardResponse> {
    const action = isActive ? 'activate' : 'deactivate';
    return this.http.post<DashboardResponse>(`/api/users/${userId}/${action}`, {});
  }

  public createBelt(request: BeltSaveRequest): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>('/api/belts', request);
  }

  public updateBelt(beltId: string, request: BeltSaveRequest): Observable<DashboardResponse> {
    return this.http.put<DashboardResponse>(`/api/belts/${beltId}`, request);
  }

  public deleteBelt(beltId: string): Observable<DashboardResponse> {
    return this.http.delete<DashboardResponse>(`/api/belts/${beltId}`);
  }

  public createEvent(request: EventSaveRequest): Observable<DashboardResponse> {
    return this.http.post<DashboardResponse>('/api/events', request);
  }

  public updateEvent(eventId: string, request: EventSaveRequest): Observable<DashboardResponse> {
    return this.http.put<DashboardResponse>(`/api/events/${eventId}`, request);
  }

  public deleteEvent(eventId: string): Observable<DashboardResponse> {
    return this.http.delete<DashboardResponse>(`/api/events/${eventId}`);
  }
}

export interface AttendanceCaptureRequest {
  studentId: string;
  status: string;
  technicalNotes: string;
}

export interface DashboardResponse {
  tenant: TenantDashboardItem;
  metrics: MetricsDashboardItem;
  students: StudentDashboardItem[];
  recentAttendance: AttendanceDashboardItem[];
  ranks: RankDashboardItem[];
  attendanceTrend: AttendanceTrendItem[];
  users: UserDashboardItem[];
  birthdaysThisMonth: BirthdayDashboardItem[];
  events: AcademyEventDashboardItem[];
}

export interface TenantDashboardItem {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCulture: string;
}

export interface MetricsDashboardItem {
  activeStudents: number;
  attendanceToday: number;
  overduePayments: number;
  promotionsReady: number;
  sevenDayAttendanceRate: number;
}

export interface StudentDashboardItem {
  id: string;
  fullName: string;
  initials: string;
  age: number;
  enrollmentDate: string;
  currentRankName: string;
  beltColor: string;
  nextRankName: string | null;
  requiredAttendanceCount: number;
  attendanceCountTowardNextRank: number;
  progressPercent: number;
  financialStatus: FinancialStatus;
  isActive: boolean;
  isPromotionReady: boolean;
}

export interface AttendanceDashboardItem {
  id: string;
  studentId: string;
  studentName: string;
  occurredAtUtc: string;
  status: AttendanceStatus;
  professorName: string;
  technicalNotes: string;
}

export interface RankDashboardItem {
  id: string;
  name: string;
  sortOrder: number;
  beltColor: string;
  requiredAttendanceCount: number;
  studentCount: number;
}

export interface AttendanceTrendItem {
  label: string;
  presentCount: number;
}

export interface UserDashboardItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
}

export interface BirthdayDashboardItem {
  studentId: string;
  fullName: string;
  birthDate: string;
  age: number;
}

export interface AcademyEventDashboardItem {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  description: string;
  isActive: boolean;
}

export interface UserSaveRequest {
  fullName: string;
  email: string;
  role: UserRole;
}

export interface BeltSaveRequest {
  name: string;
  sortOrder: number;
  beltColor: string;
  requiredAttendanceCount: number;
}

export interface EventSaveRequest {
  title: string;
  startsAt: string;
  location: string;
  description: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Excused';
export type FinancialStatus = 'Current' | 'Overdue';
export type UserRole = 'User' | 'Student' | 'Teacher' | 'Assistant';
