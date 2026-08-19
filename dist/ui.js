/* plugin-image-gen UI bundle: framework-free custom elements loaded by Locaryn. */
(function () {
  "use strict";

  function bridge() {
    return window.locaryn || window.LocarynPluginAPI;
  }

  var CATALOG = [
    {
      id: "z-image",
      label: "Z-Image Turbo (Q8)",
      match: /z[_-]?image/i,
      sources: [
        "https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q8_0.gguf",
        "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors",
        "https://huggingface.co/second-state/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
      ],
      steps: 8,
      cfg: 1
    },
    {
      id: "sd15",
      label: "Stable Diffusion 1.5 (Q4)",
      match: /stable[-_]?diffusion|sd15/i,
      sources: ["https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf"],
      steps: 20,
      cfg: 7
    },
    {
      id: "sdxl",
      label: "SDXL Turbo (Q4)",
      match: /sdxl/i,
      sources: ["https://huggingface.co/second-state/SDXL-Turbo-GGUF/resolve/main/sdxl-turbo-Q4_0.gguf"],
      steps: 6,
      cfg: 7
    },
    {
      id: "flux",
      label: "FLUX.1 Schnell (Q4)",
      match: /flux/i,
      sources: ["https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_0.gguf", "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors"],
      steps: 4,
      cfg: 1
    }
  ];

  var CSS = ""
    + ":host{display:block;width:100%;color:var(--text,#e2e8f0);font-family:inherit}"
    + ".ig-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}"
    + ".ig-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px}.ig-sub,.ig-muted{color:#94a3b8;font-size:11px}.ig-sub{margin-top:3px}"
    + ".ig-label{color:#b7c2d2;font-size:12px;font-weight:600;display:block;margin-bottom:6px}.ig-field{display:flex;flex-direction:column;gap:4px}"
    + "textarea,select,input[type=text],input[type=number]{width:100%;box-sizing:border-box;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;padding:9px 10px;font:inherit;font-size:13px;outline:none}"
    + "textarea:focus,select:focus,input:focus{border-color:#60a5fa}textarea{resize:vertical;min-height:78px}.ig-row{display:flex;gap:10px;flex-wrap:wrap}.ig-row>.ig-field{flex:1 1 120px}"
    + ".ig-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}button{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;border-radius:8px;padding:8px 12px;font:inherit;font-size:12px;cursor:pointer}button:hover{background:rgba(255,255,255,.12)}button:disabled{opacity:.55;cursor:not-allowed}.ig-primary{background:#3b82f6;border-color:#3b82f6;color:#fff;font-weight:700}.ig-primary:hover{background:#2563eb}"
    + ".ig-error{color:#fca5a5;background:rgba(127,29,29,.25);border:1px solid rgba(248,113,113,.35);border-radius:8px;padding:9px;font-size:12px;white-space:pre-wrap}.ig-ok{color:#86efac;font-size:12px}"
    + ".ig-drop{border:1px dashed rgba(255,255,255,.25);border-radius:8px;padding:14px;text-align:center;color:#94a3b8;font-size:12px;cursor:pointer}.ig-drop img{max-height:130px;max-width:100%;border-radius:6px;display:block;margin:0 auto 8px;object-fit:contain}"
    + ".ig-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.ig-thumb{border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);border-radius:8px;overflow:hidden;cursor:zoom-in}.ig-thumb img{width:100%;height:145px;object-fit:cover;display:block}.ig-thumb div{padding:6px 8px;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".ig-install{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(59,130,246,.09);border:1px solid rgba(96,165,250,.25);padding:10px;border-radius:8px;font-size:12px}"
    + ".ig-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}.ig-modal-box{position:relative;max-width:min(92vw,1100px);max-height:92vh;display:flex;flex-direction:column;align-items:center;gap:10px}.ig-modal img{max-width:92vw;max-height:82vh;object-fit:contain;border-radius:8px;box-shadow:0 12px 50px #000}.ig-modal-bar{display:flex;gap:7px;align-items:center;background:rgba(20,25,35,.94);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:7px}.ig-close{font-size:18px;line-height:1;padding:5px 9px}.ig-floating{position:fixed;right:16px;bottom:64px;width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;z-index:2147482000;box-shadow:0 18px 70px rgba(0,0,0,.55)}.ig-floating .ig-card{background:#171b25}";

  function jsonValue(value) {
    if (typeof value !== "string") return value || {};
    try {
      var parsed = JSON.parse(value);
      return typeof parsed === "string" ? jsonValue(parsed) : parsed;
    } catch (_) {
      return { text: value };
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toast(message, type) {
    var b = bridge();
    if (b && b.ui && b.ui.showToast) b.ui.showToast(message, type || "info");
  }

  function invoke(tool, input) {
    var b = bridge();
    if (!b || !b.tools || !b.tools.invoke) return Promise.reject(new Error("Le pont Locaryn n'est pas disponible."));
    return Promise.resolve(b.tools.invoke(tool, input)).then(function (value) {
      var parsed = jsonValue(value);
      if (parsed && parsed.error) throw new Error(parsed.error.message || parsed.error);
      return parsed;
    });
  }

  function assetUrl(path) {
    var b = bridge();
    if (b && b.files && b.files.assetUrl) return b.files.assetUrl(path);
    return path;
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

  // The host does not classify image prompts. The extension claims only clear
  // visual requests; normal questions continue to Locaryn's native agent.
  function looksLikeImageRequest(text) {
    var value = String(text || "");
    return /(?:\b(?:g[ée]n[èe]re(?:r|z)?|cr[ée]e(?:r|z)?|dessine(?:r|z)?|fabrique(?:r|z)?|illustr(?:e|er|ez)|generate|create|draw|paint|make)\b[\s\S]{0,100}\b(?:image|photo|photographie|dessin|illustration|logo|ic[oô]ne|visuel|picture|artwork)\b)|(?:^|\s)(?:image|photo|logo|ic[oô]ne|illustration|visuel|picture)\s*:/i.test(value);
  }

  function catalogFor(model) {
    return CATALOG.find(function (entry) { return entry.match.test(model || ""); }) || CATALOG[0];
  }

  class ImagePanel extends HTMLElement {
    constructor() {
      super();
      this._context = {};
      this.models = [];
      this.gallery = [];
      this.busy = false;
      this.error = "";
      this.notice = "";
      this.sourceImage = "";
      this.lightbox = null;
      this._ready = null;
      this.attachShadow({ mode: "open" });
    }

    set context(value) { this._context = value || {}; if (this.isConnected) this.render(); }
    get context() { return this._context; }

    connectedCallback() {
      this.render();
      this._ready = this.refreshModels();
    }

    refreshModels() {
      var self = this;
      return invoke("list_image_models", {}).then(function (result) {
        self.models = Array.isArray(result.models) ? result.models : [];
        self.error = "";
        self.render();
      }).catch(function (error) {
        self.error = String(error.message || error);
        self.render();
      });
    }

    install(entry) {
      var self = this;
      if (!entry || this.busy) return Promise.resolve();
      this.busy = true;
      this.error = "";
      this.notice = "Téléchargement du modèle et de ses compagnons…";
      this.render();
      return invoke("install_image_model", { sources: entry.sources }).then(function () {
        self.notice = entry.label + " est installé.";
        return self.refreshModels();
      }).then(function () {
        toast("Modèle image installé", "success");
      }).catch(function (error) {
        self.error = String(error.message || error);
      }).then(function () {
        self.busy = false;
        self.render();
      });
    }

    generate() {
      var prompt = this.shadowRoot.querySelector("#ig-prompt");
      return this.generatePrompt(prompt ? prompt.value : "");
    }

    generatePrompt(prompt) {
      var self = this;
      if (this.busy) return Promise.resolve();
      var ready = this._ready || Promise.resolve();
      return ready.then(function () {
        var root = self.shadowRoot;
        prompt = String(prompt || "").trim();
        var modelInput = root.querySelector("#ig-model");
        var model = modelInput ? modelInput.value : "";
        if (!prompt) throw new Error("Écrivez un prompt.");
        if (!model || self.models.indexOf(model) < 0) throw new Error("Installez puis sélectionnez un modèle de diffusion.");
        var width = Number((root.querySelector("#ig-width") || {}).value || 1024);
        var height = Number((root.querySelector("#ig-height") || {}).value || 1024);
        var steps = Number((root.querySelector("#ig-steps") || {}).value || 20);
        var cfg = Number((root.querySelector("#ig-cfg") || {}).value || 7);
        var negative = ((root.querySelector("#ig-negative") || {}).value || "").trim();
        var uncensored = !!(root.querySelector("#ig-uncensored") || {}).checked;
        self.busy = true;
        self.error = "";
        self.notice = "stable-diffusion.cpp travaille localement…";
        self.render();
        return invoke("generate_image", {
          prompt: prompt,
          model: model,
          width: Math.max(64, Math.min(2048, width)),
          height: Math.max(64, Math.min(2048, height)),
          steps: Math.max(1, Math.min(100, steps)),
          cfg_scale: Math.max(.1, Math.min(30, cfg)),
          negative_prompt: negative || undefined,
          input_image: self.sourceImage || undefined,
          uncensored: uncensored,
          variants: 1
        }).then(function (result) {
          var paths = Array.isArray(result.paths) ? result.paths : [];
          if (!paths.length) throw new Error("Le moteur n'a retourné aucune image.");
          var images = paths.map(function (path) { return { path: path, url: assetUrl(path), prompt: prompt }; });
          self.gallery = images.concat(self.gallery).slice(0, 12);
          self.notice = "Image générée et ajoutée au chat actif.";
          var b = bridge();
          if (b && b.chat && b.chat.appendAssistantMessage) {
            var markdown = "Image générée — « " + prompt + " »\n\n" + images.map(function (image) { return "![](" + image.url + ")"; }).join("\n");
            return b.chat.appendAssistantMessage(markdown);
          }
        }).then(function () {
          toast("Image générée avec succès", "success");
        }).catch(function (error) {
          self.error = String(error.message || error);
          toast(self.error, "error");
        }).then(function () {
          self.busy = false;
          self.render();
        });
      }).catch(function (error) {
        self.error = String(error.message || error);
        self.busy = false;
        self.render();
        toast(self.error, "error");
      });
    }

    openLightbox(image) { this.lightbox = image; this.render(); }

    renderLightbox() {
      var self = this;
      if (!this.lightbox) return "";
      return "<div class=\"ig-modal\" id=\"ig-lightbox\" role=\"dialog\" aria-modal=\"true\"><div class=\"ig-modal-box\"><img src=\"" + escapeHtml(this.lightbox.url) + "\" alt=\"Image agrandie\"><div class=\"ig-modal-bar\"><button id=\"ig-save\">⬇ Enregistrer sous</button><button id=\"ig-copy\">Copier l'image</button><button class=\"ig-close\" id=\"ig-close\" aria-label=\"Fermer\">×</button></div></div></div>";
    }

    render() {
      var self = this;
      if (!this.shadowRoot) return;
      var current = ((this.shadowRoot.querySelector("#ig-model") || {}).value) || this.models[0] || "";
      var entry = catalogFor(current);
      var options = this.models.map(function (model) { return "<option value=\"" + escapeHtml(model) + "\">" + escapeHtml(model) + "</option>"; }).join("");
      var source = this.sourceImage ? "<img src=\"" + escapeHtml(this.sourceImage) + "\" alt=\"Image source\"><span>Cliquer pour remplacer l'image source</span>" : "Cliquer pour ajouter une image source (facultatif, img2img)";
      this.shadowRoot.innerHTML = "<style>" + CSS + "</style><div class=\"ig-card\"><div><div class=\"ig-title\">✨ Génération d'images — plugin-image-gen</div><div class=\"ig-sub\">Moteur, modèles, interface et insertion dans le chat appartiennent à cette extension.</div></div><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-model\">Modèle de diffusion</label><select id=\"ig-model\">" + (options || "<option value=\"\">Aucun modèle installé</option>") + "</select></div>" + (!this.models.length ? "<div class=\"ig-install\"><span>Choisissez un modèle prêt à télécharger.</span><button id=\"ig-install\" class=\"ig-primary\">Installer Z-Image</button></div>" : "") + "<div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-prompt\">Prompt</label><textarea id=\"ig-prompt\" placeholder=\"Une peinture à l'huile d'un avion au-dessus des Alpes, lumière dorée…\"></textarea></div><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-negative\">Prompt négatif <span class=\"ig-muted\">(facultatif)</span></label><input id=\"ig-negative\" type=\"text\" placeholder=\"flou, watermark, mauvaise anatomie…\"></div><div class=\"ig-drop\" id=\"ig-source\">" + source + "</div><input id=\"ig-file\" type=\"file\" accept=\"image/*\" hidden><div class=\"ig-row\"><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-width\">Largeur</label><input id=\"ig-width\" type=\"number\" min=\"64\" max=\"2048\" step=\"64\" value=\"1024\"></div><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-height\">Hauteur</label><input id=\"ig-height\" type=\"number\" min=\"64\" max=\"2048\" step=\"64\" value=\"1024\"></div><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-steps\">Steps</label><input id=\"ig-steps\" type=\"number\" min=\"1\" max=\"100\" value=\"" + (entry.steps || 20) + "\"></div><div class=\"ig-field\"><label class=\"ig-label\" for=\"ig-cfg\">CFG</label><input id=\"ig-cfg\" type=\"number\" min=\"0.1\" max=\"30\" step=\"0.1\" value=\"" + (entry.cfg || 7) + "\"></div></div><label class=\"ig-muted\"><input id=\"ig-uncensored\" type=\"checkbox\"> Mode sans limite — j'assume le contenu généré</label><div class=\"ig-actions\"><button id=\"ig-generate\" class=\"ig-primary\" " + (this.busy ? "disabled" : "") + ">" + (this.busy ? "Génération…" : "Générer l'image") + "</button><span class=\"ig-muted\">" + (this.busy ? "Ne fermez pas Locaryn pendant le calcul." : "Les poids restent sur cette machine.") + "</span></div>" + (this.notice ? "<div class=\"ig-ok\">" + escapeHtml(this.notice) + "</div>" : "") + (this.error ? "<div class=\"ig-error\">" + escapeHtml(this.error) + "</div>" : "") + (this.gallery.length ? "<div><div class=\"ig-label\">Galerie de cette session</div><div class=\"ig-gallery\">" + this.gallery.map(function (image, index) { return "<div class=\"ig-thumb\" data-image-index=\"" + index + "\"><img src=\"" + escapeHtml(image.url) + "\" alt=\"" + escapeHtml(image.prompt) + "\"><div>" + escapeHtml(image.prompt.slice(0, 52)) + "</div></div>"; }).join("") + "</div></div>" : "") + "</div>" + this.renderLightbox();
      var select = this.shadowRoot.querySelector("#ig-model");
      if (select && current) select.value = current;
      var generate = this.shadowRoot.querySelector("#ig-generate");
      if (generate) generate.addEventListener("click", function () { self.generate(); });
      var install = this.shadowRoot.querySelector("#ig-install");
      if (install) install.addEventListener("click", function () { self.install(CATALOG[0]); });
      this.shadowRoot.querySelectorAll("[data-image-index]").forEach(function (node) { node.addEventListener("click", function () { self.openLightbox(self.gallery[Number(node.getAttribute("data-image-index"))]); }); });
      var close = this.shadowRoot.querySelector("#ig-close");
      if (close) close.addEventListener("click", function () { self.lightbox = null; self.render(); });
      var modal = this.shadowRoot.querySelector("#ig-lightbox");
      if (modal) modal.addEventListener("click", function (event) { if (event.target === modal) { self.lightbox = null; self.render(); } });
      var save = this.shadowRoot.querySelector("#ig-save");
      if (save) save.addEventListener("click", function () { if (self.lightbox) saveImage(self.lightbox.url); });
      var copy = this.shadowRoot.querySelector("#ig-copy");
      if (copy) copy.addEventListener("click", function () { if (self.lightbox) copyImage(self.lightbox.url).then(function () { toast("Image copiée", "success"); }).catch(function (error) { toast("Copie impossible : " + (error.message || error), "error"); }); });
      var drop = this.shadowRoot.querySelector("#ig-source");
      var file = this.shadowRoot.querySelector("#ig-file");
      if (drop && file) {
        drop.addEventListener("click", function () { file.click(); });
        file.addEventListener("change", function () { var picked = file.files && file.files[0]; if (!picked) return; var reader = new FileReader(); reader.onload = function () { self.sourceImage = reader.result; self.render(); }; reader.readAsDataURL(picked); });
      }
    }
  }

  class ImageButton extends HTMLElement {
    constructor() {
      super();
      this.context = {};
      this.open = false;
      this._unsubscribe = null;
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      var self = this;
      this.render();
      var b = bridge();
      // Only this composer contribution registers the handler. If the Studio
      // tab is also mounted, it cannot consume the same message a second time.
      if (b && b.chat && b.chat.onSubmit && !window.__locarynImageGenSubmit) {
        var handler = function (text) {
          if (!looksLikeImageRequest(text)) return false;
          self.open = true;
          self.render();
          var panel = self.shadowRoot.querySelector("locaryn-image-gen-panel");
          return panel && panel.generatePrompt ? panel.generatePrompt(text).then(function () { return true; }) : true;
        };
        this._unsubscribe = b.chat.onSubmit(handler);
        window.__locarynImageGenSubmit = { owner: this, handler: handler };
      }
    }

    disconnectedCallback() {
      if (this._unsubscribe) this._unsubscribe();
      if (window.__locarynImageGenSubmit && window.__locarynImageGenSubmit.owner === this) delete window.__locarynImageGenSubmit;
    }

    render() {
      var panel;
      this.shadowRoot.innerHTML = "<style>" + CSS + ".ig-floating{display:" + (this.open ? "block" : "none") + ";}</style><button type=\"button\" title=\"Générer une image\">🖼 Image</button><div class=\"ig-floating\"><locaryn-image-gen-panel></locaryn-image-gen-panel></div>";
      panel = this.shadowRoot.querySelector("locaryn-image-gen-panel");
      if (panel) panel.context = this.context;
      var button = this.shadowRoot.querySelector("button");
      if (button) button.addEventListener("click", function () { this.open = !this.open; this.render(); }.bind(this));
    }
  }

  if (!customElements.get("locaryn-image-gen-panel")) customElements.define("locaryn-image-gen-panel", ImagePanel);
  if (!customElements.get("locaryn-image-gen-button")) customElements.define("locaryn-image-gen-button", ImageButton);
})();
