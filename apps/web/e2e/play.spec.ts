import { expect, type Page, test } from "@playwright/test";

async function clickHit(page: Page, id: string) {
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-busy", "false");
  await expect(canvas).toHaveAttribute(`data-hit-${id}`, /,/);
  const xy = await canvas.getAttribute(`data-hit-${id}`);
  const [x, y] = (xy ?? "0,0").split(",").map(Number);
  await canvas.click({ position: { x, y } });
  await expect(canvas).toHaveAttribute("data-busy", "false", { timeout: 4000 });
}

test("home shows ArrowFlow and Play", async ({ page }) => {
  await page.goto("/?skipSplash=1");
  await expect(page.getByRole("heading", { name: "ArrowFlow" })).toBeVisible();
  await expect(page.getByTestId("home-play")).toBeVisible();
  const name = page.getByTestId("home-name");
  const level = page.getByTestId("home-level");
  await expect(name).toBeVisible();
  await expect(level).toBeVisible();
  await expect(name).toHaveText(/^[A-Z][a-z]+ [A-Z][a-z]+ [1-9]\d{0,3}$/);
});

test("leagues page does not say Local or stub", async ({ page }) => {
  await page.goto("/league");
  await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body.toLowerCase()).not.toMatch(/\blocal\b|\bstub\b|coming soon|todo|guest/i);
  await expect(page.getByTestId("league-play")).toBeVisible();
  await expect(page.getByTestId("league-note")).toBeVisible();
});

test("splash then home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("splash")).toBeVisible();
  await expect(page.getByTestId("home-play")).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId("splash")).toHaveCount(0);
});

test("play opens a board canvas", async ({ page }) => {
  await page.goto("/?skipSplash=1");
  await page.getByTestId("home-play").click();
  await expect(page.getByTestId("board-canvas")).toBeVisible();
  await expect(page.getByTestId("hud-hearts")).toHaveAttribute("data-hearts", "3");
});

test("packed campaign level renders more than one path", async ({ page }) => {
  await page.goto("/play/flow_0015");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-piece-count", /^(?:[2-9]|\d{2,})$/);
});

test("campaign daily and league routes exist", async ({ page }) => {
  await page.goto("/?skipSplash=1");
  await expect(page.getByTestId("tabbar")).toBeVisible();
  await page.getByTestId("tab-collection").click();
  await page.getByTestId("collection-campaign").click();
  await expect(page.getByRole("heading", { name: "Campaign" })).toBeVisible();
  await expect(page.getByTestId("level-flow_0015")).toBeVisible();
  await page.goto("/daily");
  await expect(page.getByTestId("daily-play")).toBeVisible();
  await page.goto("/league");
  await expect(page.getByTestId("league-play")).toBeVisible();
});

test("tapping a free piece removes it", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-piece-count", "2");
  await clickHit(page, "B");
  await expect(canvas).toHaveAttribute("data-piece-count", "1");
});

test("blocked piece turns red and hearts go 3 to 2 then stay 2", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  const hearts = page.getByTestId("hud-hearts");
  await expect(hearts).toHaveAttribute("data-hearts", "3");
  await clickHit(page, "A");
  await expect(canvas).toHaveAttribute("data-red", /A/);
  await expect(hearts).toHaveAttribute("data-hearts", "2");
  await clickHit(page, "A");
  await expect(hearts).toHaveAttribute("data-hearts", "2");
  await expect(canvas).toHaveAttribute("data-red", /A/);
});

test("undo restores hearts and red state", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  const hearts = page.getByTestId("hud-hearts");
  await clickHit(page, "A");
  await expect(hearts).toHaveAttribute("data-hearts", "2");
  await page.getByTestId("btn-undo").click();
  await expect(hearts).toHaveAttribute("data-hearts", "3");
  await expect(canvas).toHaveAttribute("data-red", "");
});

test("completing a solo board shows win card", async ({ page }) => {
  await page.goto("/play/flow_0001");
  await clickHit(page, "A");
  await expect(page.getByTestId("win-card")).toBeVisible();
  await expect(page.getByTestId("win-card")).toHaveAttribute("data-won", "true");
});

test("winning flow_0001 advances Home to level 2", async ({ page }) => {
  await page.goto("/?skipSplash=1");
  await expect(page.getByTestId("home-level")).toHaveText("Level 1");
  await page.goto("/play/flow_0001?mode=campaign");
  await clickHit(page, "A");
  await expect(page.getByTestId("win-card")).toBeVisible();
  await expect(page.getByTestId("win-next")).toBeVisible();
  await page.getByTestId("win-home").click();
  await expect(page.getByTestId("home-level")).toHaveText("Level 2");
  await expect(page.getByTestId("home-play")).toHaveAttribute("href", /flow_0002/);
});

test("unknown campaign id shows Level unavailable", async ({ page }) => {
  await page.goto("/play/flow_9999");
  await expect(page.getByTestId("level-unavailable")).toBeVisible();
  await expect(page.getByTestId("level-unavailable")).toContainText("Level unavailable");
});

test("weave takes real time on a free solo level", async ({ page }) => {
  await page.goto("/play/flow_0001");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-piece-count", "1");
  await expect(canvas).toHaveAttribute("data-busy", "false");
  await expect(canvas).toHaveAttribute("data-hit-A", /,/);
  const xy = await canvas.getAttribute("data-hit-A");
  const [x, y] = (xy ?? "0,0").split(",").map(Number);
  await canvas.click({ position: { x, y } });
  await expect(canvas).toHaveAttribute("data-busy", "true");
  await expect(canvas).toHaveAttribute("data-piece-count", "1");
  await page.waitForTimeout(50);
  await expect(canvas).toHaveAttribute("data-piece-count", "1");
  await expect(canvas).toHaveAttribute("data-busy", "false", { timeout: 2000 });
  await expect(canvas).toHaveAttribute("data-piece-count", "0");
});

test("starting lattice and fit box stay after a piece leaves", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-lattice-count", "4");
  await expect(canvas).toHaveAttribute("data-ray-count", "0");
  const bounds = await canvas.getAttribute("data-bounds");
  expect(bounds).toBeTruthy();
  await clickHit(page, "B");
  await expect(canvas).toHaveAttribute("data-piece-count", "1");
  await expect(canvas).toHaveAttribute("data-lattice-count", "4");
  await expect(canvas).toHaveAttribute("data-ray-count", "0");
  await expect(canvas).toHaveAttribute("data-bounds", bounds!);
});

test("hash toggles heading rays and keeps lattice dots", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  const btn = page.getByTestId("btn-lines");
  await expect(canvas).toHaveAttribute("data-lattice-count", "4");
  await expect(canvas).toHaveAttribute("data-ray-count", "0");
  await expect(btn).toHaveAttribute("data-lines", "off");
  await btn.click();
  await expect(canvas).toHaveAttribute("data-lines", "on");
  await expect(canvas).toHaveAttribute("data-ray-count", "2");
  await expect(canvas).toHaveAttribute("data-lattice-count", "4");
  await btn.click();
  await expect(canvas).toHaveAttribute("data-lines", "off");
  await expect(canvas).toHaveAttribute("data-ray-count", "0");
  await expect(canvas).toHaveAttribute("data-lattice-count", "4");
});

test("queued tap starts after the current weave commits", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-busy", "false");
  await expect(canvas).toHaveAttribute("data-hit-A", /,/);
  await expect(canvas).toHaveAttribute("data-hit-B", /,/);
  const xyB = await canvas.getAttribute("data-hit-B");
  const xyA = await canvas.getAttribute("data-hit-A");
  const [bx, by] = (xyB ?? "0,0").split(",").map(Number);
  const [ax, ay] = (xyA ?? "0,0").split(",").map(Number);
  await canvas.click({ position: { x: bx, y: by } });
  await expect(canvas).toHaveAttribute("data-busy", "true");
  await canvas.click({ position: { x: ax, y: ay } });
  await expect(canvas).toHaveAttribute("data-piece-count", "0", { timeout: 4000 });
  await expect(page.getByTestId("win-card")).toBeVisible();
});

test("fit recenters without locking pan", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toHaveAttribute("data-scale", "1.00");
  await canvas.hover({ position: { x: 180, y: 420 } });
  await page.mouse.wheel(0, -480);
  await expect(canvas).not.toHaveAttribute("data-scale", "1.00");
  await page.getByTestId("btn-fit").click();
  await expect(canvas).toHaveAttribute("data-scale", "1.00");
  await expect(canvas).toHaveAttribute("data-pan-x", "0.0");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await canvas.hover({ position: { x: 200, y: 400 } });
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + 400, { steps: 8 });
  await page.mouse.up();
  const panX = Number(await canvas.getAttribute("data-pan-x"));
  expect(Math.abs(panX)).toBeGreaterThan(8);
});

test("lines toggle is observable", async ({ page }) => {
  await page.goto("/play/flow_0002");
  const btn = page.getByTestId("btn-lines");
  await expect(page.getByTestId("btn-hint")).toBeVisible();
  await expect(page.getByTestId("hud-home")).toBeVisible();
  await expect(btn).toHaveAttribute("data-lines", "off");
  await btn.click();
  await expect(btn).toHaveAttribute("data-lines", "on");
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-lines", "on");
  await btn.click();
  await expect(btn).toHaveAttribute("data-lines", "off");
});
