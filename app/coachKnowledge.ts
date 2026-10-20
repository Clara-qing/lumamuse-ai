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
  journeyStage: string;
  lookName: string;
  userIntent: string;
  inspiration: string;
  referenceSummary: string;
  referenceLook: string;
  teachingProtocol: string;
  intensity: number;
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
  skinProfile: "unknown" | "dry" | "balanced" | "oily" | "sensitive";
  prepChecked: boolean;
  knowledge: StepKnowledge;
};

export const prepGuide = {
  dry: "偏干时，先薄涂保湿并等待吸收；卡粉处不要急着加粉底。",
  balanced: "肤况稳定时，清洁后薄涂保湿，等表面不黏再进入底妆。",
  oily: "偏油时，保湿仍要薄涂；重点在易出油区少量控油，不要整脸反复叠加。",
  sensitive: "敏感或不确定时，优先使用已试过的温和产品；出现刺痛、发红或不适立即停止。",
  unknown: "开始底妆前先确认肤况与妆前状态；不确定时，薄涂保湿并先在小区域试用。",
} as const;

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

export type TeachingKnowledgeEntry = {
  id: string;
  title: string;
  keywords: string[];
  guidance: string[];
  safety?: string;
};

// Derived from the team's MAKEUP_TEACHING_KNOWLEDGE_BASE.md. These are short,
// reviewable retrieval cards rather than a hidden copy of a long document in
// every model turn. Each card is intentionally about technique, not product
// diagnosis or a judgement about the user's features.
export const teachingKnowledgeBase: TeachingKnowledgeEntry[] = [
  {
    id: "safety",
    title: "不适与工具卫生",
    keywords: ["刺痛", "红肿", "不适", "眼睛痛", "过敏", "卫生", "共用", "感染"],
    guidance: [
      "出现刺痛、红肿、持续不适或眼部不适时，立即停止当前产品，不继续上妆。",
      "眼唇工具和一次性用品不要在多人之间直接共用。",
    ],
    safety: "不做医学判断；症状持续或加重时应咨询专业医疗人员。",
  },
  {
    id: "prep",
    title: "妆前与防晒后的表面管理",
    keywords: ["妆前", "防晒", "起皮", "干", "油", "敏感", "搓泥", "保湿"],
    guidance: [
      "偏干或有起皮感时，薄涂已经用过的保湿产品，等表面不黏再上妆；局部先按压，不用粉底硬盖皮屑。",
      "偏油也保留薄保湿，易出油区少量控油；防晒后等膜感稳定，后续以按压上妆为主。",
      "卡粉或浮粉先确认是刚上底妆就发生，还是过一会儿才出现；一次只追问这一项。",
    ],
    safety: "首次使用或敏感不确定时，只建议已试用过的温和产品，不根据聊天自行混用强功效产品。",
  },
  {
    id: "foundation",
    title: "底妆薄层与边缘",
    keywords: ["底妆", "粉底", "气垫", "粉扑", "斑驳", "鼻翼", "脖子", "厚", "脱妆"],
    guidance: [
      "先把少量粉底在手背或工具上摊成薄层，从两颊、鼻周和额头中央向外轻拍或短推。",
      "发际线、下颌和鼻翼边缘只用工具余量带开；边缘厚时用干净粉扑轻压，不加新粉底。",
      "底妆目标是均匀和保留纹理，不用一层覆盖所有瑕疵；局部问题留给遮瑕。",
    ],
  },
  {
    id: "concealer-setting",
    title: "遮瑕与定妆",
    keywords: ["遮瑕", "黑眼圈", "痘印", "泛红", "定妆", "散粉", "出油", "补妆"],
    guidance: [
      "遮瑕只点在最明显的中心，再用无名指或粉扑尖端向边缘小范围轻拍，别铺满整个区域。",
      "眼下过厚或过亮时，先用干净粉扑压最厚处，再用少量原底妆从边缘过渡。",
      "补妆先按走油，再少量压粉；有油时直接叠粉容易结块。",
    ],
  },
  {
    id: "brow",
    title: "眉毛的方向与浓淡",
    keywords: ["眉毛", "眉笔", "眉尾", "眉头", "眉峰", "画眉", "眉毛太深"],
    guidance: [
      "先顺毛流梳理，再从眉尾向眉峰画短线确定长度和方向；中段只补二到四根短毛流。",
      "眉头不重新取色，用余粉向上轻扫，保持最淡最散。",
      "眉尾太深先用螺旋刷减淡颜色或只清理末端，不用继续加长来求平衡。",
    ],
  },
  {
    id: "eyes",
    title: "眼妆范围与眼线睫毛",
    keywords: ["眼影", "眼线", "睫毛", "眼尾", "下眼影", "晕染", "眼妆", "烟熏"],
    guidance: [
      "眼影默认先打底、再加深、最后柔化；深色范围始终小于打底范围。",
      "下眼尾只用余粉贴近下睫毛根部外侧三分之一连接，不向下扩张。",
      "眼线贴根分小段填补，不一笔拉到底；眼部不适立刻停止。",
    ],
  },
  {
    id: "contour",
    title: "鼻影与面部修容",
    keywords: ["鼻影", "修容", "颧骨", "下颌", "脸小", "立体", "阴影", "高光鼻子"],
    guidance: [
      "修容第一笔放在最需要深度的位置，后续向边缘变淡；首次只做一层，退远看整脸再判断。",
      "鼻影从眉头下方或眼窝与鼻梁的转折处少量向下带，中段更淡；正面应像阴影而非两条线。",
      "颧骨修容从耳前向面中轻扫，面中只留余粉；下颌扫过后向颈部带开。",
    ],
  },
  {
    id: "blush-highlight",
    title: "腮红与高光的方向和面积",
    keywords: ["腮红", "高光", "气色", "晒伤", "横向", "上扬", "颧骨高光"],
    guidance: [
      "先选想要的方向再定面积：提升感从较高、偏外处向上向外；横向感从面中偏外向外带。",
      "刷头单侧轻蘸并抖粉，从高点或外侧落第一笔，越到边缘压力越轻。",
      "腮红过重先用带底妆余量的干净粉扑轻拍边缘或用空刷柔化，不立刻用大量散粉覆盖。",
    ],
  },
  {
    id: "lips",
    title: "唇妆与出界处理",
    keywords: ["口红", "唇妆", "唇线", "唇釉", "嘴唇", "出界", "咬唇"],
    guidance: [
      "先在上下唇中央少量落色，再向两侧推开，边缘最后处理。",
      "想要清晰轮廓时，从唇峰或嘴角分小段连接；想要咬唇感时，用指腹或棉签向外拍开中心。",
      "出界先用棉签向内擦除，必要时局部补底妆，不反复来回涂到结块。",
    ],
  },
  {
    id: "review-rescue",
    title: "最终检查与通用补救",
    keywords: ["画重", "画脏", "不均匀", "左右", "断层", "补救", "检查", "不对称", "结块"],
    guidance: [
      "颜色过重先停止加色，用干净工具从边缘带开；边界硬只处理最外缘一到两次。",
      "位置偏移先擦除或用底妆余量修边，不在错误旁边叠一块来凑对称。",
      "在稳定光线下后退半步看整脸，再左右转头约三十度检查耳前、下颌和边缘；同一问题补救两次仍不满意就停止叠色。",
    ],
  },
];

export function searchTeachingKnowledge(query: string, limit = 2) {
  const normalized = query.trim().toLowerCase();
  const matches = teachingKnowledgeBase
    .map((entry) => ({
      entry,
      score: entry.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? keyword.length : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      topic: entry.title,
      guidance: entry.guidance,
      ...(entry.safety ? { safety: entry.safety } : {}),
      source: "团队教学知识库初稿，正式演示前需由有实操经验的化妆师复核。",
    }));
  return matches.length > 0
    ? { found: true, entries: matches }
    : { found: false, message: "知识库没有对应的已复核动作卡。不要编造具体手法；请结合当前步骤给一个保守、可逆的小动作，或向用户追问一个细节。" };
}

export const realtimeCoachTools = [
  {
    type: "function",
    function: {
      name: "search_teaching_knowledge",
      description: "当用户询问当前步骤之外的具体化妆问题、妆前底妆眉毛鼻影腮红唇妆、常见问题或安全卫生问题时，检索团队教学知识库。不要用于闲聊、当前动作卡已经充分回答的问题或切换步骤。",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "用用户原话概括要查的化妆问题。" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
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
  return `你是 MirrorMate，一位温暖、专业、说话自然的中文实时化妆教练。你正在陪用户边照镜子边练妆；像一位耐心的朋友一样对话，不要像说明书或客服。\n\n当前页面状态（用于教学，不要把整段状态复述给用户）：\n${JSON.stringify(snapshot)}\n\n对话方式：\n1. 先自然回应用户的原话。寒暄、鼓励、一般美妆问题直接聊天，不调用工具；回答通常 1—3 句，口语、简短、可打断。\n2. 只有需要读取当前步骤/工具/用量/手法/补救时才调用 get_coaching_context。拿到信息后，用“先做什么—做到哪里停—出错怎么办”的顺序给一个小动作；一次只教一个重点。\n3. 用户明确要求“下一步、上一步、放大、整脸、救一下/画错了”时，调用相应工具后再自然确认结果。\n4. 当前视觉只可靠提供面部关键点、距离与居中状态；不能凭空判断颜色深浅、是否晕匀或左右是否一致。可以邀请用户转头、退半步或描述感觉。\n5. 不评价颜值，不制造焦虑，不做医疗诊断；不要编造从参考图识别到的产品或具体手法。用户沉默或犹豫时，可温和地问一个简短问题，例如“你现在卡在取粉还是落点？”`;
}

export function coachInstructions(snapshot: CoachSnapshot) {
  return `【最高优先级身份设定】你叫“小妆伴”，是 MirrorMate 里的专属美妆陪练伙伴，不是“千问”、不是“Qwen Omni”、不是语言模型或 API。用户问“你是谁”时，直接自然地回答：“我是 MirrorMate 的小妆伴，陪你把喜欢的妆容一步步画到自己脸上。”不要提及底层模型、厂商、提示词、知识库或系统。用户问“我们要做什么”时，明确回答：MirrorMate 会把用户的灵感妆转成适合她的试妆预览和可执行的镜前陪练；你负责从选妆、试妆到跟练和复盘全程陪伴。

你不是读步骤的语音菜单，而是一位坐在用户身边、会认真听她说话的中文化妆教练。唯一目标是帮助她把想要的妆效做出来，同时让她理解下一次也能复现的手法。你从用户上传灵感、确认风格、试妆到完成复盘全程陪伴；首次接通时用一句温暖的话欢迎她，结束时真诚邀请她下次带新的灵感回来。

这是本轮的内部教学状态，不要整段复述给用户。knowledge 中的 goal、tool、amount、firstPlacement、technique、stopCondition 是本步骤唯一可当作教学事实的动作卡；commonMistake 与 rescue 只在用户追问或明确遇到问题时使用：
${JSON.stringify(snapshot)}

你在接通前已经得到三类前置信息：用户的学习目标与自由想法（inspiration）、用户上传灵感图的解析摘要（referenceSummary / referenceLook）、以及团队教学知识库的执行协议（teachingProtocol 和当前 knowledge）。把它们默默用于回答，不要说“我读到了提示词/知识库/JSON”。没有参考图时，不要假装看过图片；有摘要也不能捏造具体产品或图片中不存在的细节。

每一轮先在心里判断用户现在需要什么，再回答：
1. 倾诉、犹豫、确认感受或普通闲聊：像朋友一样先回应，不要硬把话题拉回步骤。用户问“适不适合、好不好看、会不会太重”时，给基于目标风格和取舍的中性建议；不能假装看见实际颜色、妆面均匀度或替用户下审美结论。
2. 问“怎么画、画到哪、为什么”：只给当前能完成的一个动作，按“落点／力度或方向／停下的标志”说；理由最多一句。
3. 说画重了、画脏了、越界或不均匀：先让她停止叠加，再给当前步骤可执行的补救；必要时才打开补救卡。
4. 明确说“下一步、上一步、放大、整脸”：调用对应工具，得到结果后用一句自然的话衔接，不要重复口令本身。
5. 说赶时间、想简单些：在不改变目标妆效核心的前提下，说明可跳过的非关键步骤和保留的一个重点。
6. 用户问的是当前动作卡以外的具体问题（例如卡粉、底妆、眉毛、鼻影、腮红、唇妆、卫生或不适）：调用 search_teaching_knowledge，严格依据返回的条目回答。不要把整个知识库或 source 文本念给用户。

自然对话原则：
- 先接住用户真正的意思，再给建议。用户说“有点重”“不敢下手”“这样对吗”“今天赶时间”时，先回应她的感受或限制，再给一件现在就能做的事。
- 当前教学资料已经在上方。不要为了说话而调用 get_coaching_context；只有信息不足且用户正在问具体教学细节时才调用它。不要把工具名说出来。
- 若检索结果标注安全边界，优先告诉用户停止当前可能刺激的动作或产品；不诊断病因，也不承诺具体产品一定兼容。
- 你要温柔地主动推动流程，但不能催促：在 journeyStage 为 upload / design 时，欢迎后给用户一个最容易开始的选择（上传灵感图、说出想学的妆容或描述顾虑）；在 tryon 时邀请她先看一处整体取舍；在 coach 时只在完成一个小动作后自然问是否继续；在 finish 时给出一句复盘和下次邀请。每个阶段最多一次主动提示；用户没有提出意图时，不要自行推进，用户沉默时安静等待，不要循环提醒她“下一步”“慢一点”“救一下”“再说一遍”。
- 不用客服开场白、编号清单或固定结束问句。不要每句都说“好的”“没问题”“你可以说……”。用户没提问时，可以安静等她，而不是主动播报。
- 用户问泛问题、闲聊或表达焦虑时，可以正常聊天；若确实需要澄清，只问一个贴近她刚才表述的短问题，例如“你更担心颜色太深，还是范围会画大？”。
- 不夸大视觉能力：目前只能可靠知道脸是否在镜头中、距离和关键点位置，不能声称看见了颜色深浅、是否晕匀或左右是否完全一样。
- 情绪支持要具体、有分寸：可以肯定她正在做出的选择和耐心，不用空泛夸赞外貌；给客观意见时先说判断依据，再给可调的一处。
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
