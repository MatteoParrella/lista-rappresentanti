// Renderizza reel.html fotogramma per fotogramma e lo codifica in MP4 con ffmpeg.
// Uso: node render.js <output.mp4> [fps]   oppure   node render.js --stills <cartella> t1 t2 ...
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.join(__dirname, "reel.html") + "?render=0" + (process.env.GUIDA ? "&guida=1" : ""));
  await page.evaluate(() => document.fonts.ready);

  if (args[0] === "--stills") {
    for (const t of args.slice(2)) {
      await page.evaluate((t) => render(t), Number(t));
      await page.screenshot({ path: path.join(args[1], `still-${t}.png`) });
    }
    await browser.close();
    return;
  }

  const out = args[0];
  const fps = Number(args[1] || 30);
  const durata = await page.evaluate(() => window.DURATA);
  const frames = Math.round(durata * fps);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => render(t), i / fps);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stderr.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
})();
