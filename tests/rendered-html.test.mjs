import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the MirrorMate product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /妆伴 MirrorMate/);
  assert.match(html, /喜欢的妆/);
  assert.match(html, /本地隐私模式/);
  assert.match(html, /上传妆容范本/);
  assert.match(html, /478 点实时定位/);
  assert.match(html, /满意后再教学/);
  assert.match(html, /用文字描述风格/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
