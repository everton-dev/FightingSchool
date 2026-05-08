namespace FightFlow.Domain.Common;

public interface ITenantScoped
{
    public Guid TenantId { get; }
}
