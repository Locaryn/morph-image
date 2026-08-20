/* plugin-image-gen UI bundle: model-agnostic Studio interface for Locaryn */
(function () {
  "use strict";

  function bridge() {
    return window.locaryn || window.LocarynPluginAPI || null;
  }

  var RATIOS = [
    { label: "1:1 (Carré)", w: 1024, h: 1024 },
    { label: "16:9 (Paysage)", w: 1280, h: 720 },
    { label: "9:16 (Portrait)", w: 720, h: 1280 },
    { label: "4:3 (Photo)", w: 1024, h: 768 },
    { label: "3:4 (Affiche)", w: 768, h: 1024 }
  ];

  var CSS = `
:host {
  display: block;
  width: 100%;
  color: var(--text, #e8edf5);
  font-family: inherit;
  box-sizing: border-box;
}
* {
  box-sizing: border-box;
}
.img-gen-inline {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}
.img-gen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 12px);
}
.img-gen-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.img-gen-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: rgba(var(--accent-rgb, 110, 168, 254), 0.15);
  color: var(--accent, #6ea8fe);
  border-radius: 10px;
}
.img-gen-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text, #e8edf5);
}
.img-gen-subtitle {
  font-size: 12px;
  color: var(--text-faint, #96a3b8);
  margin-top: 2px;
}
.img-gen-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(101, 211, 145, 0.12);
  color: #65d391;
  border: 1px solid rgba(101, 211, 145, 0.25);
}
.img-gen-tabs {
  display: flex;
  gap: 8px;
}
.img-gen-tab {
  flex: 1;
  padding: 10px 14px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  color: var(--text-dim, #94a3b8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.img-gen-tab:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.07));
  color: var(--text, #e8edf5);
}
.img-gen-tab-active {
  background: rgba(var(--accent-rgb, 110, 168, 254), 0.12);
  border-color: var(--accent, #6ea8fe);
  color: var(--accent, #6ea8fe);
}
.img-gen-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 12px);
  padding: 16px;
}
.img-gen-field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.img-gen-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.img-gen-val {
  font-weight: 600;
  color: var(--accent, #6ea8fe);
  margin-left: 4px;
}
.img-gen-input, .img-gen-textarea {
  width: 100%;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.14));
  border-radius: var(--radius-sm, 8px);
  background: var(--bg, rgba(0, 0, 0, 0.25));
  color: inherit;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.img-gen-textarea {
  min-height: 90px;
  resize: vertical;
  line-height: 1.5;
}
.img-gen-input:focus, .img-gen-textarea:focus {
  border-color: var(--accent, #6ea8fe);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 110, 168, 254), 0.15);
}
.img-gen-ratios {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.img-gen-ratio-btn {
  padding: 6px 12px;
  background: var(--surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-xs, 6px);
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.img-gen-ratio-btn:hover {
  border-color: var(--accent, #6ea8fe);
  color: var(--text, #e8edf5);
}
.img-gen-ratio-btn.active {
  background: rgba(var(--accent-rgb, 110, 168, 254), 0.15);
  border-color: var(--accent, #6ea8fe);
  color: var(--accent, #6ea8fe);
}
.img-gen-dropzone {
  border: 2px dashed var(--border, rgba(255, 255, 255, 0.2));
  border-radius: var(--radius-sm, 8px);
  padding: 20px;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  background: rgba(0, 0, 0, 0.15);
}
.img-gen-dropzone:hover {
  border-color: var(--accent, #6ea8fe);
  background: rgba(var(--accent-rgb, 110, 168, 254), 0.05);
}
.img-gen-dropzone-filled {
  border-style: solid;
  padding: 12px;
}
.img-gen-preview-img {
  max-height: 160px;
  border-radius: 8px;
  object-fit: contain;
  display: block;
}
.img-gen-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  padding: 10px 14px;
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}
.img-gen-advanced-toggle:hover {
  color: var(--text, #e8edf5);
  border-color: var(--border-strong, rgba(255, 255, 255, 0.2));
}
.img-gen-advanced-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
}
.img-gen-adv-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
.img-gen-output-area {
  min-height: 0;
}
.img-gen-generating-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.img-gen-placeholder {
  position: relative;
  width: 100%;
  height: 220px;
  border-radius: var(--radius, 12px);
  overflow: hidden;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.img-gen-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(var(--accent-rgb, 110, 168, 254), 0.08) 40%,
    rgba(var(--accent-rgb, 110, 168, 254), 0.16) 50%,
    rgba(var(--accent-rgb, 110, 168, 254), 0.08) 60%,
    transparent 80%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.img-gen-pulse-ring {
  position: absolute;
  width: 80px;
  height: 80px;
  border: 2px solid rgba(var(--accent-rgb, 110, 168, 254), 0.4);
  border-radius: 50%;
  animation: pulseRing 2s cubic-bezier(0.33, 0, 0.2, 1) infinite;
}
@keyframes pulseRing {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}
.img-gen-generating-label {
  position: relative;
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8edf5);
}
.img-gen-progress-bar {
  width: 100%;
  height: 4px;
  background: var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 999px;
  overflow: hidden;
}
.img-gen-progress-fill {
  height: 100%;
  background: var(--accent, #6ea8fe);
  border-radius: 999px;
  animation: shimmer 1.5s infinite linear;
}
.img-gen-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 12px);
}
.img-gen-result-img {
  max-width: 100%;
  max-height: 420px;
  border-radius: 8px;
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.2));
  object-fit: contain;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  cursor: zoom-in;
}
.img-gen-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.img-gen-generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent, #6ea8fe);
  border: 1px solid var(--accent, #6ea8fe);
  border-radius: var(--radius-sm, 8px);
  color: #08101d;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 4px 14px rgba(var(--accent-rgb, 110, 168, 254), 0.3);
}
.img-gen-generate-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.img-gen-generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.img-gen-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.img-gen-gallery-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
}
.img-gen-gallery-card:hover {
  border-color: var(--accent, #6ea8fe);
}
.img-gen-gallery-card img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
}
.img-gen-gallery-info {
  padding: 8px 10px;
  font-size: 11px;
  color: var(--text-faint, #96a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.img-gen-modal {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
}
.img-gen-modal-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(94vw, 1100px);
  max-height: 94vh;
}
.img-gen-modal-img {
  max-width: 94vw;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}
.img-gen-modal-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface, #18202f);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
}
.img-gen-btn-ghost {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  color: var(--text, #e8edf5);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.img-gen-btn-ghost:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--accent, #6ea8fe);
  color: var(--accent, #6ea8fe);
}
.img-gen-error {
  padding: 12px 14px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 8px;
  color: #ffb1b1;
  font-size: 13px;
}
.img-gen-notice {
  padding: 12px 14px;
  background: rgba(101, 211, 145, 0.12);
  border: 1px solid rgba(101, 211, 145, 0.3);
  border-radius: 8px;
  color: #8ee2aa;
  font-size: 13px;
}
.img-gen-advanced-summary {
  margin-left: auto;
  color: var(--text-faint, #96a3b8);
}
.img-gen-field-plain {
  border: 0;
  padding: 0;
  background: transparent;
}
.img-gen-adv-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.img-gen-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  cursor: pointer;
}
.img-gen-range {
  accent-color: var(--accent, #6ea8fe);
}
.img-gen-result-title {
  color: var(--accent, #6ea8fe);
  font-size: 14px;
  font-weight: 700;
}
.img-gen-result-buttons {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
@media (max-width: 640px) {
  .img-gen-inline { gap: 12px; }
  .img-gen-header { align-items: flex-start; padding: 14px; }
  .img-gen-subtitle { max-width: 32ch; }
  .img-gen-tabs { display: grid; grid-template-columns: 1fr; }
  .img-gen-field { padding: 14px; }
  .img-gen-actions, .img-gen-generate-btn { width: 100%; }
  .img-gen-generate-btn { justify-content: center; }
  .img-gen-advanced-summary { display: none; }
}
`;

  function parseValue(value) {
    if (typeof value !== "string") return value || {};
    var current = value;
    for (var i = 0; i < 3; i += 1) {
      try {
        var parsed = JSON.parse(current);
        if (typeof parsed !== "string") return parsed || {};
        current = parsed;
      } catch (_) {
        return { text: value };
      }
    }
    return { text: value };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message, type) {
    var b = bridge();
    if (b && b.ui && b.ui.showToast) b.ui.showToast(message, type || "info");
  }

  function invoke(tool, input) {
    var b = bridge();
    if (!b || !b.tools || !b.tools.invoke) {
      return Promise.reject(new Error("Le pont MCP de l'extension n'est pas disponible."));
    }
    return Promise.resolve(b.tools.invoke(tool, input)).then(parseValue).then(function (value) {
      if (value && value.error) throw new Error(value.error.message || value.error);
      return value;
    });
  }

  function assetUrl(path) {
    var b = bridge();
    if (b && b.files && b.files.assetUrl) return b.files.assetUrl(path);
    return path;
  }

  function studioError(error) {
    var raw = String(error && (error.message || error) || "Erreur inconnue");
    if (/mod[eè]le|checkpoint|poids de diffusion/i.test(raw)) {
      return "La génération locale n'est pas encore prête. Installez les composants requis depuis le Marketplace.";
    }
    return raw;
  }

  function saveImage(url) {
    var link = document.createElement("a");
    link.href = url;
    link.download = "locaryn-image.png";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function copyImage(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("image inaccessible");
      return response.blob();
    }).then(function (blob) {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error("presse-papier image indisponible");
      return navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
    });
  }

  class ImageGenPanel extends HTMLElement {
    constructor() {
      super();
      this.mode = "txt2img"; // "txt2img" | "img2img" | "edit"
      this.prompt = "";
      this.negativePrompt = "";
      this.width = 1024;
      this.height = 1024;
      this.steps = 20;
      this.cfgScale = 7.0;
      this.sourceImage = null;
      this.showAdvanced = false;
      this.uncensored = false;
      this.isGenerating = false;
      this.error = null;
      this.notice = null;
      this.currentResult = null;
      this.gallery = [];
      this.lightbox = null;
      this.attachShadow({ mode: "open" });
      this.installStyles();
    }

    installStyles() {
      if (this.styleVersion === "1.5.0") return;
      this.styleVersion = "1.5.0";
      this.usesStyleElement = true;
      // A constructed stylesheet is not treated as an inline <style> by a
      // restrictive WebView CSP. Keep the element fallback for older engines.
      if (typeof CSSStyleSheet !== "undefined" && "adoptedStyleSheets" in this.shadowRoot) {
        try {
          var sheet = new CSSStyleSheet();
          sheet.replaceSync(CSS);
          this.shadowRoot.adoptedStyleSheets = [sheet];
          this.usesStyleElement = false;
        } catch (_) {}
      }
    }

    connectedCallback() {
      this.installStyles();
      this.render();
    }

    pluginUpdated() {
      this.installStyles();
      this.render();
    }

    generate() {
      var self = this;
      var prompt = this.prompt.trim();
      if (!prompt) {
        this.error = "Veuillez saisir une description (prompt) pour générer l'image.";
        this.render();
        return;
      }
      if (this.mode !== "txt2img" && !this.sourceImage) {
        this.error = "Veuillez sélectionner une image source pour cette opération.";
        this.render();
        return;
      }

      this.isGenerating = true;
      this.error = null;
      this.notice = "Génération de l'image en cours sur votre machine…";
      this.render();

      var payload = {
        prompt: prompt,
        width: self.width,
        height: self.height,
        steps: self.steps,
        cfg_scale: self.cfgScale,
        negative_prompt: self.negativePrompt.trim() || undefined,
        input_image: self.sourceImage || undefined,
        uncensored: self.uncensored,
        variants: 1
      };

      return invoke("generate_image", payload).then(function (result) {
        var paths = Array.isArray(result.paths) ? result.paths : [];
        if (!paths.length) throw new Error("Le moteur n'a retourné aucun fichier image.");
        var imageObj = {
          path: paths[0],
          url: assetUrl(paths[0]),
          prompt: prompt,
          date: new Date().toLocaleTimeString()
        };
        self.currentResult = imageObj;
        self.gallery = [imageObj].concat(self.gallery).slice(0, 16);
        self.notice = "Image générée avec succès !";
        toast("Image générée", "success");

        var b = bridge();
        var sessionId = b && b.chat && b.chat.getSessionId ? b.chat.getSessionId() : null;
        if (sessionId && b.chat.appendAssistantMessage) {
          var markdown = "<!--locaryn-image:" + JSON.stringify(paths[0]) + "-->\n![](" + imageObj.url + ")";
          b.chat.appendAssistantMessage(markdown).catch(function () {});
        }
      }).catch(function (error) {
        self.error = studioError(error);
        toast(self.error, "error");
      }).then(function () {
        self.isGenerating = false;
        self.render();
      });
    }

    updateState() {
      var root = this.shadowRoot;
      if (!root) return;
      var promptEl = root.querySelector("#ig-prompt");
      if (promptEl) this.prompt = promptEl.value;
      var negEl = root.querySelector("#ig-negative");
      if (negEl) this.negativePrompt = negEl.value;
    }

    render() {
      var self = this;
      if (!this.shadowRoot) return;

      var ratiosHtml = RATIOS.map(function (r) {
        var active = self.width === r.w && self.height === r.h ? " active" : "";
        return "<button type=\"button\" class=\"img-gen-ratio-btn" + active + "\" data-w=\"" + r.w + "\" data-h=\"" + r.h + "\">" + escapeHtml(r.label) + "</button>";
      }).join("");

      var galleryHtml = this.gallery.map(function (img, idx) {
        return "<div class=\"img-gen-gallery-card\" data-gallery-idx=\"" + idx + "\">"
          + "<img src=\"" + escapeHtml(img.url) + "\" alt=\"" + escapeHtml(img.prompt) + "\" loading=\"lazy\">"
          + "<div class=\"img-gen-gallery-info\">" + escapeHtml(img.prompt) + "</div>"
          + "</div>";
      }).join("");

      this.shadowRoot.innerHTML = (this.usesStyleElement ? "<style>" + CSS + "</style>" : "")
        + "<div class=\"img-gen-inline\">"
        + "  <div class=\"img-gen-header\">"
        + "    <div class=\"img-gen-title-wrap\">"
        + "      <div class=\"img-gen-icon\">✦</div>"
        + "      <div>"
        + "        <div class=\"img-gen-title\">Génération et retouche d'image</div>"
        + "        <div class=\"img-gen-subtitle\">Créez ou transformez une image directement sur votre machine.</div>"
        + "      </div>"
        + "    </div>"
        + "    <div class=\"img-gen-badge\">Local</div>"
        + "  </div>"

        + "  <div class=\"img-gen-tabs\">"
        + "    <button type=\"button\" class=\"img-gen-tab" + (this.mode === "txt2img" ? " img-gen-tab-active" : "") + "\" data-mode=\"txt2img\">Texte → Image</button>"
        + "    <button type=\"button\" class=\"img-gen-tab" + (this.mode === "img2img" ? " img-gen-tab-active" : "") + "\" data-mode=\"img2img\">Image → Image</button>"
        + "    <button type=\"button\" class=\"img-gen-tab" + (this.mode === "edit" ? " img-gen-tab-active" : "") + "\" data-mode=\"edit\">Retouche</button>"
        + "  </div>"

        + "  <div class=\"img-gen-field\">"
        + "    <div class=\"img-gen-field-row\">"
        + "      <label class=\"img-gen-label\" for=\"ig-prompt\">Description (Prompt)</label>"
        + "    </div>"
        + "    <textarea class=\"img-gen-textarea\" id=\"ig-prompt\" placeholder=\"Décrivez précisément l'image que vous souhaitez générer…\"" + (this.isGenerating ? " disabled" : "") + ">" + escapeHtml(this.prompt) + "</textarea>"
        + "  </div>"

        + (this.mode !== "txt2img" ? (
          "  <div class=\"img-gen-field\">"
          + "    <label class=\"img-gen-label\">Image source</label>"
          + "    <div class=\"img-gen-dropzone" + (this.sourceImage ? " img-gen-dropzone-filled" : "") + "\" id=\"ig-dropzone\">"
          +        (this.sourceImage
                    ? "<img class=\"img-gen-preview-img\" src=\"" + escapeHtml(this.sourceImage) + "\" alt=\"Source\"><div>Cliquer pour changer l'image source</div>"
                    : "<div>Glissez-déposez ou cliquez pour choisir une image</div>")
          + "    </div>"
          + "    <input type=\"file\" id=\"ig-file\" accept=\"image/*\" hidden>"
          + "  </div>"
        ) : "")

        + "  <div class=\"img-gen-field\">"
        + "    <label class=\"img-gen-label\">Format et dimensions</label>"
        + "    <div class=\"img-gen-ratios\">" + ratiosHtml + "</div>"
        + "  </div>"

        + "  <button type=\"button\" class=\"img-gen-advanced-toggle\" id=\"ig-adv-toggle\">"
        + "    <span>" + (this.showAdvanced ? "▼" : "▶") + " Options avancées</span>"
        + "    <span class=\"img-gen-advanced-summary\">" + this.width + "×" + this.height + " · " + this.steps + " étapes · CFG " + this.cfgScale + "</span>"
        + "  </button>"

        + (this.showAdvanced ? (
          "  <div class=\"img-gen-advanced-panel\">"
          + "    <div class=\"img-gen-field img-gen-field-plain\">"
          + "      <label class=\"img-gen-label\" for=\"ig-negative\">Prompt négatif</label>"
          + "      <input type=\"text\" class=\"img-gen-input\" id=\"ig-negative\" placeholder=\"flou, déformation, basse qualité…\" value=\"" + escapeHtml(this.negativePrompt) + "\"" + (this.isGenerating ? " disabled" : "") + ">"
          + "    </div>"
          + "    <div class=\"img-gen-adv-row\">"
          + "      <div class=\"img-gen-adv-stack\">"
          + "        <div class=\"img-gen-field-row\"><span class=\"img-gen-label\">Étapes (Steps)</span><span class=\"img-gen-val\">" + this.steps + "</span></div>"
          + "        <input type=\"range\" class=\"img-gen-range\" min=\"1\" max=\"60\" value=\"" + this.steps + "\" id=\"ig-steps-range\"" + (this.isGenerating ? " disabled" : "") + ">"
          + "      </div>"
          + "      <div class=\"img-gen-adv-stack\">"
          + "        <div class=\"img-gen-field-row\"><span class=\"img-gen-label\">Guidance (CFG Scale)</span><span class=\"img-gen-val\">" + this.cfgScale + "</span></div>"
          + "        <input type=\"range\" class=\"img-gen-range\" min=\"0.5\" max=\"20\" step=\"0.5\" value=\"" + this.cfgScale + "\" id=\"ig-cfg-range\"" + (this.isGenerating ? " disabled" : "") + ">"
          + "      </div>"
          + "    </div>"
          + "    <label class=\"img-gen-check\">"
          + "      <input type=\"checkbox\" id=\"ig-uncensored\"" + (this.uncensored ? " checked" : "") + (this.isGenerating ? " disabled" : "") + ">"
          + "      <span>Mode sans filtre (si pris en charge)</span>"
          + "    </label>"
          + "  </div>"
        ) : "")

        + (this.notice ? "<div class=\"img-gen-notice\">" + escapeHtml(this.notice) + "</div>" : "")
        + (this.error ? "<div class=\"img-gen-error\">" + escapeHtml(this.error) + "</div>" : "")

        + "  <div class=\"img-gen-actions\">"
        + "    <button type=\"button\" class=\"img-gen-generate-btn\" id=\"ig-generate-btn\"" + (this.isGenerating ? " disabled" : "") + ">"
        +        (this.isGenerating ? "Génération en cours…" : (this.mode === "img2img" ? "Transformer l'image" : this.mode === "edit" ? "Retoucher l'image" : "Générer l'image"))
        + "    </button>"
        + "  </div>"

        + "  <div class=\"img-gen-output-area\">"
        +      (this.isGenerating ? (
                "  <div class=\"img-gen-generating-wrap\">"
                + "    <div class=\"img-gen-placeholder\">"
                + "      <div class=\"img-gen-shimmer\"></div>"
                + "      <div class=\"img-gen-pulse-ring\"></div>"
                + "      <div class=\"img-gen-generating-label\">Calcul des étapes de diffusion…</div>"
                + "    </div>"
                + "    <div class=\"img-gen-progress-bar\"><div class=\"img-gen-progress-fill\"></div></div>"
                + "  </div>"
              ) : this.currentResult ? (
                "  <div class=\"img-gen-result\">"
                + "    <div class=\"img-gen-result-title\">✓ Image générée</div>"
                + "    <img class=\"img-gen-result-img\" src=\"" + escapeHtml(this.currentResult.url) + "\" alt=\"Résultat\">"
                + "    <div class=\"img-gen-result-buttons\">"
                + "      <button type=\"button\" class=\"img-gen-btn-ghost\" id=\"ig-res-save\">Télécharger</button>"
                + "      <button type=\"button\" class=\"img-gen-btn-ghost\" id=\"ig-res-copy\">Copier</button>"
                + "    </div>"
                + "  </div>"
              ) : "")
        + "  </div>"

        + (this.gallery.length > 0 ? (
          "  <div class=\"img-gen-field\">"
          + "    <div class=\"img-gen-field-row\">"
          + "      <label class=\"img-gen-label\">Galerie récente (" + this.gallery.length + ")</label>"
          + "    </div>"
          + "    <div class=\"img-gen-gallery\">" + galleryHtml + "</div>"
          + "  </div>"
        ) : "")
        + "</div>"

        + (this.lightbox ? (
          "  <div class=\"img-gen-modal\" id=\"ig-lightbox-modal\">"
          + "    <div class=\"img-gen-modal-box\">"
          + "      <img class=\"img-gen-modal-img\" src=\"" + escapeHtml(this.lightbox.url) + "\" alt=\"Agrandissement\">"
          + "      <div class=\"img-gen-modal-bar\">"
          + "        <button type=\"button\" class=\"img-gen-btn-ghost\" id=\"ig-lb-save\">Enregistrer</button>"
          + "        <button type=\"button\" class=\"img-gen-btn-ghost\" id=\"ig-lb-copy\">Copier</button>"
          + "        <button type=\"button\" class=\"img-gen-btn-ghost\" id=\"ig-lb-close\">Fermer</button>"
          + "      </div>"
          + "    </div>"
          + "  </div>"
        ) : "");

      this.bindEvents();
    }

    bindEvents() {
      var self = this;
      var root = this.shadowRoot;
      if (!root) return;

      var promptEl = root.querySelector("#ig-prompt");
      if (promptEl) {
        promptEl.addEventListener("input", function () { self.prompt = promptEl.value; });
      }

      var negEl = root.querySelector("#ig-negative");
      if (negEl) {
        negEl.addEventListener("input", function () { self.negativePrompt = negEl.value; });
      }

      root.querySelectorAll("[data-mode]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.updateState();
          self.mode = btn.getAttribute("data-mode") || "txt2img";
          self.render();
        });
      });

      root.querySelectorAll("[data-w]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.updateState();
          self.width = Number(btn.getAttribute("data-w"));
          self.height = Number(btn.getAttribute("data-h"));
          self.render();
        });
      });

      var advToggle = root.querySelector("#ig-adv-toggle");
      if (advToggle) {
        advToggle.addEventListener("click", function () {
          self.updateState();
          self.showAdvanced = !self.showAdvanced;
          self.render();
        });
      }

      var stepsRange = root.querySelector("#ig-steps-range");
      if (stepsRange) {
        stepsRange.addEventListener("input", function () {
          self.steps = Number(stepsRange.value);
          var valEl = stepsRange.parentElement.querySelector(".img-gen-val");
          if (valEl) valEl.textContent = String(self.steps);
        });
      }

      var cfgRange = root.querySelector("#ig-cfg-range");
      if (cfgRange) {
        cfgRange.addEventListener("input", function () {
          self.cfgScale = Number(cfgRange.value);
          var valEl = cfgRange.parentElement.querySelector(".img-gen-val");
          if (valEl) valEl.textContent = String(self.cfgScale);
        });
      }

      var uncensoredCb = root.querySelector("#ig-uncensored");
      if (uncensoredCb) {
        uncensoredCb.addEventListener("change", function () {
          self.uncensored = uncensoredCb.checked;
        });
      }

      var generateBtn = root.querySelector("#ig-generate-btn");
      if (generateBtn) {
        generateBtn.addEventListener("click", function () {
          self.updateState();
          self.generate();
        });
      }

      var dropzone = root.querySelector("#ig-dropzone");
      var fileInput = root.querySelector("#ig-file");
      if (dropzone && fileInput) {
        dropzone.addEventListener("click", function () { fileInput.click(); });
        fileInput.addEventListener("change", function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            self.sourceImage = reader.result;
            self.render();
          };
          reader.readAsDataURL(file);
        });
      }

      var resImg = root.querySelector(".img-gen-result-img");
      if (resImg && self.currentResult) {
        resImg.addEventListener("click", function () {
          self.lightbox = self.currentResult;
          self.render();
        });
      }

      var resSave = root.querySelector("#ig-res-save");
      if (resSave && self.currentResult) {
        resSave.addEventListener("click", function () { saveImage(self.currentResult.url); });
      }

      var resCopy = root.querySelector("#ig-res-copy");
      if (resCopy && self.currentResult) {
        resCopy.addEventListener("click", function () {
          copyImage(self.currentResult.url).then(function () {
            toast("Image copiée dans le presse-papier", "success");
          }).catch(function (e) {
            toast("Erreur lors de la copie : " + e.message, "error");
          });
        });
      }

      root.querySelectorAll("[data-gallery-idx]").forEach(function (el) {
        el.addEventListener("click", function () {
          var idx = Number(el.getAttribute("data-gallery-idx"));
          if (self.gallery[idx]) {
            self.lightbox = self.gallery[idx];
            self.render();
          }
        });
      });

      var lbModal = root.querySelector("#ig-lightbox-modal");
      if (lbModal) {
        lbModal.addEventListener("click", function (e) {
          if (e.target === lbModal) {
            self.lightbox = null;
            self.render();
          }
        });
      }

      var lbClose = root.querySelector("#ig-lb-close");
      if (lbClose) {
        lbClose.addEventListener("click", function () {
          self.lightbox = null;
          self.render();
        });
      }

      var lbSave = root.querySelector("#ig-lb-save");
      if (lbSave && self.lightbox) {
        lbSave.addEventListener("click", function () { saveImage(self.lightbox.url); });
      }

      var lbCopy = root.querySelector("#ig-lb-copy");
      if (lbCopy && self.lightbox) {
        lbCopy.addEventListener("click", function () {
          copyImage(self.lightbox.url).then(function () {
            toast("Image copiée dans le presse-papier", "success");
          }).catch(function (e) {
            toast("Erreur lors de la copie : " + e.message, "error");
          });
        });
      }
    }
  }

  var currentElement = customElements.get("locaryn-image-gen-panel");
  if (currentElement) {
    // Locaryn can update an extension without restarting. Custom elements
    // cannot be redefined, so refresh the existing class prototype in place.
    Object.getOwnPropertyNames(ImageGenPanel.prototype).forEach(function (name) {
      if (name === "constructor") return;
      Object.defineProperty(
        currentElement.prototype,
        name,
        Object.getOwnPropertyDescriptor(ImageGenPanel.prototype, name)
      );
    });
  } else {
    customElements.define("locaryn-image-gen-panel", ImageGenPanel);
  }
})();
