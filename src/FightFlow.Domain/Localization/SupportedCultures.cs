namespace FightFlow.Domain.Localization;

public static class SupportedCultures
{
    public const string English = "en";
    public const string PortugueseBrazil = "pt-BR";
    public const string PortuguesePortugal = "pt-PT";
    public const string Spanish = "es";

    private static readonly string[] Values =
    [
        English,
        PortugueseBrazil,
        PortuguesePortugal,
        Spanish
    ];

    public static IReadOnlyCollection<string> All => Values;

    public static bool IsSupported(string culture)
    {
        return Values.Any(value => string.Equals(value, culture, StringComparison.OrdinalIgnoreCase));
    }

    public static string Normalize(string culture)
    {
        string? supportedCulture = Values.FirstOrDefault(value =>
            string.Equals(value, culture, StringComparison.OrdinalIgnoreCase));

        if (supportedCulture is null)
        {
            throw new Common.DomainException($"Culture '{culture}' is not supported.");
        }

        return supportedCulture;
    }
}
