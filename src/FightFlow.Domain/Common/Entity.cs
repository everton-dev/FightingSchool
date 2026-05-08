namespace FightFlow.Domain.Common;

public abstract class Entity(Guid id)
{
    private readonly List<IDomainEvent> _domainEvents = [];

    protected Entity()
        : this(Guid.NewGuid())
    {
    }

    public Guid Id { get; protected set; } = Guard.RequiredId(id, nameof(id));

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    public override bool Equals(object? obj)
    {
        if (obj is not Entity other)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return GetType() == other.GetType() && Id == other.Id;
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(GetType(), Id);
    }

    public static bool operator ==(Entity? left, Entity? right)
    {
        return Equals(left, right);
    }

    public static bool operator !=(Entity? left, Entity? right)
    {
        return !Equals(left, right);
    }

    protected void AddDomainEvent(IDomainEvent domainEvent)
    {
        ArgumentNullException.ThrowIfNull(domainEvent);
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}
