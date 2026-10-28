import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBox, Modal } from "../components/ui";
import { PersonAvatar } from "../components/reference";
import type { Me } from "../lib/types";
export default function Login({
  onAuthenticated,
}: { onAuthenticated?: (me: Me) => void } = {}) {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const configuration = useQuery({
    queryKey: ["auth-config"],
    queryFn: () =>
      api<{ provider: string; demoAvailable: boolean }>("/auth/config"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Me>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: (me) => {
      if (onAuthenticated) {
        onAuthenticated(me);
        return;
      }
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      client.setQueryData(["me"], me);
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  return (
    <main className="reference-login">
      <div className="login-column">
        <header className="login-identity">
          <span>Welcome to</span>
          <PersonAvatar />
          <h1>SAMA</h1>
          <p>
            Student Activity
            <br />
            Management Application
          </p>
        </header>
        <section className="login-box">
          <h2>เข้าสู่ระบบ</h2>
          <form onSubmit={submit}>
            <label>
              อีเมล <span>*</span>
              <input
                type="email"
                autoComplete="username"
                aria-label="อีเมล"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.ac.th"
                required
              />
            </label>
            <label>
              รหัสผ่าน <span>*</span>
              <div className="password-field">
                <input
                  type={visible ? "text" : "password"}
                  aria-label="รหัสผ่าน"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
                <button
                  type="button"
                  aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
            </label>
            <button
              type="button"
              className="forgot-password"
              onClick={() => setHelp(true)}
            >
              ลืมรหัสผ่าน?
            </button>
            {configuration.error && (
              <ErrorBox
                error={configuration.error}
                retry={() => void configuration.refetch()}
              />
            )}
            {mutation.error && <ErrorBox error={mutation.error} />}
            <button
              className="button purple-button login-submit"
              disabled={mutation.isPending || !configuration.data}
            >
              {mutation.isPending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        </section>
        <div className="login-account-note">
          บัญชีผู้ใช้งานจัดเตรียมโดยโรงเรียน
        </div>
        {configuration.data?.demoAvailable && (
          <div className="login-demo">
            <span>ทดลองใช้งาน</span>
            <div>
              <button
                onClick={() => {
                  setEmail("student@sama.local");
                  setPassword("SamaDemo123!");
                }}
              >
                บัญชีนักเรียน
              </button>
              <button
                onClick={() => {
                  setEmail("teacher@sama.local");
                  setPassword("SamaDemo123!");
                }}
              >
                บัญชีครู
              </button>
            </div>
          </div>
        )}
        <footer>SAMA TEAM © {new Date().getFullYear()}</footer>
      </div>
      {help && (
        <Modal title="ลืมรหัสผ่าน" onClose={() => setHelp(false)}>
          <div className="modal-body">
            <p>
              กรุณาติดต่อครูผู้ดูแลระบบของโรงเรียนเพื่อขอความช่วยเหลือเกี่ยวกับบัญชีผู้ใช้
            </p>
            <button
              className="button purple-button full-width"
              onClick={() => setHelp(false)}
            >
              รับทราบ
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
