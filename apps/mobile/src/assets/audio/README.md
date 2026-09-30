# Recorded narration

Drop recorded voice files here to replace text-to-speech. They are bundled and cached for
offline use automatically; no code changes are needed.

```
audio/{lang}/{id}.mp3      lang = en | hi | sat
```

Ids:

| Narration                  | Id                            |
| -------------------------- | ----------------------------- |
| Module briefing            | `{moduleId}.briefing`         |
| Step instruction           | `{moduleId}.{stepId}`         |
| Step instruction (3D mode) | `{moduleId}.{stepId}.3d`      |
| Step success               | `{moduleId}.{stepId}.success` |
| Step hint                  | `{moduleId}.{stepId}.hint`    |

Example: `audio/hi/ar-basics.tap-cone.mp3`.

Santali (`sat`) falls back to the Hindi recording, then to Hindi text-to-speech, because
phones do not ship a Santali voice.
