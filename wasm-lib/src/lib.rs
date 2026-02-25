use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub async fn run() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}