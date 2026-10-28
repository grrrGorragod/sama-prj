namespace SamaApi.Common;

/// <summary>The web client treats every id as an opaque string; the database uses bigint.</summary>
public static class Ids
{
    public static string Str(long id) => id.ToString();
    public static string? Str(long? id) => id?.ToString();

    public static long Parse(string? value)
    {
        if (!long.TryParse(value, out var id) || id <= 0) throw BusinessException.Invalid("รูปแบบข้อมูลไม่ถูกต้อง");
        return id;
    }
}
