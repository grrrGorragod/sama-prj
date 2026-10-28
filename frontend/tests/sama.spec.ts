import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
async function login(page: Page, role: "student" | "teacher") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: role === "student" ? "บัญชีนักเรียน" : "บัญชีครู",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".welcome-card h1")).toBeVisible();
}
test("student submits, teacher approves, timeline and progress update", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await login(page, "student");
  await page.screenshot({
    path: "test-results/student-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "บันทึกกิจกรรม", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  const title = "E2E พบครูที่ปรึกษา " + Date.now();
  await modal.getByLabel("ชื่อกิจกรรม").fill(title);
  await modal.getByLabel("เวลาเริ่มต้น").fill("15:00");
  await modal.getByLabel("เวลาสิ้นสุด").fill("16:00");
  await modal
    .getByLabel("รายละเอียด / ลักษณะกิจกรรม")
    .fill("พบครูเพื่อวางแผนกิจกรรมและบันทึกสิ่งที่ได้เรียนรู้");
  await modal
    .getByLabel("ส่งกิจกรรมให้ครู")
    .selectOption({ label: "★ ครูอรพรรณ วิริยะ · กลุ่มสาระวิทยาศาสตร์" });
  await modal
    .getByRole("button", { name: "ส่งให้ครูตรวจ", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "ส่งกิจกรรมให้ครูเรียบร้อยแล้ว",
  );
  const teacherContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const teacher = await teacherContext.newPage();
  await login(teacher, "teacher");
  await teacher
    .getByRole("button", { name: "ตรวจรายการค้าง", exact: true })
    .click();
  await teacher.getByLabel("ค้นหากิจกรรม").fill(title);
  await expect(teacher.locator(".review-entry")).toHaveCount(1);
  await teacher.locator(".review-entry .table-title").first().click();
  const review = teacher.getByRole("dialog");
  await review
    .getByRole("button", { name: "อนุมัติกิจกรรม", exact: true })
    .click();
  await review
    .getByRole("button", { name: "ยืนยันอนุมัติ", exact: true })
    .click();
  await expect(review).not.toBeVisible();
  await page.getByRole("button", { name: "รีเฟรชข้อมูล", exact: true }).click();
  await page
    .getByRole("button", { name: new RegExp(title) })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByText("อนุมัติแล้ว", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator(".timeline li")).toHaveCount(3);
  await page.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  expect(errors).toEqual([]);
  await teacherContext.close();
});
test("favorites, profile and classroom export use live data", async ({
  page,
  browser,
}) => {
  await login(page, "student");
  await page
    .getByRole("button", { name: "ครูที่ชื่นชอบ", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", {
      name: "เพิ่มรายการโปรด ครูปณิธาน สุขสวัสดิ์",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("button", {
        name: "นำออกจากรายการโปรด ครูปณิธาน สุขสวัสดิ์",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "บัญชีผู้ใช้", exact: true }).click();
  await page.getByRole("button", { name: "แก้ไขโปรไฟล์", exact: true }).click();
  await page.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
  await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.getByRole("status")).toContainText(
    "บันทึกข้อมูลส่วนตัวแล้ว",
  );
  await page.reload();
  await page.getByRole("button", { name: "แก้ไขโปรไฟล์", exact: true }).click();
  await expect(page.getByLabel("เบอร์โทรศัพท์")).toHaveValue("0812345678");
  await page.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  const context = await browser.newContext();
  const teacher = await context.newPage();
  await login(teacher, "teacher");
  await teacher
    .getByRole("button", { name: "ห้องเรียนในที่ปรึกษา", exact: true })
    .click();
  await teacher.getByRole("tab", { name: "เสร็จแล้ว", exact: true }).click();
  await expect(
    teacher.getByText("พิมพ์ชนก วัฒนกุล", { exact: true }),
  ).toBeVisible();
  await teacher.screenshot({
    path: "test-results/classroom-dashboard.png",
    fullPage: true,
  });
  const download = teacher.waitForEvent("download");
  await teacher
    .getByRole("button", { name: "ดาวน์โหลด CSV", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("sama-classroom.csv");
  await context.close();
});
test("mobile layout, navigation, draft and login validation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("อีเมล", { exact: true }).fill("student@sama.local");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  );
  await page
    .getByRole("button", { name: "บัญชีนักเรียน", exact: true })
    .click();
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".welcome-card h1")).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-dashboard.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "บันทึกกิจกรรม", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อกิจกรรม").fill("E2E แบบร่างบนมือถือ");
  await dialog
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".mobile-bottom")
    .getByRole("button", { name: "กิจกรรม", exact: true })
    .click();
  await page
    .getByRole("button", { name: "รายการกิจกรรม", exact: true })
    .last()
    .click();
  await page.getByRole("tab", { name: "ยังไม่ส่ง", exact: true }).click();
  await expect(
    page.locator(".table-title").filter({ hasText: "E2E แบบร่างบนมือถือ" }),
  ).toBeVisible();
  await page
    .locator(".table-title")
    .filter({ hasText: "E2E แบบร่างบนมือถือ" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "แก้ไข / ส่งกิจกรรม" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  ).toBeVisible();
});
test("teacher can return a selected batch with a reason", async ({ page }) => {
  await login(page, "teacher");
  await page
    .getByRole("button", { name: "ตรวจรายการค้าง", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/reference-mobile-review.png",
    fullPage: true,
  });
  await page.getByLabel("เลือกทั้งหมดในหน้านี้").check();
  await page.screenshot({
    path: "test-results/reference-mobile-bulk.png",
    fullPage: true,
  });
  await page
    .locator(".bulk-bar")
    .getByRole("button", { name: "ส่งคืน", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("เหตุผลที่ส่งคืน")
    .fill("ช่วยเพิ่มรายละเอียดหน้าที่และสิ่งที่ได้เรียนรู้");
  await dialog
    .getByRole("button", { name: "ยืนยันส่งคืน", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "ส่งคืนกิจกรรมเรียบร้อยแล้ว",
  );
  await page.getByRole("tab", { name: "ประวัติการตรวจ", exact: true }).click();
  await page.getByRole("tab", { name: "ส่งคืน", exact: true }).click();
  await expect(page.locator(".review-entry").first()).toBeVisible();
});

test("reference screens render on mobile and desktop without page overflow", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".login-box")).toBeVisible();
  await page.screenshot({
    path: "test-results/reference-login.png",
    fullPage: true,
  });
  await login(page, "student");
  await page.goto("/#categories");
  await expect(
    page.locator(".reference-category-grid .reference-category"),
  ).toHaveCount(7);
  await page.screenshot({
    path: "test-results/reference-categories.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "เพิ่มกิจกรรม การออกกำลังกาย", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveClass(/page-modal/);
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds?.width).toBe(390);
  await page.getByRole("dialog").screenshot({
    path: "test-results/reference-add-activity.png",
  });
  const exerciseForm = page.getByRole("dialog");
  await exerciseForm.getByLabel("เวลาเริ่มต้น").fill("16:00");
  await exerciseForm.getByLabel("เวลาสิ้นสุด").fill("17:00");
  await exerciseForm
    .getByLabel("รายละเอียด / ลักษณะกิจกรรม")
    .fill("ออกกำลังกายและฝึกแบดมินตันร่วมกับเพื่อน");
  await exerciseForm
    .getByRole("button", { name: "ส่งกิจกรรมให้ครู", exact: true })
    .click();
  await expect(
    exerciseForm.getByRole("heading", { name: "เลือกครูผู้ตรวจ", exact: true }),
  ).toBeVisible();
  await exerciseForm
    .getByLabel("ส่งกิจกรรมให้ครู")
    .selectOption({ label: "★ ครูอรพรรณ วิริยะ · กลุ่มสาระวิทยาศาสตร์" });
  await exerciseForm.screenshot({
    path: "test-results/reference-reviewer-choice.png",
  });
  await exerciseForm
    .getByRole("button", { name: "ยืนยันส่งกิจกรรม", exact: true })
    .click();
  await expect(exerciseForm).not.toBeVisible();
  await page.goto("/#activities");
  await expect(page.locator(".activity-entry").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/reference-activity-list.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "ตรวจแล้ว", exact: true }).click();
  await page.locator(".activity-entry .table-title").first().click();
  await expect(page.locator(".timeline li")).toHaveCount(3);
  await page.getByRole("dialog").screenshot({
    path: "test-results/reference-timeline.png",
  });
  await page.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  await page.goto("/#profile");
  await expect(
    page.getByRole("button", { name: "แก้ไขโปรไฟล์", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/reference-profile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "ครูที่ชื่นชอบ", exact: true })
    .last()
    .click();
  await expect(page.locator(".reference-teacher-row").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/reference-favorites.png",
    fullPage: true,
  });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#categories");
    await expect(page.locator(".reference-category").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const teacher = await context.newPage();
  await login(teacher, "teacher");
  await teacher.goto("/#classrooms");
  await expect(teacher.locator(".classroom-pie")).toBeVisible();
  await teacher.screenshot({
    path: "test-results/reference-mobile-classroom.png",
    fullPage: true,
  });
  await teacher.locator(".reference-student-list>button").first().click();
  await expect(teacher.locator(".student-ring")).toBeVisible();
  await teacher.getByRole("dialog").screenshot({
    path: "test-results/reference-student-statistics.png",
  });
  await teacher
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  await teacher
    .getByRole("button", { name: "เลือกหมวดกิจกรรมสำหรับสถิติ", exact: true })
    .click();
  await teacher
    .getByLabel("กรองสถิติตามหมวด")
    .selectOption({ label: "การออกกำลังกาย" });
  await expect(teacher.locator(".classroom-category-note")).toContainText(
    "การออกกำลังกาย",
  );
  expect(
    await teacher.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("editable activity names and evidence survive draft edits and teacher review", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "student");
  await page.goto("/#categories");
  await page
    .getByRole("button", { name: "เพิ่มกิจกรรม การออกกำลังกาย", exact: true })
    .click();
  let form = page.getByRole("dialog");
  const title = "หลักฐาน E2E " + Date.now();
  await form.getByLabel("ชื่อกิจกรรม", { exact: true }).fill("");
  await expect(form.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue("");
  await form.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
  await form.getByLabel("เวลาเริ่มต้น").fill("16:00");
  await form.getByLabel("เวลาสิ้นสุด").fill("17:00");
  await form
    .getByLabel("รายละเอียด / ลักษณะกิจกรรม")
    .fill("วิ่งและฝึกกีฬาร่วมกับเพื่อน พร้อมหลักฐานการเข้าร่วม");
  await form
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles({
      name: "script.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(form.getByRole("alert")).toContainText("รองรับเฉพาะรูป");
  await form
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles([
      path.resolve("tests/fixtures/evidence.png"),
      path.resolve("tests/fixtures/evidence.pdf"),
    ]);
  await expect(form.locator(".pending-file")).toHaveCount(2);
  await expect(form.getByRole("alert")).toHaveCount(0);
  await form
    .locator(".evidence-section")
    .screenshot({ path: "test-results/evidence-create.png" });
  await form
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(form).not.toBeVisible();
  await page.goto("/#activities");
  await page.getByLabel("ค้นหากิจกรรม").fill(title);
  await expect(page.locator(".activity-entry")).toHaveCount(1);
  await page.locator(".activity-entry .table-title").click();
  await expect(page.getByRole("dialog").locator(".evidence-file")).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("dialog").getByAltText("หลักฐาน evidence.png"),
  ).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .getByAltText("หลักฐาน evidence.png")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  const pdfDownload = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "ดาวน์โหลดหลักฐาน evidence.pdf", exact: true })
    .click();
  expect((await pdfDownload).suggestedFilename()).toBe("evidence.pdf");
  await page.reload();
  await page.getByLabel("ค้นหากิจกรรม").fill(title);
  await page.locator(".activity-entry .table-title").click();
  await expect(page.getByRole("dialog").locator(".evidence-file")).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: "แก้ไข / ส่งกิจกรรม", exact: true })
    .click();
  form = page.getByRole("dialog");
  await form.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title + " แก้ไข");
  await expect(form.locator(".evidence-file")).toHaveCount(2);
  await form
    .getByRole("button", { name: "นำหลักฐาน evidence.pdf ออก", exact: true })
    .click();
  await form
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles({
      name: "updated.png",
      mimeType: "image/png",
      buffer: await fs.readFile("tests/fixtures/evidence.png"),
    });
  await form
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(form).not.toBeVisible();
  await page.locator(".activity-entry .table-title").click();
  await expect(page.getByRole("dialog").locator(".evidence-file")).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("link", {
      name: "ดาวน์โหลดหลักฐาน evidence.pdf",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "แก้ไข / ส่งกิจกรรม", exact: true })
    .click();
  form = page.getByRole("dialog");
  await form
    .getByLabel("ส่งกิจกรรมให้ครู")
    .selectOption({ label: "★ ครูอรพรรณ วิริยะ · กลุ่มสาระวิทยาศาสตร์" });
  await form
    .getByRole("button", { name: "ส่งให้ครูตรวจ", exact: true })
    .click();
  await expect(form).not.toBeVisible();
  const context = await browser.newContext();
  const teacher = await context.newPage();
  await login(teacher, "teacher");
  await teacher
    .getByRole("button", { name: "ตรวจรายการค้าง", exact: true })
    .click();
  await teacher.getByLabel("ค้นหากิจกรรม").fill(title);
  await expect(teacher.locator(".review-entry")).toHaveCount(1);
  await teacher.locator(".review-entry .table-title").click();
  await expect(
    teacher.getByRole("dialog").locator(".evidence-file"),
  ).toHaveCount(2);
  await teacher
    .getByRole("dialog")
    .locator(".detail-evidence")
    .screenshot({ path: "test-results/evidence-teacher.png" });
  const download = teacher.waitForEvent("download");
  await teacher
    .getByRole("link", { name: "ดาวน์โหลดหลักฐาน updated.png", exact: true })
    .click();
  const file = await download;
  expect(await fs.readFile((await file.path())!)).toEqual(
    await fs.readFile("tests/fixtures/evidence.png"),
  );
  await teacher
    .getByRole("button", { name: "อนุมัติกิจกรรม", exact: true })
    .click();
  await teacher
    .getByRole("button", { name: "ยืนยันอนุมัติ", exact: true })
    .click();
  await page.getByRole("button", { name: "รีเฟรชข้อมูล", exact: true }).click();
  await page.locator(".activity-entry .table-title").click();
  await expect(
    page.getByRole("dialog").getByText("อนุมัติแล้ว", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator(".evidence-file")).toHaveCount(
    2,
  );
  await context.close();
});
