import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { finalize } from 'rxjs';

import {
  AcademyEventDashboardItem,
  AttendanceStatus,
  DashboardResponse,
  FightFlowApi,
  FinancialStatus,
  RankDashboardItem,
  StudentDashboardItem,
  UserDashboardItem,
  UserRole
} from './fight-flow-api';
import { IconButtonComponent } from './shared/icon-button.component';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatTableModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconButtonComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly api = inject(FightFlowApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly dashboard = signal<DashboardResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isRouteLoading = signal(false);
  protected readonly isMobileViewport = signal(false);
  protected readonly isMobileMenuOpen = signal(false);
  protected readonly isLanguageMenuOpen = signal(false);
  protected readonly activeFilter = signal<'all' | 'ready' | 'overdue'>('all');
  protected readonly activeScreen = signal<AppScreen>('dashboard');
  protected readonly locale = signal<LocaleCode>('en-US');
  protected readonly text = computed(() => translations[this.locale()]);
  protected readonly displayedColumns = ['student', 'rank', 'progress', 'finance', 'actions'];
  protected readonly accountRoles: UserRole[] = ['User', 'Student', 'Teacher', 'Assistant'];
  protected readonly editingUserId = signal<string | null>(null);
  protected readonly editingBeltId = signal<string | null>(null);
  protected readonly editingEventId = signal<string | null>(null);
  protected readonly userModalMode = signal<CrudModalMode | null>(null);
  protected readonly beltModalMode = signal<CrudModalMode | null>(null);
  protected readonly eventModalMode = signal<CrudModalMode | null>(null);
  protected readonly viewingUser = signal<UserDashboardItem | null>(null);
  protected readonly viewingBelt = signal<RankDashboardItem | null>(null);
  protected readonly viewingEvent = signal<AcademyEventDashboardItem | null>(null);
  protected readonly confirmation = signal<ConfirmationRequest | null>(null);
  protected readonly languageOptions: ReadonlyArray<LanguageOption> = [
    { code: 'pt-BR', flag: '🇧🇷', label: 'Português BR' },
    { code: 'pt-PT', flag: '🇵🇹', label: 'Português PT' },
    { code: 'es-ES', flag: '🇪🇸', label: 'Español' },
    { code: 'en-US', flag: '🇺🇸', label: 'English' }
  ];
  protected readonly currentLanguage = computed(() =>
    this.languageOptions.find(language => language.code === this.locale()) ?? this.languageOptions[0]
  );

  protected readonly attendanceForm = this.formBuilder.nonNullable.group({
    studentId: ['', Validators.required],
    status: ['Present', Validators.required],
    technicalNotes: ['']
  });

  protected readonly userForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['Student' as UserRole, Validators.required]
  });

  protected readonly beltForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    sortOrder: [1, Validators.required],
    beltColor: ['#E61919', Validators.required],
    requiredAttendanceCount: [0, Validators.required]
  });

  protected readonly eventForm = this.formBuilder.nonNullable.group({
    title: ['', Validators.required],
    startsAt: [this.toDateInputValue(new Date()), Validators.required],
    location: [''],
    description: ['']
  });

  public constructor() {
    this.syncMobileViewport();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isRouteLoading.set(true);
      }

      if (event instanceof NavigationEnd) {
        this.setActiveScreenFromUrl(event.urlAfterRedirects);
        this.closeMobileMenu();
        this.loadDashboard();
      }

      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.isRouteLoading.set(false);
      }
    });
  }

  protected readonly visibleStudents = computed(() => {
    const dashboard = this.dashboard();
    if (!dashboard) {
      return [];
    }

    const filter = this.activeFilter();
    return dashboard.students.filter(student => {
      if (!student.isActive) {
        return false;
      }

      if (filter === 'ready') {
        return student.isPromotionReady;
      }

      if (filter === 'overdue') {
        return student.financialStatus === 'Overdue';
      }

      return true;
    });
  });

  protected readonly maxTrendCount = computed(() => {
    const counts = this.dashboard()?.attendanceTrend.map(item => item.presentCount) ?? [1];
    return Math.max(...counts, 1);
  });

  public ngOnInit(): void {
    this.setLocaleValue(this.locale());
    this.setActiveScreenFromUrl(this.router.url);
    this.loadDashboard();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileViewport();
  }

  protected setLocale(locale: LocaleCode): void {
    this.setLocaleValue(locale);
    this.isLanguageMenuOpen.set(false);
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(isOpen => !isOpen);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  protected toggleLanguageMenu(): void {
    this.isLanguageMenuOpen.update(isOpen => !isOpen);
  }

  protected recordAttendance(): void {
    if (this.attendanceForm.invalid) {
      this.attendanceForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.api.captureAttendance(this.attendanceForm.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: dashboard => {
          this.setDashboard(dashboard);
          this.attendanceForm.patchValue({ technicalNotes: '' });
          this.showMessage(this.text().messages.attendanceRecorded);
        },
        error: () => this.showMessage(this.text().messages.attendanceFailed)
      });
  }

  protected setFilter(filter: 'all' | 'ready' | 'overdue'): void {
    this.activeFilter.set(filter);
  }

  protected isScreen(screen: AppScreen): boolean {
    return this.activeScreen() === screen;
  }

  protected registerStudentAttendance(student: StudentDashboardItem): void {
    this.isSaving.set(true);
    this.api.captureAttendance({
      studentId: student.id,
      status: 'Present',
      technicalNotes: ''
    })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: dashboard => {
          this.setDashboard(dashboard);
          this.showMessage(this.text().messages.attendanceRecorded);
        },
        error: () => this.showMessage(this.text().messages.attendanceFailed)
      });
  }

  protected updateFinancialStatus(student: StudentDashboardItem): void {
    const status = student.financialStatus === 'Overdue' ? 'Current' : 'Overdue';
    this.isSaving.set(true);
    this.api.updateFinancialStatus(student.id, status)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.showMessage(this.text().messages.financeUpdated);
      },
      error: () => this.showMessage(this.text().messages.financeFailed)
    });
  }

  protected promoteStudent(student: StudentDashboardItem): void {
    this.requestConfirmation(
      'Promote student?',
      `Are you sure you want to promote ${student.fullName}?`,
      () => this.promoteStudentConfirmed(student)
    );
  }

  private promoteStudentConfirmed(student: StudentDashboardItem): void {
    this.isSaving.set(true);
    this.api.promoteStudent(student.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.showMessage(this.text().messages.studentPromoted);
      },
      error: () => this.showMessage(this.text().messages.promotionFailed)
    });
  }

  protected deactivateStudent(student: StudentDashboardItem): void {
    this.requestConfirmation(
      'Inactivate student?',
      `Are you sure you want to inactivate ${student.fullName}?`,
      () => {
        this.isSaving.set(true);
        this.api.deactivateStudent(student.id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: dashboard => {
              this.setDashboard(dashboard);
              this.showMessage('Student inactivated.');
            },
            error: () => this.showMessage('Student could not be inactivated.')
          });
      }
    );
  }

  protected createUser(): void {
    this.viewingUser.set(null);
    this.editingUserId.set(null);
    this.userForm.enable();
    this.userForm.reset({ fullName: '', email: '', role: 'Student' });
    this.userModalMode.set('create');
  }

  protected editUser(user: UserDashboardItem): void {
    this.viewingUser.set(user);
    this.editingUserId.set(user.id);
    this.userForm.enable();
    this.userForm.setValue({
      fullName: user.fullName,
      email: user.email,
      role: user.role
    });
    this.userModalMode.set('edit');
  }

  protected viewUser(user: UserDashboardItem): void {
    this.viewingUser.set(user);
    this.editingUserId.set(null);
    this.userForm.setValue({
      fullName: user.fullName,
      email: user.email,
      role: user.role
    });
    this.userForm.disable();
    this.userModalMode.set('view');
  }

  protected resetUserForm(): void {
    this.editingUserId.set(null);
    this.viewingUser.set(null);
    this.userModalMode.set(null);
    this.userForm.enable();
    this.userForm.reset({ fullName: '', email: '', role: 'Student' });
  }

  protected saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const request = this.userForm.getRawValue();
    const operation = this.editingUserId()
      ? this.api.updateUser(this.editingUserId()!, request)
      : this.api.createUser(request);

    this.isSaving.set(true);
    operation.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.resetUserForm();
        this.showMessage(this.text().messages.accountSaved);
      },
      error: () => this.showMessage(this.text().messages.accountFailed)
    });
  }

  protected setUserActive(user: UserDashboardItem, isActive: boolean): void {
    if (!isActive) {
      this.requestConfirmation(
        'Deactivate account?',
        `Are you sure you want to deactivate ${user.fullName}?`,
        () => this.setUserActiveConfirmed(user, false)
      );
      return;
    }

    this.setUserActiveConfirmed(user, isActive);
  }

  private setUserActiveConfirmed(user: UserDashboardItem, isActive: boolean): void {
    this.isSaving.set(true);
    this.api.setUserActive(user.id, isActive)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.showMessage(isActive ? this.text().messages.accountActivated : this.text().messages.accountDeactivated);
      },
      error: () => this.showMessage(this.text().messages.accountStatusFailed)
    });
  }

  protected resetUserPassword(user: UserDashboardItem): void {
    this.isSaving.set(true);
    this.api.resetUserPassword(user.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: dashboard => {
          this.setDashboard(dashboard);
          this.showMessage('Temporary password email sent.');
        },
        error: () => this.showMessage('Password reset could not be sent.')
      });
  }

  protected createBelt(): void {
    this.viewingBelt.set(null);
    this.resetBeltForm();
    this.beltModalMode.set('create');
  }

  protected editBelt(rank: RankDashboardItem): void {
    this.viewingBelt.set(rank);
    this.editingBeltId.set(rank.id);
    this.beltForm.enable();
    this.beltForm.setValue({
      name: rank.name,
      sortOrder: rank.sortOrder,
      beltColor: rank.beltColor,
      requiredAttendanceCount: rank.requiredAttendanceCount
    });
    this.beltModalMode.set('edit');
  }

  protected viewBelt(rank: RankDashboardItem): void {
    this.viewingBelt.set(rank);
    this.editingBeltId.set(null);
    this.beltForm.setValue({
      name: rank.name,
      sortOrder: rank.sortOrder,
      beltColor: rank.beltColor,
      requiredAttendanceCount: rank.requiredAttendanceCount
    });
    this.beltForm.disable();
    this.beltModalMode.set('view');
  }

  protected resetBeltForm(): void {
    const nextOrder = (this.dashboard()?.ranks.length ?? 0) + 1;
    this.editingBeltId.set(null);
    this.viewingBelt.set(null);
    this.beltModalMode.set(null);
    this.beltForm.enable();
    this.beltForm.reset({
      name: '',
      sortOrder: nextOrder,
      beltColor: '#E61919',
      requiredAttendanceCount: 0
    });
  }

  protected saveBelt(): void {
    if (this.beltForm.invalid) {
      this.beltForm.markAllAsTouched();
      return;
    }

    const request = this.beltForm.getRawValue();
    const operation = this.editingBeltId()
      ? this.api.updateBelt(this.editingBeltId()!, request)
      : this.api.createBelt(request);

    this.isSaving.set(true);
    operation.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.resetBeltForm();
        this.showMessage(this.text().messages.beltSaved);
      },
      error: () => this.showMessage(this.text().messages.beltFailed)
    });
  }

  protected deleteBelt(rank: RankDashboardItem): void {
    this.requestConfirmation(
      'Delete rank?',
      `Are you sure you want to delete ${rank.name}?`,
      () => this.deleteBeltConfirmed(rank)
    );
  }

  private deleteBeltConfirmed(rank: RankDashboardItem): void {
    this.isSaving.set(true);
    this.api.deleteBelt(rank.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.showMessage(this.text().messages.beltDeleted);
      },
      error: () => this.showMessage(this.text().messages.beltDeleteFailed)
    });
  }

  protected createEvent(): void {
    this.viewingEvent.set(null);
    this.resetEventForm();
    this.eventModalMode.set('create');
  }

  protected editEvent(event: AcademyEventDashboardItem): void {
    this.viewingEvent.set(event);
    this.editingEventId.set(event.id);
    this.eventForm.enable();
    this.eventForm.setValue({
      title: event.title,
      startsAt: event.startsAt,
      location: event.location,
      description: event.description
    });
    this.eventModalMode.set('edit');
  }

  protected viewEvent(event: AcademyEventDashboardItem): void {
    this.viewingEvent.set(event);
    this.editingEventId.set(null);
    this.eventForm.setValue({
      title: event.title,
      startsAt: event.startsAt,
      location: event.location,
      description: event.description
    });
    this.eventForm.disable();
    this.eventModalMode.set('view');
  }

  protected resetEventForm(): void {
    this.editingEventId.set(null);
    this.viewingEvent.set(null);
    this.eventModalMode.set(null);
    this.eventForm.enable();
    this.eventForm.reset({
      title: '',
      startsAt: this.toDateInputValue(new Date()),
      location: '',
      description: ''
    });
  }

  protected saveEvent(): void {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }

    const request = this.eventForm.getRawValue();
    const operation = this.editingEventId()
      ? this.api.updateEvent(this.editingEventId()!, request)
      : this.api.createEvent(request);

    this.isSaving.set(true);
    operation.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.resetEventForm();
        this.showMessage(this.text().messages.eventSaved);
      },
      error: () => this.showMessage(this.text().messages.eventFailed)
    });
  }

  protected deleteEvent(event: AcademyEventDashboardItem): void {
    this.requestConfirmation(
      'Delete event?',
      `Are you sure you want to delete ${event.title}?`,
      () => this.deleteEventConfirmed(event)
    );
  }

  private deleteEventConfirmed(event: AcademyEventDashboardItem): void {
    this.isSaving.set(true);
    this.api.deleteEvent(event.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
      next: dashboard => {
        this.setDashboard(dashboard);
        this.showMessage(this.text().messages.eventDeleted);
      },
      error: () => this.showMessage(this.text().messages.eventDeleteFailed)
    });
  }

  protected closeConfirmation(): void {
    this.confirmation.set(null);
  }

  protected confirmAction(): void {
    const confirmation = this.confirmation();
    this.confirmation.set(null);
    confirmation?.confirm();
  }

  protected trendHeight(presentCount: number): number {
    return Math.max((presentCount / this.maxTrendCount()) * 100, 6);
  }

  protected progressValue(student: StudentDashboardItem): number {
    return Math.min(Math.max(Number(student.progressPercent), 0), 100);
  }

  protected rankColor(rankName: string): string {
    const colors: Record<string, string> = {
      White: '#f5f5f5',
      Blue: '#2f6fed',
      Purple: '#7c3aed',
      Brown: '#8b5a2b',
      Black: '#d9d9d9'
    };

    return colors[rankName] ?? '#e61919';
  }

  protected toDateInputValue(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short'
    }).format(new Date(value));
  }

  protected formatAttendanceStatus(status: AttendanceStatus): string {
    return this.text().attendanceStatus[status];
  }

  protected formatFinancialStatus(status: FinancialStatus): string {
    return this.text().financialStatus[status];
  }

  protected formatRankName(rankName: string): string {
    const ranks = this.text().ranks as Record<string, string>;
    return ranks[rankName] ?? rankName;
  }

  protected financeActionLabel(student: StudentDashboardItem): string {
    const nextStatus = student.financialStatus === 'Overdue' ? 'Current' : 'Overdue';
    return this.formatFinancialStatus(nextStatus);
  }

  protected roleLabel(role: UserRole): string {
    return this.text().roles[role];
  }

  protected activeStatusLabel(isActive: boolean): string {
    return isActive ? this.text().management.active : this.text().management.inactive;
  }

  protected activeActionLabel(isActive: boolean): string {
    return isActive ? this.text().management.deactivate : this.text().management.activate;
  }

  protected creditsStudentsText(rank: RankDashboardItem): string {
    return this.text().management.creditsStudents
      .replace('{credits}', String(rank.requiredAttendanceCount))
      .replace('{students}', String(rank.studentCount));
  }

  protected eventLocation(location: string): string {
    return location || this.text().management.academyFallback;
  }

  protected activeUsers(users: UserDashboardItem[]): UserDashboardItem[] {
    return users.filter(user => user.isActive && (user.role === 'Student' || user.role === 'Teacher'));
  }

  protected activeEvents(events: AcademyEventDashboardItem[]): AcademyEventDashboardItem[] {
    return events.filter(event => event.isActive);
  }

  protected modalTitle(mode: CrudModalMode | null, entity: string): string {
    if (mode === 'view') {
      return `${entity} details`;
    }

    if (mode === 'edit') {
      return `Edit ${entity}`;
    }

    return `Add ${entity}`;
  }

  protected progressText(student: StudentDashboardItem): string {
    if (!student.nextRankName) {
      return this.text().students.topRank;
    }

    return this.text().students.progressToRank
      .replace('{count}', String(student.attendanceCountTowardNextRank))
      .replace('{required}', String(student.requiredAttendanceCount))
      .replace('{rank}', this.formatRankName(student.nextRankName));
  }

  private loadDashboard(): void {
    this.isLoading.set(true);
    this.api.getDashboard()
      .pipe(finalize(() => {
        this.isLoading.set(false);
        this.isRouteLoading.set(false);
      }))
      .subscribe({
        next: dashboard => this.setDashboard(dashboard),
        error: () => this.showMessage(this.text().messages.dashboardUnavailable)
      });
  }

  private setDashboard(dashboard: DashboardResponse): void {
    this.dashboard.set(dashboard);

    const selectedStudentId = this.attendanceForm.controls.studentId.value;
    const activeStudents = dashboard.students.filter(student => student.isActive);
    const selectedStudentStillActive = activeStudents.some(student => student.id === selectedStudentId);

    if (!selectedStudentStillActive && activeStudents.length > 0) {
      this.attendanceForm.patchValue({ studentId: activeStudents[0].id });
    }
  }

  private setActiveScreenFromUrl(url: string): void {
    const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '');
    const screen = (path || 'dashboard').split('/')[0] as AppScreen;
    const knownScreens: AppScreen[] = ['dashboard', 'students', 'attendance', 'ranks', 'accounts', 'belts', 'events'];

    this.activeScreen.set(knownScreens.includes(screen) ? screen : 'dashboard');
  }

  private syncMobileViewport(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    this.isMobileViewport.set(isMobile);

    if (!isMobile) {
      this.isMobileMenuOpen.set(false);
    }
  }

  private setLocaleValue(locale: LocaleCode): void {
    this.locale.set(locale);
    document.documentElement.lang = locale;
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, this.text().actions.close, { duration: 2600 });
  }

  private requestConfirmation(title: string, message: string, confirm: () => void): void {
    this.confirmation.set({ title, message, confirm });
  }
}

type LocaleCode = 'pt-BR' | 'pt-PT' | 'es-ES' | 'en-US';
type AppScreen = 'dashboard' | 'students' | 'attendance' | 'ranks' | 'accounts' | 'belts' | 'events';
type CrudModalMode = 'create' | 'edit' | 'view';

interface ConfirmationRequest {
  title: string;
  message: string;
  confirm: () => void;
}

interface LanguageOption {
  code: LocaleCode;
  flag: string;
  label: string;
}

const translations = {
  'en-US': {
    nav: {
      dashboard: 'Dashboard',
      students: 'Students',
      attendance: 'Attendance',
      ranks: 'Ranks',
      accounts: 'Accounts',
      belts: 'Belts',
      events: 'Events'
    },
    header: {
      eyebrow: 'White-label school operations',
      language: 'Language'
    },
    attendanceForm: {
      student: 'Student',
      status: 'Status',
      technicalNotes: 'Technical notes'
    },
    actions: {
      record: 'Record',
      promote: 'Promote',
      close: 'Close'
    },
    dashboard: {
      eyebrow: 'Operations cockpit',
      title: 'Academy pulse',
      subtitle: 'A cleaner view of attendance, payments, and promotion readiness for today.',
      attendanceRate: '7-day attendance rate',
      clearAccounts: 'Clear accounts',
      reviewQueue: 'Review queue',
      activeRoster: 'currently training',
      todaySession: 'checked in today',
      needsAttention: 'requires follow-up',
      readyForReview: 'ready to evaluate'
    },
    metrics: {
      activeStudents: 'Active students',
      presentToday: 'Present today',
      overduePayments: 'Overdue payments',
      promotionReady: 'Promotion ready'
    },
    attendance: {
      lastSevenDays: 'Last 7 days',
      flow: 'Attendance flow',
      flowSuffix: 'flow',
      history: 'Attendance history',
      recentLog: 'Recent log'
    },
    ranksSection: {
      label: 'Rank system',
      progression: 'Progression',
      required: '{count} attendance credits required'
    },
    students: {
      members: 'Members',
      roster: 'Student roster',
      filters: {
        all: 'All',
        ready: 'Ready',
        overdue: 'Overdue'
      },
      table: {
        student: 'Student',
        rank: 'Rank',
        progress: 'Progress',
        finance: 'Finance',
        actions: 'Actions'
      },
      yearsOld: '{age} years old',
      enrolled: 'enrolled {date}',
      progressToRank: '{count}/{required} to {rank}',
      topRank: 'Top configured rank'
    },
    attendanceStatus: {
      Present: 'Present',
      Absent: 'Absent',
      Excused: 'Excused'
    },
    financialStatus: {
      Current: 'Current',
      Overdue: 'Overdue'
    },
    ranks: {
      White: 'White',
      Blue: 'Blue',
      Purple: 'Purple',
      Brown: 'Brown',
      Black: 'Black'
    },
    roles: {
      User: 'User',
      Student: 'Student',
      Teacher: 'Teacher',
      Assistant: 'Assistant'
    },
    management: {
      birthdaysEyebrow: 'This month',
      birthdaysTitle: 'Birthdays',
      noBirthdays: 'No birthdays this month.',
      upcoming: 'Upcoming',
      academyEvents: 'Academy events',
      noEvents: 'No events registered.',
      registration: 'Registration',
      accounts: 'Accounts',
      fullName: 'Full name',
      email: 'Email',
      role: 'Role',
      create: 'Create',
      update: 'Update',
      clear: 'Clear',
      edit: 'Edit',
      delete: 'Delete',
      activate: 'Activate',
      deactivate: 'Deactivate',
      active: 'Active',
      inactive: 'Inactive',
      academySystem: 'Academy system',
      belts: 'Belts',
      name: 'Name',
      order: 'Order',
      requiredAttendance: 'Required attendance',
      color: 'Color',
      creditsStudents: '{credits} credits · {students} students',
      calendar: 'Calendar',
      title: 'Title',
      date: 'Date',
      location: 'Location',
      description: 'Description',
      academyFallback: 'Academy'
    },
    aria: {
      dashboardLink: 'FightFlow dashboard',
      primaryNavigation: 'Primary navigation',
      schoolMetrics: 'School metrics',
      overview: 'Attendance and rank overview',
      trend: 'Present students by day',
      filters: 'Student filters'
    },
    messages: {
      attendanceRecorded: 'Attendance recorded.',
      attendanceFailed: 'Attendance could not be recorded.',
      financeUpdated: 'Financial status updated.',
      financeFailed: 'Financial status could not be updated.',
      studentPromoted: 'Student promoted.',
      promotionFailed: 'Student could not be promoted.',
      dashboardUnavailable: 'Dashboard data is unavailable.',
      accountSaved: 'Account saved.',
      accountFailed: 'Account could not be saved.',
      accountActivated: 'Account activated.',
      accountDeactivated: 'Account deactivated.',
      accountStatusFailed: 'Account status could not be changed.',
      beltSaved: 'Belt saved.',
      beltFailed: 'Belt could not be saved.',
      beltDeleted: 'Belt deleted.',
      beltDeleteFailed: 'Belt could not be deleted.',
      eventSaved: 'Event saved.',
      eventFailed: 'Event could not be saved.',
      eventDeleted: 'Event deleted.',
      eventDeleteFailed: 'Event could not be deleted.'
    }
  },
  'pt-BR': {
    nav: {
      dashboard: 'Painel',
      students: 'Alunos',
      attendance: 'Presenças',
      ranks: 'Graduações',
      accounts: 'Contas',
      belts: 'Faixas',
      events: 'Eventos'
    },
    header: {
      eyebrow: 'Operação white-label da academia',
      language: 'Idioma'
    },
    attendanceForm: {
      student: 'Aluno',
      status: 'Status',
      technicalNotes: 'Notas técnicas'
    },
    actions: {
      record: 'Registrar',
      promote: 'Promover',
      close: 'Fechar'
    },
    dashboard: {
      eyebrow: 'Central de operação',
      title: 'Pulso da academia',
      subtitle: 'Uma visão mais clara de presenças, pagamentos e prontidão para graduação no dia.',
      attendanceRate: 'Taxa de presença em 7 dias',
      clearAccounts: 'Contas em dia',
      reviewQueue: 'Fila de avaliação',
      activeRoster: 'treinando atualmente',
      todaySession: 'presentes hoje',
      needsAttention: 'precisa de acompanhamento',
      readyForReview: 'pronto para avaliar'
    },
    metrics: {
      activeStudents: 'Alunos ativos',
      presentToday: 'Presentes hoje',
      overduePayments: 'Pagamentos em atraso',
      promotionReady: 'Prontos para graduação'
    },
    attendance: {
      lastSevenDays: 'Últimos 7 dias',
      flow: 'Fluxo de presenças',
      flowSuffix: 'fluxo',
      history: 'Histórico de presenças',
      recentLog: 'Registro recente'
    },
    ranksSection: {
      label: 'Sistema de graduações',
      progression: 'Progressão',
      required: '{count} créditos de presença necessários'
    },
    students: {
      members: 'Membros',
      roster: 'Lista de alunos',
      filters: {
        all: 'Todos',
        ready: 'Prontos',
        overdue: 'Em atraso'
      },
      table: {
        student: 'Aluno',
        rank: 'Faixa',
        progress: 'Progresso',
        finance: 'Financeiro',
        actions: 'Ações'
      },
      yearsOld: '{age} anos',
      enrolled: 'matrícula em {date}',
      progressToRank: '{count}/{required} para {rank}',
      topRank: 'Maior faixa configurada'
    },
    attendanceStatus: {
      Present: 'Presente',
      Absent: 'Ausente',
      Excused: 'Justificado'
    },
    financialStatus: {
      Current: 'Em dia',
      Overdue: 'Em atraso'
    },
    ranks: {
      White: 'Branca',
      Blue: 'Azul',
      Purple: 'Roxa',
      Brown: 'Marrom',
      Black: 'Preta'
    },
    roles: {
      User: 'Usuário',
      Student: 'Aluno',
      Teacher: 'Professor',
      Assistant: 'Assistente'
    },
    management: {
      birthdaysEyebrow: 'Este mês',
      birthdaysTitle: 'Aniversários',
      noBirthdays: 'Sem aniversários este mês.',
      upcoming: 'Próximos',
      academyEvents: 'Eventos da academia',
      noEvents: 'Nenhum evento registrado.',
      registration: 'Cadastro',
      accounts: 'Contas',
      fullName: 'Nome completo',
      email: 'E-mail',
      role: 'Perfil',
      create: 'Criar',
      update: 'Atualizar',
      clear: 'Limpar',
      edit: 'Editar',
      delete: 'Excluir',
      activate: 'Ativar',
      deactivate: 'Desativar',
      active: 'Ativo',
      inactive: 'Inativo',
      academySystem: 'Sistema da academia',
      belts: 'Faixas',
      name: 'Nome',
      order: 'Ordem',
      requiredAttendance: 'Presenças necessárias',
      color: 'Cor',
      creditsStudents: '{credits} créditos · {students} alunos',
      calendar: 'Calendário',
      title: 'Título',
      date: 'Data',
      location: 'Local',
      description: 'Descrição',
      academyFallback: 'Academia'
    },
    aria: {
      dashboardLink: 'Painel FightFlow',
      primaryNavigation: 'Navegação principal',
      schoolMetrics: 'Métricas da academia',
      overview: 'Visão de presenças e faixas',
      trend: 'Alunos presentes por dia',
      filters: 'Filtros de alunos'
    },
    messages: {
      attendanceRecorded: 'Presença registrada.',
      attendanceFailed: 'Não foi possível registrar a presença.',
      financeUpdated: 'Status financeiro atualizado.',
      financeFailed: 'Não foi possível atualizar o status financeiro.',
      studentPromoted: 'Aluno promovido.',
      promotionFailed: 'Não foi possível promover o aluno.',
      dashboardUnavailable: 'Os dados do painel não estão disponíveis.',
      accountSaved: 'Conta salva.',
      accountFailed: 'Não foi possível salvar a conta.',
      accountActivated: 'Conta ativada.',
      accountDeactivated: 'Conta desativada.',
      accountStatusFailed: 'Não foi possível alterar o status da conta.',
      beltSaved: 'Faixa salva.',
      beltFailed: 'Não foi possível salvar a faixa.',
      beltDeleted: 'Faixa excluída.',
      beltDeleteFailed: 'Não foi possível excluir a faixa.',
      eventSaved: 'Evento salvo.',
      eventFailed: 'Não foi possível salvar o evento.',
      eventDeleted: 'Evento excluído.',
      eventDeleteFailed: 'Não foi possível excluir o evento.'
    }
  },
  'pt-PT': {
    nav: {
      dashboard: 'Painel',
      students: 'Alunos',
      attendance: 'Presenças',
      ranks: 'Graduações',
      accounts: 'Contas',
      belts: 'Cintos',
      events: 'Eventos'
    },
    header: {
      eyebrow: 'Operação white-label da escola',
      language: 'Idioma'
    },
    attendanceForm: {
      student: 'Aluno',
      status: 'Estado',
      technicalNotes: 'Notas técnicas'
    },
    actions: {
      record: 'Registar',
      promote: 'Promover',
      close: 'Fechar'
    },
    dashboard: {
      eyebrow: 'Central de operação',
      title: 'Pulso da escola',
      subtitle: 'Uma visão mais clara de presenças, pagamentos e prontidão para graduação no dia.',
      attendanceRate: 'Taxa de presença em 7 dias',
      clearAccounts: 'Contas em dia',
      reviewQueue: 'Fila de avaliação',
      activeRoster: 'a treinar atualmente',
      todaySession: 'presentes hoje',
      needsAttention: 'precisa de acompanhamento',
      readyForReview: 'pronto para avaliar'
    },
    metrics: {
      activeStudents: 'Alunos ativos',
      presentToday: 'Presentes hoje',
      overduePayments: 'Pagamentos em atraso',
      promotionReady: 'Prontos para graduação'
    },
    attendance: {
      lastSevenDays: 'Últimos 7 dias',
      flow: 'Fluxo de presenças',
      flowSuffix: 'fluxo',
      history: 'Histórico de presenças',
      recentLog: 'Registo recente'
    },
    ranksSection: {
      label: 'Sistema de graduações',
      progression: 'Progressão',
      required: '{count} créditos de presença necessários'
    },
    students: {
      members: 'Membros',
      roster: 'Lista de alunos',
      filters: {
        all: 'Todos',
        ready: 'Prontos',
        overdue: 'Em atraso'
      },
      table: {
        student: 'Aluno',
        rank: 'Graduação',
        progress: 'Progresso',
        finance: 'Financeiro',
        actions: 'Ações'
      },
      yearsOld: '{age} anos',
      enrolled: 'inscrito em {date}',
      progressToRank: '{count}/{required} para {rank}',
      topRank: 'Maior graduação configurada'
    },
    attendanceStatus: {
      Present: 'Presente',
      Absent: 'Ausente',
      Excused: 'Justificado'
    },
    financialStatus: {
      Current: 'Em dia',
      Overdue: 'Em atraso'
    },
    ranks: {
      White: 'Branca',
      Blue: 'Azul',
      Purple: 'Roxa',
      Brown: 'Castanha',
      Black: 'Preta'
    },
    roles: {
      User: 'Utilizador',
      Student: 'Aluno',
      Teacher: 'Professor',
      Assistant: 'Assistente'
    },
    management: {
      birthdaysEyebrow: 'Este mês',
      birthdaysTitle: 'Aniversários',
      noBirthdays: 'Sem aniversários este mês.',
      upcoming: 'Próximos',
      academyEvents: 'Eventos da escola',
      noEvents: 'Nenhum evento registado.',
      registration: 'Registo',
      accounts: 'Contas',
      fullName: 'Nome completo',
      email: 'E-mail',
      role: 'Perfil',
      create: 'Criar',
      update: 'Atualizar',
      clear: 'Limpar',
      edit: 'Editar',
      delete: 'Eliminar',
      activate: 'Ativar',
      deactivate: 'Desativar',
      active: 'Ativo',
      inactive: 'Inativo',
      academySystem: 'Sistema da escola',
      belts: 'Graduações',
      name: 'Nome',
      order: 'Ordem',
      requiredAttendance: 'Presenças necessárias',
      color: 'Cor',
      creditsStudents: '{credits} créditos · {students} alunos',
      calendar: 'Calendário',
      title: 'Título',
      date: 'Data',
      location: 'Local',
      description: 'Descrição',
      academyFallback: 'Escola'
    },
    aria: {
      dashboardLink: 'Painel FightFlow',
      primaryNavigation: 'Navegação principal',
      schoolMetrics: 'Métricas da escola',
      overview: 'Visão de presenças e graduações',
      trend: 'Alunos presentes por dia',
      filters: 'Filtros de alunos'
    },
    messages: {
      attendanceRecorded: 'Presença registada.',
      attendanceFailed: 'Não foi possível registar a presença.',
      financeUpdated: 'Estado financeiro atualizado.',
      financeFailed: 'Não foi possível atualizar o estado financeiro.',
      studentPromoted: 'Aluno promovido.',
      promotionFailed: 'Não foi possível promover o aluno.',
      dashboardUnavailable: 'Os dados do painel não estão disponíveis.',
      accountSaved: 'Conta guardada.',
      accountFailed: 'Não foi possível guardar a conta.',
      accountActivated: 'Conta ativada.',
      accountDeactivated: 'Conta desativada.',
      accountStatusFailed: 'Não foi possível alterar o estado da conta.',
      beltSaved: 'Graduação guardada.',
      beltFailed: 'Não foi possível guardar a graduação.',
      beltDeleted: 'Graduação eliminada.',
      beltDeleteFailed: 'Não foi possível eliminar a graduação.',
      eventSaved: 'Evento guardado.',
      eventFailed: 'Não foi possível guardar o evento.',
      eventDeleted: 'Evento eliminado.',
      eventDeleteFailed: 'Não foi possível eliminar o evento.'
    }
  },
  'es-ES': {
    nav: {
      dashboard: 'Panel',
      students: 'Alumnos',
      attendance: 'Asistencia',
      ranks: 'Grados',
      accounts: 'Cuentas',
      belts: 'Cinturones',
      events: 'Eventos'
    },
    header: {
      eyebrow: 'Operación white-label de la escuela',
      language: 'Idioma'
    },
    attendanceForm: {
      student: 'Alumno',
      status: 'Estado',
      technicalNotes: 'Notas técnicas'
    },
    actions: {
      record: 'Registrar',
      promote: 'Promover',
      close: 'Cerrar'
    },
    dashboard: {
      eyebrow: 'Centro operativo',
      title: 'Pulso de la escuela',
      subtitle: 'Una vista más clara de asistencia, pagos y preparación para promociones de hoy.',
      attendanceRate: 'Tasa de asistencia de 7 días',
      clearAccounts: 'Cuentas al día',
      reviewQueue: 'Cola de revisión',
      activeRoster: 'entrenando actualmente',
      todaySession: 'presentes hoy',
      needsAttention: 'requiere seguimiento',
      readyForReview: 'listo para evaluar'
    },
    metrics: {
      activeStudents: 'Alumnos activos',
      presentToday: 'Presentes hoy',
      overduePayments: 'Pagos atrasados',
      promotionReady: 'Listos para promoción'
    },
    attendance: {
      lastSevenDays: 'Últimos 7 días',
      flow: 'Flujo de asistencia',
      flowSuffix: 'flujo',
      history: 'Historial de asistencia',
      recentLog: 'Registro reciente'
    },
    ranksSection: {
      label: 'Sistema de grados',
      progression: 'Progresión',
      required: '{count} créditos de asistencia requeridos'
    },
    students: {
      members: 'Miembros',
      roster: 'Lista de alumnos',
      filters: {
        all: 'Todos',
        ready: 'Listos',
        overdue: 'Atrasados'
      },
      table: {
        student: 'Alumno',
        rank: 'Grado',
        progress: 'Progreso',
        finance: 'Finanzas',
        actions: 'Acciones'
      },
      yearsOld: '{age} años',
      enrolled: 'inscrito el {date}',
      progressToRank: '{count}/{required} para {rank}',
      topRank: 'Grado máximo configurado'
    },
    attendanceStatus: {
      Present: 'Presente',
      Absent: 'Ausente',
      Excused: 'Justificado'
    },
    financialStatus: {
      Current: 'Al día',
      Overdue: 'Atrasado'
    },
    ranks: {
      White: 'Blanco',
      Blue: 'Azul',
      Purple: 'Morado',
      Brown: 'Marrón',
      Black: 'Negro'
    },
    roles: {
      User: 'Usuario',
      Student: 'Alumno',
      Teacher: 'Profesor',
      Assistant: 'Asistente'
    },
    management: {
      birthdaysEyebrow: 'Este mes',
      birthdaysTitle: 'Cumpleaños',
      noBirthdays: 'No hay cumpleaños este mes.',
      upcoming: 'Próximos',
      academyEvents: 'Eventos de la escuela',
      noEvents: 'No hay eventos registrados.',
      registration: 'Registro',
      accounts: 'Cuentas',
      fullName: 'Nombre completo',
      email: 'E-mail',
      role: 'Perfil',
      create: 'Crear',
      update: 'Actualizar',
      clear: 'Limpiar',
      edit: 'Editar',
      delete: 'Eliminar',
      activate: 'Activar',
      deactivate: 'Desactivar',
      active: 'Activo',
      inactive: 'Inactivo',
      academySystem: 'Sistema de la escuela',
      belts: 'Cinturones',
      name: 'Nombre',
      order: 'Orden',
      requiredAttendance: 'Asistencias necesarias',
      color: 'Color',
      creditsStudents: '{credits} créditos · {students} alumnos',
      calendar: 'Calendario',
      title: 'Título',
      date: 'Fecha',
      location: 'Lugar',
      description: 'Descripción',
      academyFallback: 'Escuela'
    },
    aria: {
      dashboardLink: 'Panel FightFlow',
      primaryNavigation: 'Navegación principal',
      schoolMetrics: 'Métricas de la escuela',
      overview: 'Vista de asistencia y rangos',
      trend: 'Alumnos presentes por día',
      filters: 'Filtros de alumnos'
    },
    messages: {
      attendanceRecorded: 'Asistencia registrada.',
      attendanceFailed: 'No se pudo registrar la asistencia.',
      financeUpdated: 'Estado financiero actualizado.',
      financeFailed: 'No se pudo actualizar el estado financiero.',
      studentPromoted: 'Alumno promovido.',
      promotionFailed: 'No se pudo promover al alumno.',
      dashboardUnavailable: 'Los datos del panel no están disponibles.',
      accountSaved: 'Cuenta guardada.',
      accountFailed: 'No se pudo guardar la cuenta.',
      accountActivated: 'Cuenta activada.',
      accountDeactivated: 'Cuenta desactivada.',
      accountStatusFailed: 'No se pudo cambiar el estado de la cuenta.',
      beltSaved: 'Rango guardado.',
      beltFailed: 'No se pudo guardar el rango.',
      beltDeleted: 'Rango eliminado.',
      beltDeleteFailed: 'No se pudo eliminar el rango.',
      eventSaved: 'Evento guardado.',
      eventFailed: 'No se pudo guardar el evento.',
      eventDeleted: 'Evento eliminado.',
      eventDeleteFailed: 'No se pudo eliminar el evento.'
    }
  }
} as const;
