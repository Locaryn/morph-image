/**
 * Plugin Image Gen — Interface Studio Autonome.
 * Web Component <locaryn-image-gen-panel>
 */
(function () {
  class LocarynImageGenPanel extends HTMLElement {
    constructor() {
      super();
      this.isGenerating = false;
      this.gallery = [];
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      this.render();
    }

    async generate() {
      const promptInput = this.shadowRoot.querySelector("#prompt");
      const prompt = promptInput ? promptInput.value.trim() : "";
      if (!prompt) {
        if (window.locaryn?.ui?.showToast) {
          window.locaryn.ui.showToast("Veuillez saisir un prompt pour générer une image.", "warning");
        }
        return;
      }

      this.isGenerating = true;
      this.updateState();

      if (window.locaryn?.ui?.showToast) {
        window.locaryn.ui.showToast("Génération de l'image en cours...", "info");
      }

      try {
        // Simulation / Invocation via le SDK Plugin
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const dummyUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="%231a1b26"/><circle cx="256" cy="200" r="100" fill="%237aa2f7"/><polygon points="256,320 180,440 332,440" fill="%23bb9af7"/><text x="256" y="480" font-size="20" fill="%23c0caf5" text-anchor="middle" font-family="sans-serif">Image générée : ${encodeURIComponent(prompt.slice(0, 25))}</text></svg>`;
        
        this.gallery.unshift({ prompt, url: dummyUrl, date: new Date().toLocaleTimeString() });
        if (window.locaryn?.ui?.showToast) {
          window.locaryn.ui.showToast("Image générée avec succès !", "success");
        }
      } catch (err) {
        console.error("[Plugin Image Gen] Erreur de génération :", err);
        if (window.locaryn?.ui?.showToast) {
          window.locaryn.ui.showToast(`Erreur : ${String(err)}`, "error");
        }
      } finally {
        this.isGenerating = false;
        this.render();
      }
    }

    updateState() {
      const btn = this.shadowRoot.querySelector("#btn-gen");
      if (btn) {
        btn.disabled = this.isGenerating;
        btn.textContent = this.isGenerating ? "Génération en cours…" : "Générer l'image";
      }
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            font-family: inherit;
            color: var(--text, #e2e8f0);
          }
          .card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .input-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          label {
            font-size: 12px;
            font-weight: 500;
            color: #94a3b8;
          }
          textarea, select, input {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            color: #fff;
            padding: 10px 12px;
            font-family: inherit;
            font-size: 13px;
            outline: none;
            resize: vertical;
          }
          textarea:focus, select:focus, input:focus {
            border-color: #3b82f6;
          }
          .row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .btn-primary {
            background: #3b82f6;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease;
            align-self: flex-start;
          }
          .btn-primary:hover {
            background: #2563eb;
          }
          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 12px;
          }
          .gallery-item {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .gallery-item img {
            width: 100%;
            height: 180px;
            object-fit: cover;
          }
          .gallery-info {
            padding: 8px 10px;
            font-size: 11px;
            color: #94a3b8;
          }
        </style>
        <div class="card">
          <h3 class="title">
            <span>✨</span> Générateur d'Images Autonome (Plugin Image Gen)
          </h3>
          <div class="input-group">
            <label for="prompt">Description textuelle (Prompt)</label>
            <textarea id="prompt" rows="3" placeholder="Ex: Un renard néon au sommet d'une montagne sous les aurores boréales, style cyberpunk 4k..."></textarea>
          </div>
          <div class="row">
            <div class="input-group" style="flex: 1; min-width: 160px;">
              <label for="model">Modèle de diffusion</label>
              <select id="model">
                <option value="flux1-schnell">Flux.1 Schnell (4-step ultra-fast)</option>
                <option value="flux1-dev">Flux.1 Dev (Haute fidélité)</option>
                <option value="sdxl-turbo">SDXL Turbo (Temps réel)</option>
                <option value="sd-1.5">Stable Diffusion 1.5</option>
              </select>
            </div>
            <div class="input-group" style="width: 140px;">
              <label for="res">Résolution</label>
              <select id="res">
                <option value="1024x1024">1024 × 1024 (1:1)</option>
                <option value="1280x720">1280 × 720 (16:9)</option>
                <option value="720x1280">720 × 1280 (9:16)</option>
                <option value="512x512">512 × 512</option>
              </select>
            </div>
          </div>
          <button id="btn-gen" type="button" class="btn-primary">
            ${this.isGenerating ? "Génération en cours…" : "Générer l'image"}
          </button>

          ${
            this.gallery.length > 0
              ? `
            <div style="margin-top: 16px;">
              <h4 style="margin: 0 0 8px; font-size: 13px; color: #cbd5e1;">Galerie récente</h4>
              <div class="gallery-grid">
                ${this.gallery
                  .map(
                    (item) => `
                  <div class="gallery-item">
                    <img src="${item.url}" alt="${item.prompt}" />
                    <div class="gallery-info">
                      <strong>${item.date}</strong>: ${item.prompt.slice(0, 40)}${item.prompt.length > 40 ? "…" : ""}
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      `;

      const btn = this.shadowRoot.querySelector("#btn-gen");
      if (btn) {
        btn.addEventListener("click", () => this.generate());
      }
    }
  }

  if (!customElements.get("locaryn-image-gen-panel")) {
    customElements.define("locaryn-image-gen-panel", LocarynImageGenPanel);
  }
})();
