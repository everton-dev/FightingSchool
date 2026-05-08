namespace FightFlow.Domain.Common;

public abstract class AggregateRoot(Guid id) : Entity(id)
{
    protected AggregateRoot()
        : this(Guid.NewGuid())
    {
    }
}
