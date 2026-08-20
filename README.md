# Locaryn Plugin: Image Generation (`plugin-image-gen`)

Official Locaryn extension for local image generation and editing. The extension
owns image inference, VAE/text-encoder companion resolution,
`stable-diffusion.cpp` invocation, the styled Studio, gallery and image
lightbox. The plugin also owns the Marketplace image filters, catalogue entries,
download sources and companion-file plans. Locaryn only validates and renders
that generic extension data, so every image entry disappears when the plugin is
disabled or removed.

The chat composer stays deliberately native and text-only. When a user asks the
LLM for an image, the Locaryn agent calls this plugin's MCP tool and the result
is rendered as an image in the conversation.

## Architecture

Locaryn only provides the generic extension host and starts the plugin's MCP
server. The plugin bundle contains:

- `dist/ui.js`: the plugin-owned Studio custom element;
- `dist/marketplace.json`: the plugin-owned filters, models and HTTPS install plans;
- `src/bin/locaryn-image-gen-mcp`: the stdio MCP server;
- `src/lib.rs`: model discovery, downloads, companion validation and the
  stable-diffusion.cpp runtime;
- `mcp/mcp.json`: the plugin-owned server declaration.

No image-generation Tauri command is required in the Locaryn application.

## Tools

- `list_image_models`: list installed diffusion checkpoints, including files
  whose names are not in the built-in catalog, while hiding VAE and text
  encoder companions;
- `install_image_model`: download a checkpoint and its companions from
  HuggingFace and remove every newly created partial file if the installation
  fails;
- `generate_image`: generate `txt2img` or `img2img` PNGs locally.

The Studio deliberately contains no model picker or installation catalogue. It
follows the default selected in Locaryn. The Marketplace view is rendered by the
host, but every image-specific row and source comes from `dist/marketplace.json`.

The plugin deliberately selects `ae.safetensors` for Z-Image/Flux. The old ONNX
VAE decoder is rejected, preventing the `get sd version from file failed` error.

## Installation

```bash
locaryn plugin install Locaryn/plugin-image-gen
```

The release bundle includes a platform-specific MCP executable. The extension
asks for MCP, model-storage read/write and network permissions before it starts.
