using FightFlow.Domain.Common;

namespace FightFlow.Domain.Attendances;

public sealed class Attendance(
    Guid id,
    Guid tenantId,
    Guid studentProfileId,
    Guid professorUserId,
    DateTime occurredAtUtc,
    AttendanceStatus status,
    string? technicalNotes) : AggregateRoot(id), ITenantScoped
{
    private Attendance()
        : this(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateTime.UtcNow,
            AttendanceStatus.Present,
            null)
    {
    }

    public Guid TenantId { get; private set; } = Guard.RequiredId(tenantId, nameof(tenantId));

    public Guid StudentProfileId { get; private set; } = Guard.RequiredId(studentProfileId, nameof(studentProfileId));

    public Guid ProfessorUserId { get; private set; } = Guard.RequiredId(professorUserId, nameof(professorUserId));

    public DateTime OccurredAtUtc { get; private set; } =
        Guard.UtcDateTime(occurredAtUtc, nameof(occurredAtUtc));

    public AttendanceStatus Status { get; private set; } = status;

    public string TechnicalNotes { get; private set; } = Guard.Optional(technicalNotes, nameof(technicalNotes), 2000);

    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    public void ChangeStatus(AttendanceStatus status)
    {
        Status = status;
    }

    public void UpdateTechnicalNotes(string? technicalNotes)
    {
        TechnicalNotes = Guard.Optional(technicalNotes, nameof(technicalNotes), 2000);
    }
}
