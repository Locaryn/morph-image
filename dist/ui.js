/* plugin-image-gen — interface Studio.
 *
 * L'extension possède son moteur, ses modèles et cet écran. Elle ne propose
 * plus d'installation ici : les modèles vivent dans le catalogue de modèles de
 * l'application, où ils se mettent à jour tout seuls. Cet écran renvoie donc
 * vers le catalogue au lieu de lui faire concurrence avec une liste figée. */
(function () {
  "use strict";

  function bridge() {
    return window.locaryn || window.LocarynPluginAPI || null;
  }

  /** Les proportions, en multiples de la résolution native du modèle : rendre
   *  un checkpoint Stable Diffusion 1.x en 1024 coûte quatre fois le calcul
   *  pour une image moins bonne. */
  var RATIOS = [
    { label: "Carré", detail: "1:1", w: 1, h: 1 },
    { label: "Paysage", detail: "16:9", w: 1.25, h: 0.703125 },
    { label: "Portrait", detail: "9:16", w: 0.703125, h: 1.25 },
    { label: "Photo", detail: "4:3", w: 1, h: 0.75 },
    { label: "Affiche", detail: "3:4", w: 0.75, h: 1 }
  ];

  /** Un multiple de 64 : les moteurs de diffusion travaillent par blocs. */
  function snap(value) {
    return Math.max(64, Math.round(value / 64) * 64);
  }

  /** La taille sur laquelle la famille du modèle a été entraînée. */
  function defaultResolution(name) {
    var lower = String(name || "").toLowerCase();
    var zImage = ["z_image", "z-image", "z-img", "z_img", "zimg"].some(function (part) {
      return lower.indexOf(part) >= 0;
    });
    if (zImage || lower.indexOf("flux") >= 0) return 1024;
    var large = ["sdxl", "sd_xl", "sd-xl", "sd3", "playground-v", "kolors", "pixart"].some(
      function (part) {
        return lower.indexOf(part) >= 0;
      }
    );
    return large ? 1024 : 512;
  }

  /** Les mêmes réglages par défaut que le moteur, pour que la valeur affichée
   *  soit celle qui sera réellement utilisée. */
  function defaultSampling(name) {
    var lower = String(name || "").toLowerCase();
    var turbo = ["turbo", "schnell", "lightning"].some(function (part) {
      return lower.indexOf(part) >= 0;
    });
    var zImage = ["z_image", "z-image", "z-img", "z_img", "zimg"].some(function (part) {
      return lower.indexOf(part) >= 0;
    });
    if (zImage) return { steps: turbo ? 8 : 20, cfg: 1.0 };
    if (lower.indexOf("flux") >= 0) return { steps: turbo ? 4 : 20, cfg: 1.0 };
    return { steps: turbo ? 6 : 20, cfg: 7.0 };
  }

  var CSS = `
:host {
  display: block;
  width: 100%;
  color: var(--text, #e8edf5);
  font-family: inherit;
  box-sizing: border-box;
}
* { box-sizing: border-box; }
button { font: inherit; }

.ig-panel {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  align-items: start;
  gap: 20px;
}
.ig-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
/* Une seule colonne dès que le panneau latéral et la toile ne tiennent plus
   côte à côte : deux colonnes étroites sont pires qu'une large. */
@media (max-width: 900px) {
  .ig-panel { grid-template-columns: minmax(0, 1fr); }
}

.ig-card {
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ig-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ig-card-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.ig-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-faint, #96a3b8);
}
.ig-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim, #94a3b8);
}
.ig-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ig-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  background: rgba(101, 211, 145, 0.12);
  color: #65d391;
  border: 1px solid rgba(101, 211, 145, 0.25);
}
.ig-badge.ig-badge-empty {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.25);
}

.ig-tabs {
  display: flex;
  gap: 6px;
}
.ig-tab {
  flex: 1;
  padding: 9px 12px;
  background: var(--surface, rgba(255, 255, 255, 0.035));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ig-tab:hover { color: var(--text, #e8edf5); }
.ig-tab-on {
  background: var(--accent-soft, rgba(110, 168, 254, 0.15));
  border-color: var(--accent, #6ea8fe);
  color: var(--accent, #6ea8fe);
}

.ig-input,
.ig-select,
.ig-textarea {
  width: 100%;
  padding: 9px 11px;
  background: var(--bg, rgba(0, 0, 0, 0.25));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  color: var(--text, #e8edf5);
  font-size: 13px;
  font-family: inherit;
}
.ig-textarea {
  min-height: 110px;
  resize: vertical;
  line-height: 1.5;
}
.ig-input:focus,
.ig-select:focus,
.ig-textarea:focus {
  outline: none;
  border-color: var(--accent, #6ea8fe);
}
.ig-input:disabled,
.ig-select:disabled,
.ig-textarea:disabled { opacity: 0.55; }

.ig-ratios {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 6px;
}
.ig-ratio {
  padding: 8px 6px;
  background: var(--bg, rgba(0, 0, 0, 0.25));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  color: var(--text-dim, #94a3b8);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}
.ig-ratio span { font-size: 10px; color: var(--text-faint, #96a3b8); }
.ig-ratio-on {
  border-color: var(--accent, #6ea8fe);
  color: var(--accent, #6ea8fe);
}

.ig-btn {
  padding: 8px 12px;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ig-btn:hover { color: var(--text, #e8edf5); }
.ig-btn:disabled { opacity: 0.5; cursor: default; }
.ig-btn-primary {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius-sm, 8px);
  background: var(--accent, #6ea8fe);
  color: var(--accent-contrast, #0b1220);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.ig-btn-primary:disabled { opacity: 0.5; cursor: default; }

.ig-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: 1px dashed var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  cursor: pointer;
}
.ig-adv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.ig-slider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.ig-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent, #6ea8fe);
  font-variant-numeric: tabular-nums;
}
.ig-range { width: 100%; accent-color: var(--accent, #6ea8fe); }
.ig-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim, #94a3b8);
  cursor: pointer;
}

.ig-drop {
  border: 1px dashed var(--border, rgba(255, 255, 255, 0.18));
  border-radius: var(--radius-sm, 8px);
  padding: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint, #96a3b8);
  cursor: pointer;
}
.ig-drop:hover { border-color: var(--accent, #6ea8fe); }
.ig-drop img {
  max-width: 100%;
  max-height: 160px;
  border-radius: var(--radius-sm, 8px);
  margin-bottom: 8px;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.ig-note {
  padding: 10px 12px;
  border-radius: var(--radius-sm, 8px);
  font-size: 12px;
  line-height: 1.5;
}
.ig-note-info {
  background: rgba(110, 168, 254, 0.1);
  border: 1px solid rgba(110, 168, 254, 0.25);
  color: var(--accent, #6ea8fe);
}
.ig-note-error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.25);
  color: #f87171;
}

.ig-canvas {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}
.ig-canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 420px;
}
.ig-canvas-mark {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  font-size: 24px;
  background: var(--accent-soft, rgba(110, 168, 254, 0.15));
  color: var(--accent, #6ea8fe);
}
.ig-result-img {
  max-width: 100%;
  max-height: 62vh;
  border-radius: var(--radius, 12px);
  display: block;
  cursor: zoom-in;
}
.ig-result-bar {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.ig-progress {
  width: 100%;
  max-width: 340px;
  height: 4px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--border, rgba(255, 255, 255, 0.1));
}
.ig-progress i {
  display: block;
  height: 100%;
  width: 35%;
  border-radius: 99px;
  background: var(--accent, #6ea8fe);
  animation: ig-slide 1.4s ease-in-out infinite;
}
@keyframes ig-slide {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(320%); }
}
@media (prefers-reduced-motion: reduce) {
  .ig-progress i { animation: none; width: 100%; }
}

.ig-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.ig-thumb {
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg, rgba(0, 0, 0, 0.25));
}
.ig-thumb img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}
.ig-thumb figcaption {
  padding: 6px 8px;
  font-size: 10px;
  color: var(--text-faint, #96a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ig-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ig-modal-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  max-width: 92vw;
}
.ig-modal-box img {
  max-width: 92vw;
  max-height: 78vh;
  border-radius: var(--radius, 12px);
}
`;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function toast(message, type) {
    var b = bridge();
    if (b && b.ui && b.ui.showToast) b.ui.showToast(message, type || "info");
  }

  /** Demander à l'application d'ouvrir un de ses écrans. */
  function openHostView(view) {
    var b = bridge();
    if (b && b.ui && b.ui.dispatchAction) b.ui.dispatchAction("navigate", { view: view });
  }

  function invoke(tool, input) {
    var b = bridge();
    if (!b || !b.tools || !b.tools.invoke) {
      return Promise.reject(new Error("Le pont d'outils de l'application n'est pas disponible."));
    }
    return Promise.resolve(b.tools.invoke(tool, input))
      .then(parseValue)
      .then(function (value) {
        if (value && value.error) throw new Error(value.error.message || value.error);
        return value;
      });
  }

  function assetUrl(path) {
    var b = bridge();
    if (b && b.files && b.files.assetUrl) return b.files.assetUrl(path);
    return path;
  }

  function normalizeModels(result) {
    var raw = result && Array.isArray(result.models) ? result.models : [];
    return raw
      .map(function (item) {
        if (typeof item === "string") return { name: item, missing: [] };
        return {
          name: String(item.name || item.path || ""),
          missing: Array.isArray(item.missing) ? item.missing : []
        };
      })
      .filter(function (item) {
        return item.name;
      });
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
    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("image inaccessible");
        return response.blob();
      })
      .then(function (blob) {
        if (!navigator.clipboard || !window.ClipboardItem) {
          throw new Error("presse-papier image indisponible");
        }
        var item = {};
        item[blob.type || "image/png"] = blob;
        return navigator.clipboard.write([new ClipboardItem(item)]);
      });
  }

  class ImageGenPanel extends HTMLElement {
    constructor() {
      super();
      this.mode = "txt2img";
      this.models = [];
      this.selectedModel = "";
      this.prompt = "";
      this.negativePrompt = "";
      this.base = 1024;
      this.ratio = RATIOS[0];
      this.width = 1024;
      this.height = 1024;
      this.steps = 20;
      this.cfgScale = 7.0;
      this.sourceImage = null;
      this.showAdvanced = false;
      this.uncensored = false;
      this.isGenerating = false;
      this.isLoadingModels = true;
      this.error = null;
      this.notice = null;
      this.currentResult = null;
      this.gallery = [];
      this.lightbox = null;
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      this.render();
      this.refreshModels();
    }

    /** Appelé par l'hôte quand l'extension a été mise à jour sous nos pieds. */
    pluginUpdated() {
      this.refreshModels();
    }

    selectModel(name) {
      this.selectedModel = name;
      var sampling = defaultSampling(name);
      this.steps = sampling.steps;
      this.cfgScale = sampling.cfg;
      this.base = defaultResolution(name);
      this.width = snap(this.base * this.ratio.w);
      this.height = snap(this.base * this.ratio.h);
    }

    refreshModels() {
      var self = this;
      this.isLoadingModels = true;
      this.render();
      return invoke("list_image_models", {})
        .then(function (result) {
          self.models = normalizeModels(result);
          var known = self.models.some(function (m) {
            return m.name === self.selectedModel;
          });
          if (!known) self.selectModel(self.models[0] ? self.models[0].name : "");
          self.error = null;
        })
        .catch(function (error) {
          self.models = [];
          self.error = String((error && error.message) || error);
        })
        .then(function () {
          self.isLoadingModels = false;
          self.render();
        });
    }

    generate() {
      var self = this;
      var prompt = this.prompt.trim();
      if (!prompt) {
        this.error = "Décrivez l'image à produire avant de lancer la génération.";
        this.render();
        return;
      }
      if (this.models.length === 0) {
        this.error = "Aucun modèle de diffusion installé.";
        this.render();
        return;
      }
      if (this.mode !== "txt2img" && !this.sourceImage) {
        this.error = "Choisissez une image source pour ce mode.";
        this.render();
        return;
      }

      this.isGenerating = true;
      this.error = null;
      this.notice = "Génération en cours sur votre machine…";
      this.render();

      return invoke("generate_image", {
        prompt: prompt,
        model: this.selectedModel || undefined,
        width: this.width,
        height: this.height,
        steps: this.steps,
        cfg_scale: this.cfgScale,
        negative_prompt: this.negativePrompt.trim() || undefined,
        input_image: this.sourceImage || undefined,
        uncensored: this.uncensored,
        variants: 1
      })
        .then(function (result) {
          var paths = Array.isArray(result.paths) ? result.paths : [];
          if (!paths.length) throw new Error("Le moteur n'a retourné aucun fichier image.");
          var image = {
            path: paths[0],
            url: assetUrl(paths[0]),
            prompt: prompt
          };
          self.currentResult = image;
          self.gallery = [image].concat(self.gallery).slice(0, 16);
          self.notice = null;
          toast("Image générée", "success");

          var b = bridge();
          var sessionId = b && b.chat && b.chat.getSessionId ? b.chat.getSessionId() : null;
          if (sessionId && b.chat.appendAssistantMessage) {
            var markdown =
              "<!--locaryn-image:" + JSON.stringify(paths[0]) + "-->\n![](" + image.url + ")";
            b.chat.appendAssistantMessage(markdown).catch(function () {});
          }
        })
        .catch(function (error) {
          self.notice = null;
          self.error = String((error && error.message) || error);
          toast(self.error, "error");
        })
        .then(function () {
          self.isGenerating = false;
          self.render();
        });
    }

    /** Recopier ce que contiennent les champs libres avant un nouveau rendu :
     *  `innerHTML` les recrée, et la saisie en cours serait perdue. */
    captureInputs() {
      var root = this.shadowRoot;
      if (!root) return;
      var promptEl = root.querySelector("#ig-prompt");
      if (promptEl) this.prompt = promptEl.value;
      var negEl = root.querySelector("#ig-negative");
      if (negEl) this.negativePrompt = negEl.value;
      var modelEl = root.querySelector("#ig-model");
      if (modelEl && modelEl.value) this.selectedModel = modelEl.value;
    }

    // ── Rendu ──────────────────────────────────────────────────────────────

    renderStatusBadge() {
      if (this.isLoadingModels) return '<span class="ig-badge">Recherche…</span>';
      if (this.models.length === 0) {
        return '<span class="ig-badge ig-badge-empty">Aucun modèle</span>';
      }
      var plural = this.models.length > 1 ? "s" : "";
      return (
        '<span class="ig-badge">' +
        this.models.length +
        " modèle" +
        plural +
        " installé" +
        plural +
        "</span>"
      );
    }

    renderModelCard() {
      if (this.models.length === 0) {
        return (
          '<section class="ig-card">' +
          '<div class="ig-card-head"><span class="ig-card-title">Modèle de diffusion</span>' +
          this.renderStatusBadge() +
          "</div>" +
          '<p class="ig-hint">Les modèles d\'image se trouvent dans le catalogue de modèles de ' +
          "l'application, avec le filtre « Génération d'image ». Ils y restent à jour et " +
          "s'installent avec les fichiers qui les accompagnent.</p>" +
          '<button type="button" class="ig-btn" id="ig-open-catalog">' +
          "Ouvrir le catalogue de modèles</button>" +
          '<button type="button" class="ig-btn" id="ig-refresh">Chercher à nouveau</button>' +
          "</section>"
        );
      }

      var self = this;
      var options = this.models
        .map(function (model) {
          var missing = model.missing.length
            ? " — " + model.missing.length + " fichier compagnon manquant"
            : "";
          return (
            '<option value="' +
            escapeHtml(model.name) +
            '"' +
            (model.name === self.selectedModel ? " selected" : "") +
            ">" +
            escapeHtml(model.name + missing) +
            "</option>"
          );
        })
        .join("");

      var current = this.models.find(function (model) {
        return model.name === self.selectedModel;
      });
      var warning =
        current && current.missing.length
          ? '<p class="ig-note ig-note-error">Fichiers manquants : ' +
            escapeHtml(current.missing.join(", ")) +
            ". Réinstallez ce modèle depuis le catalogue pour récupérer ses compagnons.</p>"
          : "";

      return (
        '<section class="ig-card">' +
        '<div class="ig-card-head"><span class="ig-card-title">Modèle de diffusion</span>' +
        this.renderStatusBadge() +
        "</div>" +
        '<select class="ig-select" id="ig-model"' +
        (this.isGenerating ? " disabled" : "") +
        ">" +
        options +
        "</select>" +
        warning +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="ig-btn" id="ig-refresh">Actualiser</button>' +
        '<button type="button" class="ig-btn" id="ig-open-catalog">Catalogue de modèles</button>' +
        "</div>" +
        "</section>"
      );
    }

    renderControls() {
      var self = this;
      var busy = this.isGenerating;
      var ratios = RATIOS.map(function (ratio, index) {
        var on = self.ratio === ratio ? " ig-ratio-on" : "";
        return (
          '<button type="button" class="ig-ratio' +
          on +
          '" data-ratio="' +
          index +
          '">' +
          escapeHtml(ratio.label) +
          "<span>" +
          escapeHtml(ratio.detail) +
          "</span></button>"
        );
      }).join("");

      var source =
        this.mode === "txt2img"
          ? ""
          : '<section class="ig-card"><div class="ig-field">' +
            '<span class="ig-label">Image source</span>' +
            '<div class="ig-drop" id="ig-drop">' +
            (this.sourceImage
              ? '<img src="' +
                escapeHtml(this.sourceImage) +
                '" alt="Image source">Cliquer pour changer'
              : "Cliquer pour choisir une image") +
            "</div>" +
            '<input type="file" id="ig-file" accept="image/*" hidden>' +
            "</div></section>";

      var advanced = this.showAdvanced
        ? '<section class="ig-card">' +
          '<div class="ig-field"><label class="ig-label" for="ig-negative">Prompt négatif</label>' +
          '<input type="text" class="ig-input" id="ig-negative" placeholder="flou, déformation, basse qualité…" value="' +
          escapeHtml(this.negativePrompt) +
          '"' +
          (busy ? " disabled" : "") +
          "></div>" +
          '<div class="ig-adv-grid">' +
          '<div><div class="ig-slider-head"><span class="ig-label">Étapes</span>' +
          '<span class="ig-value" id="ig-steps-value">' +
          this.steps +
          "</span></div>" +
          '<input type="range" class="ig-range" id="ig-steps" min="1" max="60" value="' +
          this.steps +
          '"' +
          (busy ? " disabled" : "") +
          "></div>" +
          '<div><div class="ig-slider-head"><span class="ig-label">Guidage</span>' +
          '<span class="ig-value" id="ig-cfg-value">' +
          this.cfgScale +
          "</span></div>" +
          '<input type="range" class="ig-range" id="ig-cfg" min="0.5" max="20" step="0.5" value="' +
          this.cfgScale +
          '"' +
          (busy ? " disabled" : "") +
          "></div>" +
          "</div>" +
          '<label class="ig-check"><input type="checkbox" id="ig-uncensored"' +
          (this.uncensored ? " checked" : "") +
          (busy ? " disabled" : "") +
          "> Mode sans filtre (utilise l'encodeur abliteré s'il est installé)</label>" +
          "</section>"
        : "";

      return (
        '<div class="ig-column">' +
        '<div class="ig-tabs">' +
        '<button type="button" class="ig-tab' +
        (this.mode === "txt2img" ? " ig-tab-on" : "") +
        '" data-mode="txt2img">Texte → Image</button>' +
        '<button type="button" class="ig-tab' +
        (this.mode === "img2img" ? " ig-tab-on" : "") +
        '" data-mode="img2img">Image → Image</button>' +
        '<button type="button" class="ig-tab' +
        (this.mode === "edit" ? " ig-tab-on" : "") +
        '" data-mode="edit">Retouche</button>' +
        "</div>" +
        this.renderModelCard() +
        '<section class="ig-card"><div class="ig-field">' +
        '<label class="ig-label" for="ig-prompt">Description</label>' +
        '<textarea class="ig-textarea" id="ig-prompt" placeholder="Décrivez l\'image à produire…"' +
        (busy ? " disabled" : "") +
        ">" +
        escapeHtml(this.prompt) +
        "</textarea></div></section>" +
        source +
        '<section class="ig-card"><div class="ig-field">' +
        '<span class="ig-label">Format</span>' +
        '<div class="ig-ratios">' +
        ratios +
        "</div></div></section>" +
        '<button type="button" class="ig-toggle" id="ig-adv">' +
        "<span>" +
        (this.showAdvanced ? "Masquer" : "Afficher") +
        " les options avancées</span><span>" +
        this.width +
        "×" +
        this.height +
        " · " +
        this.steps +
        " étapes · guidage " +
        this.cfgScale +
        "</span></button>" +
        advanced +
        (this.error ? '<p class="ig-note ig-note-error">' + escapeHtml(this.error) + "</p>" : "") +
        (this.notice ? '<p class="ig-note ig-note-info">' + escapeHtml(this.notice) + "</p>" : "") +
        '<button type="button" class="ig-btn-primary" id="ig-generate"' +
        (busy || this.models.length === 0 ? " disabled" : "") +
        ">" +
        (busy
          ? "Génération en cours…"
          : this.mode === "txt2img"
            ? "Générer l'image"
            : "Transformer l'image") +
        "</button>" +
        "</div>"
      );
    }

    renderCanvas() {
      var body;
      if (this.isGenerating) {
        body =
          '<div class="ig-canvas-empty">' +
          '<div class="ig-canvas-mark">◐</div>' +
          '<p class="ig-hint">Diffusion en cours. Le calcul se fait sur votre machine : ' +
          "comptez de quelques secondes à plusieurs minutes selon le modèle.</p>" +
          '<div class="ig-progress"><i></i></div>' +
          "</div>";
      } else if (this.currentResult) {
        body =
          '<div class="ig-canvas-empty" style="max-width:none">' +
          '<img class="ig-result-img" id="ig-result" src="' +
          escapeHtml(this.currentResult.url) +
          '" alt="' +
          escapeHtml(this.currentResult.prompt) +
          '">' +
          '<div class="ig-result-bar">' +
          '<button type="button" class="ig-btn" id="ig-save">Télécharger</button>' +
          '<button type="button" class="ig-btn" id="ig-copy">Copier</button>' +
          "</div></div>";
      } else {
        body =
          '<div class="ig-canvas-empty">' +
          '<div class="ig-canvas-mark">✦</div>' +
          '<p class="ig-hint">' +
          (this.models.length === 0
            ? "Installez un modèle depuis le catalogue de modèles pour commencer."
            : "Décrivez une image à gauche, puis lancez la génération. Le résultat s'affichera ici.") +
          "</p></div>";
      }

      var gallery = this.gallery.length
        ? '<section class="ig-card">' +
          '<div class="ig-card-head"><span class="ig-card-title">Images de cette session (' +
          this.gallery.length +
          ")</span></div>" +
          '<div class="ig-gallery">' +
          this.gallery
            .map(function (image, index) {
              return (
                '<figure class="ig-thumb" data-thumb="' +
                index +
                '"><img src="' +
                escapeHtml(image.url) +
                '" alt="' +
                escapeHtml(image.prompt) +
                '" loading="lazy"><figcaption>' +
                escapeHtml(image.prompt) +
                "</figcaption></figure>"
              );
            })
            .join("") +
          "</div></section>"
        : "";

      return (
        '<div class="ig-column">' +
        '<section class="ig-card ig-canvas">' +
        body +
        "</section>" +
        gallery +
        "</div>"
      );
    }

    render() {
      if (!this.shadowRoot) return;
      var lightbox = this.lightbox
        ? '<div class="ig-modal" id="ig-modal"><div class="ig-modal-box">' +
          '<img src="' +
          escapeHtml(this.lightbox.url) +
          '" alt="Agrandissement">' +
          '<div class="ig-result-bar">' +
          '<button type="button" class="ig-btn" id="ig-lb-save">Télécharger</button>' +
          '<button type="button" class="ig-btn" id="ig-lb-copy">Copier</button>' +
          '<button type="button" class="ig-btn" id="ig-lb-close">Fermer</button>' +
          "</div></div></div>"
        : "";

      this.shadowRoot.innerHTML =
        "<style>" +
        CSS +
        "</style>" +
        '<div class="ig-panel">' +
        this.renderControls() +
        this.renderCanvas() +
        "</div>" +
        lightbox;

      this.bindEvents();
    }

    bindEvents() {
      var self = this;
      var root = this.shadowRoot;
      if (!root) return;

      var on = function (selector, event, handler) {
        var element = root.querySelector(selector);
        if (element) element.addEventListener(event, handler);
      };
      var onAll = function (selector, event, handler) {
        root.querySelectorAll(selector).forEach(function (element) {
          element.addEventListener(event, function () {
            handler(element);
          });
        });
      };

      on("#ig-prompt", "input", function (event) {
        self.prompt = event.target.value;
      });
      on("#ig-negative", "input", function (event) {
        self.negativePrompt = event.target.value;
      });
      on("#ig-model", "change", function (event) {
        self.captureInputs();
        self.selectModel(event.target.value);
        self.render();
      });
      on("#ig-refresh", "click", function () {
        self.captureInputs();
        self.refreshModels();
      });
      on("#ig-open-catalog", "click", function () {
        openHostView("models");
      });

      onAll("[data-mode]", "click", function (element) {
        self.captureInputs();
        self.mode = element.getAttribute("data-mode") || "txt2img";
        self.render();
      });
      onAll("[data-ratio]", "click", function (element) {
        self.captureInputs();
        self.ratio = RATIOS[Number(element.getAttribute("data-ratio"))] || RATIOS[0];
        self.width = snap(self.base * self.ratio.w);
        self.height = snap(self.base * self.ratio.h);
        self.render();
      });

      on("#ig-adv", "click", function () {
        self.captureInputs();
        self.showAdvanced = !self.showAdvanced;
        self.render();
      });
      on("#ig-steps", "input", function (event) {
        self.steps = Number(event.target.value);
        var label = root.querySelector("#ig-steps-value");
        if (label) label.textContent = String(self.steps);
      });
      on("#ig-cfg", "input", function (event) {
        self.cfgScale = Number(event.target.value);
        var label = root.querySelector("#ig-cfg-value");
        if (label) label.textContent = String(self.cfgScale);
      });
      on("#ig-uncensored", "change", function (event) {
        self.uncensored = event.target.checked;
      });

      on("#ig-generate", "click", function () {
        self.captureInputs();
        self.generate();
      });

      var fileInput = root.querySelector("#ig-file");
      on("#ig-drop", "click", function () {
        if (fileInput) fileInput.click();
      });
      if (fileInput) {
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

      on("#ig-result", "click", function () {
        self.lightbox = self.currentResult;
        self.render();
      });
      on("#ig-save", "click", function () {
        if (self.currentResult) saveImage(self.currentResult.url);
      });
      on("#ig-copy", "click", function () {
        if (self.currentResult) self.copyToClipboard(self.currentResult.url);
      });

      onAll("[data-thumb]", "click", function (element) {
        var index = Number(element.getAttribute("data-thumb"));
        if (self.gallery[index]) {
          self.lightbox = self.gallery[index];
          self.render();
        }
      });

      on("#ig-modal", "click", function (event) {
        if (event.target.id === "ig-modal") {
          self.lightbox = null;
          self.render();
        }
      });
      on("#ig-lb-close", "click", function () {
        self.lightbox = null;
        self.render();
      });
      on("#ig-lb-save", "click", function () {
        if (self.lightbox) saveImage(self.lightbox.url);
      });
      on("#ig-lb-copy", "click", function () {
        if (self.lightbox) self.copyToClipboard(self.lightbox.url);
      });
    }

    copyToClipboard(url) {
      copyImage(url)
        .then(function () {
          toast("Image copiée", "success");
        })
        .catch(function (error) {
          toast("Copie impossible : " + ((error && error.message) || error), "error");
        });
    }
  }

  if (!customElements.get("locaryn-image-gen-panel")) {
    customElements.define("locaryn-image-gen-panel", ImageGenPanel);
  }
})();
