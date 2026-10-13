# Build Note — MirrorMate demo

| Rung | Feature | Acceptance check | Tier | Status |
|---|---|---|---|---|
| F0 | Product spine from reference to coaching surface | `pnpm build` | MUST | ✅ |
| F1 | Local reference upload and palette interpretation | `pnpm test` | MUST | ✅ |
| F2 | Interactive camera/demo mirror and step coaching | `pnpm test` | MUST | ✅ |
| F3 | Recovery feedback, privacy reset, responsive polish | `pnpm test` | MUST | ✅ |
| F4 | Social preview and hosted deployment | `pnpm build` | SHOULD | 进行中 |

## Run record

- F0: `pnpm build`, exit 0; root route and product shell rendered.
- F1: `pnpm test`, exit 0; local upload, palette extraction, template confirmation present.
- F2: `pnpm test`, exit 0; camera fallback, coaching steps, speech synthesis, overlays present.
- F3: `pnpm test`, exit 0; bounded rescue path, recap, reset, responsive styles present.
- Social preview generated once, inspected for exact headline text, and saved as `public/og.png`.

## Deferred

- Production face landmarking and brush tracking: requires model assets, calibration, and real-user validation.
- Open-ended reconstruction of any social-media makeup image: single-result images do not reveal reliable product order or technique.

## Blockers

None.
