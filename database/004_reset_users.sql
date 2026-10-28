-- SAMA — ล้างข้อมูลผู้ใช้และกิจกรรมเดิมทั้งหมด (ครู นักเรียน กิจกรรม ประวัติ หลักฐาน ดาวครู)
-- ไม่ลบ: หมวดกิจกรรม เกณฑ์ กำหนดส่ง และห้องเรียน 1/1 … 6/10
-- Supabase Dashboard → SQL Editor → New query → วาง → Run   (ลบแล้วกู้คืนไม่ได้)
-- หลังรันเสร็จ ให้นำเข้าบัญชีใหม่ด้วย dotnet run -- import ... จากเครื่องของคุณ
begin;
delete from "Activity_Attachments";
delete from "Activities_History";
delete from "Activities";
delete from "Favorite_Teacher";
update "Classroom" set advisor_teacher_id = null;
delete from "Student";
delete from "Teacher";
delete from "User";
commit;
