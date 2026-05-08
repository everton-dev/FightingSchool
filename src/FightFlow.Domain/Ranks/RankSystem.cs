using FightFlow.Domain.Common;

namespace FightFlow.Domain.Ranks;

public sealed class RankSystem(
    Guid id,
    Guid tenantId,
    string name) : AggregateRoot(id), ITenantScoped
{
    private readonly List<RankDefinition> _ranks = [];

    private RankSystem()
        : this(Guid.NewGuid(), Guid.NewGuid(), "Default rank system")
    {
    }

    public Guid TenantId { get; private set; } = Guard.RequiredId(tenantId, nameof(tenantId));

    public string Name { get; private set; } = Guard.Required(name, nameof(name), 120);

    public IReadOnlyCollection<RankDefinition> Ranks => _ranks.AsReadOnly();

    public void Rename(string name)
    {
        Name = Guard.Required(name, nameof(name), 120);
    }

    public RankDefinition AddRank(
        string name,
        int sortOrder,
        string beltColor,
        int requiredAttendanceCount)
    {
        if (_ranks.Any(rank => rank.SortOrder == sortOrder))
        {
            throw new DomainException($"Rank sort order '{sortOrder}' already exists.");
        }

        RankDefinition rankDefinition = new(
            Guid.NewGuid(),
            Id,
            name,
            sortOrder,
            beltColor,
            requiredAttendanceCount);

        _ranks.Add(rankDefinition);

        return rankDefinition;
    }

    public RankDefinition? GetNextRank(Guid currentRankId)
    {
        RankDefinition? currentRank = _ranks.FirstOrDefault(rank => rank.Id == currentRankId);

        if (currentRank is null)
        {
            return null;
        }

        return _ranks
            .Where(rank => rank.SortOrder > currentRank.SortOrder)
            .OrderBy(rank => rank.SortOrder)
            .FirstOrDefault();
    }
}

public sealed class RankDefinition(
    Guid id,
    Guid rankSystemId,
    string name,
    int sortOrder,
    string beltColor,
    int requiredAttendanceCount) : Entity(id)
{
    private RankDefinition()
        : this(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Rank",
            1,
            "#FFFFFF",
            0)
    {
    }

    public Guid RankSystemId { get; private set; } = Guard.RequiredId(rankSystemId, nameof(rankSystemId));

    public string Name { get; private set; } = Guard.Required(name, nameof(name), 120);

    public int SortOrder { get; private set; } = Guard.NonNegative(sortOrder, nameof(sortOrder));

    public string BeltColor { get; private set; } = Guard.HexColor(beltColor, nameof(beltColor));

    public int RequiredAttendanceCount { get; private set; } =
        Guard.NonNegative(requiredAttendanceCount, nameof(requiredAttendanceCount));

    public void UpdateRequirements(int requiredAttendanceCount)
    {
        RequiredAttendanceCount = Guard.NonNegative(requiredAttendanceCount, nameof(requiredAttendanceCount));
    }
}
