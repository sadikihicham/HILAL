// Icône de barre d'état (barre de menus macOS / zone de notification Windows-Linux).
//
// Le texte affiché est poussé par le FRONTEND, pas calculé ici : lui seul connaît la
// langue choisie, l'unité et la métrique retenue par l'utilisateur. Le backend ne fait
// que relayer vers l'API système. Même principe que partout dans HILAL — le Rust lit
// et exécute, le TypeScript décide.
//
// Ce que chaque plateforme accepte réellement :
//   - macOS : `set_title` affiche du TEXTE à côté de l'icône. C'est la plateforme où
//     la fonctionnalité prend tout son sens.
//   - Windows / Linux : aucun texte possible dans la zone de notification — seule
//     l'infobulle au survol peut le porter. On l'alimente donc systématiquement, sur
//     les trois plateformes, plutôt que de laisser Windows sans rien.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

pub const TRAY_ID: &str = "hilal-main";

/// Poignées conservées pour pouvoir retraduire le menu quand l'utilisateur change de
/// langue, sans reconstruire l'icône (ce qui la ferait clignoter dans la barre).
pub struct TrayState {
    pub show: MenuItem<Wry>,
    pub quit: MenuItem<Wry>,
    /// Pilote le comportement du bouton de fermeture : replier dans la barre d'état
    /// quand l'icône est active, quitter quand elle ne l'est pas. Sans ce drapeau,
    /// désactiver l'icône rendrait l'application impossible à fermer autrement.
    pub enabled: AtomicBool,
}

/// Glyphe du croissant HILAL, dessiné en RGBA plutôt que chargé depuis un PNG : évite
/// une dépendance de décodage d'image et garantit un rendu net à toute densité.
///
/// 🪤 MESURÉ le 2026-09-03 : dessiné en BLANC, le croissant était INVISIBLE dans la
/// barre de menus alors que `tray_by_id`, `set_title` et `set_visible` renvoyaient
/// tous `Ok` — un succès d'API sans aucun rendu. AppKit exige qu'une image
/// « template » soit **noire + alpha** (doc Apple : « black and clear colors ») ;
/// elle la recolore ensuite selon le thème clair/sombre. Le blanc n'est donc bon
/// QUE hors template, où l'icône est peinte telle quelle sur une barre sombre.
fn crescent(size: u32) -> tauri::image::Image<'static> {
    // macOS = template (noir, recoloré par le système) ; ailleurs l'icône est peinte
    // telle quelle, et les barres de tâches sont sombres -> blanc.
    let ink: u8 = if cfg!(target_os = "macos") { 0 } else { 255 };
    let n = size as f32;
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    // Deux disques : le grand donne la lune, le petit décalé creuse le croissant.
    let (ox, oy, orad) = (n * 0.5, n * 0.5, n * 0.44);
    let (ix, iy, irad) = (n * 0.74, n * 0.5, n * 0.40);
    for y in 0..size {
        for x in 0..size {
            let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
            let d_out = ((fx - ox).powi(2) + (fy - oy).powi(2)).sqrt();
            let d_in = ((fx - ix).powi(2) + (fy - iy).powi(2)).sqrt();
            // Bords adoucis sur un pixel : sans cela le croissant crénelle salement
            // dans une barre de menus de 22 points.
            let alpha = (orad - d_out).clamp(0.0, 1.0).min((d_in - irad).clamp(0.0, 1.0));
            let i = ((y * size + x) * 4) as usize;
            rgba[i] = ink;
            rgba[i + 1] = ink;
            rgba[i + 2] = ink;
            rgba[i + 3] = (alpha * 255.0).round() as u8;
        }
    }
    tauri::image::Image::new_owned(rgba, size, size)
}

fn reveal(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Construit l'icône. Les libellés passés ici sont provisoires : le frontend les
/// retraduit dès qu'il a lu la langue enregistrée (cf. `set_tray_menu_labels`).
pub fn build(app: &AppHandle) -> tauri::Result<TrayState> {
    let show = MenuItem::with_id(app, "tray-show", "Afficher HILAL", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Quitter HILAL", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(crescent(32))
        .icon_as_template(cfg!(target_os = "macos"))
        .menu(&menu)
        // Clic gauche = ouvrir la fenêtre (l'intention la plus fréquente) ;
        // clic droit = le menu. Convention des moniteurs de barre de menus.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => reveal(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                reveal(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(TrayState {
        show,
        quit,
        enabled: AtomicBool::new(true),
    })
}

/// Texte de la barre d'état. `title` n'a d'effet que sur macOS ; l'infobulle est
/// alimentée partout pour que Windows et Linux ne restent pas muets.
#[tauri::command]
pub fn set_tray_label(app: AppHandle, title: Option<String>, tooltip: String) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let _ = tray.set_title(title.as_deref());
    let _ = tray.set_tooltip(Some(&tooltip));
}

/// `try_state` et non `State` : l'icône est construite sur `RunEvent::Ready`, donc un
/// tout premier appel du frontend peut la précéder. On ignore alors sans erreur —
/// l'effet se rejoue au tick suivant.
#[tauri::command]
pub fn set_tray_menu_labels(app: AppHandle, show: String, quit: String) {
    let Some(state) = app.try_state::<TrayState>() else { return };
    let _ = state.show.set_text(show);
    let _ = state.quit.set_text(quit);
}

/// Masque ou réaffiche l'icône. Masquer bascule aussi le bouton de fermeture en
/// « quitter » : sans icône, une fenêtre repliée serait irrécupérable.
#[tauri::command]
pub fn set_tray_visible(app: AppHandle, visible: bool) {
    let Some(state) = app.try_state::<TrayState>() else { return };
    state.enabled.store(visible, Ordering::Relaxed);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(visible);
        if !visible {
            let _ = tray.set_title(None::<&str>);
        }
    }
}
