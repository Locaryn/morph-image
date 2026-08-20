---
name: image-generation
description: Generate or edit images with the plugin-owned stable-diffusion.cpp runtime when the user asks for visuals, illustrations, icons, logos or image transformations.
---

# Image Generation Skill

Use the plugin MCP tools rather than application commands:

- `list_image_models` lists installed diffusion checkpoints.
- `generate_image` renders locally through the extension's stable-diffusion.cpp process.
- `install_image_model` downloads a checkpoint and its companions from HuggingFace. Prefer
  pointing the user at the application's model catalogue (filter « Génération d'image »),
  which stays up to date and installs the companion files on its own.

When the user asks for an image in any language, write the `prompt` in English and make it
detailed — subject, composition, lighting, style, medium. The diffusion models in this
catalogue are trained on English captions, so a translated, expanded prompt produces a far
better image than a literal one.

For `generate_image`, provide:

- `prompt`: detailed English visual description;
- `model` when a specific installed checkpoint is requested; omit it to follow the account's
  default image model, falling back to the first installed checkpoint;
- `width` / `height`: a value between 64 and 2048;
- `steps` and `cfg_scale` only when the user asks for custom sampling — the engine already
  picks the values that suit each model family;
- `input_image` as a `data:image/...;base64,...` URL for image-to-image editing;
- `variants` between 1 and 8 when several alternatives are useful.

If no model is installed, say so and point to the model catalogue. Do not invent a model name.

The extension owns the model catalogue, VAE/text-encoder companions, process invocation,
output files and Studio interface. Locaryn itself does not expose an image engine,
image-generation command or image button in the chat composer. The host renders
MCP image artifacts returned by this extension directly in the conversation.
