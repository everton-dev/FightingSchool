using FightFlow.Domain.Common;

namespace FightFlow.Domain.Students;

public sealed class StudentProfile(
    Guid id,
    Guid tenantId,
    Guid userId,
    string fullName,
    DateOnly birthDate,
    Guid rankSystemId,
    Guid currentRankId,
    DateOnly enrollmentDate) : AggregateRoot(id), ITenantScoped
{
    private StudentProfile()
        : this(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Student",
            DateOnly.FromDateTime(DateTime.UtcNow),
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow))
    {
    }

    public Guid TenantId { get; private set; } = Guard.RequiredId(tenantId, nameof(tenantId));

    public Guid UserId { get; private set; } = Guard.RequiredId(userId, nameof(userId));

    public string FullName { get; private set; } = Guard.Required(fullName, nameof(fullName), 160);

    public DateOnly BirthDate { get; private set; } = birthDate;

    public Guid RankSystemId { get; private set; } = Guard.RequiredId(rankSystemId, nameof(rankSystemId));

    public Guid CurrentRankId { get; private set; } = Guard.RequiredId(currentRankId, nameof(currentRankId));

    public DateOnly EnrollmentDate { get; private set; } = enrollmentDate;

    public FinancialStatus FinancialStatus { get; private set; } = FinancialStatus.Current;

    public int AttendanceCountTowardNextRank { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    public void Rename(string fullName)
    {
        FullName = Guard.Required(fullName, nameof(fullName), 160);
    }

    public void UpdateFinancialStatus(FinancialStatus financialStatus)
    {
        FinancialStatus = financialStatus;
    }

    public void RegisterAttendanceCredit()
    {
        AttendanceCountTowardNextRank++;
    }

    public decimal CalculateProgressToNextRank(int requiredAttendanceCount)
    {
        int requiredCount = Guard.NonNegative(requiredAttendanceCount, nameof(requiredAttendanceCount));

        if (requiredCount == 0)
        {
            return 100m;
        }

        decimal progress = AttendanceCountTowardNextRank / (decimal)requiredCount * 100m;
        return Math.Clamp(progress, 0m, 100m);
    }

    public void PromoteToRank(Guid rankId)
    {
        CurrentRankId = Guard.RequiredId(rankId, nameof(rankId));
        AttendanceCountTowardNextRank = 0;
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }
}
