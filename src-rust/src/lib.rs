use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use wgpu::SurfaceTarget;

#[wasm_bindgen]
pub struct Renderer {
    instance: wgpu::Instance,
    surface: wgpu::Surface<'static>,
    adapter: wgpu::Adapter,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration
}

#[wasm_bindgen]
impl Renderer {
    #[wasm_bindgen]
    pub async fn create(canvas: HtmlCanvasElement) -> Renderer {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU,
            ..Default::default()
        });
        let width = canvas.width();
        let height = canvas.height();
        let surface = instance
            .create_surface(SurfaceTarget::Canvas(canvas))
            .expect("Failed to create surface");
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false
            })
            .await
            .expect("Failed to find an appropriate adapter");
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: None,
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    ..Default::default()
                }
            )
            .await
            .expect("Failed to create device");
        let surface_caps = surface.get_capabilities(&adapter);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_caps.formats[0],
            width,
            height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2
        };
        surface.configure(&device, &config);
        Renderer { instance, surface, adapter, device, queue, config }
    }

    #[wasm_bindgen]
    pub fn on_resize(&mut self, width: u32, height: u32) {
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
    }

    #[wasm_bindgen]
    pub fn render(&mut self, delta_time: f64) -> Result<(), JsValue> {
        let output = self.surface.get_current_texture()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: None
        });
        Ok(())
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

