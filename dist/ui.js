/* plugin-image — panneau Studio.
 *
 * Rendu dans le document, sans racine fantôme : le panneau hérite du thème et
 * des composants de l'application (`locaryn-card`, `locaryn-btn-*`,
 * `locaryn-gen-*`) au lieu de recopier un style qui vieillit à part. Une
 * racine fantôme isolait tout — le panneau sortait sans aucun style, et le
 * thème de l'application n'avait plus prise dessus.
 *
 * L'extension possède son moteur et ses modèles ; les modèles se choisissent
 * dans le catalogue de modèles de l'application, pas ici. */
(function () {
  "use strict";

  function bridge() {
    return window.locaryn || window.LocarynPluginAPI || null;
  }

  /** La mise en page du panneau, portée par ses propres nœuds.
   *
   *  Le reste de son style vient de l'application — couleurs, cartes, boutons
   *  suivent ainsi le thème sans être recopiés. Mais la disposition de ses
   *  blocs le regarde, et une règle injectée ne suffisait pas : l'application
   *  possède déjà `.locaryn-gen-split`, héritée du temps où la génération
   *  d'images était une fonction du socle, et c'est elle qui décidait —
   *  1280 px de large, une colonne de réglages de 380 px, six blocs empilés
   *  et deux bandes vides sur les côtés. Un style porté par l'élément lui-même
   *  ne se discute pas, quel que soit l'ordre des feuilles.
   *
   *  Deux niveaux, tous deux en `auto-fit` : la page se coupe en deux quand
   *  elle dépasse 880 px, et la colonne des réglages range ses blocs par deux
   *  dès qu'elle atteint 480 px. Aucune taille d'écran n'est devinée à
   *  l'avance ; chaque grille décide d'après la place qu'elle a réellement. */
  var SPLIT_STYLE =
    "display:grid;align-items:start;gap:24px;width:100%;max-width:1680px;" +
    "margin:0 auto;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));";

  /* `max(240px,45%)` borne le nombre de pistes à deux : au-delà, 45 % trois
     fois dépasse la largeur disponible. En dessous de 480 px, le plancher de
     240 px reprend la main et la colonne redevient unique. */
  var CONTROLS_STYLE =
    "display:grid;align-content:start;gap:14px;min-width:0;" +
    "grid-template-columns:repeat(auto-fit,minmax(min(100%,max(240px,45%)),1fr));";

  var WIDE_STYLE = "grid-column:1/-1;";

  var CANVAS_STYLE = "display:flex;flex-direction:column;gap:14px;min-width:0";

  /** La version du paquet, affichée dans le panneau. */
  var PANEL_VERSION = "2.0.4";

  /** Les éléments qui perdent à être coupés en deux. Ceux des versions
   *  précédentes sont visés aussi : ce script sert à les rattraper. */
  var WIDE_SELECTOR = [
    ".locaryn-gen-wide",
    ".locaryn-gen-tabs",
    ".locaryn-gen-advanced-toggle",
    ".locaryn-gen-advanced-panel",
    ".locaryn-gen-error",
    ".locaryn-gen-generate-btn"
  ].join(",");

  /** Poser la disposition sur ce qui est déjà à l'écran.
   *
   *  Un élément personnalisé ne se redéfinit pas : quand l'hôte a déjà
   *  enregistré une version précédente de ce panneau, c'est elle qui rend, et
   *  rien de ce qui est écrit ici n'atteint la page — on met le paquet à jour
   *  et l'interface ne bouge pas. Ce script-ci s'exécute quand même. Il
   *  corrige donc ce que l'autre a produit, au lieu d'attendre un
   *  redémarrage que rien n'annonce.
   *
   *  Idempotent : quand c'est bien cette version qui rend, il réécrit à
   *  l'identique ce qu'elle a déjà posé. */
  function stampLayout() {
    var panels = document.querySelectorAll("locaryn-image-panel,locaryn-image-gen-panel");
    for (var i = 0; i < panels.length; i += 1) {
      var panel = panels[i];
      var split = panel.querySelector(".locaryn-gen-split");
      if (!split) continue;
      if (split.getAttribute("style") !== SPLIT_STYLE) split.setAttribute("style", SPLIT_STYLE);
      var columns = split.children;
      if (columns[0] && columns[0].getAttribute("style") !== CONTROLS_STYLE) {
        columns[0].setAttribute("style", CONTROLS_STYLE);
      }
      // Comparer avant d'écrire : l'observateur qui appelle cette fonction
      // réagit à toute mutation, et une écriture inconditionnelle se
      // rappellerait elle-même sans fin.
      if (columns[1] && columns[1].getAttribute("style") !== CANVAS_STYLE) {
        columns[1].setAttribute("style", CANVAS_STYLE);
      }
      // La version qui a réellement posé cette disposition. Sans elle, une
      // capture d'écran ne dit pas quel code rend, et on cherche un défaut de
      // mise en page là où il n'y a qu'un paquet resté en arrière.
      var tabs = columns[0] ? columns[0].querySelector(".locaryn-gen-tabs") : null;
      if (tabs) {
        tabs.style.alignItems = "center";
        var badge = tabs.querySelector("[data-locaryn-image-version]");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "locaryn-gen-hint";
          badge.setAttribute("data-locaryn-image-version", "");
          badge.style.marginLeft = "auto";
          badge.style.whiteSpace = "nowrap";
          badge.title = "Version du paquet plugin-image qui rend ce panneau";
          tabs.appendChild(badge);
        }
        if (badge.textContent !== "v" + PANEL_VERSION) badge.textContent = "v" + PANEL_VERSION;
      }
      var wide = columns[0] ? columns[0].querySelectorAll(WIDE_SELECTOR) : [];
      for (var j = 0; j < wide.length; j += 1) {
        if (wide[j].parentElement !== columns[0]) continue;
        if (wide[j].style.gridColumn !== "1 / -1") wide[j].style.gridColumn = "1/-1";
      }
    }
  }

  /** Le panneau se réécrit entièrement à chaque rendu : observer le document
   *  est le seul moyen de reprendre la main après coup. */
  function watchLayout() {
    stampLayout();
    if (window.__locarynImageLayoutWatcher) return;
    var observer = new MutationObserver(function () {
      stampLayout();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__locarynImageLayoutWatcher = observer;
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

  /** Les définitions proposées, en plus de celle du modèle. Rendre au-delà de
   *  la résolution d'entraînement ne rend pas l'image meilleure — il la
   *  déforme — mais le choix appartient à qui regarde le résultat. */
  var SIZES = [
    { label: "Native", detail: "du modèle", base: 0 },
    { label: "Brouillon", detail: "512 px", base: 512 },
    { label: "Standard", detail: "768 px", base: 768 },
    { label: "Élevée", detail: "1024 px", base: 1024 },
    { label: "Maximale", detail: "1280 px", base: 1280 }
  ];

  var SAMPLERS = ["", "euler", "euler_a", "heun", "dpm2", "dpm++2s_a", "dpm++2m", "dpm++2mv2", "lcm"];
  var SCHEDULERS = ["", "discrete", "karras", "exponential", "ays", "gits"];

  /** Les trois façons de modifier une zone, telles que le moteur les nomme. */
  var EDIT_MODES = [
    { id: "preview", label: "Aperçu", hint: "Teinte la zone sans rien modifier." },
    { id: "recolor", label: "Recolorer", hint: "Change la couleur exactement, sans diffusion." },
    { id: "replace", label: "Remplacer", hint: "Redessine la zone avec le moteur." }
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
      this.nativeBase = 1024;
      this.sizeIndex = 0;
      this.ratio = RATIOS[0];
      this.width = 1024;
      this.height = 1024;
      this.steps = 20;
      this.cfgScale = 7.0;
      this.seed = "";
      this.variants = 1;
      this.strength = 0.75;
      this.sampler = "";
      this.scheduler = "";
      this.clipSkip = "";
      this.sourceImage = null;
      this.editTarget = "";
      this.editMode = "preview";
      this.editColor = "#633e26";
      this.editPrompt = "";
      this.editStats = null;
      this.showAdvanced = false;
      this.uncensored = false;
      this.isGenerating = false;
      this.isLoadingModels = true;
      this.error = null;
      this.notice = null;
      this.currentResult = null;
      this.gallery = [];
      this.lightbox = null;
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
      this.nativeBase = defaultResolution(name);
      this.applySize();
    }

    /** Recalcule les dimensions depuis la définition et le format choisis. */
    applySize() {
      var chosen = SIZES[this.sizeIndex] || SIZES[0];
      this.base = chosen.base || this.nativeBase;
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
      if (this.mode === "edit") return this.editRegion();
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
      this.notice = null;
      this.render();

      var seed = parseInt(this.seed, 10);
      var clipSkip = parseInt(this.clipSkip, 10);
      return invoke("generate_image", {
        prompt: prompt,
        model: this.selectedModel || undefined,
        width: this.width,
        height: this.height,
        steps: this.steps,
        cfg_scale: this.cfgScale,
        negative_prompt: this.negativePrompt.trim() || undefined,
        input_image: this.sourceImage || undefined,
        strength: this.sourceImage ? this.strength : undefined,
        seed: isFinite(seed) ? seed : undefined,
        sampler: this.sampler || undefined,
        scheduler: this.scheduler || undefined,
        clip_skip: isFinite(clipSkip) ? clipSkip : undefined,
        uncensored: this.uncensored,
        variants: this.variants
      })
        .then(function (result) {
          var paths = Array.isArray(result.paths) ? result.paths : [];
          if (!paths.length) throw new Error("Le moteur n'a retourné aucun fichier image.");
          var image = { path: paths[0], url: assetUrl(paths[0]), prompt: prompt };
          self.currentResult = image;
          self.gallery = [image].concat(self.gallery).slice(0, 16);
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
          self.error = String((error && error.message) || error);
          toast(self.error, "error");
        })
        .then(function () {
          self.isGenerating = false;
          self.render();
        });
    }

    /** Modifier une seule zone, désignée en clair.
     *
     *  Un img2img global régénère toute la scène : à faible force rien ne
     *  bouge, à forte force le décor change aussi. La segmentation par
     *  description donne le masque qui manque, et l'aperçu permet de vérifier
     *  la sélection avant de toucher à l'image. */
    editRegion() {
      var self = this;
      if (!this.sourceImage) {
        this.error = "Choisissez l'image à retoucher.";
        this.render();
        return;
      }
      var target = this.editTarget.trim();
      if (!target) {
        this.error = "Décrivez la zone à modifier (ex. « le t-shirt »).";
        this.render();
        return;
      }
      if (this.editMode === "replace" && !this.editPrompt.trim()) {
        this.error = "Décrivez ce qui doit remplacer la zone.";
        this.render();
        return;
      }

      this.isGenerating = true;
      this.error = null;
      this.notice = null;
      this.editStats = null;
      this.render();

      return invoke("edit_image_region", {
        image: this.sourceImage,
        target: target,
        mode: this.editMode,
        color: this.editMode === "recolor" ? this.editColor : undefined,
        prompt: this.editMode === "replace" ? this.editPrompt.trim() : undefined,
        model: this.selectedModel || undefined,
        steps: this.steps,
        cfgScale: this.cfgScale,
        strength: this.strength
      })
        .then(function (result) {
          if (!result || !result.path) throw new Error("Aucune image retournée.");
          var image = { path: result.path, url: assetUrl(result.path), prompt: target };
          self.currentResult = image;
          self.editStats = {
            coverage: Number(result.coverage || 0),
            confidence: Number(result.confidence || 0),
            pieces: Number(result.pieces || 0)
          };
          if (self.editMode !== "preview") {
            self.gallery = [image].concat(self.gallery).slice(0, 16);
          }
          toast(self.editMode === "preview" ? "Sélection affichée" : "Zone modifiée", "success");
        })
        .catch(function (error) {
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
      var promptEl = this.querySelector("#ig-prompt");
      if (promptEl) this.prompt = promptEl.value;
      var negEl = this.querySelector("#ig-negative");
      if (negEl) this.negativePrompt = negEl.value;
      var modelEl = this.querySelector("#ig-model");
      if (modelEl && modelEl.value) this.selectedModel = modelEl.value;
      var seedEl = this.querySelector("#ig-seed");
      if (seedEl) this.seed = seedEl.value;
      var skipEl = this.querySelector("#ig-clip-skip");
      if (skipEl) this.clipSkip = skipEl.value;
      var targetEl = this.querySelector("#ig-target");
      if (targetEl) this.editTarget = targetEl.value;
      var editPromptEl = this.querySelector("#ig-edit-prompt");
      if (editPromptEl) this.editPrompt = editPromptEl.value;
    }

    // ── Rendu ──────────────────────────────────────────────────────────────

    renderModelBlock() {
      var self = this;
      if (this.models.length === 0) {
        return (
          '<section class="locaryn-gen-block">' +
          '<div class="locaryn-gen-block-head">' +
          '<span class="locaryn-gen-label">Modèle de diffusion</span>' +
          '<span class="locaryn-tag">' +
          (this.isLoadingModels ? "Recherche…" : "Aucun") +
          "</span></div>" +
          '<p class="locaryn-field-hint">Les modèles d\'image sont dans le catalogue de modèles, ' +
          "sous le filtre « Génération d'image ». Ils y restent à jour et s'installent avec les " +
          "fichiers qui les accompagnent.</p>" +
          '<div class="locaryn-gen-actions" style="justify-content:flex-start">' +
          '<button type="button" class="locaryn-btn-primary" id="ig-open-catalog">' +
          "Ouvrir le catalogue</button>" +
          '<button type="button" class="locaryn-btn-ghost" id="ig-refresh">Chercher à nouveau</button>' +
          "</div></section>"
        );
      }

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

      var current = this.models.filter(function (model) {
        return model.name === self.selectedModel;
      })[0];
      var warning =
        current && current.missing.length
          ? '<p class="locaryn-gen-error">Fichiers manquants : ' +
            escapeHtml(current.missing.join(", ")) +
            ". Réinstallez ce modèle depuis le catalogue pour récupérer ses compagnons.</p>"
          : "";
      var plural = this.models.length > 1 ? "s" : "";

      return (
        '<section class="locaryn-gen-block">' +
        '<div class="locaryn-gen-block-head">' +
        '<span class="locaryn-gen-label">Modèle de diffusion</span>' +
        '<span class="locaryn-gen-model-count">' +
        this.models.length +
        " installé" +
        plural +
        "</span></div>" +
        '<select class="locaryn-select" id="ig-model"' +
        (this.isGenerating ? " disabled" : "") +
        ">" +
        options +
        "</select>" +
        warning +
        '<div class="locaryn-gen-actions" style="justify-content:flex-start">' +
        '<button type="button" class="locaryn-btn-ghost" id="ig-refresh">Actualiser</button>' +
        '<button type="button" class="locaryn-btn-ghost" id="ig-open-catalog">Catalogue</button>' +
        "</div></section>"
      );
    }

    /** Les définitions offertes, avec ce que chacune donnerait en pixels. */
    renderSizes() {
      var self = this;
      var cells = SIZES.map(function (size, index) {
        var base = size.base || self.nativeBase;
        return (
          '<button type="button" class="locaryn-gen-choice' +
          (self.sizeIndex === index ? " locaryn-gen-choice-on" : "") +
          '" data-size="' +
          index +
          '">' +
          escapeHtml(size.label) +
          "<small>" +
          escapeHtml(size.base ? size.detail : base + " px") +
          "</small></button>"
        );
      }).join("");
      return (
        '<section class="locaryn-gen-block">' +
        '<div class="locaryn-gen-block-head">' +
        '<span class="locaryn-gen-label">Définition</span>' +
        '<span class="locaryn-gen-model-count">' +
        this.width +
        "×" +
        this.height +
        "</span></div>" +
        '<div class="locaryn-gen-choices">' +
        cells +
        "</div>" +
        '<p class="locaryn-gen-hint">Au-delà de la définition native du modèle, le calcul ' +
        "quadruple et l'image se dédouble plus qu'elle ne gagne en détail.</p>" +
        "</section>"
      );
    }

    /** La retouche ciblée : une zone décrite, un mode, rien d'autre. */
    renderEdit() {
      var self = this;
      var busy = this.isGenerating;
      var modes = EDIT_MODES.map(function (mode) {
        return (
          '<button type="button" class="locaryn-gen-choice' +
          (self.editMode === mode.id ? " locaryn-gen-choice-on" : "") +
          '" data-edit-mode="' +
          mode.id +
          '">' +
          escapeHtml(mode.label) +
          "</button>"
        );
      }).join("");

      var detail = "";
      if (this.editMode === "recolor") {
        detail =
          '<div class="locaryn-gen-field">' +
          '<label class="locaryn-gen-label" for="ig-color">Couleur cible</label>' +
          '<input type="color" id="ig-color" value="' +
          escapeHtml(this.editColor) +
          '"' +
          (busy ? " disabled" : "") +
          "></div>";
      } else if (this.editMode === "replace") {
        detail =
          '<div class="locaryn-gen-field">' +
          '<label class="locaryn-gen-label" for="ig-edit-prompt">Ce qui doit apparaître</label>' +
          '<input type="text" class="locaryn-input" id="ig-edit-prompt" placeholder="a brown leather jacket" value="' +
          escapeHtml(this.editPrompt) +
          '"' +
          (busy ? " disabled" : "") +
          "></div>";
      }

      var stats = this.editStats
        ? '<p class="locaryn-gen-hint">Sélection : ' +
          this.editStats.coverage.toFixed(1) +
          " % de l'image, confiance " +
          Math.round(this.editStats.confidence * 100) +
          " %, " +
          this.editStats.pieces +
          (this.editStats.pieces > 1 ? " morceaux" : " morceau") +
          ".</p>"
        : "";

      return (
        '<section class="locaryn-gen-block">' +
        '<label class="locaryn-gen-label" for="ig-target">Zone à modifier</label>' +
        '<input type="text" class="locaryn-input" id="ig-target" placeholder="le t-shirt, l\'étagère en bois…" value="' +
        escapeHtml(this.editTarget) +
        '"' +
        (busy ? " disabled" : "") +
        ">" +
        '<p class="locaryn-gen-hint">Visez un seul élément : « le cadre à gauche » plutôt ' +
        "que « les cadres ». La sélection est refusée si la description est trop vague.</p>" +
        '<div class="locaryn-gen-choices" style="margin-top:10px">' +
        modes +
        "</div>" +
        detail +
        stats +
        "</section>"
      );
    }

    renderControls() {
      var self = this;
      var busy = this.isGenerating;
      var isEdit = this.mode === "edit";

      var ratios = RATIOS.map(function (ratio, index) {
        var on = self.ratio === ratio ? " locaryn-gen-choice-on" : "";
        return (
          '<button type="button" class="locaryn-gen-choice' +
          on +
          '" data-ratio="' +
          index +
          '">' +
          escapeHtml(ratio.label) +
          "<small>" +
          escapeHtml(ratio.detail) +
          "</small></button>"
        );
      }).join("");

      var source =
        this.mode === "txt2img"
          ? ""
          : '<section class="locaryn-gen-block">' +
            '<span class="locaryn-gen-label">' +
            (isEdit ? "Image à retoucher" : "Image source") +
            "</span>" +
            '<div class="locaryn-gen-dropzone' +
            (this.sourceImage ? " locaryn-gen-dropzone-filled" : "") +
            '" id="ig-drop">' +
            (this.sourceImage
              ? '<img class="locaryn-gen-preview-img" src="' +
                escapeHtml(this.sourceImage) +
                '" alt="Image source"><div class="locaryn-gen-drop-text">Cliquer pour changer</div>'
              : '<div class="locaryn-gen-drop-text">Cliquer pour choisir une image</div>') +
            "</div>" +
            '<input type="file" id="ig-file" accept="image/*" hidden>' +
            "</section>";

      var advanced = this.showAdvanced
        ? '<section class="locaryn-gen-advanced-panel" style="' +
          WIDE_STYLE +
          '">' +
          '<div class="locaryn-gen-field">' +
          '<label class="locaryn-gen-label" for="ig-negative">Prompt négatif</label>' +
          '<input type="text" class="locaryn-input" id="ig-negative" placeholder="flou, déformation, basse qualité…" value="' +
          escapeHtml(this.negativePrompt) +
          '"' +
          (busy ? " disabled" : "") +
          "></div>" +
          '<div class="locaryn-gen-adv-row">' +
          '<div class="locaryn-gen-adv-item">' +
          '<div class="locaryn-gen-field-row"><span class="locaryn-gen-label">Étapes</span>' +
          '<span class="locaryn-gen-val" id="ig-steps-value">' +
          this.steps +
          "</span></div>" +
          '<input type="range" id="ig-steps" min="1" max="60" value="' +
          this.steps +
          '"' +
          (busy ? " disabled" : "") +
          "></div>" +
          '<div class="locaryn-gen-adv-item">' +
          '<div class="locaryn-gen-field-row"><span class="locaryn-gen-label">Guidage</span>' +
          '<span class="locaryn-gen-val" id="ig-cfg-value">' +
          this.cfgScale +
          "</span></div>" +
          '<input type="range" id="ig-cfg" min="0.5" max="20" step="0.5" value="' +
          this.cfgScale +
          '"' +
          (busy ? " disabled" : "") +
          "></div></div>" +
          '<div class="locaryn-gen-adv-row">' +
          '<div class="locaryn-gen-adv-item">' +
          '<div class="locaryn-gen-field-row"><span class="locaryn-gen-label">Variantes</span>' +
          '<span class="locaryn-gen-val" id="ig-variants-value">' +
          this.variants +
          "</span></div>" +
          '<input type="range" id="ig-variants" min="1" max="8" value="' +
          this.variants +
          '"' +
          (busy ? " disabled" : "") +
          ">" +
          '<p class="locaryn-gen-hint">Rendues en une seule passe : les poids et le ' +
          "prompt ne sont chargés qu'une fois.</p></div>" +
          '<div class="locaryn-gen-adv-item">' +
          '<div class="locaryn-gen-field-row"><span class="locaryn-gen-label">Force</span>' +
          '<span class="locaryn-gen-val" id="ig-strength-value">' +
          this.strength.toFixed(2) +
          "</span></div>" +
          '<input type="range" id="ig-strength" min="0.05" max="1" step="0.05" value="' +
          this.strength +
          '"' +
          (busy || !this.sourceImage ? " disabled" : "") +
          ">" +
          '<p class="locaryn-gen-hint">Part de l\'image source réécrite. Sans image ' +
          "source, ce réglage ne s'applique pas.</p></div></div>" +
          '<div class="locaryn-gen-adv-row">' +
          '<div class="locaryn-gen-adv-item">' +
          '<label class="locaryn-gen-label" for="ig-sampler">Échantillonneur</label>' +
          '<select class="locaryn-select" id="ig-sampler"' +
          (busy ? " disabled" : "") +
          ">" +
          SAMPLERS.map(function (name) {
            return (
              '<option value="' +
              escapeHtml(name) +
              '"' +
              (self.sampler === name ? " selected" : "") +
              ">" +
              escapeHtml(name || "Automatique") +
              "</option>"
            );
          }).join("") +
          "</select></div>" +
          '<div class="locaryn-gen-adv-item">' +
          '<label class="locaryn-gen-label" for="ig-scheduler">Planificateur</label>' +
          '<select class="locaryn-select" id="ig-scheduler"' +
          (busy ? " disabled" : "") +
          ">" +
          SCHEDULERS.map(function (name) {
            return (
              '<option value="' +
              escapeHtml(name) +
              '"' +
              (self.scheduler === name ? " selected" : "") +
              ">" +
              escapeHtml(name || "Automatique") +
              "</option>"
            );
          }).join("") +
          "</select></div></div>" +
          '<div class="locaryn-gen-adv-row">' +
          '<div class="locaryn-gen-adv-item">' +
          '<label class="locaryn-gen-label" for="ig-seed">Graine</label>' +
          '<input type="number" class="locaryn-input" id="ig-seed" placeholder="aléatoire" value="' +
          escapeHtml(this.seed) +
          '"' +
          (busy ? " disabled" : "") +
          ">" +
          '<p class="locaryn-gen-hint">Fixée, elle rejoue exactement le même rendu.</p></div>' +
          '<div class="locaryn-gen-adv-item">' +
          '<label class="locaryn-gen-label" for="ig-clip-skip">Saut CLIP</label>' +
          '<input type="number" class="locaryn-input" id="ig-clip-skip" min="1" max="12" placeholder="automatique" value="' +
          escapeHtml(this.clipSkip) +
          '"' +
          (busy ? " disabled" : "") +
          ">" +
          '<p class="locaryn-gen-hint">2 sur beaucoup de dérivés SD 1.5.</p></div></div>' +
          '<label class="locaryn-gen-hint" style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
          '<input type="checkbox" id="ig-uncensored"' +
          (this.uncensored ? " checked" : "") +
          (busy ? " disabled" : "") +
          "> Mode sans filtre (utilise l'encodeur abliteré s'il est installé)</label>" +
          "</section>"
        : "";

      return (
        '<div class="locaryn-gen-col locaryn-gen-controls" style="' +
        CONTROLS_STYLE +
        '">' +
        '<div class="locaryn-gen-tabs" style="' +
        WIDE_STYLE +
        'align-items:center">' +
        '<button type="button" class="locaryn-gen-tab' +
        (this.mode === "txt2img" ? " locaryn-gen-tab-active" : "") +
        '" data-mode="txt2img">Texte → Image</button>' +
        '<button type="button" class="locaryn-gen-tab' +
        (this.mode === "img2img" ? " locaryn-gen-tab-active" : "") +
        '" data-mode="img2img">Image → Image</button>' +
        '<button type="button" class="locaryn-gen-tab' +
        (this.mode === "edit" ? " locaryn-gen-tab-active" : "") +
        '" data-mode="edit">Retouche</button>' +
        "</div>" +
        this.renderModelBlock() +
        (isEdit
          ? ""
          : '<section class="locaryn-gen-block">' +
            '<label class="locaryn-gen-label" for="ig-prompt">Description</label>' +
            '<textarea class="locaryn-textarea locaryn-gen-textarea" id="ig-prompt" rows="5" placeholder="Décrivez l\'image à produire…"' +
            (busy ? " disabled" : "") +
            ">" +
            escapeHtml(this.prompt) +
            "</textarea></section>") +
        source +
        (isEdit ? this.renderEdit() : "") +
        (isEdit
          ? ""
          : '<section class="locaryn-gen-block">' +
            '<span class="locaryn-gen-label">Format</span>' +
            '<div class="locaryn-gen-choices">' +
            ratios +
            "</div></section>" +
            this.renderSizes()) +
        '<button type="button" style="' +
        WIDE_STYLE +
        '" class="locaryn-gen-advanced-toggle' +
        (this.showAdvanced ? " locaryn-gen-advanced-open" : "") +
        '" id="ig-adv"><span>Options avancées</span>' +
        '<span class="locaryn-gen-advanced-summary">' +
        this.width +
        "×" +
        this.height +
        " · " +
        this.steps +
        " étapes · guidage " +
        this.cfgScale +
        "</span></button>" +
        advanced +
        (this.error
          ? '<p class="locaryn-gen-error" style="' +
            WIDE_STYLE +
            '">' +
            escapeHtml(this.error) +
            "</p>"
          : "") +
        '<button type="button" style="' +
        WIDE_STYLE +
        '" class="locaryn-btn-primary locaryn-gen-generate-btn' +
        (busy ? " locaryn-gen-generate-btn-busy" : "") +
        '" id="ig-generate"' +
        (busy || (this.models.length === 0 && !isEdit) ? " disabled" : "") +
        ">" +
        (busy
          ? "Traitement en cours…"
          : isEdit
            ? this.editMode === "preview"
              ? "Voir la sélection"
              : "Modifier la zone"
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
          '<div class="locaryn-gen-canvas-inner">' +
          '<div class="locaryn-gen-placeholder"><div class="locaryn-gen-shimmer"></div>' +
          '<div class="locaryn-gen-pulse-ring"></div></div>' +
          '<p class="locaryn-field-hint">Diffusion en cours sur votre machine : de quelques ' +
          "secondes à plusieurs minutes selon le modèle.</p>" +
          '<div class="locaryn-gen-progress-bar"><div class="locaryn-gen-progress-fill"></div></div>' +
          "</div>";
      } else if (this.currentResult) {
        body =
          '<div class="locaryn-gen-canvas-inner" style="max-width:none">' +
          '<img class="locaryn-gen-result-img" id="ig-result" src="' +
          escapeHtml(this.currentResult.url) +
          '" alt="' +
          escapeHtml(this.currentResult.prompt) +
          '">' +
          '<div class="locaryn-gen-actions" style="justify-content:center">' +
          '<button type="button" class="locaryn-btn-ghost" id="ig-save">Télécharger</button>' +
          '<button type="button" class="locaryn-btn-ghost" id="ig-copy">Copier</button>' +
          "</div></div>";
      } else {
        body =
          '<div class="locaryn-gen-canvas-inner">' +
          '<div class="locaryn-gen-icon">✦</div>' +
          '<p class="locaryn-field-hint">' +
          (this.models.length === 0
            ? "Installez un modèle depuis le catalogue de modèles pour commencer."
            : "Décrivez une image à gauche, puis lancez la génération. Le résultat s'affichera ici.") +
          "</p></div>";
      }

      var gallery = this.gallery.length
        ? '<section class="locaryn-gen-block">' +
          '<div class="locaryn-gen-block-head">' +
          '<span class="locaryn-gen-label">Images de cette session</span>' +
          '<span class="locaryn-gen-model-count">' +
          this.gallery.length +
          "</span></div>" +
          '<div class="locaryn-gen-thumbs">' +
          this.gallery
            .map(function (image, index) {
              return (
                '<figure class="locaryn-gen-thumb" data-thumb="' +
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
        '<div class="locaryn-gen-col" style="' +
        CANVAS_STYLE +
        '">' +
        '<section class="locaryn-gen-block locaryn-gen-canvas">' +
        body +
        "</section>" +
        gallery +
        "</div>"
      );
    }

    render() {
      var lightbox = this.lightbox
        ? '<div class="locaryn-gen-lightbox" id="ig-modal">' +
          '<div class="locaryn-gen-lightbox-inner">' +
          '<img src="' +
          escapeHtml(this.lightbox.url) +
          '" alt="Agrandissement">' +
          '<div class="locaryn-gen-actions">' +
          '<button type="button" class="locaryn-btn-ghost" id="ig-lb-save">Télécharger</button>' +
          '<button type="button" class="locaryn-btn-ghost" id="ig-lb-copy">Copier</button>' +
          '<button type="button" class="locaryn-btn-ghost" id="ig-lb-close">Fermer</button>' +
          "</div></div></div>"
        : "";

      this.innerHTML =
        '<div class="locaryn-gen-split" style="' +
        SPLIT_STYLE +
        '">' +
        this.renderControls() +
        this.renderCanvas() +
        "</div>" +
        lightbox;

      this.bindEvents();
    }

    bindEvents() {
      var self = this;

      var on = function (selector, event, handler) {
        var element = self.querySelector(selector);
        if (element) element.addEventListener(event, handler);
      };
      var onAll = function (selector, event, handler) {
        self.querySelectorAll(selector).forEach(function (element) {
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
        self.applySize();
        self.render();
      });
      onAll("[data-size]", "click", function (element) {
        self.captureInputs();
        self.sizeIndex = Number(element.getAttribute("data-size")) || 0;
        self.applySize();
        self.render();
      });
      onAll("[data-edit-mode]", "click", function (element) {
        self.captureInputs();
        self.editMode = element.getAttribute("data-edit-mode") || "preview";
        self.render();
      });

      on("#ig-adv", "click", function () {
        self.captureInputs();
        self.showAdvanced = !self.showAdvanced;
        self.render();
      });
      on("#ig-steps", "input", function (event) {
        self.steps = Number(event.target.value);
        var label = self.querySelector("#ig-steps-value");
        if (label) label.textContent = String(self.steps);
      });
      on("#ig-cfg", "input", function (event) {
        self.cfgScale = Number(event.target.value);
        var label = self.querySelector("#ig-cfg-value");
        if (label) label.textContent = String(self.cfgScale);
      });
      on("#ig-variants", "input", function (event) {
        self.variants = Number(event.target.value);
        var label = self.querySelector("#ig-variants-value");
        if (label) label.textContent = String(self.variants);
      });
      on("#ig-strength", "input", function (event) {
        self.strength = Number(event.target.value);
        var label = self.querySelector("#ig-strength-value");
        if (label) label.textContent = self.strength.toFixed(2);
      });
      on("#ig-sampler", "change", function (event) {
        self.sampler = event.target.value;
      });
      on("#ig-scheduler", "change", function (event) {
        self.scheduler = event.target.value;
      });
      on("#ig-seed", "input", function (event) {
        self.seed = event.target.value;
      });
      on("#ig-clip-skip", "input", function (event) {
        self.clipSkip = event.target.value;
      });
      on("#ig-target", "input", function (event) {
        self.editTarget = event.target.value;
      });
      on("#ig-edit-prompt", "input", function (event) {
        self.editPrompt = event.target.value;
      });
      on("#ig-color", "input", function (event) {
        self.editColor = event.target.value;
      });
      on("#ig-uncensored", "change", function (event) {
        self.uncensored = event.target.checked;
      });

      on("#ig-generate", "click", function () {
        self.captureInputs();
        self.generate();
      });

      var fileInput = this.querySelector("#ig-file");
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

  if (!customElements.get("locaryn-image-panel")) {
    customElements.define("locaryn-image-panel", ImageGenPanel);
  }

  // Après la définition : si l'hôte tient déjà une classe plus ancienne, c'est
  // elle qui rendra, et seul ce rattrapage lui donnera la bonne disposition.
  if (document.body) {
    watchLayout();
  } else {
    document.addEventListener("DOMContentLoaded", watchLayout);
  }
})();
