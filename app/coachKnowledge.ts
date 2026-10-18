export type FocusMode = "full" | "detail";

export type StepKnowledge = {
  tool: string;
  amount: string;
  technique: string;
  stopCondition: string;
  commonMistake: string;
  rescue: string;
  evidence: string;
};

export type CoachSnapshot = {
  lookName: string;
  stepIndex: number;
  totalSteps: number;
  stepTitle: string;
  instruction: string;
  tip: string;
  zone: string;
  direction: string;
  tracking: string;
  meshStatus: string;
  focusMode: FocusMode;
  knowledge: StepKnowledge;
};

const eyeBlend: StepKnowledge = {
  tool: "蓬松的小号晕染刷；没有时可用干净的小号眼影刷",
  amount: "刷头轻蘸一次，先抖掉浮粉；第一遍只建立很淡的底色",
  technique: "刷柄放平，手腕小幅往返，压力像扫掉桌面灰尘一样轻",
  stopCondition: "睁眼时看得到柔和层次，但边缘没有清晰色块就停止",
  commonMistake: "一次取粉太多，或为了显色反复扩大上界",
  rescue: "先停下叠色，用干净刷子只扫边缘两次；仍然明显时用少量肤色哑光粉轻压边界",
  evidence: "当前为团队预置教学模板，需由化妆师复核；不是从参考图片识别出的具体手法",
};

export const knowledgeByZone: Record<string, StepKnowledge> = {
  base: eyeBlend,
  outer: {
    ...eyeBlend,
    tool: "小号扁圆眼影刷，再用干净晕染刷收边",
    amount: "只在刷尖蘸少量深色，从外眼角落第一笔",
    technique: "由外向内短距离拍扫，不越过瞳孔外侧；余粉再向外上方带开",
    stopCondition: "外眼角最深、向内自然变浅，而且左右方向一致就停止",
    commonMistake: "从眼中落笔导致中心过深，或眼尾向下拖",
  },
  lower: {
    ...eyeBlend,
    tool: "短毛细节刷或棉签尖端，不建议用大号晕染刷",
    amount: "使用上一步刷具上的余粉即可",
    technique: "贴着下睫毛根部连接外侧三分之一，线条由外向内变细",
    stopCondition: "下眼尾与上眼尾连通、睁眼没有明显下坠感就停止",
    commonMistake: "范围向下扩张，形成黑眼圈感",
  },
  liner: {
    ...eyeBlend,
    tool: "短毛扁刷或小号斜角刷",
    amount: "蘸取一次后在手背压掉浮粉",
    technique: "分三小段贴根按压，不画一条连续粗线",
    stopCondition: "睫毛根部更完整、睁眼看不见粗色块就停止",
    commonMistake: "闭眼一笔拉长，导致睁眼后线条过粗或断裂",
  },
  soften: {
    ...eyeBlend,
    tool: "完全干净、无余粉的蓬松刷",
    amount: "本步骤不再取任何颜色",
    technique: "只沿最外侧边缘往返两次，不碰最深色中心",
    stopCondition: "边界看不出明确终点但深浅结构仍保留就停止",
    commonMistake: "刷得太久，把整个眼妆混成同一深度",
  },
  highlight: {
    ...eyeBlend,
    tool: "干净指腹或小号扁平刷",
    amount: "一粒米大小以内，先点一次再观察",
    technique: "在瞳孔正上方轻点，边缘向两侧各拍开一次",
    stopCondition: "正面转头时出现小范围反光即可，不需要铺满眼皮",
    commonMistake: "提亮面积过大，遮掉前面的深浅层次",
  },
  cheek: {
    tool: "中小号斜角修容刷；没有时用捏扁的腮红刷",
    amount: "刷头单侧轻蘸一次并抖掉浮粉",
    technique: "从耳前落第一笔，沿参考线向内轻扫，越向面中力度越轻",
    stopCondition: "正面只见柔和阴影、看不见一条明确的线就停止",
    commonMistake: "落点过靠面中或反复叠色形成色块",
    rescue: "停止叠色，用粉扑上的底妆余量从面中向外轻拍边缘，再用空刷带开一次",
    evidence: "当前为团队预置教学模板，需由化妆师复核；不是从参考图片识别出的具体手法",
  },
  jaw: {
    tool: "中号修容刷或松散粉刷",
    amount: "使用少量余粉，下颌中段不重新蘸取",
    technique: "贴下颌骨扫过后向颈部带开，不把颜色堆在线上",
    stopCondition: "转头时下颌到颈部连续、没有深色断层就停止",
    commonMistake: "只画下颌线却没有向颈部晕开",
    rescue: "用空刷向颈部扫两次；边界仍硬时用粉扑轻拍最深处，不再加修容",
    evidence: "当前为团队预置教学模板，需由化妆师复核；不是从参考图片识别出的具体手法",
  },
  scan: {
    tool: "镜面与稳定补光，不需要继续拿取产品",
    amount: "不加色，只检查",
    technique: "缓慢左右转头约 30 度，依次看耳前、下颌转角和颈部边界",
    stopCondition: "两侧边界连续且没有单独跳出的色块即可结束",
    commonMistake: "在光线不稳定时误以为颜色不均并继续叠加",
    rescue: "先固定光线再复检；系统置信度不足时只提示观察，不替用户下结论",
    evidence: "当前为团队预置验妆流程；视觉模型只负责定位，尚不能可靠判断所有妆面质量",
  },
};

export const realtimeCoachTools = [
  {
    type: "function",
    function: {
      name: "get_coaching_context",
      description: "读取当前妆容步骤、面部追踪状态、工具、用量、手法、停止条件和教学证据。回答具体教学问题前调用。",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "move_step",
      description: "根据用户明确请求切换上一步或下一步。",
      parameters: {
        type: "object",
        properties: { direction: { type: "string", enum: ["previous", "next"] } },
        required: ["direction"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_mirror_view",
      description: "按用户要求切换整脸视图或放大当前教学局部。",
      parameters: {
        type: "object",
        properties: { mode: { type: "string", enum: ["full", "detail"] } },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_rescue",
      description: "用户说画错、太重、越界、不均匀或不知道怎么补救时，打开当前步骤的局部补救卡。",
      parameters: {
        type: "object",
        properties: { problem: { type: "string" } },
        required: ["problem"],
        additionalProperties: false,
      },
    },
  },
] as const;

export function coachInstructions(snapshot: CoachSnapshot) {
  return `你是 LumaMuse 光感妆伴，一位温暖、专业、说话自然的中文实时化妆教练。你正在陪用户边照镜子边练妆；像一位耐心的朋友一样对话，不要像说明书或客服。\n\n当前页面状态（用于教学，不要把整段状态复述给用户）：\n${JSON.stringify(snapshot)}\n\n对话方式：\n1. 先自然回应用户的原话。寒暄、鼓励、一般美妆问题直接聊天，不调用工具；回答通常 1—3 句，口语、简短、可打断。\n2. 只有需要读取当前步骤/工具/用量/手法/补救时才调用 get_coaching_context。拿到信息后，用“先做什么—做到哪里停—出错怎么办”的顺序给一个小动作；一次只教一个重点。\n3. 用户明确要求“下一步、上一步、放大、整脸、救一下/画错了”时，调用相应工具后再自然确认结果。\n4. 当前视觉只可靠提供面部关键点、距离与居中状态；不能凭空判断颜色深浅、是否晕匀或左右是否一致。可以邀请用户转头、退半步或描述感觉。\n5. 不评价颜值，不制造焦虑，不做医疗诊断；不要编造从参考图识别到的产品或具体手法。用户沉默或犹豫时，可温和地问一个简短问题，例如“你现在卡在取粉还是落点？”`;
}
