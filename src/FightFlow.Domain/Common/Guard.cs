using FightFlow.Domain.Localization;

namespace FightFlow.Domain.Common;

public static class Guard
{
    public static Guid RequiredId(Guid value, string parameterName)
    {
        if (value == Guid.Empty)
        {
            throw new DomainException($"{parameterName} cannot be empty.");
        }

        return value;
    }

    public static string Required(string? value, string parameterName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException($"{parameterName} is required.");
        }

        string trimmed = value.Trim();

        if (trimmed.Length > maxLength)
        {
            throw new DomainException($"{parameterName} cannot exceed {maxLength} characters.");
        }

        return trimmed;
    }

    public static string Optional(string? value, string parameterName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string trimmed = value.Trim();

        if (trimmed.Length > maxLength)
        {
            throw new DomainException($"{parameterName} cannot exceed {maxLength} characters.");
        }

        return trimmed;
    }

    public static string Email(string? value, string parameterName)
    {
        string email = Required(value, parameterName, 256).ToLowerInvariant();

        if (email.IndexOf("@", StringComparison.Ordinal) < 0
            || email.IndexOf(".", StringComparison.Ordinal) < 0)
        {
            throw new DomainException($"{parameterName} must be a valid email address.");
        }

        return email;
    }

    public static string Slug(string? value, string parameterName)
    {
        string slug = Required(value, parameterName, 80).ToLowerInvariant();

        if (slug.StartsWith("-", StringComparison.Ordinal) || slug.EndsWith("-", StringComparison.Ordinal))
        {
            throw new DomainException($"{parameterName} cannot start or end with a hyphen.");
        }

        foreach (char character in slug)
        {
            bool isValidCharacter = character is >= 'a' and <= 'z'
                || character is >= '0' and <= '9'
                || character == '-';

            if (!isValidCharacter)
            {
                throw new DomainException($"{parameterName} can contain only lowercase letters, numbers, and hyphens.");
            }
        }

        return slug;
    }

    public static string HexColor(string? value, string parameterName)
    {
        string color = Required(value, parameterName, 7).ToUpperInvariant();

        if (color.Length != 7 || color[0] != '#')
        {
            throw new DomainException($"{parameterName} must be a seven-character hex color.");
        }

        for (int index = 1; index < color.Length; index++)
        {
            bool isHex = color[index] is >= '0' and <= '9'
                || color[index] is >= 'A' and <= 'F';

            if (!isHex)
            {
                throw new DomainException($"{parameterName} must be a valid hex color.");
            }
        }

        return color;
    }

    public static string Culture(string? value, string parameterName)
    {
        string culture = Required(value, parameterName, 8);
        return SupportedCultures.Normalize(culture);
    }

    public static int NonNegative(int value, string parameterName)
    {
        if (value < 0)
        {
            throw new DomainException($"{parameterName} cannot be negative.");
        }

        return value;
    }

    public static DateTime UtcDateTime(DateTime value, string parameterName)
    {
        if (value == default)
        {
            throw new DomainException($"{parameterName} is required.");
        }

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
