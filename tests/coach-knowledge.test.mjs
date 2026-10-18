import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../app/coachKnowledge.ts", import.meta.url);

test("provides all realtime coaching tools and a context-bound instruction", async () => {
  const { coachInstructions, knowledgeByZone, realtimeCoachTools } = await import(moduleUrl.href);
  assert.deepEqual(
    realtimeCoachTools.map((tool) => tool.function.name),
    ["get_coaching_context", "move_step", "set_mirror_view", "open_rescue"],
  );
  assert.equal(typeof knowledgeByZone.outer.goal, "string");
  assert.equal(typeof knowledgeByZone.outer.firstPlacement, "string");
  assert.equal(typeof knowledgeByZone.outer.rescue, "string");
  const instructions = coachInstructions({
    lookName: "日常消肿眼妆",
    stepIndex: 1,
    totalSteps: 4,
    stepTitle: "眼尾加深",
    instruction: "从外眼角向内晕染。",
    tip: "余粉先轻点。",
    zone: "outer",
    direction: "向外上方",
    tracking: "居中",
    meshStatus: "tracking",
    focusMode: "detail",
    knowledge: knowledgeByZone.outer,
  });
  assert.match(instructions, /日常消肿眼妆/);
  assert.match(instructions, /先接住用户真正的意思/);
  assert.match(instructions, /不要循环提醒她“下一步”“慢一点”“救一下”“再说一遍”/);
  assert.match(instructions, /每一轮先在心里判断用户现在需要什么/);
  assert.match(instructions, /唯一可当作教学事实的动作卡/);
  assert.match(instructions, /用户没有提出意图时，不要自行推进/);
  assert.match(instructions, /不念说明书/);
  assert.match(instructions, /不夸大视觉能力/);
});
