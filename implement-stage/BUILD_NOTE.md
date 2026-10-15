# Build Note — MirrorMate demo

| Rung | Feature | Acceptance check | Tier | Status |
|---|---|---|---|---|
| F0 | Product spine from reference to coaching surface | `pnpm build` | MUST | ✅ |
| F1 | Local reference upload and palette interpretation | `pnpm test` | MUST | ✅ |
| F2 | Interactive camera/demo mirror and step coaching | `pnpm test` | MUST | ✅ |
| F3 | Recovery feedback, privacy reset, responsive polish | `pnpm test` | MUST | ✅ |
| F4 | Social preview and hosted deployment | `pnpm build` | SHOULD | ✅ |
| F5 | Dense 3D face landmark pipeline with fallback | `pnpm test` | MUST | ✅ |
| F6 | Reference/text style generation and live try-on controls | `pnpm test` | MUST | ✅ |
| F7 | Satisfaction gate into face-aligned coaching | `pnpm test` | MUST | ✅ |
| F8 | Updated deployment | `pnpm build` | SHOULD | ✅ |
| F9 | Reference-image palette clustering and style features | `pnpm test` | MUST | ✅ |
| F10 | Deploy reference-analysis upgrade | `pnpm build` | SHOULD | ✅ |
| F11 | Visible 478-point mesh and camera calibration | `pnpm test` | MUST | ✅ |
| F12 | Deploy calibration upgrade | `pnpm build` | SHOULD | ✅ |
| F13 | Browser E2E: style to real face tracking to coaching | `pnpm test:e2e` | MUST | ✅ |
| F14 | Final verified deployment | `pnpm build` | SHOULD | ✅ |
| F15 | 双镜同步对照、分步刷具箭头与更自然的混合模式 | `pnpm test` + `pnpm test:e2e` | MUST | ✅ |
| F16 | 实时语音陪练接入设计（不含密钥） | 文档审阅 | MUST | ✅ |
| F17 | 视频帧内妆效合成与柔边区域 Mask | `pnpm test` + `pnpm test:e2e` | MUST | ✅ |
| F18 | 双镜共享一次人脸推理 | `pnpm test` + `pnpm test:e2e` | MUST | ✅ |

## Run record

- F0: `pnpm build`, exit 0; root route and product shell rendered.
- F1: `pnpm test`, exit 0; local upload, palette extraction, template confirmation present.
- F2: `pnpm test`, exit 0; camera fallback, coaching steps, speech synthesis, overlays present.
- F3: `pnpm test`, exit 0; bounded rescue path, recap, reset, responsive styles present.
- Social preview generated once, inspected for exact headline text, and saved as `public/og.png`.
- F4: source version deployed successfully to the private Sites URL.
- F5: `pnpm test`, exit 0; MediaPipe 478-landmark pipeline, live canvas renderer, camera/model fallback present. Official WASM and model asset endpoints returned HTTP 200.
- F6: `pnpm test`, exit 0; local reference palette, style prompt mapping, preset switching, palette and intensity controls present.
- F7: `pnpm test`, exit 0; try-on acceptance is required before face-aligned teaching and the accepted intensity is carried into the session recap.
- F8: live face-mesh version deployed successfully to the private Sites URL.
- F9: `pnpm test`, exit 0; deterministic three-color clustering, temperature/contrast inference, intensity recommendation, and fallback covered by three unit tests.
- F10: reference-analysis version deployed successfully to the private Sites URL.
- F11: `pnpm test`, exit 0; optional face tesselation, scale/centering readiness, acceptance gate, and four calibration unit tests present.
- F12: visible-mesh and calibration version deployed successfully to the private Sites URL.
- F13: `pnpm test:e2e`, exit 0; headless Chrome consumed a fake-camera Y4M made from MediaPipe's portrait asset, reached 478-point tracking and ready calibration, unlocked acceptance, and entered the first coaching step.
- F16: `VOICE_AGENT_ARCHITECTURE.md` defines a single real-time coach, context tools, browser/server boundary, privacy guardrails, and required credentials without embedding a provider secret.
- F15: `pnpm test`, exit 0 (10 unit/render tests); `pnpm test:e2e`, exit 0; the verified camera path reaches two synchronized coaching overlays and the current-step direction copy.
- F17: `pnpm test`, exit 0 (10 tests); `pnpm test:e2e`, exit 0; video pixels are composited into the output canvas before face-mask blending, and the same live camera flow reaches the dual coaching view.
- F18: `pnpm test`, exit 0 (10 tests); `pnpm test:e2e`, exit 0; one tracker supplies landmarks to both coaching renderers while the verified camera flow retains step direction and target-look comparison.

## Deferred

- Brush/product tracking and production-quality makeup segmentation still require a labelled dataset and real-user validation.
- Open-ended reconstruction of any social-media makeup image: single-result images do not reveal reliable product order or technique.
- Production TikTok-level rendering needs region masks, texture assets and portrait/occlusion segmentation; this MVP uses landmarks plus blend modes and does not claim pixel-perfect reconstruction.

## Blockers

None.
