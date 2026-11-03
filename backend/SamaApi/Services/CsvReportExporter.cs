using System.Globalization;
using System.Text;
using SamaApi.Common;
using SamaApi.Dtos;

namespace SamaApi.Services;

public class CsvReportExporter
{
    public byte[] Export(ClassroomSummaryDto summary)
    {
        var sb = new StringBuilder("\uFEFFเลขที่,รหัสนักเรียน,ชื่อ-นามสกุล,ห้อง,เปอร์เซ็นต์ความคืบหน้า,ผลทั้งปี,อนุมัติ,รอตรวจ,ส่งคืน,แบบร่าง,นาทีที่อนุมัติ\r\n");
        foreach (var s in summary.Students)
        {
            var result = !s.Configured ? "ยังไม่ได้ตั้งเกณฑ์" : s.Completed ? "เสร็จแล้ว" : "ยังไม่เสร็จ";
            sb.Append(s.RollNumber).Append(',').Append(Csv.Cell(s.StudentCode)).Append(',').Append(Csv.Cell(s.StudentName)).Append(',')
              .Append(Csv.Cell(s.Classroom)).Append(',').Append(s.Percent.ToString(CultureInfo.InvariantCulture)).Append(',')
              .Append(Csv.Cell(result)).Append(',').Append(s.Approved).Append(',').Append(s.Pending).Append(',')
              .Append(s.Rejected).Append(',').Append(s.Draft).Append(',').Append(s.TotalApprovedMinutes).Append("\r\n");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
