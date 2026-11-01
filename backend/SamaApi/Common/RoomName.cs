namespace SamaApi.Common;

public static class RoomName
{
    /// <summary>"1/1" → "ม.1/1" for display only; the stored classroom names stay "1/1".</summary>
    public static string Display(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "" : name.StartsWith("ม.") ? name : "ม." + name;
}
