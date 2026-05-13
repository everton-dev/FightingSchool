using System.Globalization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton<FightFlowStore>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularDev", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AngularDev");

RouteGroupBuilder api = app.MapGroup("/api");

api.MapGet("/dashboard", (FightFlowStore store) => store.GetDashboard())
    .WithName("GetDashboard");

api.MapPost("/attendance", (FightFlowStore store, AttendanceCaptureRequest request) =>
{
    AttendanceCaptureResult result = store.CaptureAttendance(request);
    return result.Success
        ? Results.Ok(result.Dashboard)
        : Results.BadRequest(new ProblemDetails(result.Message));
})
.WithName("CaptureAttendance");

api.MapPost("/students/{studentId:guid}/financial-status", (
    FightFlowStore store,
    Guid studentId,
    FinancialStatusUpdateRequest request) =>
{
    StudentActionResult result = store.UpdateFinancialStatus(studentId, request.Status);
    return result.Success
        ? Results.Ok(result.Dashboard)
        : Results.BadRequest(new ProblemDetails(result.Message));
})
.WithName("UpdateStudentFinancialStatus");

api.MapPost("/students/{studentId:guid}/promote", (FightFlowStore store, Guid studentId) =>
{
    StudentActionResult result = store.PromoteStudent(studentId);
    return result.Success
        ? Results.Ok(result.Dashboard)
        : Results.BadRequest(new ProblemDetails(result.Message));
})
.WithName("PromoteStudent");

api.MapPost("/students/{studentId:guid}/deactivate", (FightFlowStore store, Guid studentId) =>
{
    StudentActionResult result = store.DeactivateStudent(studentId);
    return result.Success
        ? Results.Ok(result.Dashboard)
        : Results.BadRequest(new ProblemDetails(result.Message));
})
.WithName("DeactivateStudent");

api.MapPost("/users", (FightFlowStore store, UserSaveRequest request) => ToResult(store.CreateUser(request)))
    .WithName("CreateUser");

api.MapPut("/users/{userId:guid}", (FightFlowStore store, Guid userId, UserSaveRequest request) => ToResult(store.UpdateUser(userId, request)))
    .WithName("UpdateUser");

api.MapPost("/users/{userId:guid}/deactivate", (FightFlowStore store, Guid userId) => ToResult(store.DeactivateUser(userId)))
    .WithName("DeactivateUser");

api.MapPost("/users/{userId:guid}/activate", (FightFlowStore store, Guid userId) => ToResult(store.ActivateUser(userId)))
    .WithName("ActivateUser");

api.MapPost("/users/{userId:guid}/reset-password", (FightFlowStore store, Guid userId) => ToResult(store.ResetUserPassword(userId)))
    .WithName("ResetUserPassword");

api.MapPost("/belts", (FightFlowStore store, BeltSaveRequest request) => ToResult(store.CreateBelt(request)))
    .WithName("CreateBelt");

api.MapPut("/belts/{beltId:guid}", (FightFlowStore store, Guid beltId, BeltSaveRequest request) => ToResult(store.UpdateBelt(beltId, request)))
    .WithName("UpdateBelt");

api.MapDelete("/belts/{beltId:guid}", (FightFlowStore store, Guid beltId) => ToResult(store.DeleteBelt(beltId)))
    .WithName("DeleteBelt");

api.MapPost("/events", (FightFlowStore store, EventSaveRequest request) => ToResult(store.CreateEvent(request)))
    .WithName("CreateEvent");

api.MapPut("/events/{eventId:guid}", (FightFlowStore store, Guid eventId, EventSaveRequest request) => ToResult(store.UpdateEvent(eventId, request)))
    .WithName("UpdateEvent");

api.MapDelete("/events/{eventId:guid}", (FightFlowStore store, Guid eventId) => ToResult(store.DeleteEvent(eventId)))
    .WithName("DeleteEvent");

app.Run();

static IResult ToResult(StoreActionResult result)
{
    return result.Success
        ? Results.Ok(result.Dashboard)
        : Results.BadRequest(new ProblemDetails(result.Message));
}

internal sealed class FightFlowStore
{
    private readonly object sync = new();
    private readonly TenantState tenant = new(
        Guid.Parse("af3c3c48-7c1a-4d80-a72c-f4f9cb4036a4"),
        "FightFlow Lisbon",
        "fightflow-lisbon",
        "#0F766E",
        "#F97316",
        "en");

    private readonly List<RankState> ranks = [];
    private readonly List<StudentState> students = [];
    private readonly List<AttendanceState> attendances = [];
    private readonly List<UserState> users = [];
    private readonly List<AcademyEventState> events = [];

    public FightFlowStore()
    {
        SeedRanks();
        SeedStudents();
        SeedUsers();
        SeedAttendance();
        SeedEvents();
    }

    public DashboardResponse GetDashboard()
    {
        lock (sync)
        {
            return BuildDashboard();
        }
    }

    public AttendanceCaptureResult CaptureAttendance(AttendanceCaptureRequest request)
    {
        lock (sync)
        {
            StudentState? student = students.FirstOrDefault(item => item.Id == request.StudentId && item.IsActive);
            if (student is null)
            {
                return AttendanceCaptureResult.Fail("Active student was not found.");
            }

            string status = NormalizeAttendanceStatus(request.Status);
            if (status.Length == 0)
            {
                return AttendanceCaptureResult.Fail("Attendance status must be Present, Absent, or Excused.");
            }

            AttendanceState attendance = new(
                Guid.NewGuid(),
                student.Id,
                DateTime.UtcNow,
                status,
                "Marta Silva",
                TrimOptional(request.TechnicalNotes, 500));

            attendances.Insert(0, attendance);

            if (status == AttendanceStatuses.Present)
            {
                student.AttendanceCountTowardNextRank++;
            }

            return AttendanceCaptureResult.Ok(BuildDashboard());
        }
    }

    public StudentActionResult UpdateFinancialStatus(Guid studentId, string? status)
    {
        lock (sync)
        {
            StudentState? student = students.FirstOrDefault(item => item.Id == studentId);
            if (student is null)
            {
                return StudentActionResult.Fail("Student was not found.");
            }

            string normalizedStatus = NormalizeFinancialStatus(status);
            if (normalizedStatus.Length == 0)
            {
                return StudentActionResult.Fail("Financial status must be Current or Overdue.");
            }

            student.FinancialStatus = normalizedStatus;
            return StudentActionResult.Ok(BuildDashboard());
        }
    }

    public StudentActionResult PromoteStudent(Guid studentId)
    {
        lock (sync)
        {
            StudentState? student = students.FirstOrDefault(item => item.Id == studentId);
            if (student is null)
            {
                return StudentActionResult.Fail("Student was not found.");
            }

            RankState? currentRank = ranks.FirstOrDefault(item => item.Id == student.CurrentRankId);
            if (currentRank is null)
            {
                return StudentActionResult.Fail("Student rank was not found.");
            }

            RankState? nextRank = ranks
                .Where(item => item.SortOrder > currentRank.SortOrder)
                .OrderBy(item => item.SortOrder)
                .FirstOrDefault();

            if (nextRank is null)
            {
                return StudentActionResult.Fail("Student is already at the highest configured rank.");
            }

            int requiredAttendance = Math.Max(nextRank.RequiredAttendanceCount, 1);
            if (student.AttendanceCountTowardNextRank < requiredAttendance)
            {
                return StudentActionResult.Fail("Student has not reached the attendance requirement for promotion.");
            }

            student.CurrentRankId = nextRank.Id;
            student.AttendanceCountTowardNextRank = 0;

            attendances.Insert(0, new AttendanceState(
                Guid.NewGuid(),
                student.Id,
                DateTime.UtcNow,
                AttendanceStatuses.Present,
                "Marta Silva",
                $"Promoted to {nextRank.Name}."));

            return StudentActionResult.Ok(BuildDashboard());
        }
    }

    public StudentActionResult DeactivateStudent(Guid studentId)
    {
        lock (sync)
        {
            StudentState? student = students.FirstOrDefault(item => item.Id == studentId);
            if (student is null)
            {
                return StudentActionResult.Fail("Student was not found.");
            }

            student.IsActive = false;
            return StudentActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult CreateUser(UserSaveRequest request)
    {
        lock (sync)
        {
            string role = NormalizeUserRole(request.Role);
            if (role.Length == 0)
            {
                return StoreActionResult.Fail("Role must be Student, Teacher, Assistant, or User.");
            }

            string fullName = TrimOptional(request.FullName, 160);
            string email = TrimOptional(request.Email, 256).ToLowerInvariant();
            if (fullName.Length == 0 || email.Length == 0 || !email.Contains('@', StringComparison.Ordinal))
            {
                return StoreActionResult.Fail("Full name and a valid email are required.");
            }

            if (users.Any(user => user.Email == email))
            {
                return StoreActionResult.Fail("A user with this email already exists.");
            }

            users.Add(new UserState(Guid.NewGuid(), fullName, email, role, DateOnly.FromDateTime(DateTime.UtcNow), true));
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult UpdateUser(Guid userId, UserSaveRequest request)
    {
        lock (sync)
        {
            UserState? user = users.FirstOrDefault(item => item.Id == userId);
            if (user is null)
            {
                return StoreActionResult.Fail("User was not found.");
            }

            string role = NormalizeUserRole(request.Role);
            string fullName = TrimOptional(request.FullName, 160);
            string email = TrimOptional(request.Email, 256).ToLowerInvariant();
            if (role.Length == 0 || fullName.Length == 0 || email.Length == 0 || !email.Contains('@', StringComparison.Ordinal))
            {
                return StoreActionResult.Fail("Full name, email, and role are required.");
            }

            if (users.Any(item => item.Id != userId && item.Email == email))
            {
                return StoreActionResult.Fail("A user with this email already exists.");
            }

            user.FullName = fullName;
            user.Email = email;
            user.Role = role;
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult DeactivateUser(Guid userId)
    {
        lock (sync)
        {
            UserState? user = users.FirstOrDefault(item => item.Id == userId);
            if (user is null)
            {
                return StoreActionResult.Fail("User was not found.");
            }

            user.IsActive = false;
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult ActivateUser(Guid userId)
    {
        lock (sync)
        {
            UserState? user = users.FirstOrDefault(item => item.Id == userId);
            if (user is null)
            {
                return StoreActionResult.Fail("User was not found.");
            }

            user.IsActive = true;
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult ResetUserPassword(Guid userId)
    {
        lock (sync)
        {
            UserState? user = users.FirstOrDefault(item => item.Id == userId);
            if (user is null)
            {
                return StoreActionResult.Fail("User was not found.");
            }

            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult CreateBelt(BeltSaveRequest request)
    {
        lock (sync)
        {
            string name = TrimOptional(request.Name, 120);
            string color = NormalizeHexColor(request.BeltColor);
            int requiredAttendanceCount = Math.Max(request.RequiredAttendanceCount, 0);
            int sortOrder = request.SortOrder <= 0 ? ranks.Count + 1 : request.SortOrder;

            if (name.Length == 0 || color.Length == 0)
            {
                return StoreActionResult.Fail("Belt name and color are required.");
            }

            if (ranks.Any(rank => rank.SortOrder == sortOrder))
            {
                return StoreActionResult.Fail("Another belt already uses this sort order.");
            }

            ranks.Add(new RankState(Guid.NewGuid(), name, sortOrder, color, requiredAttendanceCount));
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult UpdateBelt(Guid beltId, BeltSaveRequest request)
    {
        lock (sync)
        {
            RankState? rank = ranks.FirstOrDefault(item => item.Id == beltId);
            if (rank is null)
            {
                return StoreActionResult.Fail("Belt was not found.");
            }

            string name = TrimOptional(request.Name, 120);
            string color = NormalizeHexColor(request.BeltColor);
            int requiredAttendanceCount = Math.Max(request.RequiredAttendanceCount, 0);
            int sortOrder = request.SortOrder <= 0 ? rank.SortOrder : request.SortOrder;

            if (name.Length == 0 || color.Length == 0)
            {
                return StoreActionResult.Fail("Belt name and color are required.");
            }

            if (ranks.Any(item => item.Id != beltId && item.SortOrder == sortOrder))
            {
                return StoreActionResult.Fail("Another belt already uses this sort order.");
            }

            rank.Name = name;
            rank.SortOrder = sortOrder;
            rank.BeltColor = color;
            rank.RequiredAttendanceCount = requiredAttendanceCount;
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult DeleteBelt(Guid beltId)
    {
        lock (sync)
        {
            RankState? rank = ranks.FirstOrDefault(item => item.Id == beltId);
            if (rank is null)
            {
                return StoreActionResult.Fail("Belt was not found.");
            }

            if (students.Any(student => student.CurrentRankId == beltId))
            {
                return StoreActionResult.Fail("This belt is assigned to students and cannot be deleted.");
            }

            ranks.Remove(rank);
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult CreateEvent(EventSaveRequest request)
    {
        lock (sync)
        {
            string title = TrimOptional(request.Title, 160);
            string location = TrimOptional(request.Location, 160);
            string description = TrimOptional(request.Description, 500);
            if (title.Length == 0)
            {
                return StoreActionResult.Fail("Event title is required.");
            }

            events.Add(new AcademyEventState(Guid.NewGuid(), title, request.StartsAt, location, description, true));
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult UpdateEvent(Guid eventId, EventSaveRequest request)
    {
        lock (sync)
        {
            AcademyEventState? academyEvent = events.FirstOrDefault(item => item.Id == eventId);
            if (academyEvent is null)
            {
                return StoreActionResult.Fail("Event was not found.");
            }

            string title = TrimOptional(request.Title, 160);
            if (title.Length == 0)
            {
                return StoreActionResult.Fail("Event title is required.");
            }

            academyEvent.Title = title;
            academyEvent.StartsAt = request.StartsAt;
            academyEvent.Location = TrimOptional(request.Location, 160);
            academyEvent.Description = TrimOptional(request.Description, 500);
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    public StoreActionResult DeleteEvent(Guid eventId)
    {
        lock (sync)
        {
            AcademyEventState? academyEvent = events.FirstOrDefault(item => item.Id == eventId);
            if (academyEvent is null)
            {
                return StoreActionResult.Fail("Event was not found.");
            }

            events.Remove(academyEvent);
            return StoreActionResult.Ok(BuildDashboard());
        }
    }

    private DashboardResponse BuildDashboard()
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        int activeStudents = students.Count(student => student.IsActive);
        int attendanceToday = attendances.Count(attendance => DateOnly.FromDateTime(attendance.OccurredAtUtc) == today
            && attendance.Status == AttendanceStatuses.Present);
        int overduePayments = students.Count(student => student.FinancialStatus == FinancialStatuses.Overdue);

        List<StudentDashboardItem> studentItems = students
            .OrderByDescending(student => student.IsActive)
            .ThenBy(student => student.FullName)
            .Select(ToStudentDashboardItem)
            .ToList();

        int promotionsReady = studentItems.Count(student => student.IsPromotionReady);
        IReadOnlyList<AttendanceTrendItem> trend = BuildAttendanceTrend();

        IReadOnlyList<AttendanceDashboardItem> recentAttendance = attendances
            .OrderByDescending(attendance => attendance.OccurredAtUtc)
            .Take(10)
            .Select(attendance =>
            {
                StudentState? student = students.FirstOrDefault(item => item.Id == attendance.StudentId);
                return new AttendanceDashboardItem(
                    attendance.Id,
                    attendance.StudentId,
                    student?.FullName ?? "Unknown student",
                    attendance.OccurredAtUtc,
                    attendance.Status,
                    attendance.ProfessorName,
                    attendance.TechnicalNotes);
            })
            .ToList();

        IReadOnlyList<RankDashboardItem> rankItems = ranks
            .OrderBy(rank => rank.SortOrder)
            .Select(rank => new RankDashboardItem(
                rank.Id,
                rank.Name,
                rank.SortOrder,
                rank.BeltColor,
                rank.RequiredAttendanceCount,
                students.Count(student => student.CurrentRankId == rank.Id)))
            .ToList();

        IReadOnlyList<UserDashboardItem> userItems = users
            .OrderByDescending(user => user.IsActive)
            .ThenBy(user => user.Role)
            .ThenBy(user => user.FullName)
            .Select(user => new UserDashboardItem(
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.CreatedAt,
                user.IsActive))
            .ToList();

        IReadOnlyList<BirthdayDashboardItem> birthdayItems = students
            .Where(student => student.BirthDate.Month == today.Month)
            .OrderBy(student => student.BirthDate.Day)
            .Select(student => new BirthdayDashboardItem(
                student.Id,
                student.FullName,
                student.BirthDate,
                CalculateAge(student.BirthDate)))
            .ToList();

        IReadOnlyList<AcademyEventDashboardItem> eventItems = events
            .OrderBy(item => item.StartsAt)
            .Select(item => new AcademyEventDashboardItem(
                item.Id,
                item.Title,
                item.StartsAt,
                item.Location,
                item.Description,
                item.IsActive))
            .ToList();

        return new DashboardResponse(
            new TenantDashboardItem(
                tenant.Id,
                tenant.Name,
                tenant.Slug,
                tenant.PrimaryColor,
                tenant.SecondaryColor,
                tenant.DefaultCulture),
            new MetricsDashboardItem(
                activeStudents,
                attendanceToday,
                overduePayments,
                promotionsReady,
                CalculateAttendanceRate(trend)),
            studentItems,
            recentAttendance,
            rankItems,
            trend,
            userItems,
            birthdayItems,
            eventItems);
    }

    private StudentDashboardItem ToStudentDashboardItem(StudentState student)
    {
        RankState currentRank = ranks.First(rank => rank.Id == student.CurrentRankId);
        RankState? nextRank = ranks
            .Where(rank => rank.SortOrder > currentRank.SortOrder)
            .OrderBy(rank => rank.SortOrder)
            .FirstOrDefault();

        int requiredAttendance = nextRank?.RequiredAttendanceCount ?? 0;
        decimal progress = requiredAttendance == 0
            ? 100m
            : Math.Clamp(student.AttendanceCountTowardNextRank / (decimal)requiredAttendance * 100m, 0m, 100m);

        return new StudentDashboardItem(
            student.Id,
            student.FullName,
            BuildInitials(student.FullName),
            CalculateAge(student.BirthDate),
            student.EnrollmentDate,
            currentRank.Name,
            currentRank.BeltColor,
            nextRank?.Name,
            requiredAttendance,
            student.AttendanceCountTowardNextRank,
            Math.Round(progress, 1),
            student.FinancialStatus,
            student.IsActive,
            nextRank is not null && student.AttendanceCountTowardNextRank >= Math.Max(requiredAttendance, 1));
    }

    private IReadOnlyList<AttendanceTrendItem> BuildAttendanceTrend()
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Enumerable.Range(0, 7)
            .Select(offset => today.AddDays(offset - 6))
            .Select(day => new AttendanceTrendItem(
                day.ToString("MMM d", CultureInfo.InvariantCulture),
                attendances.Count(attendance => DateOnly.FromDateTime(attendance.OccurredAtUtc) == day
                    && attendance.Status == AttendanceStatuses.Present)))
            .ToList();
    }

    private static decimal CalculateAttendanceRate(IReadOnlyList<AttendanceTrendItem> trend)
    {
        int total = trend.Sum(item => item.PresentCount);
        decimal capacity = Math.Max(trend.Count * 12m, 1m);
        return Math.Round(Math.Clamp(total / capacity * 100m, 0m, 100m), 1);
    }

    private void SeedRanks()
    {
        ranks.AddRange(
        [
            new RankState(Guid.Parse("7fdcb56e-1c69-4aa6-83ba-8a5462477963"), "White", 1, "#F8FAFC", 0),
            new RankState(Guid.Parse("53d70180-04fe-40e8-a733-277b323ed386"), "Blue", 2, "#2563EB", 18),
            new RankState(Guid.Parse("5735c626-7a3c-4d6a-9884-7ad3d061a5dc"), "Purple", 3, "#7C3AED", 28),
            new RankState(Guid.Parse("926ce513-73ce-465d-b2a1-6b2f98fe5612"), "Brown", 4, "#92400E", 36),
            new RankState(Guid.Parse("62887bd8-b0de-441b-83d0-3522378ff0d7"), "Black", 5, "#111827", 48)
        ]);
    }

    private void SeedStudents()
    {
        RankState white = ranks.First(rank => rank.Name == "White");
        RankState blue = ranks.First(rank => rank.Name == "Blue");
        RankState purple = ranks.First(rank => rank.Name == "Purple");

        students.AddRange(
        [
            new StudentState(Guid.Parse("e61c94d2-0a43-4f45-aa43-624d3615f68b"), "Ana Costa", new DateOnly(2009, 5, 14), new DateOnly(2024, 9, 2), blue.Id, 25, FinancialStatuses.Current, true),
            new StudentState(Guid.Parse("4a1d4411-5e5f-4497-91d5-0110f95df125"), "Tiago Martins", new DateOnly(2012, 2, 22), new DateOnly(2025, 1, 13), white.Id, 16, FinancialStatuses.Current, true),
            new StudentState(Guid.Parse("c1ef5a2e-9f1d-4b5f-9a1b-947f03f0caca"), "Beatriz Rocha", new DateOnly(1998, 11, 3), new DateOnly(2023, 3, 6), purple.Id, 21, FinancialStatuses.Overdue, true),
            new StudentState(Guid.Parse("94b64f92-2ab5-4eaa-b079-c77906b87c01"), "Lucas Ferreira", new DateOnly(2006, 7, 19), new DateOnly(2024, 4, 17), blue.Id, 11, FinancialStatuses.Current, true),
            new StudentState(Guid.Parse("6e34f339-0a36-4c5f-b7e6-d7791d88d83c"), "Mia Santos", new DateOnly(2014, 9, 8), new DateOnly(2025, 10, 1), white.Id, 9, FinancialStatuses.Overdue, true),
            new StudentState(Guid.Parse("db122f99-7e07-49da-9084-18fd91c1f3a7"), "Rafael Almeida", new DateOnly(1995, 1, 27), new DateOnly(2022, 6, 20), purple.Id, 27, FinancialStatuses.Current, true)
        ]);
    }

    private void SeedUsers()
    {
        users.AddRange(
        [
            new UserState(Guid.Parse("927ee0b1-e5b1-4d2c-9960-7822bc91c0d5"), "Marta Silva", "marta@fightflow.local", UserRoles.Teacher, new DateOnly(2024, 1, 8), true),
            new UserState(Guid.Parse("1b8da9f9-5692-4c5f-b411-b3f6be95743f"), "Joao Pereira", "joao@fightflow.local", UserRoles.Assistant, new DateOnly(2024, 3, 18), true),
            new UserState(Guid.Parse("bf9a52eb-1518-4708-8faa-3b770fd97dc0"), "Ana Costa", "ana@fightflow.local", UserRoles.Student, new DateOnly(2024, 9, 2), true),
            new UserState(Guid.Parse("35e67f71-5e77-445d-a177-7d7bcb147093"), "Academy Admin", "admin@fightflow.local", UserRoles.User, new DateOnly(2023, 12, 4), true)
        ]);
    }

    private void SeedAttendance()
    {
        DateTime today = DateTime.UtcNow.Date.AddHours(18);
        string[] notes =
        [
            "Guard retention and controlled rounds.",
            "Late arrival, completed conditioning.",
            "Competition class drilling.",
            "Excused for school event.",
            "Strong positional sparring."
        ];

        for (int dayOffset = 0; dayOffset < 7; dayOffset++)
        {
            int studentsInClass = dayOffset % 3 == 0 ? 4 : 5;
            foreach (StudentState student in students.Take(studentsInClass))
            {
                attendances.Add(new AttendanceState(
                    Guid.NewGuid(),
                    student.Id,
                    today.AddDays(-dayOffset).AddMinutes(students.IndexOf(student) * 6),
                    dayOffset == 2 && student.FullName == "Mia Santos"
                        ? AttendanceStatuses.Excused
                        : AttendanceStatuses.Present,
                    "Marta Silva",
                    notes[(dayOffset + students.IndexOf(student)) % notes.Length]));
            }
        }

        attendances.Sort((left, right) => right.OccurredAtUtc.CompareTo(left.OccurredAtUtc));
    }

    private void SeedEvents()
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        events.AddRange(
        [
            new AcademyEventState(Guid.Parse("8d99e7e2-fc6b-44f8-a812-ceb274f8f1aa"), "Open Mat", today.AddDays(3), "Main academy", "Technical rounds and review.", true),
            new AcademyEventState(Guid.Parse("b53e005c-c6b8-47b3-ac5a-9ab2f28a4d6e"), "Belt Review", today.AddDays(14), "Dojo floor", "Promotion readiness check.", true)
        ]);
    }

    private static string NormalizeUserRole(string? role)
    {
        return role?.Trim().ToLowerInvariant() switch
        {
            "user" => UserRoles.User,
            "student" => UserRoles.Student,
            "teacher" => UserRoles.Teacher,
            "assistant" => UserRoles.Assistant,
            _ => string.Empty
        };
    }

    private static string NormalizeHexColor(string? value)
    {
        string color = TrimOptional(value, 7).ToUpperInvariant();
        if (color.Length != 7 || color[0] != '#')
        {
            return string.Empty;
        }

        return color.Skip(1).All(character =>
            character is >= '0' and <= '9'
            || character is >= 'A' and <= 'F')
            ? color
            : string.Empty;
    }

    private static string NormalizeAttendanceStatus(string? status)
    {
        return status?.Trim().ToLowerInvariant() switch
        {
            "present" => AttendanceStatuses.Present,
            "absent" => AttendanceStatuses.Absent,
            "excused" => AttendanceStatuses.Excused,
            _ => string.Empty
        };
    }

    private static string NormalizeFinancialStatus(string? status)
    {
        return status?.Trim().ToLowerInvariant() switch
        {
            "current" => FinancialStatuses.Current,
            "overdue" => FinancialStatuses.Overdue,
            _ => string.Empty
        };
    }

    private static string TrimOptional(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static int CalculateAge(DateOnly birthDate)
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        int age = today.Year - birthDate.Year;
        return birthDate > today.AddYears(-age) ? age - 1 : age;
    }

    private static string BuildInitials(string fullName)
    {
        string[] parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts.Take(2).Select(part => char.ToUpperInvariant(part[0])));
    }
}

internal static class AttendanceStatuses
{
    public const string Present = "Present";
    public const string Absent = "Absent";
    public const string Excused = "Excused";
}

internal static class FinancialStatuses
{
    public const string Current = "Current";
    public const string Overdue = "Overdue";
}

internal static class UserRoles
{
    public const string User = "User";
    public const string Student = "Student";
    public const string Teacher = "Teacher";
    public const string Assistant = "Assistant";
}

internal sealed record AttendanceCaptureRequest(Guid StudentId, string? Status, string? TechnicalNotes);

internal sealed record FinancialStatusUpdateRequest(string? Status);

internal sealed record UserSaveRequest(string? FullName, string? Email, string? Role);

internal sealed record BeltSaveRequest(string? Name, int SortOrder, string? BeltColor, int RequiredAttendanceCount);

internal sealed record EventSaveRequest(string? Title, DateOnly StartsAt, string? Location, string? Description);

internal sealed record TenantDashboardItem(
    Guid Id,
    string Name,
    string Slug,
    string PrimaryColor,
    string SecondaryColor,
    string DefaultCulture);

internal sealed record MetricsDashboardItem(
    int ActiveStudents,
    int AttendanceToday,
    int OverduePayments,
    int PromotionsReady,
    decimal SevenDayAttendanceRate);

internal sealed record StudentDashboardItem(
    Guid Id,
    string FullName,
    string Initials,
    int Age,
    DateOnly EnrollmentDate,
    string CurrentRankName,
    string BeltColor,
    string? NextRankName,
    int RequiredAttendanceCount,
    int AttendanceCountTowardNextRank,
    decimal ProgressPercent,
    string FinancialStatus,
    bool IsActive,
    bool IsPromotionReady);

internal sealed record AttendanceDashboardItem(
    Guid Id,
    Guid StudentId,
    string StudentName,
    DateTime OccurredAtUtc,
    string Status,
    string ProfessorName,
    string TechnicalNotes);

internal sealed record RankDashboardItem(
    Guid Id,
    string Name,
    int SortOrder,
    string BeltColor,
    int RequiredAttendanceCount,
    int StudentCount);

internal sealed record AttendanceTrendItem(string Label, int PresentCount);

internal sealed record UserDashboardItem(
    Guid Id,
    string FullName,
    string Email,
    string Role,
    DateOnly CreatedAt,
    bool IsActive);

internal sealed record BirthdayDashboardItem(
    Guid StudentId,
    string FullName,
    DateOnly BirthDate,
    int Age);

internal sealed record AcademyEventDashboardItem(
    Guid Id,
    string Title,
    DateOnly StartsAt,
    string Location,
    string Description,
    bool IsActive);

internal sealed record DashboardResponse(
    TenantDashboardItem Tenant,
    MetricsDashboardItem Metrics,
    IReadOnlyList<StudentDashboardItem> Students,
    IReadOnlyList<AttendanceDashboardItem> RecentAttendance,
    IReadOnlyList<RankDashboardItem> Ranks,
    IReadOnlyList<AttendanceTrendItem> AttendanceTrend,
    IReadOnlyList<UserDashboardItem> Users,
    IReadOnlyList<BirthdayDashboardItem> BirthdaysThisMonth,
    IReadOnlyList<AcademyEventDashboardItem> Events);

internal sealed record AttendanceCaptureResult(bool Success, string Message, DashboardResponse? Dashboard)
{
    public static AttendanceCaptureResult Ok(DashboardResponse dashboard) => new(true, string.Empty, dashboard);

    public static AttendanceCaptureResult Fail(string message) => new(false, message, null);
}

internal sealed record StudentActionResult(bool Success, string Message, DashboardResponse? Dashboard)
{
    public static StudentActionResult Ok(DashboardResponse dashboard) => new(true, string.Empty, dashboard);

    public static StudentActionResult Fail(string message) => new(false, message, null);
}

internal sealed record StoreActionResult(bool Success, string Message, DashboardResponse? Dashboard)
{
    public static StoreActionResult Ok(DashboardResponse dashboard) => new(true, string.Empty, dashboard);

    public static StoreActionResult Fail(string message) => new(false, message, null);
}

internal sealed record ProblemDetails(string Detail);

internal sealed record TenantState(
    Guid Id,
    string Name,
    string Slug,
    string PrimaryColor,
    string SecondaryColor,
    string DefaultCulture);

internal sealed class RankState(
    Guid id,
    string name,
    int sortOrder,
    string beltColor,
    int requiredAttendanceCount)
{
    public Guid Id { get; } = id;

    public string Name { get; set; } = name;

    public int SortOrder { get; set; } = sortOrder;

    public string BeltColor { get; set; } = beltColor;

    public int RequiredAttendanceCount { get; set; } = requiredAttendanceCount;
}

internal sealed class StudentState(
    Guid id,
    string fullName,
    DateOnly birthDate,
    DateOnly enrollmentDate,
    Guid currentRankId,
    int attendanceCountTowardNextRank,
    string financialStatus,
    bool isActive)
{
    public Guid Id { get; } = id;

    public string FullName { get; } = fullName;

    public DateOnly BirthDate { get; } = birthDate;

    public DateOnly EnrollmentDate { get; } = enrollmentDate;

    public Guid CurrentRankId { get; set; } = currentRankId;

    public int AttendanceCountTowardNextRank { get; set; } = attendanceCountTowardNextRank;

    public string FinancialStatus { get; set; } = financialStatus;

    public bool IsActive { get; set; } = isActive;
}

internal sealed record AttendanceState(
    Guid Id,
    Guid StudentId,
    DateTime OccurredAtUtc,
    string Status,
    string ProfessorName,
    string TechnicalNotes);

internal sealed class UserState(
    Guid id,
    string fullName,
    string email,
    string role,
    DateOnly createdAt,
    bool isActive)
{
    public Guid Id { get; } = id;

    public string FullName { get; set; } = fullName;

    public string Email { get; set; } = email;

    public string Role { get; set; } = role;

    public DateOnly CreatedAt { get; } = createdAt;

    public bool IsActive { get; set; } = isActive;
}

internal sealed class AcademyEventState(
    Guid id,
    string title,
    DateOnly startsAt,
    string location,
    string description,
    bool isActive)
{
    public Guid Id { get; } = id;

    public string Title { get; set; } = title;

    public DateOnly StartsAt { get; set; } = startsAt;

    public string Location { get; set; } = location;

    public string Description { get; set; } = description;

    public bool IsActive { get; set; } = isActive;
}
