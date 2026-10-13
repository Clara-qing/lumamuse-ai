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
| F8 | Updated deployment | `pnpm build` | SHOULD | 进行中 |

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

## Deferred

- Brush/product tracking and production-quality makeup segmentation still require a labelled dataset and real-user validation.
- Open-ended reconstruction of any social-media makeup image: single-result images do not reveal reliable product order or technique.

## Blockers

None.
