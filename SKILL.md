---
name: image
description: Generate or edit images with the plugin-owned stable-diffusion.cpp runtime when the user asks for visuals, illustrations, icons, logos or image transformations.
---

# Image Skill

Use the plugin MCP tools rather than application commands:

- `list_image_models` lists installed diffusion checkpoints.
- `generate_image` renders locally through the extension's stable-diffusion.cpp process.
- `edit_image_region` changes one named area of an existing image and leaves the rest
  untouched.
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
- `width` / `height` only when the user asks for a specific format — each model family
  renders at the size it was trained for, and forcing 1024 on a Stable Diffusion 1.x
  checkpoint costs four times the compute for a worse image;
- `steps` and `cfg_scale` only when the user asks for custom sampling — the engine already
  picks the values that suit each model family;
- `input_image` as a file path or `data:image/...;base64,...` URL for image-to-image;
- `strength` between 0 and 1 alongside `input_image` — low keeps the source, high reinvents it;
- `seed` only to reproduce a previous render exactly;
- `variants` between 1 and 8 when several alternatives are useful: the weight load and the
  prompt encoding are paid once for the whole batch.

## Editing part of an image

When the request concerns a *part* of an existing image — « make the shirt brown »,
« replace the poster on the wall » — call `edit_image_region`, not `generate_image`.
A global image-to-image pass regenerates the whole scene: at low strength nothing moves,
at high strength the background changes too.

- `target`: the area in plain words, one element at a time. « the frame on the left »
  works; « the frames » returns a scattered selection and is refused;
- `mode`: `recolor` (exact colour, no diffusion model, a fraction of a second),
  `replace` (the area is redrawn by the engine) or `preview` (the selection is tinted so
  the user can confirm it before anything is modified);
- `color` as `#RRGGBB` for `recolor`, `prompt` in English for `replace`.

The tool refuses rather than guessing: a selection recognised below 55 % confidence,
broken into five or more pieces, or covering more than 45 % of the image comes back as an
error asking for a more precise description. Relay that wording — it tells the user what
to reword.

If no model is installed, say so and point to the model catalogue. Do not invent a model name.

The extension owns the model catalogue, VAE/text-encoder companions, process invocation,
output files and Studio interface. Locaryn itself does not expose an image engine,
image-generation command or image button in the chat composer. The host renders
MCP image artifacts returned by this extension directly in the conversation.
