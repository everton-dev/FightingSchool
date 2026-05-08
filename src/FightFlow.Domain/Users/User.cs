using FightFlow.Domain.Common;

namespace FightFlow.Domain.Users;

public sealed class User(
    Guid id,
    Guid tenantId,
    string email,
    string displayName,
    string passwordHash,
    UserRole role) : AggregateRoot(id), ITenantScoped
{
    private User()
        : this(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "user@example.com",
            "User",
            "not-configured",
            UserRole.Student)
    {
    }

    public Guid TenantId { get; private set; } = Guard.RequiredId(tenantId, nameof(tenantId));

    public string Email { get; private set; } = Guard.Email(email, nameof(email));

    public string DisplayName { get; private set; } = Guard.Required(displayName, nameof(displayName), 160);

    public string PasswordHash { get; private set; } = Guard.Required(passwordHash, nameof(passwordHash), 512);

    public UserRole Role { get; private set; } = role;

    public bool IsActive { get; private set; } = true;

    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    public DateTime? LastLoginAtUtc { get; private set; }

    public void ChangeDisplayName(string displayName)
    {
        DisplayName = Guard.Required(displayName, nameof(displayName), 160);
    }

    public void ChangePasswordHash(string passwordHash)
    {
        PasswordHash = Guard.Required(passwordHash, nameof(passwordHash), 512);
    }

    public void ChangeRole(UserRole role)
    {
        Role = role;
    }

    public void MarkLogin(DateTime occurredAtUtc)
    {
        LastLoginAtUtc = Guard.UtcDateTime(occurredAtUtc, nameof(occurredAtUtc));
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
