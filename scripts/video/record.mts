import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = "https://spend-aware-agent.vercel.app";
const OUT = "scripts/video/out";
const VOICE = "en-US-AndrewNeural";

const beats = [
  {
    id: "home",
    text: "This is Spend-Aware Agent. It buys Sui data per request, scores what each purchase actually added, and stores that verdict in Walrus Memory. The next similar question skips the sources that did not deliver.",
  },
  {
    id: "receipt",
    text: "The card is a real mainnet run. The first time this question was asked, memory was empty. The agent bought four sources and spent two point four cents. The second time, it skipped Staking Scope, Alpha Wire, and Chain Pulse Pro, and bought only Chain Pulse, for two tenths of a cent.",
  },
  {
    id: "how",
    text: "Every run does three things. It recalls past evaluations. It pays with x four oh two on Sui mainnet, using Tatum's gRPC gateway for the chain data. Gas is sponsored, so the wallet holds U S D C and no SUI. Then it writes one score per purchase back to Walrus. Scores older than seven days get tested again.",
  },
  {
    id: "sources",
    text: "Six sellers sit behind those paywalls, from two tenths of a cent up to just under a cent. Alpha Wire claims every topic and returns nothing you can check. It is there so the agent has a source it should learn to refuse.",
  },
  {
    id: "console",
    text: "The console spends the money. The agent wallet, what sellers have earned, and the memory count are live from mainnet.",
  },
  {
    id: "ask",
    text: "I'll ask how healthy the Sui network is, one more time.",
  },
  {
    id: "running",
    text: "It reads Walrus first. Sources that scored poorly are skipped, with the reason written out. Only a source that still earns its price gets paid. That payment is a real U S D C transfer on Sui.",
    untilAnswer: true,
  },
  {
    id: "answer",
    text: "The answer comes from the live checkpoint, its age, total transactions, the reference gas price, and the epoch. Under it is what this run spent, what buying every source would have cost, and the share it kept.",
  },
  {
    id: "ledger",
    text: "The learned panel averages every evaluation. Chain Pulse stays. The decoys stay skipped. That memory is why a later answer costs a fraction of the first. The code is public on GitHub, and this site is the live demo.",
  },
];

function sh(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function probe(file: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      file,
    ]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("exit", (code) => (code === 0 ? resolve(Number(out.trim())) : reject(new Error(`ffprobe ${file}`))));
  });
}

async function synth() {
  await mkdir(`${OUT}/audio`, { recursive: true });
  const durations: number[] = [];
  for (const [i, beat] of beats.entries()) {
    const file = `${OUT}/audio/${String(i).padStart(2, "0")}-${beat.id}.mp3`;
    await sh("edge-tts", ["--voice", VOICE, "--rate=-4%", `--text=${beat.text}`, `--write-media=${file}`]);
    durations.push(await probe(file));
    console.log(beat.id, durations.at(-1)?.toFixed(2));
  }
  return durations;
}

async function record(durations: number[]) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const paint = () => {
      if (document.getElementById("rec-cursor")) return;
      const cursor = document.createElement("div");
      cursor.id = "rec-cursor";
      cursor.style.cssText =
        "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#019d91;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 35%);pointer-events:none;";
      document.documentElement.appendChild(cursor);
      window.addEventListener("mousemove", (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      });
    };
    paint();
    document.addEventListener("DOMContentLoaded", paint);
  });

  const started = Date.now();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pay for chain data once" }).waitFor();
  const leadIn = (Date.now() - started) / 1000;

  const gaps: number[] = [];
  let failed = "";

  async function hold(seconds: number) {
    await page.waitForTimeout(Math.max(0, seconds) * 1000);
  }

  async function scrollTo(selector: string) {
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, selector);
  }

  for (const [i, beat] of beats.entries()) {
    const audio = durations[i];
    const began = Date.now();
    if (beat.id === "how") await scrollTo("#how");
    if (beat.id === "sources") await scrollTo("#sources");
    if (beat.id === "console") {
      await page.getByRole("link", { name: "Open the console" }).click();
      await page.getByRole("heading", { name: "Console" }).waitFor();
      await page.getByText("Memories").waitFor();
      await page.waitForFunction(() => {
        const values = [...document.querySelectorAll("dd")].map((node) => node.textContent?.trim());
        return values.some((value) => value && value !== "…" && value !== "-");
      });
    }
    if (beat.id === "ask") {
      const run = page.getByRole("button", { name: "Run" });
      await run.scrollIntoViewIfNeeded();
      const box = await run.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await run.click();
    }
    if (beat.id === "answer") {
      await page.getByRole("heading", { name: "Answer" }).scrollIntoViewIfNeeded();
    }
    if (beat.id === "ledger") {
      await page.locator("#ledger").scrollIntoViewIfNeeded();
    }

    const elapsed = (Date.now() - began) / 1000;
    let extra = 0;
    if (beat.untilAnswer) {
      const settled = page.getByRole("heading", { name: "Answer" }).or(page.locator("p.text-bad"));
      await settled.first().waitFor({ timeout: 120_000 });
      if (await page.locator("p.text-bad").count()) {
        failed = (await page.locator("p.text-bad").first().textContent()) ?? "run failed";
      }
      const after = (Date.now() - began) / 1000;
      extra = Math.max(0, after - audio);
      if (after < audio) await hold(audio - after);
    } else {
      await hold(audio - elapsed);
    }
    gaps.push(extra);
    console.log("beat", beat.id, "audio", audio.toFixed(2), "extra", extra.toFixed(2), failed || "");
    if (failed) break;
  }

  const video = page.video();
  await context.close();
  await browser.close();
  const webm = await video?.path();
  if (!webm) throw new Error("no video");
  return { webm, leadIn, gaps, failed };
}

async function mux(webm: string, leadIn: number, gaps: number[]) {
  const lines = ["ffconcat version 1.0"];
  for (const [i, beat] of beats.entries()) {
    if (i >= gaps.length) break;
    lines.push(`file 'audio/${String(i).padStart(2, "0")}-${beat.id}.mp3'`);
    if (gaps[i] > 0.05) {
      const silence = `${OUT}/audio/gap-${i}.mp3`;
      await sh("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=24000:cl=mono",
        "-t",
        gaps[i].toFixed(3),
        "-c:a",
        "libmp3lame",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-b:a",
        "48k",
        silence,
      ]);
      lines.push(`file 'audio/gap-${i}.mp3'`);
    }
  }
  await writeFile(`${OUT}/voice.txt`, lines.join("\n") + "\n");
  await sh("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${OUT}/voice.txt`,
    "-c:a",
    "libmp3lame",
    "-ar",
    "24000",
    "-ac",
    "1",
    "-b:a",
    "48k",
    `${OUT}/voice.mp3`,
  ]);
  await sh("ffmpeg", [
    "-y",
    "-ss",
    leadIn.toFixed(3),
    "-i",
    webm,
    "-i",
    `${OUT}/voice.mp3`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-shortest",
    `${OUT}/demo.mp4`,
  ]);
}

const durations = await synth();
const shot = await record(durations);
console.log(JSON.stringify(shot));
if (!shot.failed) await mux(shot.webm, shot.leadIn, shot.gaps);
