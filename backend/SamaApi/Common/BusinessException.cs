namespace SamaApi.Common;

/// <summary>Expected failure with an HTTP status and a Thai message shown to the user.</summary>
public class BusinessException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
    public static BusinessException Invalid(string message) => new(400, message);
    public static BusinessException Conflict(string message) => new(409, message);
    public static BusinessException Missing() => new(404, "ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
    public static BusinessException Forbidden(string message) => new(403, message);
    public static BusinessException Unauthorized(string message) => new(401, message);
}
