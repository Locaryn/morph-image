//! Stdio MCP server shipped by plugin-image.
//! stdout is reserved for JSON-RPC; diagnostics stay out of the protocol.

use locaryn_plugin_image::region_edit::{edit_region, RegionEditArgs};
use locaryn_plugin_image::{
    generate_image, generated_images_dir, install_models, install_runtime, list_image_models,
    ImageGenRequest, InstallRequest, RuntimeInstallRequest,
};
use serde_json::{json, Value};
use std::io::Write;
use tokio::io::{AsyncBufReadExt, BufReader};

const VERSION: &str = "2.0.2";

#[tokio::main]
async fn main() {
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<Value>(&line) {
            Ok(request) => handle_request(request).await,
            Err(error) => error_response(Value::Null, -32700, format!("JSON invalide : {error}")),
        };
        if let Ok(serialized) = serde_json::to_string(&response) {
            println!("{serialized}");
            let _ = std::io::stdout().flush();
        }
    }
}

async fn handle_request(request: Value) -> Value {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match method {
        "initialize" => success(
            id,
            json!({
                "protocolVersion": "2025-06-18",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "plugin-image", "version": VERSION }
            }),
        ),
        "tools/list" => success(id, tools_list()),
        "tools/call" => {
            let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let args = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            match call_tool(name, args).await {
                Ok(value) => success(id, text_content(value)),
                Err(error) => error_response(id, -32000, error),
            }
        }
        notification if notification.starts_with("notifications/") => Value::Null,
        _ => error_response(id, -32601, format!("méthode MCP inconnue : {method}")),
    }
}

fn tools_list() -> Value {
    json!({
        "tools": [
            {
                "name": "list_image_models",
                "description": "Liste les checkpoints de diffusion installés par l'extension.",
                "inputSchema": { "type": "object", "properties": {} }
            },
            {
                "name": "install_image_model",
                "description": "Télécharge un checkpoint et ses compagnons HuggingFace. En temps normal, renvoyez plutôt l'utilisateur vers le catalogue de modèles de l'application, filtre « Génération d'image » : il y trouve les modèles à jour avec leurs fichiers compagnons.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "source": { "type": "string" },
                        "sources": { "type": "array", "items": { "type": "string" } },
                        "token": { "type": "string" }
                    }
                }
            },
            {
                "name": "install_image_runtime",
                "description": "Installe le binaire stable-diffusion.cpp dans le dossier du plugin.",
                "inputSchema": {
                    "type": "object",
                    "required": ["source"],
                    "properties": { "source": { "type": "string" } }
                }
            },
            {
                "name": "generate_image",
                "description": "Génère ou transforme localement une image avec le moteur du plugin. Rédigez toujours prompt en anglais et en détail, quelle que soit la langue de la demande : ces modèles sont entraînés sur des légendes anglaises. Ne renseignez ni steps ni cfg_scale sans demande explicite — le moteur choisit déjà ce qui convient à la famille du modèle. Omettez model pour suivre le modèle par défaut choisi dans le compte, ou à défaut le premier checkpoint installé.",
                "inputSchema": {
                    "type": "object",
                    "required": ["prompt"],
                    "properties": {
                        "prompt": { "type": "string", "description": "Description visuelle en anglais : sujet, composition, lumière, style, support." },
                        "negative_prompt": { "type": "string", "description": "Ce qu'il faut éviter, en anglais." },
                        "model": { "type": "string", "description": "Nom exact d'un checkpoint renvoyé par list_image_models. À omettre en temps normal." },
                        "width": { "type": "integer", "minimum": 64, "maximum": 2048, "description": "À laisser vide sauf format demandé : chaque famille de modèle rend à sa résolution d'entraînement." },
                        "height": { "type": "integer", "minimum": 64, "maximum": 2048, "description": "À laisser vide sauf format demandé." },
                        "steps": { "type": "integer", "minimum": 1, "maximum": 100, "description": "À laisser vide sauf demande explicite : une valeur trop haute allonge le calcul sans rien apporter." },
                        "cfg_scale": { "type": "number", "minimum": 0.1, "maximum": 30, "description": "À laisser vide sauf demande explicite." },
                        "input_image": { "type": "string", "description": "Chemin de fichier ou URL data:image/...;base64,... pour transformer une image existante." },
                        "mask_image": { "type": "string", "description": "Masque de retouche, blanc = repeindre, noir = garder. Exige input_image. Pour désigner une zone en mots plutôt qu'en pixels, utilisez edit_image_region." },
                        "strength": { "type": "number", "minimum": 0, "maximum": 1, "description": "Part de l'image source réécrite, 0,75 par défaut. Bas = retouche légère, haut = réinvention." },
                        "seed": { "type": "integer", "description": "Rejoue exactement le même rendu. À omettre pour une image différente à chaque appel." },
                        "sampler": { "type": "string", "description": "euler, euler_a, dpm++2m… À omettre en temps normal." },
                        "scheduler": { "type": "string", "description": "discrete, karras, exponential, ays… À omettre en temps normal." },
                        "clip_skip": { "type": "integer", "minimum": 1, "maximum": 12, "description": "Couches CLIP ignorées ; 2 sur beaucoup de dérivés SD 1.5. À omettre en temps normal." },
                        "uncensored": { "type": "boolean" },
                        "variants": { "type": "integer", "minimum": 1, "maximum": 8, "description": "Plusieurs images en un seul rendu : le chargement des poids et l'encodage du prompt ne sont payés qu'une fois." }
                    }
                }
            },
            {
                "name": "edit_image_region",
                "description": "Modifie une zone nommée d'une image en laissant le reste intact. La zone est désignée en clair (« le t-shirt », « l'étagère en bois ») et segmentée par CLIPSeg — aucune coordonnée à fournir. Trois modes : recolor change la couleur exactement, sans modèle de diffusion et en une fraction de seconde ; replace redessine la zone avec le moteur ; preview teinte la sélection pour la faire valider avant de modifier quoi que ce soit. Préférez cet outil à generate_image dès que la demande porte sur une partie d'une image existante : un img2img global régénère toute la scène.",
                "inputSchema": {
                    "type": "object",
                    "required": ["image", "target", "mode"],
                    "properties": {
                        "image": { "type": "string", "description": "Chemin de l'image à modifier, ou URL data:image/...;base64,..." },
                        "target": { "type": "string", "description": "La zone, en mots. Visez un seul élément : « le cadre à gauche » plutôt que « les cadres »." },
                        "mode": { "type": "string", "enum": ["recolor", "replace", "preview"], "description": "recolor exige color ; replace exige prompt ; preview ne modifie rien." },
                        "color": { "type": "string", "description": "Couleur cible en #RRGGBB, pour recolor." },
                        "prompt": { "type": "string", "description": "Ce qu'il faut dessiner à la place, en anglais, pour replace." },
                        "model": { "type": "string", "description": "Checkpoint pour replace. À omettre pour suivre le modèle par défaut du compte." },
                        "steps": { "type": "integer", "minimum": 1, "maximum": 100 },
                        "cfgScale": { "type": "number", "minimum": 0.1, "maximum": 30 },
                        "strength": { "type": "number", "minimum": 0, "maximum": 1, "description": "0,85 par défaut pour un remplacement." }
                    }
                }
            }
        ]
    })
}

async fn call_tool(name: &str, args: Value) -> Result<Value, String> {
    match name {
        "list_image_models" => Ok(json!({ "models": list_image_models() })),
        "install_image_model" => {
            let request: InstallRequest = serde_json::from_value(args)
                .map_err(|error| format!("paramètres d'installation invalides : {error}"))?;
            Ok(json!({ "installed": install_models(request).await? }))
        }
        "install_image_runtime" => {
            let request: RuntimeInstallRequest = serde_json::from_value(args)
                .map_err(|error| format!("paramètres runtime invalides : {error}"))?;
            Ok(json!({ "path": install_runtime(request).await? }))
        }
        "generate_image" => {
            let request: ImageGenRequest = serde_json::from_value(args)
                .map_err(|error| format!("paramètres de génération invalides : {error}"))?;
            let result = generate_image(request).await?;
            let mut value = serde_json::to_value(&result).map_err(|error| error.to_string())?;
            value["artifacts"] = json!(result
                .paths
                .iter()
                .map(|path| json!({
                    "kind": "image_png",
                    "path": path.to_string_lossy()
                }))
                .collect::<Vec<_>>());
            Ok(value)
        }
        "edit_image_region" => {
            // Le dossier de sortie appartient au plugin : l'appelant n'a pas à
            // le connaître, et une extension n'écrit pas où on le lui dit.
            let mut args = args;
            if let Some(object) = args.as_object_mut() {
                object.insert(
                    "outputDir".to_string(),
                    json!(generated_images_dir().to_string_lossy()),
                );
            }
            let request: RegionEditArgs = serde_json::from_value(args)
                .map_err(|error| format!("paramètres de retouche invalides : {error}"))?;
            let result = edit_region(request).await?;
            let mut value = serde_json::to_value(&result).map_err(|error| error.to_string())?;
            value["artifacts"] = json!([{ "kind": "image_png", "path": result.path }]);
            Ok(value)
        }
        _ => Err(format!("outil image inconnu : {name}")),
    }
}

fn text_content(value: Value) -> Value {
    json!({
        "content": [{ "type": "text", "text": serde_json::to_string(&value).unwrap_or_else(|_| "{}".into()) }]
    })
}

fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn error_response(id: Value, code: i64, message: String) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}
