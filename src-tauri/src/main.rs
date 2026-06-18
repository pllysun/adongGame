// 问鼎仙途 Tauri 壳：纯 WebView 容器，游戏逻辑全部在前端
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
