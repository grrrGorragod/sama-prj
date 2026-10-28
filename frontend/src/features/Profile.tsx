import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Save } from "lucide-react";
import type { Me, Summary } from "../lib/types";
import { api } from "../lib/api";
import { ErrorBox, Modal } from "../components/ui";
import { PersonAvatar, SchoolHeading } from "../components/reference";
export default function Profile({
  me,
  termId,
  notify,
  onFavorites,
  onLogout,
}: {
  me: Me;
  termId: string;
  notify: (message: string) => void;
  onFavorites: () => void;
  onLogout: () => void;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [name, setName] = useState(me.fullName);
  const [email, setEmail] = useState(me.email);
  const [phone, setPhone] = useState(me.phone || "");
  const [address, setAddress] = useState(me.address || "");
  const summary = useQuery({
    queryKey: ["progress", termId],
    queryFn: () => api<Summary>("/me/progress?termId=" + termId),
    enabled: me.role === "STUDENT" && !!termId,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Me>("/me", {
        method: "PATCH",
        body: JSON.stringify({ fullName: name, email, phone, address }),
      }),
    onSuccess: (user) => {
      client.setQueryData(["me"], user);
      setEditing(false);
      notify("บันทึกข้อมูลส่วนตัวแล้ว");
    },
  });
  return (
    <div className="reference-profile">
      <div className="page-heading centered">
        <h1>บัญชีผู้ใช้</h1>
      </div>
      <section className="reference-profile-card">
        <SchoolHeading />
        <div className="profile-card-identity">
          <PersonAvatar square />
          <div>
            <h2>{me.fullName}</h2>
            <p>
              {me.role === "STUDENT"
                ? "รหัสประจำตัว: " + me.studentCode
                : me.department}
            </p>
            <p>
              {summary.data
                ? `${summary.data.classroom} เลขที่ ${summary.data.rollNumber}`
                : me.email}
            </p>
          </div>
        </div>
      </section>
      <h2 className="settings-label">บัญชี</h2>
      <div className="settings-list">
        <button onClick={() => setEditing(true)}>
          แก้ไขโปรไฟล์
          <ChevronRight size={21} />
        </button>
        {me.role === "STUDENT" && (
          <button onClick={onFavorites}>
            ครูที่ชื่นชอบ
            <ChevronRight size={21} />
          </button>
        )}
        <button className="logout-row" onClick={onLogout}>
          ออกจากระบบ
          <ChevronRight size={21} />
        </button>
      </div>
      <h2 className="settings-label">ตั้งค่า</h2>
      <div className="settings-list">
        <button onClick={() => setPrivacy(true)}>
          ข้อมูลที่ระบบจัดเก็บ
          <ChevronRight size={21} />
        </button>
      </div>
      {editing && (
        <Modal
          title="แก้ไขโปรไฟล์"
          onClose={() => {
            if (!mutation.isPending) setEditing(false);
          }}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <fieldset disabled={mutation.isPending}>
              <label>
                ชื่อ–นามสกุล
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label>
                อีเมล
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  readOnly={me.emailEditable === false}
                />
                {me.emailEditable === false && (
                  <small>หากต้องการเปลี่ยนอีเมล กรุณาติดต่อผู้ดูแลบัญชี</small>
                )}
              </label>
              <label>
                เบอร์โทรศัพท์
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                />
              </label>
              <label>
                ที่อยู่
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={1000}
                />
              </label>
              {mutation.error && <ErrorBox error={mutation.error} />}
              <button className="button primary full-width">
                <Save size={18} />
                {mutation.isPending ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
      {privacy && (
        <Modal title="ข้อมูลที่ระบบจัดเก็บ" onClose={() => setPrivacy(false)}>
          <div className="modal-body">
            <p>
              ระบบจัดเก็บข้อมูลบัญชี ข้อมูลส่วนตัว กิจกรรม และประวัติการตรวจ
              เพื่อใช้ติดตามกิจกรรมพัฒนาผู้เรียน นักเรียนเห็นข้อมูลของตนเอง
              ส่วนครูเข้าถึงกิจกรรมและสถิติตามสิทธิ์ที่ได้รับมอบหมาย
            </p>
            <button
              className="button primary full-width"
              onClick={() => setPrivacy(false)}
            >
              รับทราบ
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
