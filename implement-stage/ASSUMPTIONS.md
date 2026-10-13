# Assumption Ledger — MirrorMate demo
<!-- ASK mode: never -->

| ID | Under-determined by the request | Chosen | Class | Source |
|---|---|---|---|---|
| A-001 | What arbitrary reference-image understanding means for the demo | Extract a local color palette and require the user to confirm one of three validated teaching templates | semantic | default |
| A-002 | Whether live camera is mandatory | Offer camera mode with a deterministic demo-face fallback | interface | default |
| A-003 | What counts as automatic error detection | Demo detects user-declared practice difficulty and produces a bounded recovery instruction; it does not claim production vision scoring | semantic | default |
| A-004 | Supported makeup areas | Daily eye, smoky eye, and natural contour each use a four-step teaching path | interface | default |
| A-005 | Data persistence | Reference image and camera stream remain in browser memory and are cleared when the session resets | semantic | default |
| A-006 | Language and audience | Chinese mobile-first interface for competition judges and novice makeup users | interface | default |
| A-007 | Built-in reference | The no-upload path uses a clearly labelled built-in sample | interface | default |
| A-008 | Camera permission | Camera starts only after an explicit user action | interface | default |
| A-009 | Voice interaction | Use browser speech synthesis to read each step; no speech-recognition control is claimed | semantic | default |
| A-010 | AR alignment | Use MediaPipe Face Landmarker dense 3D landmarks to anchor eye, cheek, lip, and contour polygons in real time | semantic | default |
| A-011 | Session reset | Reset cancels speech and clears the reference, palette, template, camera state, and transient feedback | interface | default |
| A-012 | Meaning of “3D modeling” in a browser MVP | A 478-landmark metric face mesh with x/y/z coordinates and pose-following overlays; not a textured photogrammetric head model | semantic | default |
| A-013 | Open-ended style generation | Map reference palette plus user keywords onto bounded eye/blush/lip/contour parameters; clearly label it as a visual interpretation | semantic | default |
| A-014 | Model delivery and degraded mode | Load MediaPipe WASM from jsDelivr and the model from Google storage; show the deterministic demo face when camera access or model loading fails | interface | default |
| A-015 | When coaching begins | The user must explicitly mark the try-on result as satisfactory; its palette, template, and exact intensity become the teaching target | semantic | default |
| A-016 | Try-on controls | Users can switch preset interpretation, rebuild the three-shade palette from one swatch, and adjust effect intensity from 15–90% (default 55%) before acceptance | interface | default |
| A-017 | Text-style interpretation | Recognize bounded Chinese keyword groups for contour, smoky, temperature, and color mood; unmatched descriptions fall back to the daily template and neutral rose palette | semantic | default |
| A-018 | Step-specific spatial coaching | Eye steps use distinct full-eye, outer-corner, lash-line/lower-eye, and highlight landmark polygons; contour steps switch between cheek and jaw polygons | semantic | default |
| A-019 | Reference-image analysis | Sample opaque pixels, preferring non-near-white, non-near-black, chromatic pixels; if fewer than 12 remain, reuse all samples. Use deterministic three-cluster RGB k-means to estimate dark/mid/light colors plus temperature, saturation, contrast, intensity, and daily-vs-smoky direction | semantic | default |
| A-020 | Image-to-area inference | A finished reference image may suggest daily vs smoky contrast, but does not reliably prove contour intent; contour remains an explicit text/preset choice | semantic | default |
| A-021 | Input precedence | Explicit template/preset selection wins; edited text is interpreted on try-on; otherwise the reference-image recommendation is preserved | semantic | default |
| A-022 | Image-analysis failure | Decode, canvas, or empty-sample failure uses the neutral daily palette at 55% and is visibly labelled as a default rather than a successful analysis | semantic | default |

## Notes

- **A-001** — Reliable reconstruction of application order from one finished-look image is not defensible in this timeframe. Template confirmation keeps the experience honest and reversible.
- **A-003** — A labelled prototype feedback path is more credible than presenting simulated classification as a trained result.
- **A-012** — Dense landmarks provide enough geometry for convincing pose-following makeup and instruction zones without claiming full head reconstruction.
- **A-013** — A finished reference image does not contain ground-truth products or application order, so the generator produces an editable interpretation rather than asserting exact reconstruction.
