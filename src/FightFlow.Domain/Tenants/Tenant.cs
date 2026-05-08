using FightFlow.Domain.Common;
using FightFlow.Domain.Localization;

namespace FightFlow.Domain.Tenants;

public sealed class Tenant(
    Guid id,
    string name,
    string slug,
    string primaryColor,
    string secondaryColor,
    string defaultCulture) : AggregateRoot(id)
{
    private Tenant()
        : this(
            Guid.NewGuid(),
            "Tenant",
            "tenant",
            "#0F766E",
            "#F97316",
            SupportedCultures.English)
    {
    }

    public string Name { get; private set; } = Guard.Required(name, nameof(name), 160);

    public string Slug { get; private set; } = Guard.Slug(slug, nameof(slug));

    public string PrimaryColor { get; private set; } = Guard.HexColor(primaryColor, nameof(primaryColor));

    public string SecondaryColor { get; private set; } = Guard.HexColor(secondaryColor, nameof(secondaryColor));

    public string DefaultCulture { get; private set; } = Guard.Culture(defaultCulture, nameof(defaultCulture));

    public bool IsActive { get; private set; } = true;

    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; private set; }

    public void Rename(string name)
    {
        Name = Guard.Required(name, nameof(name), 160);
        Touch();
    }

    public void ChangeSlug(string slug)
    {
        Slug = Guard.Slug(slug, nameof(slug));
        Touch();
    }

    public void UpdateBranding(string primaryColor, string secondaryColor)
    {
        PrimaryColor = Guard.HexColor(primaryColor, nameof(primaryColor));
        SecondaryColor = Guard.HexColor(secondaryColor, nameof(secondaryColor));
        Touch();
    }

    public void ChangeDefaultCulture(string defaultCulture)
    {
        DefaultCulture = Guard.Culture(defaultCulture, nameof(defaultCulture));
        Touch();
    }

    public void Activate()
    {
        IsActive = true;
        Touch();
    }

    public void Deactivate()
    {
        IsActive = false;
        Touch();
    }

    private void Touch()
    {
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
