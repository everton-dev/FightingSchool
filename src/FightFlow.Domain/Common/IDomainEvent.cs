namespace FightFlow.Domain.Common;

public interface IDomainEvent
{
    public DateTime OccurredAtUtc { get; }
}
