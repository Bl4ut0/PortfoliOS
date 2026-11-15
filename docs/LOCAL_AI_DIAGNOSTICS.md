# Local AI failures and recovery

The Local AI controller and worker use the same explicit `@mlc-ai/web-llm` 0.2.88 runtime. The worker URL is versioned independently so a new controller does not reuse an old worker response. Models and their cached weights remain outside SystemFS/Drive document backup.

## What the debug report means

A download progress entry does not identify the cause of a later generation failure. Export **Settings → Debug** after the failure. The report includes:

- **Last Error:** the actual worker message, including WebLLM string rejections, nested errors and numeric runtime codes. Clients receive a normal Error with a message.
- **Failure:** loading versus generation, model, app surface, timestamp and rejection type.
- **Request:** character counts, requested output tokens and the model record's context-window limit. Character counts are not exact tokenizer counts; WebLLM reports actual token overflow.
- **GPU:** modern adapter metadata, fallback status, required-feature availability and buffer limit.

Prompt/editor text is not added to request diagnostics. The failure itself may contain runtime details returned by the engine. Loading progress entries contain only model, progress and text to keep the useful failure tail readable.

The excerpt ending at a 43% download cannot establish the original failure's exact cause. A separate real-GPU reproduction using Gemma 2 returned a string `ContextWindowSizeExceededError` that the previous controller replaced with its generic failure message. Normal chat also succeeded on that same model; this is not evidence that every device or every failed request had a context error.

## Recovery behavior

All local models receive up to six short relevant project summaries rather than the entire portfolio/bookmark list. The model's memory size does not imply a larger context window. Broadly oversized requests fail before dispatch; the engine still enforces its actual tokenizer limit. User input is not silently truncated.

Known context/request-validation rejections leave the loaded model ready for a shorter or corrected retry. A successful retry clears the old error. Unknown runtime, device or load failures still stop the worker and surface the actual error for diagnosis. Cached weights are not erased. An old generation cannot reset or disable a newly selected model.

GPU adapter/required-feature checks occur before weight downloads. Missing `shader-f16` is a capability failure, not a reason to recommend another model that also requires it. Cloud fallback and automatic model changes are not introduced.

Loop Studio has a separate bounded JSON output budget (256 tokens for lighter local models, 384 otherwise). Structured draft output bypasses prose de-duplication and portfolio fallback text; the app still validates the draft and requires Apply/Play. A larger budget does not guarantee valid or musically useful model output.

## Verification

```sh
node scripts/check-app-contracts.js
node scripts/check-local-ai-browser.js
```

The browser regression uses Playwright/Chrome and a controlled WebLLM transport; locate Playwright with `PORTFOLIOS_PLAYWRIGHT` when it is not installed directly. It does not download weights or contact providers. It exercises string/numeric/nested failures, debug export without prompt text, GPU feature rejection before loading, warm retry, streaming, preserved JSON and a stale model's late rejection.

A separate actual-GPU check used the real pinned runtime, model WASM and Gemma 2 weights on an NVIDIA adapter. Official weight files were checked against their published sizes/digests and streamed over loopback for the test to avoid slow external transfers. It reproduced the old generic error on an overlong request, preserved the error and warm model after the fix, successfully retried, and validated one two-track music draft. This is a targeted inference check, not certification of all local models, Linux/phone drivers, creative quality or arbitrary model output.
