using System.Text;

namespace SamaApi.Common;

public static class Csv
{
    /// <summary>Writes a quoted cell; neutralises spreadsheet formulas (=,+,-,@).</summary>
    public static string Cell(string? text)
    {
        var s = text ?? "";
        var trimmed = s.TrimStart();
        if ((trimmed.Length > 0 && "=+-@".Contains(trimmed[0])) || s.StartsWith('\t') || s.StartsWith('\r') || s.StartsWith('\n'))
            s = "'" + s;
        return "\"" + s.Replace("\"", "\"\"") + "\"";
    }

    /// <summary>Minimal RFC 4180 reader (BOM, quotes, CRLF). Returns header-keyed rows.</summary>
    public static List<Dictionary<string, string>> Read(string path)
    {
        var text = File.ReadAllText(path, Encoding.UTF8).TrimStart('\uFEFF');
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else cell.Append(c);
            }
            else if (c == '"') quoted = true;
            else if (c == ',') { row.Add(cell.ToString()); cell.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString()); cell.Clear();
                if (row.Any(v => v.Length > 0)) rows.Add(row);
                row = new List<string>();
            }
            else cell.Append(c);
        }
        row.Add(cell.ToString());
        if (row.Any(v => v.Length > 0)) rows.Add(row);
        if (rows.Count == 0) return new();

        var header = rows[0].Select(h => h.Trim().ToLowerInvariant()).ToList();
        return rows.Skip(1).Select(r =>
        {
            var d = new Dictionary<string, string>();
            for (var i = 0; i < header.Count; i++) d[header[i]] = i < r.Count ? r[i].Trim() : "";
            return d;
        }).ToList();
    }
}
