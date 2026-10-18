const plans = {
  daily: { name: "干净通勤眼妆", focus: "用浅色打底，外眼角轻轻加深，再把边界晕开。" },
  smoky: { name: "氛围烟熏眼妆", focus: "从眼尾少量铺色，向上、向外柔化，不要一次叠太重。" },
  contour: { name: "自然立体修容", focus: "从颧骨外侧向内带开，沿下颌向颈部衔接。" },
} as const;

type Look = keyof typeof plans;

export default async function LessonPage({ searchParams }: { searchParams: Promise<{ look?: string; intensity?: string }> }) {
  const params = await searchParams;
  const look: Look = params.look === "smoky" || params.look === "contour" ? params.look : "daily";
  const plan = plans[look];
  const intensity = Math.min(90, Math.max(15, Number(params.intensity) || 55));
  return <main className="lesson-page">
    <header className="lesson-header"><a href="/" aria-label="返回 LumaMuse 首页">LumaMuse · 光感妆伴</a><span>独立教学页</span></header>
    <section className={`lesson-hero lesson-${look}`}>
      <p className="kicker">STEP 3 · 对镜跟练</p><h1>{plan.name}</h1>
      <p>教学页已独立打开。这里不会自动调用摄像头或加载特效，你可以先安心看动作，再回到首页开启实时镜子。</p>
      <div className="lesson-intensity">本次建议浓度 <b>{intensity}%</b></div>
    </section>
    <section className="lesson-content">
      <article className="lesson-card action-card"><span>当前动作</span><h2>{plan.focus}</h2><p>拿起干净的刷具，先用最轻的力度完成一侧；确认范围合适后再做另一侧。</p></article>
      <ol className="lesson-steps">
        <li><b>01</b><div><strong>少量取色</strong><span>先从刷具余粉开始，宁少勿多。</span></div></li>
        <li><b>02</b><div><strong>按方向上妆</strong><span>{plan.focus}</span></div></li>
        <li><b>03</b><div><strong>停下来对照</strong><span>左右各退后半步看一次；过重时用干净刷具向外带开。</span></div></li>
      </ol>
      <aside className="lesson-tip"><b>新手补救</b><span>画出界时不要立刻叠遮瑕，先用干净刷具轻扫边缘两次。</span></aside>
    </section>
    <footer className="lesson-footer"><a className="secondary" href="/">返回首页，重新开启实时镜子</a><a className="primary" href="/">完成本步</a></footer>
  </main>;
}
