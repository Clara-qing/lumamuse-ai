# Spec — MirrorMate makeup coaching demo

## Target
Build a browser demo for a two-person competition team: a user provides a makeup reference or style description, previews the generated look on a live dense face mesh, adjusts and accepts it, then receives face-aligned step-by-step coaching, recovery help, and a privacy-first ending.

## Inputs
Reference image from local device and/or a style description, selected target area, intensity, optional live camera.

## Outputs
Interactive single-route site; all user media stays in browser memory. Deployment artifact produced by `pnpm build`.

## Success command
`pnpm test`

## Base commit
none (repository has no commit)

## Scope cuts
No server upload, account, commerce, medical advice, beauty scoring, arbitrary tutorial reconstruction, or brush tracking. The demo uses production MediaPipe face landmarks but heuristic makeup rendering and style interpretation.
