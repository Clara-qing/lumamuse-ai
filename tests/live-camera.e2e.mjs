import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const root=new URL("..",import.meta.url).pathname;
const temp=await mkdtemp(join(tmpdir(),"mirrormate-e2e-"));
const portrait=join(temp,"portrait.jpg"),video=join(temp,"portrait.y4m");
const image=await fetch("https://storage.googleapis.com/mediapipe-assets/portrait.jpg");
assert.equal(image.ok,true,"MediaPipe portrait fixture must download");
await writeFile(portrait,Buffer.from(await image.arrayBuffer()));

function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:root,stdio:"ignore"});p.on("exit",code=>code===0?resolve():reject(new Error(`${command} exited ${code}`)));p.on("error",reject)})}
await run("ffmpeg",["-y","-loop","1","-i",portrait,"-vf","crop=700:700:60:120,scale=640:480","-t","12","-r","30","-pix_fmt","yuv420p",video]);

const server=spawn(process.execPath,[join(root,"node_modules/vinext/dist/cli.js"),"dev","--port","4173"],{cwd:root,env:{...process.env,WRANGLER_LOG_PATH:join(temp,"wrangler.log")},stdio:["ignore","inherit","inherit"]});
try{
  for(let i=0;i<60;i++){try{const r=await fetch("http://localhost:4173");if(r.ok)break}catch{ /* wait for the local preview server */ }await new Promise(r=>setTimeout(r,500));if(i===59)throw new Error("preview server did not start")}
  const browser=await chromium.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream",`--use-file-for-fake-video-capture=${video}`,"--enable-webgl","--ignore-gpu-blocklist"]});
  const context=await browser.newContext({permissions:["camera"],viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  await page.goto("http://localhost:4173",{waitUntil:"networkidle"});
  await page.getByRole("button",{name:/用文字描述风格/}).click();
  await page.getByRole("button",{name:/开启摄像头，实时试妆/}).click();
  await page.getByText("478 点面部网格跟踪中").first().waitFor({timeout:30000});
  await page.getByText("距离与位置合适").waitFor({timeout:15000});
  const accept=page.getByRole("button",{name:"我满意，用这个妆效教我"});
  assert.equal(await accept.isEnabled(),true,"tracking readiness must unlock acceptance");
  await accept.click();
  await page.getByText("STEP 3 · 对镜跟练").waitFor();
  await page.getByText("眼窝打底").first().waitFor();
  await page.getByText("操作镜头 · 按箭头上妆").waitFor();
  await page.getByText("目标妆效 · 实时对照").waitFor();
  await page.getByText("镜面箭头从睫毛根部向上轻扫").waitFor();
  await page.getByLabel("语音陪练").waitFor();
  assert.equal(
    await page.locator(".dual-mirror-stage .face-mesh-canvas").count(),
    2,
    "coaching must render both the teaching and target-look overlays",
  );
  await browser.close();
  console.log("E2E PASS: style → live 478-point tracking → calibrated acceptance → dual coaching with direction");
}finally{server.kill("SIGTERM")}
