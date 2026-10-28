using System.Security.Cryptography;
using System.Text;
using SamaApi.Common;

namespace SamaApi.Services;

/// <summary>Validates uploads: extension, real content signature, size. Never trusts the client content type.</summary>
public class EvidenceFilePolicy
{
    public const int MaxFiles = 5;
    public const int MaxBytes = 5 * 1024 * 1024;

    public record Validated(string Name, string ContentType, string Extension, string Sha256);

    public Validated Validate(string? filename, byte[] content)
    {
        if (content.Length == 0) throw BusinessException.Invalid("ไฟล์หลักฐานต้องไม่เป็นไฟล์ว่าง");
        if (content.Length > MaxBytes) throw new BusinessException(413, "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์");

        var name = (filename ?? "").Replace('\\', '/');
        name = new string(name[(name.LastIndexOf('/') + 1)..].Where(c => !char.IsControl(c)).ToArray()).Trim();
        var dot = name.LastIndexOf('.');
        const string unsupported = "รองรับเฉพาะรูป JPG, PNG, WEBP และไฟล์ PDF";
        if (dot <= 0) throw BusinessException.Invalid(unsupported);
        var extension = name[dot..].ToLowerInvariant();

        var mime = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => throw BusinessException.Invalid(unsupported)
        };

        var valid = mime switch
        {
            "image/png" => StartsWith(content, new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/jpeg" => StartsWith(content, new byte[] { 255, 216, 255 }),
            "image/webp" => content.Length >= 16 && Ascii(content, 0, 4) == "RIFF" && Ascii(content, 8, 4) == "WEBP" && Ascii(content, 12, 3) == "VP8",
            "application/pdf" => StartsWith(content, Encoding.ASCII.GetBytes("%PDF-")),
            _ => false
        };
        if (!valid) throw BusinessException.Invalid("เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่รองรับ กรุณาเลือกรูปภาพหรือ PDF ที่ถูกต้อง");

        if (name.Length > 200) name = name[..(200 - extension.Length)] + extension;
        return new Validated(name, mime, extension, Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant());
    }

    private static bool StartsWith(byte[] bytes, byte[] signature) =>
        bytes.Length >= signature.Length && bytes.AsSpan(0, signature.Length).SequenceEqual(signature);

    private static string Ascii(byte[] bytes, int offset, int length) => Encoding.ASCII.GetString(bytes, offset, length);
}
