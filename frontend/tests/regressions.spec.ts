import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

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
async function write(page: Page, path: string, body: unknown, method = "POST") {
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  const response = await page.request.fetch("/api" + path, {
    method,
    data: body,
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function draft(page: Page, title: string, pending = false) {
  const term = (await (await page.request.get("/api/terms")).json())[0];
  const category = (
    await (
      await page.request.get("/api/activity-categories?termId=" + term.id)
    ).json()
  )[0];
  let activity = await write(page, "/activities", {
    termId: term.id,
    categoryId: category.id,
    title,
    description: "original description",
    activityDate: term.startsOn,
    startTime: "10:00",
    endTime: "11:00",
  });
  if (pending) {
    const teachers = await (
      await page.request.get("/api/teachers?search=")
    ).json();
    activity = await write(page, "/activities/" + activity.id + "/submit", {
      reviewerId: teachers.items.find((teacher: any) =>
        teacher.fullName.includes("ครูอรพรรณ"),
      ).id,
      expectedVersion: activity.version,
    });
  }
  return activity;
}
async function activitiesPage(page: Page, teacher = false) {
  await page.goto(teacher ? "/#reviews" : "/#activities");
  await expect(
    page.getByRole("heading", {
      name: teacher ? "ตรวจกิจกรรม" : "รายการกิจกรรม",
      exact: true,
    }),
  ).toBeVisible();
}

test("expired session retains unsaved fields and evidence through login on mobile", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "student");
  await activitiesPage(page);
  await page
    .getByRole("button", { name: "บันทึกกิจกรรม", exact: true })
    .first()
    .click();
  const title = "REGRESSION_UNSAVED_" + Date.now();
  await page.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
  await page
    .getByLabel("รายละเอียด / ลักษณะกิจกรรม")
    .fill("unsaved description");
  await page
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/evidence.png"));
  await context.clearCookies();
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  const recovery = page.getByRole("dialog", {
    name: "เซสชันหมดอายุ",
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toBeHidden();
  await page.screenshot({
    path: "test-results/session-recovery-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(recovery).toBeVisible();
  await recovery
    .getByRole("button", { name: "บัญชีนักเรียน", exact: true })
    .click();
  await recovery
    .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
    .click();
  await expect(recovery).not.toBeVisible();
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue(
    title,
  );
  await expect(page.getByLabel("รายละเอียด / ลักษณะกิจกรรม")).toHaveValue(
    "unsaved description",
  );
  await expect(page.locator(".pending-file")).toContainText("evidence.png");
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("ค้นหากิจกรรม", { exact: true }).fill(title);
  await page.locator(".activity-entry .table-title").click();
  await expect(page.locator(".evidence-file")).toContainText("evidence.png");
});

test("session expiry during evidence upload resumes the saved draft without duplication", async ({
  page,
  context,
}) => {
  await login(page, "student");
  const activity = await draft(page, "REGRESSION_UPLOAD_SESSION");
  await activitiesPage(page);
  await page.getByLabel("ค้นหากิจกรรม", { exact: true }).fill(activity.title);
  await page.locator(".activity-entry .table-title").click();
  await page
    .getByRole("button", { name: "แก้ไข / ส่งกิจกรรม", exact: true })
    .click();
  await page
    .getByLabel("ชื่อกิจกรรม", { exact: true })
    .fill("REGRESSION_UPLOAD_RECOVERED");
  await page
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/evidence.png"));
  await page.route(
    `**/api/activities/${activity.id}/attachments`,
    async (route) => {
      if (route.request().method() === "POST") {
        await context.clearCookies();
        await route.continue();
        await page.unroute(`**/api/activities/${activity.id}/attachments`);
      } else await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  const recovery = page.getByRole("dialog", {
    name: "เซสชันหมดอายุ",
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await recovery
    .getByRole("button", { name: "บัญชีนักเรียน", exact: true })
    .click();
  await recovery
    .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
    .click();
  await expect(recovery).not.toBeVisible();
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue(
    "REGRESSION_UPLOAD_RECOVERED",
  );
  await expect(page.locator(".pending-file")).toHaveCount(1);
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const final = (
    await (await page.request.get("/api/activities/" + activity.id)).json()
  ).activity;
  expect(final.title).toBe("REGRESSION_UPLOAD_RECOVERED");
  const files = await (
    await page.request.get(`/api/activities/${activity.id}/attachments`)
  ).json();
  expect(files).toHaveLength(1);
  expect(files[0].originalName).toBe("evidence.png");
});

test("a different account cannot see or recover the previous account's draft", async ({
  page,
  context,
}) => {
  await login(page, "student");
  await activitiesPage(page);
  await page
    .getByRole("button", { name: "บันทึกกิจกรรม", exact: true })
    .click();
  await page
    .getByLabel("ชื่อกิจกรรม", { exact: true })
    .fill("PRIVATE_UNSAVED_DRAFT");
  await context.clearCookies();
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  const recovery = page.getByRole("dialog", {
    name: "เซสชันหมดอายุ",
    exact: true,
  });
  await recovery
    .getByLabel("อีเมล", { exact: true })
    .fill("student2@sama.local");
  await recovery.getByLabel("รหัสผ่าน", { exact: true }).fill("SamaDemo123!");
  await recovery
    .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".welcome-card h1")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page
    .getByRole("button", { name: "บันทึกกิจกรรม", exact: true })
    .click();
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue("");
  await expect(page.locator(".pending-file")).toHaveCount(0);
});

test("conflicted edits require explicit reload and preserve the other browser's changes", async ({
  page,
}) => {
  await login(page, "student");
  const activity = await draft(page, "REGRESSION_CONFLICT_ORIGINAL");
  await activitiesPage(page);
  await page.getByLabel("ค้นหากิจกรรม", { exact: true }).fill(activity.title);
  await page.locator(".activity-entry .table-title").click();
  await page
    .getByRole("button", { name: "แก้ไข / ส่งกิจกรรม", exact: true })
    .click();
  await page
    .getByLabel("ชื่อกิจกรรม", { exact: true })
    .fill("REGRESSION_MY_EDIT");
  await page
    .getByLabel("แนบหลักฐาน", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/evidence.png"));
  const other = await write(
    page,
    "/activities/" + activity.id,
    {
      ...activity,
      title: "REGRESSION_OTHER_EDIT",
      description: "other browser description",
      expectedVersion: activity.version,
    },
    "PATCH",
  );
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(page.locator(".conflict-notice")).toBeVisible();
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue(
    "REGRESSION_MY_EDIT",
  );
  await expect(page.locator(".pending-file")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "บันทึกแบบร่าง", exact: true }),
  ).toBeDisabled();
  const unchanged = (
    await (await page.request.get("/api/activities/" + activity.id)).json()
  ).activity;
  expect(unchanged.version).toBe(other.version);
  expect(unchanged.description).toBe("other browser description");
  await page
    .getByRole("button", { name: "โหลดข้อมูลล่าสุด", exact: true })
    .click();
  await expect(page.locator(".conflict-notice")).toHaveCount(0);
  await expect(page.getByLabel("ชื่อกิจกรรม", { exact: true })).toHaveValue(
    other.title,
  );
  await expect(page.getByLabel("รายละเอียด / ลักษณะกิจกรรม")).toHaveValue(
    other.description,
  );
  await expect(page.locator(".pending-file")).toHaveCount(0);
  await page
    .getByLabel("ชื่อกิจกรรม", { exact: true })
    .fill("REGRESSION_MERGED_EDIT");
  await page
    .getByRole("button", { name: "บันทึกแบบร่าง", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const final = (
    await (await page.request.get("/api/activities/" + activity.id)).json()
  ).activity;
  expect(final.title).toBe("REGRESSION_MERGED_EDIT");
  expect(final.description).toBe(other.description);
});

test("bulk conflict clears stale selection and allows choosing the remaining current items", async ({
  page,
  browser,
}) => {
  await login(page, "student");
  const first = await draft(page, "REGRESSION_BULK_CONFLICT_A", true);
  const second = await draft(page, "REGRESSION_BULK_CONFLICT_B", true);
  const context = await browser.newContext();
  try {
    const teacher = await context.newPage();
    await login(teacher, "teacher");
    await activitiesPage(teacher, true);
    await teacher
      .getByLabel("ค้นหากิจกรรม", { exact: true })
      .fill("REGRESSION_BULK_CONFLICT_");
    await expect(teacher.locator(".review-entry")).toHaveCount(2);
    await teacher.getByLabel("เลือกทั้งหมดในหน้านี้").check();
    await write(teacher, "/reviews/bulk", {
      items: [{ activityId: first.id, expectedVersion: first.version }],
      decision: "APPROVE",
    });
    await teacher
      .locator(".bulk-bar")
      .getByRole("button", { name: "อนุมัติ", exact: true })
      .click();
    await teacher
      .getByRole("dialog")
      .getByRole("button", { name: "ยืนยันการอนุมัติ", exact: true })
      .click();
    await expect(teacher.getByRole("dialog")).not.toBeVisible();
    await expect(
      teacher.getByText("รายการเปลี่ยนแปลงแล้ว กรุณาเลือกจากข้อมูลล่าสุดใหม่", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(teacher.locator(".bulk-bar")).toHaveCount(0);
    await expect(teacher.locator(".review-entry")).toHaveCount(1);
    await teacher.locator(".review-entry input[type=checkbox]").check();
    await teacher
      .locator(".bulk-bar")
      .getByRole("button", { name: "อนุมัติ", exact: true })
      .click();
    await teacher
      .getByRole("dialog")
      .getByRole("button", { name: "ยืนยันการอนุมัติ", exact: true })
      .click();
    await expect(teacher.getByRole("dialog")).not.toBeVisible();
    const final = (
      await (await page.request.get("/api/activities/" + second.id)).json()
    ).activity;
    expect(final.status).toBe("APPROVED");
  } finally {
    await context.close();
  }
});

test("approving the final item on page two returns to the remaining first page", async ({
  page,
  browser,
}) => {
  await login(page, "student");
  for (let i = 0; i < 13; i++)
    await draft(page, "REGRESSION_PAGINATION_" + i, true);
  const context = await browser.newContext();
  try {
    const teacher = await context.newPage();
    await login(teacher, "teacher");
    await activitiesPage(teacher, true);
    await teacher
      .getByLabel("ค้นหากิจกรรม", { exact: true })
      .fill("REGRESSION_PAGINATION_");
    await expect(teacher.locator(".review-entry")).toHaveCount(12);
    await teacher
      .getByRole("button", { name: "หน้าถัดไป", exact: true })
      .click();
    await expect(teacher.locator(".review-entry")).toHaveCount(1);
    await teacher.locator(".review-entry input[type=checkbox]").check();
    await teacher
      .locator(".bulk-bar")
      .getByRole("button", { name: "อนุมัติ", exact: true })
      .click();
    await teacher
      .getByRole("dialog")
      .getByRole("button", { name: "ยืนยันการอนุมัติ", exact: true })
      .click();
    await expect(teacher.getByRole("dialog")).not.toBeVisible();
    await expect(teacher.locator(".review-entry")).toHaveCount(12);
    await expect(teacher.locator(".pagination")).toContainText("1 / 1");
  } finally {
    await context.close();
  }
});

test("timeline shows the original teacher after resubmission to a different teacher", async ({
  page,
  browser,
}) => {
  await login(page, "student");
  const activity = await draft(page, "REGRESSION_TIMELINE_REVIEWER", true);
  const context = await browser.newContext();
  try {
    const teacher = await context.newPage();
    await login(teacher, "teacher");
    const original = await (await teacher.request.get("/api/me")).json();
    await write(teacher, "/reviews/bulk", {
      items: [{ activityId: activity.id, expectedVersion: activity.version }],
      decision: "REJECT",
      reason: "REGRESSION_RETURN_BY_ORIGINAL_TEACHER",
    });
    const rejected = (
      await (await page.request.get("/api/activities/" + activity.id)).json()
    ).activity;
    const teachers = await (
      await page.request.get("/api/teachers?search=")
    ).json();
    const replacement = teachers.items.find(
      (entry: any) => entry.id !== original.id,
    );
    await write(page, "/activities/" + activity.id + "/submit", {
      reviewerId: replacement.id,
      expectedVersion: rejected.version,
    });
    await activitiesPage(page);
    await page.getByLabel("ค้นหากิจกรรม", { exact: true }).fill(activity.title);
    await page.locator(".activity-entry .table-title").click();
    const event = page
      .locator(".timeline li")
      .filter({ hasText: "REGRESSION_RETURN_BY_ORIGINAL_TEACHER" });
    await expect(event).toContainText(original.fullName);
    await expect(event).not.toContainText(replacement.fullName);
  } finally {
    await context.close();
  }
});
