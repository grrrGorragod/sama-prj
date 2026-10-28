import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  FileText,
  ClipboardCheck,
  Users,
  Star,
  UserRound,
  LogOut,
  Plus,
  ChevronDown,
  Menu,
  X,
  RefreshCw,
  CheckCircle2,
  LayoutGrid,
} from "lucide-react";
import { api, ApiError } from "./lib/api";
import type { Me, Term, Category, Activity } from "./lib/types";
import { Loading, ErrorBox, Modal } from "./components/ui";
import { PersonAvatar } from "./components/reference";
import Login from "./features/Login";
import Dashboard, { Categories } from "./features/Dashboard";
import Activities from "./features/Activities";
import Classrooms from "./features/Classrooms";
import Favorites from "./features/Favorites";
import Profile from "./features/Profile";
import { ActivityEditor, ActivityDetail } from "./features/ActivityDialogs";
type Route =
  | "dashboard"
  | "categories"
  | "activities"
  | "reviews"
  | "classrooms"
  | "favorites"
  | "profile";
const titles: Record<Route, string> = {
  dashboard: "หน้าหลัก",
  categories: "กิจกรรม",
  activities: "รายการกิจกรรม",
  reviews: "ตรวจกิจกรรม",
  classrooms: "แดชบอร์ดห้องเรียน",
  favorites: "ครูที่ชื่นชอบ",
  profile: "บัญชีผู้ใช้",
};
function initialRoute(): Route {
  const route = window.location.hash.slice(1) as Route;
  return route in titles ? route : "dashboard";
}
export default function App() {
  const client = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [route, setRoute] = useState<Route>(initialRoute);
  const [termId, setTermId] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState<unknown>();
  const [editor, setEditor] = useState<{
    categoryId?: string;
    activity?: Activity;
  } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [recoveryUser, setRecoveryUser] = useState<Me | null>(null);
  const terms = useQuery({
    queryKey: ["terms"],
    queryFn: () => api<Term[]>("/terms"),
    enabled: !!me.data && !recoveryUser,
  });
  const term = terms.data?.find((t) => t.id === termId) || terms.data?.[0];
  const selectedTerm = term?.id || "";
  const categories = useQuery({
    queryKey: ["categories", selectedTerm],
    queryFn: () =>
      api<Category[]>("/activity-categories?termId=" + selectedTerm),
    enabled: !!me.data && !!selectedTerm && !recoveryUser,
  });
  useEffect(() => {
    const expired = () => {
      const previous = client.getQueryData<Me>(["me"]);
      void client.cancelQueries({
        predicate: (q) => q.queryKey[0] !== "auth-config",
      });
      if (previous) {
        // Keep the mounted editor (including File objects) private until re-authentication.
        setRecoveryUser((user) => user || previous);
        return;
      }
      client.removeQueries({
        predicate: (q) =>
          q.queryKey[0] !== "me" && q.queryKey[0] !== "auth-config",
      });
      client.setQueryData(["me"], null);
      setEditor(null);
      setDetail(null);
      setTermId("");
    };
    window.addEventListener("sama-auth-expired", expired);
    return () => window.removeEventListener("sama-auth-expired", expired);
  }, [client]);
  useEffect(() => {
    const listener = () => setRoute(initialRoute());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next: Route) {
    window.location.hash = next;
    setRoute(next);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function done(message: string) {
    setToast(message);
    void client.invalidateQueries();
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      client.setQueryData(["me"], null);
      setEditor(null);
      setDetail(null);
      setTermId("");
      navigate("dashboard");
    } catch (e) {
      setError(e);
    }
  }
  function recoverSession(next: Me) {
    if (next.id !== recoveryUser?.id) {
      setEditor(null);
      setDetail(null);
      setTermId("");
      setMobile(false);
      setToast("");
      setError(undefined);
      navigate("dashboard");
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    }
    client.setQueryData(["me"], next);
    setRecoveryUser(null);
    void client.invalidateQueries();
  }
  if (me.isPending && !recoveryUser) return <Loading />;
  if (
    !recoveryUser &&
    me.error &&
    !(me.error instanceof ApiError && me.error.status === 401)
  )
    return (
      <div className="connection-error">
        <ErrorBox error={me.error} retry={() => void me.refetch()} />
      </div>
    );
  const user = recoveryUser || me.data;
  if (!user) return <Login />;
  const student = user.role === "STUDENT";
  const allowed = student
    ? ["dashboard", "categories", "activities", "favorites", "profile"]
    : ["dashboard", "reviews", "classrooms", "profile"];
  const active = allowed.includes(route) ? route : "dashboard";
  const nav = student
    ? [
        { id: "dashboard" as Route, label: "หน้าหลัก", icon: Home },
        { id: "categories" as Route, label: "กิจกรรม", icon: FileText },
        {
          id: "activities" as Route,
          label: "รายการกิจกรรม",
          icon: ClipboardCheck,
        },
        { id: "favorites" as Route, label: "ครูที่ชื่นชอบ", icon: Star },
      ]
    : [
        { id: "dashboard" as Route, label: "หน้าหลัก", icon: Home },
        { id: "reviews" as Route, label: "ตรวจกิจกรรม", icon: ClipboardCheck },
        {
          id: "classrooms" as Route,
          label: "ห้องเรียนในที่ปรึกษา",
          icon: Users,
        },
      ];
  const bottom = [
    { id: "dashboard" as Route, label: "หน้าหลัก", icon: Home },
    {
      id: (student ? "categories" : "reviews") as Route,
      label: student ? "กิจกรรม" : "ตรวจงาน",
      icon: student ? FileText : CheckCircle2,
    },
    {
      id: (student ? "favorites" : "classrooms") as Route,
      label: student ? "ครูโปรด" : "ห้องเรียน",
      icon: student ? Star : Users,
    },
    { id: "profile" as Route, label: "บัญชี", icon: UserRound },
  ];
  function navActive(id: Route) {
    return active === id || (id === "categories" && active === "activities");
  }
  return (
    <div
      className={`app-shell ${student ? "student-app" : "teacher-app"} route-${active}${recoveryUser ? " session-locked" : ""}`}
    >
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <a
          className="brand"
          href="#dashboard"
          onClick={() => navigate("dashboard")}
        >
          <PersonAvatar />
          <strong>
            SAMA<small>Student Activity Management</small>
          </strong>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="ปิดเมนู"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={active === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={22} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <PersonAvatar />
          <div>
            <strong>{user.fullName}</strong>
            <small>{student ? "นักเรียน" : "ครูผู้ดูแลกิจกรรม"}</small>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => navigate("profile")}
            className={active === "profile" ? "active" : ""}
          >
            <UserRound size={20} />
            บัญชีผู้ใช้
          </button>
          <button onClick={() => void logout()}>
            <LogOut size={20} />
            ออกจากระบบ
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="เปิดเมนู"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <strong>{titles[active]}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              aria-label="รีเฟรชข้อมูล"
              onClick={() => void client.invalidateQueries()}
            >
              <RefreshCw size={19} />
            </button>
            <label className="term-select">
              <span>ปี/เทอม</span>
              <select
                aria-label="ปีและภาคเรียน"
                value={selectedTerm}
                onChange={(e) => {
                  setTermId(e.target.value);
                  setEditor(null);
                  setDetail(null);
                }}
              >
                {terms.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
        </header>
        <main className="main-content">
          {!!error && <ErrorBox error={error} />}{" "}
          {terms.error && (
            <ErrorBox error={terms.error} retry={() => void terms.refetch()} />
          )}{" "}
          {terms.isPending ? (
            <Loading />
          ) : !term ? (
            <div className="panel empty">
              <h2>ยังไม่มีปีการศึกษา</h2>
              <p>กรุณาให้ผู้ดูแลตั้งค่าเทอมก่อนเริ่มใช้งาน</p>
            </div>
          ) : (
            <>
              {active === "dashboard" && (
                <Dashboard
                  me={user}
                  term={term}
                  navigate={navigate}
                  onCreate={(categoryId) => setEditor({ categoryId })}
                  onView={setDetail}
                />
              )}
              {active === "categories" && (
                <Categories
                  term={term}
                  onCreate={(categoryId) => setEditor({ categoryId })}
                  onList={() => navigate("activities")}
                />
              )}
              {(active === "activities" || active === "reviews") && (
                <Activities
                  key={active + selectedTerm}
                  review={!student}
                  termId={selectedTerm}
                  categories={categories.data || []}
                  onCreate={() => setEditor({})}
                  onView={setDetail}
                  notify={done}
                />
              )}
              {active === "classrooms" && (
                <Classrooms termId={selectedTerm} notify={setToast} />
              )}
              {active === "favorites" && <Favorites notify={done} />}
              {active === "profile" && (
                <Profile
                  me={user}
                  termId={selectedTerm}
                  notify={done}
                  onFavorites={() => navigate("favorites")}
                  onLogout={() => void logout()}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          SAMA TEAM © {new Date().getFullYear()}
        </footer>
      </div>
      {editor && term && (
        <ActivityEditor
          me={user}
          term={term}
          categories={categories.data || []}
          initial={editor}
          onClose={() => setEditor(null)}
          onSuccess={(message) => {
            setEditor(null);
            done(message);
          }}
        />
      )}
      {detail && (
        <ActivityDetail
          id={detail}
          me={user}
          onClose={() => setDetail(null)}
          onEdit={(activity) => {
            setDetail(null);
            setEditor({ activity });
          }}
          notify={done}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
      <nav className="mobile-bottom" aria-label="เมนูหลัก">
        {bottom.slice(0, 2).map((n) => (
          <button
            key={n.id}
            className={navActive(n.id) ? "active" : ""}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={24} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className="central-action"
          aria-label={student ? "บันทึกกิจกรรม" : "แดชบอร์ดห้องเรียน"}
          onClick={() => (student ? setEditor({}) : navigate("classrooms"))}
        >
          {student ? <Plus size={32} /> : <LayoutGrid size={27} />}
        </button>
        {bottom.slice(2).map((n) => (
          <button
            key={n.id}
            className={navActive(n.id) ? "active" : ""}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={24} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {recoveryUser && (
        <Modal
          title="เซสชันหมดอายุ"
          className="session-recovery"
          dismissible={false}
          onClose={() => {}}
        >
          <p className="session-recovery-note">
            ข้อมูลที่กรอกและไฟล์แนบยังอยู่ เข้าสู่ระบบด้วยบัญชีเดิมเพื่อทำต่อ
            หากเปลี่ยนบัญชีระบบจะล้างข้อมูลที่ยังไม่ได้บันทึก
          </p>
          <Login onAuthenticated={recoverSession} />
        </Modal>
      )}
    </div>
  );
}
