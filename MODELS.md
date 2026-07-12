# PortfoliOS Model Catalog & Compatibility Matrix

This document tracks all local (WebGPU/WebLLM) and cloud models supported in PortfoliOS, including their quantization settings, repository sources, hardware requirements, and verification history.

---

## 1. Local Models (WebGPU)

These models run entirely in the browser using WebGPU and the WebLLM runtime. They are compiled to MLC format (`q4f16_1` quantization).

| Model ID & Name | Size / VRAM | Repo Source (HF / GitHub) | Status / Verification Notes |
| :--- | :--- | :--- | :--- |
| **SmolLM2 360M** <br>`SmolLM2-360M-Instruct-q4f16_1-MLC` | 376MB | [mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC](https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC) | **Active & Verified** (Default)<br>- Official prebuilt model from MLC-AI catalog.<br>- Loads WASM directly from GitHub raw CDN.<br>- Highly stable, works out of the box. |
| **Qwen 2.5 0.5B** <br>`Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | 420MB | [mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC) | **Active & Verified**<br>- Official prebuilt model from MLC-AI catalog.<br>- Stable performance for low-mid spec devices. |
| **Llama 3.2 1B** <br>`Llama-3.2-1B-Instruct-q4f16_1-MLC` | 980MB | [mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC) | **Active & Verified**<br>- Official prebuilt model from MLC-AI catalog.<br>- Recommended for devices with 4GB+ system VRAM. |
| **Gemma 3 1B** <br>`gemma-3-1b-it-q4f16_1-MLC` | 600MB | [mlc-ai/gemma-3-1b-it-q4f16_1-MLC](https://huggingface.co/mlc-ai/gemma-3-1b-it-q4f16_1-MLC) | **Active**<br>- Official prebuilt model.<br>- Requires `shader-f16` GPU feature support.<br>- May prompt for HuggingFace authentication depending on gating terms. |
| **Gemma 2 2B** <br>`gemma-2-2b-it-q4f16_1-MLC` | 1.6GB | [mlc-ai/gemma-2-2b-it-q4f16_1-MLC](https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC) | **Active**<br>- High-quality local reasoning.<br>- Needs 3GB+ VRAM allocated for browser execution. |

---

## 2. Model Source Policy

Only models that provide useful instruction/chat responses and are available through the maintained WebLLM catalog belong in the application selector.

1. **No community gating bypasses**: Do not route users through an unofficial model fork solely to avoid provider authentication or license agreements. Hide or remove a model that cannot be loaded reliably from its maintained source.
2. **Minimum capability**: Ultra-small models that return control tokens, repetitive fragments, or cannot sustain basic chat should not be exposed as assistants.
3. **Avoid broken mirrors**:
   - `hf-mirror.com` (China CDN) **must remain disabled** because it fails to resolve outside of China or fails to verify LFS assets correctly.
   - Run tests directly to `huggingface.co` or GitHub raw CDNs.

---

## 3. Troubleshooting & Asset Verification

### Compile Error: `WebAssembly.instantiate(): function index 0 out of bounds (0 entries)`
* **Root Cause**: The downloaded `.wasm` file is a 25-byte text placeholder containing Git LFS pointer metadata instead of the actual compiled binary.
* **Fix**: Check other community repos or pull the compiled WASM binary (which should be ~1-6 MB in size) and ensure the URL resolves to the direct file, not the LFS text pointer.

### Local AI Fails to Load in Incognito Mode
* **Root Cause**: Incognito mode limits storage quotas or denies Cache API calls if the browser context restricts site storage.
* **Fix**: Ensure standard Cache API support is active, or fall back to memory-only compilation (which will download the model weights on each load).
