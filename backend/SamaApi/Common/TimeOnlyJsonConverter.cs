using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SamaApi.Common;

/// <summary>Accepts "HH:mm" and "HH:mm:ss" (what &lt;input type=time&gt; sends); writes "HH:mm:ss".</summary>
public class TimeOnlyJsonConverter : JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (TimeOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)) return t;
        throw new JsonException("invalid time");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm:ss", CultureInfo.InvariantCulture));
}
