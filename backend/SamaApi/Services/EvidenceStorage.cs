using System.Net.Http.Headers;
using SamaApi.Common;

namespace SamaApi.Services;

/// <summary>Where evidence files live. The database only keeps metadata + the storage path.</summary>
public interface IEvidenceStorage
{
    Task SaveAsync(string path, byte[] content, string contentType);
    Task<byte[]> ReadAsync(string path);
    Task DeleteAsync(string path);
}

/// <summary>Private Supabase Storage bucket, accessed only from the server with the service key.</summary>
public class SupabaseEvidenceStorage(HttpClient http, IConfiguration config) : IEvidenceStorage
{
    private readonly string _url = (config["Supabase:Url"] ?? "").TrimEnd('/');
    private readonly string _key = config["Supabase:ServiceKey"] ?? "";
    private readonly string _bucket = config["Supabase:Bucket"] ?? "evidence";

    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, $"{_url}/storage/v1/object/{_bucket}/{path}");
        request.Headers.Add("apikey", _key);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);
        return request;
    }

    public async Task SaveAsync(string path, byte[] content, string contentType)
    {
        using var request = Request(HttpMethod.Post, path);
        request.Content = new ByteArrayContent(content);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            throw new BusinessException(502, $"บันทึกไฟล์หลักฐานไม่สำเร็จ ({(int)response.StatusCode})");
    }

    public async Task<byte[]> ReadAsync(string path)
    {
        using var request = Request(HttpMethod.Get, path);
        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode) throw BusinessException.Missing();
        return await response.Content.ReadAsByteArrayAsync();
    }

    public async Task DeleteAsync(string path)
    {
        using var request = Request(HttpMethod.Delete, path);
        using var response = await http.SendAsync(request);
        // a missing object is fine (idempotent delete)
    }
}

/// <summary>Development fallback when Supabase Storage is not configured.</summary>
public class LocalEvidenceStorage(IConfiguration config) : IEvidenceStorage
{
    private readonly string _root = Path.GetFullPath(config["Storage:LocalPath"] ?? "evidence-storage");

    private string Resolve(string path)
    {
        var full = Path.GetFullPath(Path.Combine(_root, path));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar)) throw BusinessException.Missing();
        return full;
    }

    public async Task SaveAsync(string path, byte[] content, string contentType)
    {
        var file = Resolve(path);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        await File.WriteAllBytesAsync(file, content);
    }

    public async Task<byte[]> ReadAsync(string path)
    {
        var file = Resolve(path);
        if (!File.Exists(file)) throw BusinessException.Missing();
        return await File.ReadAllBytesAsync(file);
    }

    public Task DeleteAsync(string path)
    {
        var file = Resolve(path);
        if (File.Exists(file)) File.Delete(file);
        return Task.CompletedTask;
    }
}
