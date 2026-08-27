//! Runtime owned by the Locaryn image-generation extension.
//!
//! The Locaryn application only hosts the extension and exposes a generic MCP
//! bridge. Model files, the diffusion executable, output media and all image
//! generation decisions live here.

pub mod region_edit;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};

const Z_IMAGE_VAE_URL: &str =
    "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors";
const Z_IMAGE_ENCODER_URL: &str =
    "https://huggingface.co/second-state/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageGenRequest {
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: Option<String>,
    /// Optional: the first detected checkpoint is used when omitted.
    #[serde(default)]
    pub model: Option<String>,
    /// Absent : la résolution native de la famille du modèle. Une valeur
    /// imposée par défaut faisait rendre du SD 1.5 en 1024 — lent, et pire.
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    /// Absents : l'échantillonnage que la famille du modèle demande.
    #[serde(default)]
    pub steps: Option<u32>,
    #[serde(default)]
    pub cfg_scale: Option<f32>,
    #[serde(default)]
    pub input_image: Option<String>,
    /// Masque de retouche : blanc = repeindre, noir = garder. Exige
    /// `input_image`. Chemin disque ou data URL, comme l'image source.
    #[serde(default)]
    pub mask_image: Option<String>,
    /// Part de l'image source réécrite en img2img, 0 à 1.
    #[serde(default)]
    pub strength: Option<f32>,
    /// Absente : une graine tirée de l'horloge, donc une image différente à
    /// chaque appel. Fixer la graine rejoue exactement le même rendu.
    #[serde(default)]
    pub seed: Option<i64>,
    /// `euler`, `euler_a`, `dpm++2m`… selon ce que le moteur installé accepte.
    #[serde(default)]
    pub sampler: Option<String>,
    /// `discrete`, `karras`, `exponential`, `ays`…
    #[serde(default)]
    pub scheduler: Option<String>,
    /// Couches de CLIP ignorées à la fin de l'encodage. 2 sur les modèles
    /// entraînés ainsi (beaucoup de dérivés SD 1.5).
    #[serde(default)]
    pub clip_skip: Option<i32>,
    #[serde(default)]
    pub uncensored: bool,
    #[serde(default = "default_variants")]
    pub variants: u32,
}

fn default_variants() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageGenResult {
    pub paths: Vec<PathBuf>,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeInstallRequest {
    pub source: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelFamily {
    ZImage,
    Flux,
    FullCheckpoint,
}

pub fn classify_model(file_name: &str) -> ModelFamily {
    let name = file_name.to_ascii_lowercase();
    if ["z_image", "z-image", "z-img", "z_img", "zimg"]
        .iter()
        .any(|part| name.contains(part))
    {
        ModelFamily::ZImage
    } else if name.contains("flux") {
        ModelFamily::Flux
    } else {
        ModelFamily::FullCheckpoint
    }
}

/// Le côté sur lequel la famille du modèle a été entraînée.
///
/// Rendre un checkpoint Stable Diffusion 1.x en 1024 coûte quatre fois le
/// calcul et donne une image moins bonne — sujets dédoublés, cadrage éclaté.
/// Sans dimension demandée, on rend donc à la résolution native.
pub fn default_resolution(file_name: &str) -> u32 {
    let name = file_name.to_ascii_lowercase();
    match classify_model(file_name) {
        ModelFamily::ZImage | ModelFamily::Flux => 1024,
        ModelFamily::FullCheckpoint => {
            let large = [
                "sdxl",
                "sd_xl",
                "sd-xl",
                "sd3",
                "playground-v",
                "kolors",
                "pixart",
            ]
            .iter()
            .any(|part| name.contains(part));
            if large {
                1024
            } else {
                512
            }
        }
    }
}

pub fn default_sampling(file_name: &str) -> (u32, f32) {
    let name = file_name.to_ascii_lowercase();
    let turbo = ["turbo", "schnell", "lightning"]
        .iter()
        .any(|part| name.contains(part));
    match classify_model(file_name) {
        ModelFamily::ZImage => (if turbo { 8 } else { 20 }, 1.0),
        ModelFamily::Flux => (if turbo { 4 } else { 20 }, 1.0),
        ModelFamily::FullCheckpoint => (if turbo { 6 } else { 20 }, 7.0),
    }
}

/// Où poser les fichiers intermédiaires d'un rendu.
///
/// L'hôte range son scratch hors du disque système quand celui-ci est saturé,
/// et le publie ; sinon le temporaire de la machine fait l'affaire.
pub fn scratch_dir() -> PathBuf {
    let dir = std::env::var_os("LOCARYN_TEMP_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// The host injects this path when it launches the plugin MCP server.
pub fn plugin_root() -> PathBuf {
    std::env::var_os("LOCARYN_MORPH_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Primary model directory for downloads.
pub fn models_dir() -> PathBuf {
    std::env::var_os("LOCARYN_EXTENSION_MODELS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| plugin_root().join("models"))
}

/// All candidate directories where diffusion models or companions may be located.
pub fn candidate_model_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // 1. Explicit extension models dir
    if let Some(d) = std::env::var_os("LOCARYN_EXTENSION_MODELS_DIR").map(PathBuf::from) {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    }

    // 2. Host models dir
    if let Some(d) = std::env::var_os("LOCARYN_MODELS_DIR").map(PathBuf::from) {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    }

    // 3. Plugin root models
    let plugin_models = plugin_root().join("models");
    if !dirs.contains(&plugin_models) {
        dirs.push(plugin_models);
    }

    // 4. Windows AppData / UserProfile
    #[cfg(windows)]
    {
        if let Some(appdata) = std::env::var_os("APPDATA").map(PathBuf::from) {
            let p1 = appdata.join("Locaryn").join("models");
            if !dirs.contains(&p1) {
                dirs.push(p1);
            }
            let p2 = appdata.join("syncho").join("models");
            if !dirs.contains(&p2) {
                dirs.push(p2);
            }
        }
        if let Some(userprofile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
            let p1 = userprofile.join(".locaryn").join("models");
            if !dirs.contains(&p1) {
                dirs.push(p1);
            }
        }
    }

    // 5. Unix Home / Data Dir
    #[cfg(not(windows))]
    {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            let p1 = home.join(".locaryn").join("models");
            if !dirs.contains(&p1) {
                dirs.push(p1);
            }
            let p2 = home
                .join(".local")
                .join("share")
                .join("Locaryn")
                .join("models");
            if !dirs.contains(&p2) {
                dirs.push(p2);
            }
        }
    }

    // 6. Current working directory / parent models directory
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_models = cwd.join("models");
        if !dirs.contains(&cwd_models) {
            dirs.push(cwd_models);
        }
        if let Some(parent) = cwd.parent() {
            let parent_models = parent.join("models");
            if !dirs.contains(&parent_models) {
                dirs.push(parent_models);
            }
        }
    }

    dirs
}

pub fn generated_images_dir() -> PathBuf {
    std::env::var_os("LOCARYN_EXTENSION_MEDIA_DIR")
        .or_else(|| std::env::var_os("LOCARYN_GENERATED_MEDIA_DIR"))
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("LOCARYN_EXTENSION_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| plugin_root().join("data"))
                .join("generated_images")
        })
}

/// Les options que le binaire installé accepte réellement.
///
/// Les versions de stable-diffusion.cpp ne proposent pas les mêmes drapeaux de
/// placement mémoire, et passer un drapeau inconnu fait échouer l'appel avant
/// même le chargement. On lit donc son aide une fois, plutôt que de parier sur
/// une version.
fn sd_help_text(binary: &Path) -> &'static str {
    use std::sync::OnceLock;
    static HELP: OnceLock<String> = OnceLock::new();
    HELP.get_or_init(|| {
        let mut command = std::process::Command::new(binary);
        command.arg("--help");
        hide_std_console(&mut command);
        command
            .output()
            .map(|out| {
                let mut text = String::from_utf8_lossy(&out.stdout).to_string();
                text.push_str(&String::from_utf8_lossy(&out.stderr));
                text
            })
            .unwrap_or_default()
    })
}

/// La VRAM utilisable, en Gio.
///
/// L'hôte connaît la carte et publie le chiffre ; à défaut on interroge
/// `nvidia-smi`. Sans ce chiffre, impossible de savoir si les poids tiennent,
/// et c'est toute la différence entre un rendu d'une minute et un de trois.
pub fn vram_budget_gb() -> Option<f32> {
    if let Some(raw) = std::env::var_os("LOCARYN_VRAM_GB") {
        if let Ok(value) = raw.to_string_lossy().trim().parse::<f32>() {
            if value > 0.0 {
                return Some(value);
            }
        }
    }
    probed_vram_gb()
}

/// Ce que la machine sait dire d'elle-même, relevé une seule fois.
fn probed_vram_gb() -> Option<f32> {
    use std::sync::OnceLock;
    static PROBE: OnceLock<Option<f32>> = OnceLock::new();
    *PROBE.get_or_init(|| {
        let mut command = std::process::Command::new("nvidia-smi");
        command.args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"]);
        hide_std_console(&mut command);
        let output = command.output().ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        // Plusieurs cartes : la plus grande, c'est celle qui décide.
        text.lines()
            .filter_map(|line| line.trim().parse::<f32>().ok())
            .filter(|mib| *mib > 0.0)
            .fold(None, |best: Option<f32>, mib| {
                Some(best.map_or(mib, |b| b.max(mib)))
            })
            .map(|mib| mib / 1024.0)
    })
}

/// Le poids du modèle sur le disque, en Gio.
///
/// Un dépôt au format diffusers est un dossier : additionner ses fichiers,
/// sinon `metadata` renvoie la taille de l'entrée de répertoire et tout
/// paraît tenir sur n'importe quelle carte.
fn weights_gb(model_path: &Path) -> f32 {
    const GIB: f32 = 1024.0 * 1024.0 * 1024.0;
    if model_path.is_dir() {
        let total: u64 = walkdir::WalkDir::new(model_path)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .filter_map(|entry| entry.metadata().ok())
            .map(|meta| meta.len())
            .sum();
        return total as f32 / GIB;
    }
    std::fs::metadata(model_path)
        .map(|meta| meta.len() as f32 / GIB)
        .unwrap_or(0.0)
}

/// Où placer les poids, d'après ce que la carte peut réellement tenir.
///
/// Déporter systématiquement était la cause d'une lenteur qui n'avait aucune
/// raison d'être : un Stable Diffusion 1.5 quantifié pèse 1,5 Gio et tenait
/// largement sur les 6 Gio de la carte, mais `--auto-fit` envoyait quand même
/// la diffusion en RAM — une minute de rendu devenait trois. Tant que les
/// poids tiennent, aucun drapeau : le moteur garde tout sur le GPU. Ce n'est
/// que lorsqu'ils débordent qu'il faut répartir, et là `--auto-fit` est ce qui
/// aboutit sur cette classe de machine (mesuré sur Z-Image, 9,9 Gio contre
/// 6 Gio de VRAM). Les moteurs qui ne le connaissent pas retombent sur le
/// trio du socle : déport, plafond de VRAM, encodeur de texte sur processeur —
/// le VAE, lui, reste sur le GPU, son décodage dominait le rendu sinon.
fn memory_placement_args(model_path: &Path, help: &str) -> Vec<String> {
    let weights = weights_gb(model_path);
    let vram = vram_budget_gb();
    let fits = match vram {
        Some(budget) if budget > 0.0 && weights > 0.0 => weights < budget * 0.85,
        _ => false,
    };
    if fits {
        return Vec::new();
    }
    if help.contains("--auto-fit") {
        return vec!["--auto-fit".to_string()];
    }
    let mut args = Vec::new();
    if help.contains("--offload-to-cpu") {
        args.push("--offload-to-cpu".to_string());
    }
    if let Some(budget) = vram.filter(|value| *value > 0.0) {
        if help.contains("--max-vram") {
            args.push("--max-vram".to_string());
            args.push(format!("{:.1}", (budget * 0.55).max(1.5)));
        }
    }
    if help.contains("--backend") {
        args.push("--backend".to_string());
        args.push("te=cpu".to_string());
    }
    args
}

/// Les noms sous lesquels le moteur se présente.
///
/// stable-diffusion.cpp a renommé son exécutable : les publications récentes
/// livrent `sd-cli`, plus aucun `sd`. Chercher le seul ancien nom faisait
/// répondre « moteur introuvable » avec le moteur dans le dossier d'à côté.
/// Les deux sont acceptés, le nom actuel d'abord.
fn sd_executable_names() -> [&'static str; 2] {
    if cfg!(windows) {
        ["sd-cli.exe", "sd.exe"]
    } else {
        ["sd-cli", "sd"]
    }
}

pub fn find_sd_binary() -> Option<PathBuf> {
    let noms = sd_executable_names();
    let explicit = std::env::var_os("LOCARYN_SD_BINARY").map(PathBuf::from);
    let mut candidates: Vec<PathBuf> = explicit.into_iter().collect();

    // Chaque emplacement est essayé sous les deux noms avant de passer au
    // suivant : un moteur livré avec l'extension prime sur un vieux binaire
    // traînant ailleurs sur la machine.
    let ajouter = |dossier: PathBuf, candidates: &mut Vec<PathBuf>| {
        for nom in noms {
            candidates.push(dossier.join(nom));
        }
    };

    // In plugin bin/ and plugin root
    ajouter(plugin_root().join("bin").join("sd"), &mut candidates);
    ajouter(plugin_root().join("bin"), &mut candidates);
    ajouter(plugin_root(), &mut candidates);

    // In LOCARYN_PLUGIN_BIN_DIR
    if let Some(bin_dir) = std::env::var_os("LOCARYN_PLUGIN_BIN_DIR").map(PathBuf::from) {
        ajouter(bin_dir.join("sd"), &mut candidates);
        ajouter(bin_dir, &mut candidates);
    }

    // Dans les dossiers de données que l'hôte expose. Un moteur peut y avoir
    // été posé avant que l'extension existe — le chercher évite de le
    // retélécharger, et de dire « aucun moteur » avec le binaire sous la main.
    for key in ["LOCARYN_EXTENSION_DATA_DIR", "LOCARYN_DATA_DIR"] {
        let Some(dir) = std::env::var_os(key).map(PathBuf::from) else {
            continue;
        };
        ajouter(dir.join("bin").join("sd"), &mut candidates);
        ajouter(dir.join("bin"), &mut candidates);
        ajouter(dir, &mut candidates);
    }

    // In candidate model dirs / parent bin dirs
    for dir in candidate_model_dirs() {
        ajouter(dir.join("bin"), &mut candidates);
        ajouter(dir.clone(), &mut candidates);
        if let Some(parent) = dir.parent() {
            ajouter(parent.join("bin"), &mut candidates);
            ajouter(parent.to_path_buf(), &mut candidates);
        }
    }

    // In PATH
    if let Some(path_var) = std::env::var_os("PATH") {
        for path_entry in std::env::split_paths(&path_var) {
            ajouter(path_entry, &mut candidates);
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

#[derive(Debug, Clone, Default)]
pub struct Companions {
    pub vae: Option<PathBuf>,
    pub llm: Option<PathBuf>,
    pub clip_l: Option<PathBuf>,
    pub t5xxl: Option<PathBuf>,
}

fn find_companion(dir: &Path, patterns: &[&str], exclude: &[&str]) -> Option<PathBuf> {
    let mut best: Option<(u64, PathBuf)> = None;
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
        if !patterns.iter().any(|p| name.contains(p)) || exclude.iter().any(|p| name.contains(p)) {
            continue;
        }
        let size = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        if best.as_ref().map(|(old, _)| size > *old).unwrap_or(true) {
            best = Some((size, path));
        }
    }
    best.map(|(_, path)| path)
}

fn find_companion_in_all_dirs(patterns: &[&str], exclude: &[&str]) -> Option<PathBuf> {
    for dir in candidate_model_dirs() {
        if let Some(p) = find_companion(&dir, patterns, exclude) {
            return Some(p);
        }
    }
    None
}

pub fn discover_companions(models: &Path, family: ModelFamily, uncensored: bool) -> Companions {
    if family == ModelFamily::FullCheckpoint {
        return Companions::default();
    }
    let vae = find_companion(
        models,
        &["ae.safetensors", "vae"],
        &[".onnx", "decoder", "taesd"],
    )
    .or_else(|| {
        find_companion_in_all_dirs(&["ae.safetensors", "vae"], &[".onnx", "decoder", "taesd"])
    });
    match family {
        ModelFamily::ZImage => Companions {
            vae,
            llm: if uncensored {
                find_companion(models, &["abliterat", "heretic"], &[])
                    .or_else(|| find_companion_in_all_dirs(&["abliterat", "heretic"], &[]))
            } else {
                find_companion(models, &["qwen3-4b", "qwen3_4b"], &["tts", "abliterat"]).or_else(
                    || find_companion_in_all_dirs(&["qwen3-4b", "qwen3_4b"], &["tts", "abliterat"]),
                )
            },
            ..Companions::default()
        },
        ModelFamily::Flux => Companions {
            vae,
            clip_l: find_companion(models, &["clip_l", "clip-l"], &[])
                .or_else(|| find_companion_in_all_dirs(&["clip_l", "clip-l"], &[])),
            t5xxl: find_companion(models, &["t5xxl", "t5-xxl"], &[])
                .or_else(|| find_companion_in_all_dirs(&["t5xxl", "t5-xxl"], &[])),
            ..Companions::default()
        },
        ModelFamily::FullCheckpoint => Companions::default(),
    }
}

pub fn missing_companions(family: ModelFamily, companions: &Companions) -> Vec<&'static str> {
    let mut missing = Vec::new();
    match family {
        ModelFamily::ZImage => {
            if companions.vae.is_none() {
                missing.push("ae.safetensors (VAE stable-diffusion.cpp)");
            }
            if companions.llm.is_none() {
                missing.push("un encodeur de texte Qwen3");
            }
        }
        ModelFamily::Flux => {
            if companions.vae.is_none() {
                missing.push("ae.safetensors (VAE)");
            }
            if companions.clip_l.is_none() {
                missing.push("un encodeur CLIP-L");
            }
            if companions.t5xxl.is_none() {
                missing.push("un encodeur T5-XXL");
            }
        }
        ModelFamily::FullCheckpoint => {}
    }
    missing
}

/// Companion files cannot render an image by themselves. Everything else in
/// the candidate model directories is a candidate, including unfamiliar
/// repository names and new quantization names.
/// Fichiers qui accompagnent un checkpoint sans pouvoir rendre une image :
/// VAE, encodeurs de texte, projecteurs, tokeniseurs.
fn is_companion_name(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [
        "mmproj-",
        "ae.safetensors",
        "vae",
        "clip",
        "t5xxl",
        "t5-xxl",
        "text_encoder",
        "text-encoder",
        "tokenizer",
        "embed",
    ]
    .iter()
    .any(|part| lower.contains(part))
}

/// Familles de diffusion reconnues, cherchées dans le chemin entier.
const DIFFUSION_FAMILIES: &[&str] = &[
    "stable-diffusion",
    "stable_diffusion",
    "sd-v1",
    "sd_v1",
    "sd15",
    "sd3",
    "sdxl",
    "sd_xl",
    "flux",
    "z_image",
    "z-image",
    "z_img",
    "zimg",
    "qwen-image",
    "qwen_image",
    "krea",
    "dreamshaper",
    "juggernaut",
    "pony",
    "playground-v",
    "kolors",
    "hunyuan-dit",
    "pixart",
    "deliberate",
    "realvis",
    "illustrious",
    "noobai",
];

fn names_a_diffusion_family(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    DIFFUSION_FAMILIES.iter().any(|part| lower.contains(part))
}

/// `path` est relatif au dossier de modèles et normalisé en `/`, pas seulement
/// le nom du fichier : `Qwen__Qwen3-TTS-…/model.safetensors` ne se distingue
/// d'un checkpoint que par son dossier.
///
/// La règle était « tout ce qui n'est pas un fichier compagnon ». La
/// bibliothèque de poids d'un utilisateur contient aussi ses modèles de voix
/// et de texte, et leurs `model.safetensors` étaient proposés comme modèles
/// d'image — un choix qui ne pouvait produire aucune image. Exiger qu'une
/// famille de diffusion soit nommée coûte un nom exotique de temps en temps,
/// et l'ajouter à [`DIFFUSION_FAMILIES`] le rattrape.
pub fn is_diffusion_checkpoint(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    let valid_extension = [".gguf", ".safetensors", ".ckpt"]
        .iter()
        .any(|suffix| lower.ends_with(suffix));
    if !valid_extension
        || lower.ends_with(".part")
        || lower.ends_with(".tmp")
        || is_companion_name(path)
    {
        return false;
    }
    names_a_diffusion_family(path)
}

fn collect_models(dir: &Path, relative: &Path, output: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = relative.join(&name);
        if path.is_dir() {
            // A diffusers repository is one model, not one model per nested
            // safetensors shard.
            if path.join("model_index.json").is_file() || path.join("unet").is_dir() {
                output.push(rel.to_string_lossy().replace('\\', "/"));
            } else {
                collect_models(&path, &rel, output);
            }
        } else {
            let rel_path = rel.to_string_lossy().replace('\\', "/");
            if is_diffusion_checkpoint(&rel_path) {
                output.push(rel_path);
            }
        }
    }
}

pub fn list_image_models() -> Vec<String> {
    let mut names = Vec::new();
    for dir in candidate_model_dirs() {
        collect_models(&dir, Path::new(""), &mut names);
    }
    names.sort_by_key(|name| name.to_ascii_lowercase());
    names.dedup();
    names
}

pub fn resolve_model_path(raw: &str) -> PathBuf {
    let raw_path = Path::new(raw);
    if raw_path.is_absolute() && raw_path.exists() {
        return raw_path.to_path_buf();
    }
    for dir in candidate_model_dirs() {
        let candidate = dir.join(raw);
        if candidate.exists() {
            return candidate;
        }
        let clean = raw.split(['/', '\\']).next_back().unwrap_or(raw);
        let candidate_clean = dir.join(clean);
        if candidate_clean.exists() {
            return candidate_clean;
        }
    }
    models_dir().join(raw)
}

/// Un chemin canonique que le moteur sait relire.
///
/// Sous Windows, `canonicalize` renvoie la forme longue `\\?\D:\...`.
/// stable-diffusion.cpp la refuse pour un dossier — « get sd version from file
/// failed » sur un dépôt qui se charge parfaitement par son chemin ordinaire.
fn plain_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let text = path.to_string_lossy();
        if let Some(stripped) = text.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{stripped}"));
        }
        if let Some(stripped) = text.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }
    path
}

fn validate_model_path(path: &Path) -> Result<PathBuf, String> {
    let model = if path.exists() {
        std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
    } else {
        let resolved = resolve_model_path(&path.to_string_lossy());
        std::fs::canonicalize(&resolved).map_err(|e| format!("modèle introuvable : {e}"))?
    };
    Ok(plain_path(model))
}

pub struct SdRequest<'a> {
    pub model_path: &'a Path,
    pub models_dir: &'a Path,
    pub prompt: &'a str,
    pub negative_prompt: Option<&'a str>,
    pub width: u32,
    pub height: u32,
    pub steps: u32,
    pub cfg_scale: f32,
    pub seed: i64,
    pub out_file: &'a Path,
    pub init_image: Option<&'a Path>,
    /// Blanc = repeindre, noir = garder. Exige `init_image`.
    pub mask: Option<&'a Path>,
    /// Part de l'image source réécrite, 0 à 1. Ignorée sans `init_image`.
    pub strength: f32,
    pub sampler: Option<&'a str>,
    pub scheduler: Option<&'a str>,
    pub clip_skip: Option<i32>,
    pub batch_count: u32,
    pub uncensored: bool,
    /// Le moteur qui exécutera ces arguments. Les drapeaux disponibles
    /// dépendent de la version installée, pas de ce que le plugin espère.
    pub binary: &'a Path,
}

pub fn batch_output(out_file: &Path, count: u32) -> (PathBuf, Vec<PathBuf>) {
    if count <= 1 {
        return (out_file.to_path_buf(), vec![out_file.to_path_buf()]);
    }
    let dir = out_file.parent().unwrap_or_else(|| Path::new("."));
    let stem = out_file.file_stem().unwrap_or_default().to_string_lossy();
    let extension = out_file.extension().unwrap_or_default().to_string_lossy();
    let pattern = dir.join(format!("{stem}_%d.{extension}"));
    let paths = (0..count)
        .map(|index| dir.join(format!("{stem}_{index}.{extension}")))
        .collect();
    (pattern, paths)
}

/// Ce qu'il faut passer à `-m` pour un modèle rangé dans un dossier.
///
/// Un dépôt au format diffusers n'a pas de fichier de poids à sa racine : ses
/// poids sont dans `unet/`, `vae/` et `text_encoder/`. Chercher un fichier à la
/// racine puis abandonner rejetait un dépôt que le moteur sait pourtant charger
/// tel quel, en lui donnant le dossier — c'est ce que faisait le catalogue en
/// le proposant comme modèle, et la génération échouait juste après.
fn directory_checkpoint(dir: &Path) -> Option<PathBuf> {
    let top_level = std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && matches!(
                    path.extension().and_then(|ext| ext.to_str()),
                    Some("gguf") | Some("safetensors") | Some("ckpt")
                )
        });
    if top_level.is_some() {
        return top_level;
    }
    let diffusers = dir.join("model_index.json").is_file() || dir.join("unet").is_dir();
    diffusers.then(|| dir.to_path_buf())
}

pub fn build_args(request: &SdRequest<'_>) -> Result<Vec<String>, String> {
    let file_name = request
        .model_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    let family = classify_model(&file_name);
    let companions = discover_companions(request.models_dir, family, request.uncensored);
    let mut args = vec!["-M".into(), "img_gen".into()];

    if request.model_path.is_dir() {
        let Some(checkpoint) = directory_checkpoint(request.model_path) else {
            return Err(format!(
                "dossier de modèle invalide : {}",
                request.model_path.display()
            ));
        };
        args.extend(["-m".into(), checkpoint.to_string_lossy().to_string()]);
    } else {
        let missing = missing_companions(family, &companions);
        if !missing.is_empty() {
            return Err(format!("{} nécessite : {}", file_name, missing.join(", ")));
        }
        match family {
            ModelFamily::FullCheckpoint => {
                args.extend([
                    "-m".into(),
                    request.model_path.to_string_lossy().to_string(),
                ]);
            }
            ModelFamily::ZImage | ModelFamily::Flux => {
                args.extend([
                    "--diffusion-model".into(),
                    request.model_path.to_string_lossy().to_string(),
                ]);
                if let Some(vae) = &companions.vae {
                    args.extend(["--vae".into(), vae.to_string_lossy().to_string()]);
                }
                if let Some(llm) = &companions.llm {
                    args.extend(["--llm".into(), llm.to_string_lossy().to_string()]);
                }
                if let Some(clip) = &companions.clip_l {
                    args.extend(["--clip_l".into(), clip.to_string_lossy().to_string()]);
                }
                if let Some(t5) = &companions.t5xxl {
                    args.extend(["--t5xxl".into(), t5.to_string_lossy().to_string()]);
                }
            }
        }
    }

    args.extend(["-p".into(), request.prompt.to_string()]);
    if let Some(negative) = request.negative_prompt.filter(|prompt| !prompt.is_empty()) {
        args.extend(["-n".into(), negative.to_string()]);
    }
    if let Some(input) = request.init_image {
        args.extend([
            "-i".into(),
            input.to_string_lossy().to_string(),
            "--strength".into(),
            format!("{:.2}", request.strength.clamp(0.0, 1.0)),
        ]);
        if let Some(mask) = request.mask {
            args.extend(["--mask".into(), mask.to_string_lossy().to_string()]);
        }
    }
    args.extend([
        "-W".into(),
        request.width.to_string(),
        "-H".into(),
        request.height.to_string(),
        "--steps".into(),
        request.steps.to_string(),
        "--cfg-scale".into(),
        format!("{:.2}", request.cfg_scale),
        "-s".into(),
        request.seed.to_string(),
    ]);
    let help = sd_help_text(request.binary);
    if let Some(sampler) = request.sampler.filter(|value| !value.is_empty()) {
        if help.contains("--sampling-method") {
            args.extend(["--sampling-method".into(), sampler.to_string()]);
        }
    }
    if let Some(scheduler) = request.scheduler.filter(|value| !value.is_empty()) {
        if help.contains("--schedule") {
            args.extend(["--schedule".into(), scheduler.to_string()]);
        }
    }
    if let Some(skip) = request.clip_skip.filter(|value| *value > 0) {
        if help.contains("--clip-skip") {
            args.extend(["--clip-skip".into(), skip.to_string()]);
        }
    }
    if help.contains("--diffusion-fa") {
        args.push("--diffusion-fa".into());
    }
    if help.contains("--vae-tiling") {
        args.push("--vae-tiling".into());
    }
    args.extend(memory_placement_args(request.model_path, help));
    let count = request.batch_count.clamp(1, 8);
    if count > 1 {
        args.extend(["-b".into(), count.to_string()]);
    }
    let (output, _) = batch_output(request.out_file, count);
    args.extend(["-o".into(), output.to_string_lossy().to_string()]);
    Ok(args)
}

/// Le checkpoint choisi par le titulaire du compte, si l'hôte en expose un.
///
/// L'hôte publie le chemin de ses préférences de modèles dans
/// `LOCARYN_MODEL_PREFERENCES_FILE` sans en interpréter le contenu ; c'est
/// l'extension qui sait que la clé `image_model` la concerne. Sans cela, un
/// appel d'outil qui ne nomme pas de modèle prenait le premier venu, et le
/// réglage « modèle d'image par défaut » du compte ne servait à rien.
pub fn account_default_model() -> Option<String> {
    let path = std::env::var_os("LOCARYN_MODEL_PREFERENCES_FILE")?;
    let raw = std::fs::read_to_string(PathBuf::from(path)).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let chosen = parsed.get("image_model")?.as_str()?.trim();
    if chosen.is_empty() {
        return None;
    }
    // Un modèle désinstallé depuis le réglage ne doit pas faire échouer la
    // génération : on retombe sur ce qui est réellement là.
    resolve_model_path(chosen)
        .exists()
        .then(|| chosen.to_string())
}

pub async fn generate_image(request: ImageGenRequest) -> Result<ImageGenResult, String> {
    if request.prompt.trim().is_empty() {
        return Err("le prompt ne peut pas être vide".into());
    }
    let selected = request
        .model
        .as_deref()
        .filter(|model| !model.trim().is_empty())
        .map(str::to_string)
        .or_else(account_default_model)
        .or_else(|| list_image_models().into_iter().next())
        .ok_or_else(|| {
            "aucun modèle de diffusion installé dans le stockage du plugin".to_string()
        })?;
    let model_path = validate_model_path(&resolve_model_path(&selected))?;
    let model_name = model_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| selected.clone());
    let (family_steps, family_cfg) = default_sampling(&model_name);
    let steps = request
        .steps
        .map(|value| value.clamp(1, 100))
        .unwrap_or(family_steps);
    let cfg = request
        .cfg_scale
        .map(|value| value.clamp(0.1, 30.0))
        .unwrap_or(family_cfg);
    let native = default_resolution(&model_name);
    let width = request
        .width
        .map(|value| value.clamp(64, 2048))
        .unwrap_or(native);
    let height = request
        .height
        .map(|value| value.clamp(64, 2048))
        .unwrap_or(native);

    let output_dir = generated_images_dir();
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("dossier de sortie : {e}"))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let out_file = output_dir.join(format!("img_{stamp}.png"));
    let input_path = materialise_image(request.input_image.as_deref(), &format!("input-{stamp}"))?;
    let mask_path = materialise_image(request.mask_image.as_deref(), &format!("mask-{stamp}"))?;
    if mask_path.is_some() && input_path.is_none() {
        return Err("un masque de retouche demande aussi une image source".into());
    }
    let models = models_dir();
    let binary = find_sd_binary().ok_or_else(|| {
        "le moteur image du plugin est introuvable. Installez le runtime depuis l'extension."
            .to_string()
    })?;
    let args = build_args(&SdRequest {
        model_path: &model_path,
        models_dir: &models,
        prompt: request.prompt.trim(),
        negative_prompt: request.negative_prompt.as_deref(),
        width,
        height,
        steps,
        cfg_scale: cfg,
        seed: request.seed.unwrap_or(stamp as i64),
        out_file: &out_file,
        init_image: input_path.as_deref(),
        mask: mask_path.as_deref(),
        strength: request.strength.unwrap_or(0.75).clamp(0.0, 1.0),
        sampler: request.sampler.as_deref(),
        scheduler: request.scheduler.as_deref(),
        clip_skip: request.clip_skip,
        batch_count: request.variants.clamp(1, 8),
        uncensored: request.uncensored,
        binary: &binary,
    })?;

    let mut command = tokio::process::Command::new(binary);
    command
        .args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    hide_console(&mut command);
    let result = async {
        let mut child = command
            .spawn()
            .map_err(|e| format!("lancement de stable-diffusion.cpp : {e}"))?;
        let stderr = child.stderr.take().ok_or("stderr du moteur indisponible")?;
        let mut lines = tokio::io::BufReader::new(stderr).lines();
        let mut errors = Vec::new();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.contains("[ERROR]") || line.to_ascii_lowercase().contains("error") {
                errors.push(line.trim().to_string());
            }
        }
        let status = child
            .wait()
            .await
            .map_err(|e| format!("attente du moteur : {e}"))?;
        let (_, expected) = batch_output(&out_file, request.variants.clamp(1, 8));
        let paths = expected
            .into_iter()
            .filter(|path| path.is_file())
            .collect::<Vec<_>>();
        if !status.success() || paths.is_empty() {
            return Err(format!(
                "génération échouée : {}",
                errors
                    .last()
                    .map(String::as_str)
                    .unwrap_or("aucune image écrite")
            ));
        }
        Ok(paths)
    }
    .await;
    for scratch in [&input_path, &mask_path].into_iter().flatten() {
        let _ = std::fs::remove_file(scratch);
    }
    if result.is_err() {
        let (_, expected) = batch_output(&out_file, request.variants.clamp(1, 8));
        for path in expected {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(ImageGenResult {
        paths: result?,
        model: selected,
    })
}

/// Ramène une image à un fichier, qu'elle arrive en data URL ou en chemin.
///
/// L'interface d'une extension vit dans une vue web : elle n'a pas de chemin
/// disque à donner, seulement le contenu encodé. Un appel d'outil venu du
/// modèle, lui, nomme un fichier existant. Les deux doivent marcher.
pub fn materialise_image(source: Option<&str>, tag: &str) -> Result<Option<PathBuf>, String> {
    let Some(raw) = source.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if !raw.starts_with("data:") {
        let path = PathBuf::from(raw);
        if !path.is_file() {
            return Err(format!("image introuvable : {raw}"));
        }
        return Ok(Some(path));
    }
    let path = std::env::temp_dir().join(format!("locaryn-image-{tag}.png"));
    std::fs::write(&path, decode_data_url(raw)?).map_err(|e| format!("image source : {e}"))?;
    Ok(Some(path))
}

fn hide_std_console(command: &mut std::process::Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    #[cfg(not(windows))]
    let _ = command;
}

fn hide_console(command: &mut tokio::process::Command) {
    #[cfg(windows)]
    {
        command.creation_flags(0x0800_0000);
    }
    #[cfg(not(windows))]
    let _ = command;
}

fn decode_data_url(input: &str) -> Result<Vec<u8>, String> {
    decode_base64(
        input
            .split_once(',')
            .map(|(_, payload)| payload)
            .unwrap_or(input),
    )
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let mut values = Vec::new();
    for byte in input.bytes().filter(|byte| !b" \r\n\t".contains(byte)) {
        if byte == b'=' {
            break;
        }
        values.push(match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("image source base64 invalide".into()),
        });
    }
    let mut output = Vec::with_capacity(values.len() * 3 / 4);
    let mut index = 0;
    while index + 3 < values.len() {
        output.push((values[index] << 2) | (values[index + 1] >> 4));
        output.push((values[index + 1] << 4) | (values[index + 2] >> 2));
        output.push((values[index + 2] << 6) | values[index + 3]);
        index += 4;
    }
    if values.len() - index >= 2 {
        output.push((values[index] << 2) | (values[index + 1] >> 4));
    }
    if values.len() - index >= 3 {
        output.push((values[index + 1] << 4) | (values[index + 2] >> 2));
    }
    Ok(output)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRequest {
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub sources: Vec<String>,
    #[serde(default)]
    pub token: Option<String>,
}

pub async fn install_models(request: InstallRequest) -> Result<Vec<String>, String> {
    let mut sources = request.sources;
    if let Some(source) = request.source.filter(|source| !source.trim().is_empty()) {
        sources.push(source);
    }
    if sources.is_empty() {
        return Err("aucune source de modèle".into());
    }

    let mut expanded = Vec::new();
    for source in sources {
        expanded.push(source.clone());
        let lower = source.to_ascii_lowercase();
        if lower.contains("z_image") || lower.contains("z-image") {
            expanded.push(Z_IMAGE_VAE_URL.into());
            expanded.push(Z_IMAGE_ENCODER_URL.into());
        }
    }
    expanded.sort();
    expanded.dedup();

    let token = request
        .token
        .or_else(|| std::env::var("HF_TOKEN").ok())
        .unwrap_or_default();
    let client = reqwest::Client::builder()
        .user_agent("locaryn-plugin-image")
        .build()
        .map_err(|e| format!("client HTTP : {e}"))?;
    let mut installed = Vec::new();
    let mut created = Vec::new();
    for source in expanded {
        let outcome = async {
            let url = normalize_huggingface_source(&source)?;
            let file_name = filename_from_url(&url)?;
            let destination = models_dir().join(&file_name);
            if !destination.is_file() {
                download_file(&client, &url, &destination, &token).await?;
                created.push(destination);
            }
            Ok::<String, String>(file_name)
        }
        .await;
        match outcome {
            Ok(file_name) => installed.push(file_name),
            Err(error) => {
                for path in created {
                    let _ = tokio::fs::remove_file(path).await;
                }
                return Err(error);
            }
        }
    }
    Ok(installed)
}

/// Poser le contenu d'une archive de runtime dans `bin/`.
///
/// Le moteur est publié avec ses bibliothèques à côté de lui ; extraire le seul
/// exécutable donnerait un binaire qui ne démarre pas. Les chemins sont aplatis
/// : l'archive place parfois tout dans un dossier, parfois à la racine, et le
/// moteur veut ses bibliothèques dans son propre dossier.
fn extract_runtime_archive(archive: &Path, bin_dir: &Path) -> Result<PathBuf, String> {
    let file = std::fs::File::open(archive).map_err(|e| format!("archive illisible : {e}"))?;
    let mut zip =
        zip::ZipArchive::new(file).map_err(|e| format!("archive runtime invalide : {e}"))?;
    let executable = if cfg!(windows) { "sd.exe" } else { "sd" };
    let mut installed: Option<PathBuf> = None;

    std::fs::create_dir_all(bin_dir).map_err(|e| format!("dossier bin : {e}"))?;
    for index in 0..zip.len() {
        let mut entry = zip
            .by_index(index)
            .map_err(|e| format!("entrée d'archive illisible : {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let raw = entry.name().replace('\\', "/");
        let Some(name) = raw.rsplit('/').next().filter(|name| !name.is_empty()) else {
            continue;
        };
        // Aplatissement : on ne recrée aucun sous-dossier, donc aucun nom ne
        // peut sortir de `bin_dir`.
        let target = bin_dir.join(name);
        let mut out =
            std::fs::File::create(&target).map_err(|e| format!("écriture {name} : {e}"))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| format!("extraction {name} : {e}"))?;
        drop(out);
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&target, std::fs::Permissions::from_mode(mode));
        }
        if name.eq_ignore_ascii_case(executable) {
            installed = Some(target);
        }
    }

    installed.ok_or_else(|| {
        format!("l'archive ne contient pas d'exécutable « {executable} » de stable-diffusion.cpp")
    })
}

pub async fn install_runtime(request: RuntimeInstallRequest) -> Result<String, String> {
    let source = request.source.trim();
    if !(source.starts_with("https://") && source.contains("github.com/")) {
        return Err("le runtime doit être un asset HTTPS de GitHub".into());
    }
    let executable = if cfg!(windows) { "sd.exe" } else { "sd" };
    let bin_dir = plugin_root().join("bin");
    let client = reqwest::Client::builder()
        .user_agent("locaryn-plugin-image")
        .build()
        .map_err(|e| format!("client HTTP : {e}"))?;

    if source.to_ascii_lowercase().ends_with(".zip") {
        let archive = std::env::temp_dir().join("locaryn-sd-runtime.zip");
        download_file(&client, source, &archive, "").await?;
        let result = extract_runtime_archive(&archive, &bin_dir);
        let _ = std::fs::remove_file(&archive);
        return result.map(|path| path.to_string_lossy().to_string());
    }

    let destination = bin_dir.join(executable);
    download_file(&client, source, &destination, "").await?;
    Ok(destination.to_string_lossy().to_string())
}

fn normalize_huggingface_source(source: &str) -> Result<String, String> {
    let source = source.trim();
    let url = if source.starts_with("hf.co/") {
        source.replacen("hf.co/", "https://huggingface.co/", 1)
    } else {
        source.to_string()
    };
    if !(url.starts_with("https://") && url.contains("huggingface.co/")) {
        return Err("les modèles doivent venir de huggingface.co en HTTPS".into());
    }
    Ok(url)
}

fn filename_from_url(url: &str) -> Result<String, String> {
    let name = url
        .split(['?', '#'])
        .next()
        .unwrap_or(url)
        .rsplit('/')
        .next()
        .unwrap_or_default();
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\']) {
        return Err("nom de fichier invalide".into());
    }
    Ok(name.to_string())
}

async fn download_file(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    token: &str,
) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("dossier de destination : {e}"))?;
    }
    let part = destination.with_file_name(format!(
        "{}.part",
        destination.file_name().unwrap().to_string_lossy()
    ));
    let outcome = async {
        let mut request = client.get(url);
        if !token.is_empty() {
            request = request.bearer_auth(token);
        }
        let response = request
            .send()
            .await
            .map_err(|e| format!("téléchargement : {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "téléchargement HTTP {} pour {}",
                response.status(),
                url
            ));
        }
        let mut file = tokio::fs::File::create(&part)
            .await
            .map_err(|e| format!("fichier temporaire : {e}"))?;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            file.write_all(&chunk.map_err(|e| format!("flux de téléchargement : {e}"))?)
                .await
                .map_err(|e| format!("écriture : {e}"))?;
        }
        file.flush().await.map_err(|e| format!("flush : {e}"))?;
        drop(file);
        tokio::fs::rename(&part, destination)
            .await
            .map_err(|e| format!("finalisation : {e}"))
    }
    .await;
    if outcome.is_err() {
        let _ = tokio::fs::remove_file(&part).await;
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ce que coûtait le placement systématique : un SD 1.5 quantifié tient
    /// largement sur une carte de 6 Gio, et l'envoyer quand même en RAM
    /// faisait passer le rendu d'une minute à trois.
    #[test]
    fn weights_that_fit_the_card_stay_on_it() {
        let dir = std::env::temp_dir().join("locaryn_image_fit_test");
        std::fs::create_dir_all(&dir).unwrap();
        let small = dir.join("sd15.gguf");
        std::fs::write(&small, vec![0u8; 4 * 1024 * 1024]).unwrap();
        std::env::set_var("LOCARYN_VRAM_GB", "6");
        assert!(memory_placement_args(&small, "--auto-fit --offload-to-cpu").is_empty());

        // Au-delà de ce que la carte tient, il faut au contraire répartir.
        std::env::set_var("LOCARYN_VRAM_GB", "0.001");
        assert_eq!(
            memory_placement_args(&small, "--auto-fit --offload-to-cpu"),
            vec!["--auto-fit".to_string()]
        );
        // Un moteur qui ignore --auto-fit retombe sur le trio du socle.
        assert_eq!(
            memory_placement_args(&small, "--offload-to-cpu --max-vram --backend"),
            vec![
                "--offload-to-cpu".to_string(),
                "--max-vram".to_string(),
                "1.5".to_string(),
                "--backend".to_string(),
                "te=cpu".to_string(),
            ]
        );
        std::env::remove_var("LOCARYN_VRAM_GB");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn model_families_and_sampling_are_stable() {
        assert_eq!(classify_model("z_image_turbo-Q8.gguf"), ModelFamily::ZImage);
        assert_eq!(classify_model("z-img-Q4.gguf"), ModelFamily::ZImage);
        assert_eq!(classify_model("flux1-schnell-Q4.gguf"), ModelFamily::Flux);
        assert_eq!(
            classify_model("sdxl-turbo-Q4.gguf"),
            ModelFamily::FullCheckpoint
        );
        assert_eq!(default_sampling("z_image_turbo-Q8.gguf"), (8, 1.0));
        assert_eq!(default_sampling("flux1-schnell-Q4.gguf"), (4, 1.0));
    }

    #[test]
    fn checkpoints_are_recognised_and_companions_hidden() {
        assert!(is_diffusion_checkpoint("z_image_turbo-Q8_0.gguf"));
        assert!(is_diffusion_checkpoint("flux1-schnell-Q4_0.gguf"));
        assert!(is_diffusion_checkpoint("sd_xl_turbo_1.0.q8_0.gguf"));
        assert!(is_diffusion_checkpoint(
            "stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf"
        ));
        // Un checkpoint abliteré reste un checkpoint : c'est l'encodeur de
        // texte qui est abliteré séparément, pas le modèle de diffusion.
        assert!(is_diffusion_checkpoint("Z-Image-AbliteratedV1.Q4_K_M.gguf"));
        assert!(!is_diffusion_checkpoint("ae.safetensors"));
        assert!(!is_diffusion_checkpoint("decoder_fp32_fix.onnx"));
        // L'encodeur de texte de Z-Image vit dans le même dossier que lui.
        assert!(!is_diffusion_checkpoint("Qwen3-4B-Instruct-Q4.gguf"));
        assert!(!is_diffusion_checkpoint(
            "L3.2-8X3B-MOE-Dark-Champion-Q3.gguf"
        ));
    }

    /// L'archive du moteur place parfois tout dans un dossier : l'exécutable
    /// et ses bibliothèques doivent finir côte à côte dans `bin/`, sinon le
    /// binaire extrait ne démarre pas.
    #[test]
    fn runtime_archive_is_flattened_into_bin() {
        let root = temp_dir("runtime");
        let archive = root.join("sd.zip");
        let executable = if cfg!(windows) { "sd.exe" } else { "sd" };
        {
            let file = std::fs::File::create(&archive).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            zip.add_directory("sd-master-bin/", options).unwrap();
            zip.start_file(format!("sd-master-bin/{executable}"), options)
                .unwrap();
            std::io::Write::write_all(&mut zip, b"moteur").unwrap();
            zip.start_file("sd-master-bin/ggml.dll", options).unwrap();
            std::io::Write::write_all(&mut zip, b"lib").unwrap();
            zip.finish().unwrap();
        }

        let bin = root.join("bin");
        let installed = extract_runtime_archive(&archive, &bin).unwrap();
        assert_eq!(installed, bin.join(executable));
        assert!(
            bin.join("ggml.dll").is_file(),
            "la bibliothèque suit le binaire"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    /// Une archive sans moteur doit le dire, pas laisser croire à une
    /// installation réussie.
    #[test]
    fn runtime_archive_without_engine_is_refused() {
        let root = temp_dir("runtime-vide");
        let archive = root.join("vide.zip");
        {
            let file = std::fs::File::create(&archive).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            zip.start_file("LISEZMOI.txt", options).unwrap();
            std::io::Write::write_all(&mut zip, b"rien ici").unwrap();
            zip.finish().unwrap();
        }
        assert!(extract_runtime_archive(&archive, &root.join("bin")).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }

    /// Le réglage du compte ne vaut que si le fichier est encore là : un
    /// modèle supprimé depuis ne doit pas faire échouer la génération.
    #[test]
    fn account_default_is_ignored_when_the_file_is_gone() {
        let root = temp_dir("prefs");
        let prefs = root.join("model_preferences.json");
        std::fs::write(&prefs, br#"{"image_model":"disparu-Q4.gguf"}"#).unwrap();
        std::env::set_var("LOCARYN_MODEL_PREFERENCES_FILE", &prefs);
        std::env::set_var("LOCARYN_EXTENSION_MODELS_DIR", &root);
        assert_eq!(account_default_model(), None);

        std::fs::write(root.join("z_image_turbo-Q8_0.gguf"), b"poids").unwrap();
        std::fs::write(&prefs, br#"{"image_model":"z_image_turbo-Q8_0.gguf"}"#).unwrap();
        assert_eq!(
            account_default_model().as_deref(),
            Some("z_image_turbo-Q8_0.gguf")
        );
        std::env::remove_var("LOCARYN_MODEL_PREFERENCES_FILE");
        std::env::remove_var("LOCARYN_EXTENSION_MODELS_DIR");
        let _ = std::fs::remove_dir_all(&root);
    }

    /// Un dépôt de voix contient lui aussi un `model.safetensors` ; seul son
    /// dossier le distingue d'un checkpoint de diffusion.
    #[test]
    fn weights_nested_in_a_non_diffusion_repo_are_not_offered() {
        assert!(!is_diffusion_checkpoint(
            "Qwen__Qwen3-TTS-12Hz-0.6B-Base/model.safetensors"
        ));
        assert!(!is_diffusion_checkpoint(
            "Qwen__Qwen3-TTS-12Hz-1.7B-CustomVoice/speech_tokenizer/model.safetensors"
        ));
        assert!(is_diffusion_checkpoint(
            "stable-diffusion-xl/unet/diffusion_pytorch_model.safetensors"
        ));
    }

    #[test]
    fn old_onnx_vae_is_never_selected() {
        let root = temp_dir("companions");
        std::fs::write(root.join("decoder_fp32_fix.onnx"), b"bad").unwrap();
        std::fs::write(root.join("ae.safetensors"), b"good").unwrap();
        let companions = discover_companions(&root, ModelFamily::ZImage, false);
        assert_eq!(companions.vae, Some(root.join("ae.safetensors")));
    }

    #[test]
    fn data_url_and_batch_paths_are_valid() {
        assert_eq!(
            decode_data_url("data:image/png;base64,aGVsbG8=").unwrap(),
            b"hello"
        );
        let (pattern, files) = batch_output(Path::new("out/img.png"), 3);
        assert!(pattern.to_string_lossy().contains("img_%d.png"));
        assert_eq!(files[0], PathBuf::from("out/img_0.png"));
        assert_eq!(files[2], PathBuf::from("out/img_2.png"));
    }

    /// Sans dimension demandée, chaque famille rend à sa taille d'entraînement.
    #[test]
    fn a_model_renders_at_the_size_it_was_trained_for() {
        assert_eq!(default_resolution("z_image_turbo-Q8_0.gguf"), 1024);
        assert_eq!(default_resolution("flux1-schnell-Q4_0.gguf"), 1024);
        assert_eq!(default_resolution("sd_xl_turbo_1.0.q8_0.gguf"), 1024);
        assert_eq!(
            default_resolution("stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf"),
            512
        );
        assert_eq!(default_resolution("stablediffusionapi__deliberate-v2"), 512);
    }

    /// Le moteur relit un chemin ordinaire, pas la forme longue de Windows.
    #[cfg(windows)]
    #[test]
    fn the_engine_gets_a_path_it_can_reopen() {
        assert_eq!(
            plain_path(PathBuf::from(r"\\?\D:\modeles\sd.gguf")),
            PathBuf::from(r"D:\modeles\sd.gguf")
        );
        assert_eq!(
            plain_path(PathBuf::from(r"\\?\UNC\serveur\part\sd.gguf")),
            PathBuf::from(r"\\serveur\part\sd.gguf")
        );
        assert_eq!(
            plain_path(PathBuf::from(r"D:\deja\simple.gguf")),
            PathBuf::from(r"D:\deja\simple.gguf")
        );
    }

    /// Un dépôt diffusers se charge en donnant le dossier au moteur ; un dépôt
    /// sans aucun poids reste refusé, avec un message.
    #[test]
    fn a_diffusers_repository_is_loaded_as_a_directory() {
        let root = temp_dir("diffusers-dir");

        let plain = root.join("un-checkpoint");
        std::fs::create_dir_all(&plain).unwrap();
        std::fs::write(plain.join("model.safetensors"), b"x").unwrap();
        assert_eq!(
            directory_checkpoint(&plain),
            Some(plain.join("model.safetensors"))
        );

        let repo = root.join("stablediffusionapi__deliberate-v2");
        std::fs::create_dir_all(repo.join("unet")).unwrap();
        std::fs::write(repo.join("model_index.json"), b"{}").unwrap();
        std::fs::write(
            repo.join("unet")
                .join("diffusion_pytorch_model.safetensors"),
            b"x",
        )
        .unwrap();
        assert_eq!(directory_checkpoint(&repo), Some(repo.clone()));

        let empty = root.join("rien");
        std::fs::create_dir_all(&empty).unwrap();
        assert_eq!(directory_checkpoint(&empty), None);

        let _ = std::fs::remove_dir_all(&root);
    }

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("locaryn-image-plugin-{name}"));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
