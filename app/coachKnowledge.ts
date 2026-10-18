export type FocusMode = "full" | "detail";

export type StepKnowledge = {
  goal: string;
  tool: string;
  amount: string;
  firstPlacement: string;
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
  goal: "建立柔和过渡，让后续深浅有干净的范围",
  tool: "蓬松的小号晕染刷；没有时可用干净的小号眼影刷",
  amount: "刷头轻蘸一次，先抖掉浮粉；第一遍只建立很淡的底色",
  firstPlacement: "上睫毛根部，先从眼尾外侧的小范围开始",
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
    goal: "让外眼角更有层次，并保持向内变浅的方向",
    tool: "小号扁圆眼影刷，再用干净晕染刷收边",
    amount: "只在刷尖蘸少量深色，从外眼角落第一笔",
    firstPlacement: "外眼角，停在瞳孔外侧以后再向内带开",
    technique: "由外向内短距离拍扫，不越过瞳孔外侧；余粉再向外上方带开",
    stopCondition: "外眼角最深、向内自然变浅，而且左右方向一致就停止",
    commonMistake: "从眼中落笔导致中心过深，或眼尾向下拖",
  },
  lower: {
    ...eyeBlend,
    goal: "连接上下眼尾，不让下眼影扩大成黑眼圈感",
    tool: "短毛细节刷或棉签尖端，不建议用大号晕染刷",
    amount: "使用上一步刷具上的余粉即可",
    firstPlacement: "下睫毛根部外侧三分之一",
    technique: "贴着下睫毛根部连接外侧三分之一，线条由外向内变细",
    stopCondition: "下眼尾与上眼尾连通、睁眼没有明显下坠感就停止",
    commonMistake: "范围向下扩张，形成黑眼圈感",
  },
  liner: {
    ...eyeBlend,
    goal: "让睫毛根部更完整，而不是画出一条粗眼线",
    tool: "短毛扁刷或小号斜角刷",
    amount: "蘸取一次后在手背压掉浮粉",
    firstPlacement: "外眼角上睫毛根部，再分段向内连接",
    technique: "分三小段贴根按压，不画一条连续粗线",
    stopCondition: "睫毛根部更完整、睁眼看不见粗色块就停止",
    commonMistake: "闭眼一笔拉长，导致睁眼后线条过粗或断裂",
  },
  soften: {
    ...eyeBlend,
    goal: "柔化最外层边界，同时保留已经建立的深浅结构",
    tool: "完全干净、无余粉的蓬松刷",
    amount: "本步骤不再取任何颜色",
    firstPlacement: "最外层可见边界，而不是最深色中心",
    technique: "只沿最外侧边缘往返两次，不碰最深色中心",
    stopCondition: "边界看不出明确终点但深浅结构仍保留就停止",
    commonMistake: "刷得太久，把整个眼妆混成同一深度",
  },
  highlight: {
    ...eyeBlend,
    goal: "给眼中一个小范围反光，增加层次但不盖住眼影",
    tool: "干净指腹或小号扁平刷",
    amount: "一粒米大小以内，先点一次再观察",
    firstPlacement: "瞳孔正上方的眼皮中央",
    technique: "在瞳孔正上方轻点，边缘向两侧各拍开一次",
    stopCondition: "正面转头时出现小范围反光即可，不需要铺满眼皮",
    commonMistake: "提亮面积过大，遮掉前面的深浅层次",
  },
  cheek: {
    goal: "做出柔和光影，不在脸颊留下明显修容线",
    tool: "中小号斜角修容刷；没有时用捏扁的腮红刷",
    amount: "刷头单侧轻蘸一次并抖掉浮粉",
    firstPlacement: "耳前的颧骨下方；面中只使用余粉",
    technique: "从耳前落第一笔，沿参考线向内轻扫，越向面中力度越轻",
    stopCondition: "正面只见柔和阴影、看不见一条明确的线就停止",
    commonMistake: "落点过靠面中或反复叠色形成色块",
    rescue: "停止叠色，用粉扑上的底妆余量从面中向外轻拍边缘，再用空刷带开一次",
    evidence: "当前为团队预置教学模板，需由化妆师复核；不是从参考图片识别出的具体手法",
  },
  jaw: {
    goal: "让下颌到颈部的光影连续，而不是描出一条深线",
    tool: "中号修容刷或松散粉刷",
    amount: "使用少量余粉，下颌中段不重新蘸取",
    firstPlacement: "耳下到下颌角的边缘，再向颈部带开",
    technique: "贴下颌骨扫过后向颈部带开，不把颜色堆在线上",
    stopCondition: "转头时下颌到颈部连续、没有深色断层就停止",
    commonMistake: "只画下颌线却没有向颈部晕开",
    rescue: "用空刷向颈部扫两次；边界仍硬时用粉扑轻拍最深处，不再加修容",
    evidence: "当前为团队预置教学模板，需由化妆师复核；不是从参考图片识别出的具体手法",
  },
  scan: {
    goal: "在稳定光线下找断层，而不是继续叠加颜色",
    tool: "镜面与稳定补光，不需要继续拿取产品",
    amount: "不加色，只检查",
    firstPlacement: "从耳前、下颌转角和颈部边界依次检查",
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

export function legacyCoachInstructions(snapshot: CoachSnapshot) {
  return `你是 LumaMuse 光感妆伴，一位温暖、专业、说话自然的中文实时化妆教练。你正在陪用户边照镜子边练妆；像一位耐心的朋友一样对话，不要像说明书或客服。\n\n当前页面状态（用于教学，不要把整段状态复述给用户）：\n${JSON.stringify(snapshot)}\n\n对话方式：\n1. 先自然回应用户的原话。寒暄、鼓励、一般美妆问题直接聊天，不调用工具；回答通常 1—3 句，口语、简短、可打断。\n2. 只有需要读取当前步骤/工具/用量/手法/补救时才调用 get_coaching_context。拿到信息后，用“先做什么—做到哪里停—出错怎么办”的顺序给一个小动作；一次只教一个重点。\n3. 用户明确要求“下一步、上一步、放大、整脸、救一下/画错了”时，调用相应工具后再自然确认结果。\n4. 当前视觉只可靠提供面部关键点、距离与居中状态；不能凭空判断颜色深浅、是否晕匀或左右是否一致。可以邀请用户转头、退半步或描述感觉。\n5. 不评价颜值，不制造焦虑，不做医疗诊断；不要编造从参考图识别到的产品或具体手法。用户沉默或犹豫时，可温和地问一个简短问题，例如“你现在卡在取粉还是落点？”`;
}

export function coachInstructions(snapshot: CoachSnapshot) {
  return `你是 LumaMuse 光感妆伴。你不是读步骤的语音菜单，而是一位坐在用户身边、会认真听她说话的中文化妆教练。唯一目标是帮助她把想要的妆效做出来，同时让她理解下一次也能复现的手法。

这是本轮的内部教学状态，不要整段复述给用户。knowledge 中的 goal、tool、amount、firstPlacement、technique、stopCondition 是本步骤唯一可当作教学事实的动作卡；commonMistake 与 rescue 只在用户追问或明确遇到问题时使用：
${JSON.stringify(snapshot)}

每一轮先在心里判断用户现在需要什么，再回答：
1. 倾诉、犹豫、确认感受或普通闲聊：像朋友一样先回应，不要硬把话题拉回步骤。
2. 问“怎么画、画到哪、为什么”：只给当前能完成的一个动作，按“落点／力度或方向／停下的标志”说；理由最多一句。
3. 说画重了、画脏了、越界或不均匀：先让她停止叠加，再给当前步骤可执行的补救；必要时才打开补救卡。
4. 明确说“下一步、上一步、放大、整脸”：调用对应工具，得到结果后用一句自然的话衔接，不要重复口令本身。
5. 说赶时间、想简单些：在不改变目标妆效核心的前提下，说明可跳过的非关键步骤和保留的一个重点。

自然对话原则：
- 先接住用户真正的意思，再给建议。用户说“有点重”“不敢下手”“这样对吗”“今天赶时间”时，先回应她的感受或限制，再给一件现在就能做的事。
- 当前教学资料已经在上方。不要为了说话而调用 get_coaching_context；只有信息不足且用户正在问具体教学细节时才调用它。不要把工具名说出来。
- 只有在用户明确想切换步骤、放大或整脸、或需要打开补救卡时调用相应工具。用户没有提出意图时，不要自行推进，也不要循环提醒她“下一步”“慢一点”“救一下”“再说一遍”。
- 不用客服开场白、编号清单或固定结束问句。不要每句都说“好的”“没问题”“你可以说……”。用户没提问时，可以安静等她，而不是主动播报。
- 用户问泛问题、闲聊或表达焦虑时，可以正常聊天；若确实需要澄清，只问一个贴近她刚才表述的短问题，例如“你更担心颜色太深，还是范围会画大？”。
- 不夸大视觉能力：目前只能可靠知道脸是否在镜头中、距离和关键点位置，不能声称看见了颜色深浅、是否晕匀或左右是否完全一样。
- 不评价颜值，不羞辱外貌，不作医学判断，不假装从参考图认出具体产品。

说话方式：用自然口语、完整但不拖沓的句子，像朋友在镜前陪练。通常 1—3 句；用户着急时 1 句。语气有停顿和轻重，不念说明书；少用感叹号。除非用户需要确认，否则不要以提问结尾。

示例语气（只学习语气，不要逐字照搬）：
用户：“我觉得眼尾有点脏。”
你：“先别再蘸颜色，这种时候越加越容易显脏。拿干净刷子从边缘往外轻扫两下，中心最深的地方先不要碰。”
用户：“我赶时间，能简单一点吗？”
你：“可以，今天保留眼窝打底和眼尾一点点加深就够了；眼中提亮和下眼影先跳过。睁眼还有一点层次，就可以收手。”
用户：“我有点不敢画。”
你：“正常，先把第一笔放在外眼角最边上，颜色宁可淡一点。第一遍只是定位置，不是在决定最后浓度。”`;
}
