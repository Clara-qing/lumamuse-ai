# Spec — MirrorMate makeup coaching demo

## Target
Build a browser demo for a two-person competition team: a user provides a makeup reference, the app interprets it into a teachable eye-makeup or contour template, then guides practice through face-aligned visual overlays, concise coaching, recovery help, and a privacy-first ending.

## Inputs
Reference image from local device, selected target area, selected style, optional live camera.

## Outputs
Interactive single-route site; all user media stays in browser memory. Deployment artifact produced by `pnpm build`.

## Success command
`pnpm test`

## Base commit
none (repository has no commit)

## Scope cuts
No server upload, account, commerce, medical advice, beauty scoring, arbitrary tutorial reconstruction, or production-grade face/brush tracking. Reference parsing and visual feedback are explicitly presented as a competition demo.

