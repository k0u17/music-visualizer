use macros::js_error;
use std::array;
use std::error::Error;
use wasm_bindgen::prelude::wasm_bindgen;
use web_sys::HtmlCanvasElement;
use wgpu::util::DeviceExt;

const FFT_SIZE: u16 = 2048;
const FFT_WINDOW_STRIDE: u16 = 128;
const MAX_ANALYSIS_PER_FRAME: u16 = 16;
const FREQUENCIES: u16 = FFT_SIZE / 2;
const BINS: u16 = 20;

struct Resources {
    position_buffers: [wgpu::Buffer; 2],
    velocity_buffers: [wgpu::Buffer; 2],
    bins_buffer: wgpu::Buffer,
    vertices: wgpu::Buffer,
    indices: wgpu::Buffer
}

impl Resources {

    fn init_simulation_resources(device: &wgpu::Device) -> ([wgpu::Buffer; 2], [wgpu::Buffer; 2]) {
        let buffer_desc = wgpu::BufferDescriptor {
            label: None,
            size: FREQUENCIES as u64 * size_of::<f32>() as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        };
        let [position_buffers, velocity_buffers] = array::from_fn::<_, 2, _>(|_| [
            device.create_buffer(&buffer_desc),
            device.create_buffer(&buffer_desc)
        ]);
        (position_buffers, velocity_buffers)
    }

    fn init_vertex_resources(device: &wgpu::Device) -> (wgpu::Buffer, wgpu::Buffer) {
        let vertices = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: FREQUENCIES as u64 * 4 * size_of::<f32>() as u64 * 2, // rectangles
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });
        // 0 - 1
        // | \ |
        // 3 - 2
        let index_content = (0..FREQUENCIES)
            .flat_map(|i| [i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3])
            .collect::<Vec<_>>();
        let indices = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: None,
            contents: bytemuck::cast_slice(&index_content),
            usage: wgpu::BufferUsages::INDEX,
        });
        (vertices, indices)
    }

    pub fn new(device: &wgpu::Device) -> Self {
        let (position_buffers, velocity_buffers) = Self::init_simulation_resources(device);
        let (vertices, indices) = Self::init_vertex_resources(device);
        let bins_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: BINS as u64 * size_of::<f32>() as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });
        Self {
            position_buffers,
            velocity_buffers,
            bins_buffer,
            vertices,
            indices,
        }
    }

    pub fn position_buffers(&self) -> &[wgpu::Buffer; 2] {
        &self.position_buffers
    }

    pub fn velocity_buffers(&self) -> &[wgpu::Buffer; 2] {
        &self.velocity_buffers
    }

    pub fn bins_buffer(&self) -> &wgpu::Buffer {
        &self.bins_buffer
    }

    pub fn vertices(&self) -> &wgpu::Buffer {
        &self.vertices
    }

    pub fn indices(&self) -> &wgpu::Buffer {
        &self.indices
    }
}

// struct SimulationShader {
//     bind_groups: [wgpu::BindGroup; 2],
//     pipeline: wgpu::ComputePipeline
// }
//
// impl SimulationShader {
//     pub fn new(device: &wgpu::Device, resources: &Resources) -> Self {
//         let buffers = [resources.position_buffers(), resources.velocity_buffers()];
//         let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
//             label: None,
//             entries: &[0, 1].map(|i|
//                 wgpu::BindGroupLayoutEntry {
//                     binding: i,
//                     visibility: wgpu::ShaderStages::COMPUTE,
//                     ty: wgpu::BindingType::Buffer {
//                         ty: BufferBindingType::Storage {
//                             read_only: i == 0
//                         },
//                         has_dynamic_offset: false,
//                         min_binding_size: None,
//                     },
//                     count: None
//                 }
//             ),
//         });
//         let bind_groups = [0, 1].map(|i| [0, 1].map(|j|
//             wgpu::BindGroupEntry {
//                 binding: i as u32,
//                 resource: buffers[j][i].as_entire_binding(),
//             }
//         )).map(|entries|
//             device.create_bind_group(&wgpu::BindGroupDescriptor {
//                 label: None,
//                 layout: &layout,
//                 entries: &entries,
//             })
//         );
//         Self {
//             bind_groups,
//         }
//     }
// }

const LAYOUT: wgpu::VertexBufferLayout<'static> = wgpu::VertexBufferLayout {
    array_stride: (size_of::<f32>() * 2) as wgpu::BufferAddress,
    step_mode: wgpu::VertexStepMode::Vertex,
    attributes: &wgpu::vertex_attr_array![
        0 => Float32x2, // position
    ],
};

struct PosToBinsShader {
    bind_groups: [wgpu::BindGroup; 2],
    pipeline: wgpu::ComputePipeline,
}

impl PosToBinsShader {
    pub fn new(device: &wgpu::Device, resources: &Resources) -> Self {
        let shader = device.create_shader_module(wgpu::include_wgsl!("shaders/pos_to_bins.wgsl"));
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: None,
            module: &shader,
            entry_point: None,
            compilation_options: Default::default(),
            cache: Default::default(),
        });
        let bind_group_layout = pipeline.get_bind_group_layout(0);
        let bind_groups = resources.position_buffers().each_ref().map(|pos_buf|
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: None,
                layout: &bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: pos_buf.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: resources.bins_buffer().as_entire_binding(),
                    },
                ],
            })
        );
        Self { bind_groups, pipeline }
    }

    pub fn compute(&self, pass: &mut wgpu::ComputePass, step: usize) {
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &self.bind_groups[step & 1], &[]);
        pass.dispatch_workgroups(BINS.div_ceil(64) as u32, 1, 1);
    }
}

struct VertexGenShader {
    bind_group: wgpu::BindGroup,
    pipeline: wgpu::ComputePipeline,
}

impl VertexGenShader {
    pub fn new(device: &wgpu::Device, resources: &Resources) -> Self {
        let shader = device.create_shader_module(wgpu::include_wgsl!("shaders/vertex_gen.wgsl"));
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: None,
            module: &shader,
            entry_point: None,
            compilation_options: Default::default(),
            cache: Default::default(),
        });
        let bind_group_layout = pipeline.get_bind_group_layout(0);
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: resources.bins_buffer().as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: resources.vertices().as_entire_binding(),
                },
            ],
        });
        Self { bind_group, pipeline }
    }

    pub fn compute(&self, pass: &mut wgpu::ComputePass) {
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &self.bind_group, &[]);
        pass.dispatch_workgroups(BINS.div_ceil(64) as u32, 1, 1);
    }
}

struct BinsShader {
    pipeline: wgpu::RenderPipeline,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
}

impl BinsShader {
    pub fn new(device: &wgpu::Device, config: &wgpu::SurfaceConfiguration, resources: &Resources) -> Self {
        let shader = device.create_shader_module(wgpu::include_wgsl!("shaders/bins.wgsl"));
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: None,
            layout: None,
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: None,
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[LAYOUT],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: None,
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState {
                count: 4,
                ..Default::default()
            },
            multiview_mask: None,
            cache: None,
        });
        Self {
            pipeline,
            vertex_buffer: resources.vertices().clone(),
            index_buffer: resources.indices().clone(),
        }
    }

    pub fn render(&self, pass: &mut wgpu::RenderPass) {
        pass.set_pipeline(&self.pipeline);
        pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
        pass.draw_indexed(0..FREQUENCIES as u32 * 6, 0, 0..1);
    }
}

#[wasm_bindgen]
pub struct Renderer {
    instance: wgpu::Instance,
    surface: wgpu::Surface<'static>,
    adapter: wgpu::Adapter,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    frame: usize,
    msaa_view: wgpu::TextureView,
    resources: Resources,
    sample_buffer: Vec<f32>,
    combined_sample_buffer: Vec<f32>,
    pos_to_bins_shader: PosToBinsShader,
    vertex_gen_shader: VertexGenShader,
    bins_shader: BinsShader
}

#[js_error]
#[wasm_bindgen]
impl Renderer {

    fn create_msaa_view(device: &wgpu::Device, config: &wgpu::SurfaceConfiguration) -> wgpu::TextureView {
        device.create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d { width: config.width, height: config.height, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 4,
            dimension: wgpu::TextureDimension::D2,
            format: config.format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        }).create_view(&wgpu::TextureViewDescriptor::default())
    }

    #[js_error(display)]
    #[wasm_bindgen]
    pub async fn create(canvas: HtmlCanvasElement) -> Result<Self, Box<dyn Error>> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU,
            ..Default::default()
        });
        let width = canvas.width();
        let height = canvas.height();
        let surface = instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas))?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await?;
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: None,
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                ..Default::default()
            })
            .await?;
        let surface_caps = surface.get_capabilities(&adapter);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_caps.formats[0],
            width,
            height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);
        let msaa_view = Self::create_msaa_view(&device, &config);
        // L and R
        let sample_buffer = vec![0.0f32; 2 * ((FFT_SIZE - FFT_WINDOW_STRIDE) + FFT_WINDOW_STRIDE * MAX_ANALYSIS_PER_FRAME) as usize];
        // (L + R)/2
        let combined_sample_buffer = vec![0.0f32; ((FFT_SIZE - FFT_WINDOW_STRIDE) + FFT_WINDOW_STRIDE * MAX_ANALYSIS_PER_FRAME) as usize];
        let resources = Resources::new(&device);
        let pos_to_bins_shader = PosToBinsShader::new(&device, &resources);
        let vertex_gen_shader = VertexGenShader::new(&device, &resources);
        let bins_shader = BinsShader::new(&device, &config, &resources);
        Ok(Self {
            instance,
            surface,
            adapter,
            device,
            queue,
            config,
            frame: 0,
            msaa_view,
            sample_buffer,
            combined_sample_buffer,
            resources,
            pos_to_bins_shader,
            vertex_gen_shader,
            bins_shader
        })
    }

    #[wasm_bindgen(js_name = "sampleBufferPtrL")]
    pub fn sample_buffer_ptr_left(&mut self) -> *mut f32 {
        self.sample_buffer.as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "sampleBufferPtrR")]
    pub fn sample_buffer_ptr_right(&mut self) -> *mut f32 {
        self.sample_buffer.as_mut_ptr().wrapping_add(self.sample_buffer.len() / 2)
    }

    #[wasm_bindgen(js_name = "sampleBufferSize")]
    pub fn sample_buffer_size(&mut self) -> usize {
        self.sample_buffer.len() / 2
    }

    #[wasm_bindgen(js_name = "onResize")]
    pub fn on_resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
        self.msaa_view = Self::create_msaa_view(&self.device, &self.config);
    }

    #[js_error(display)]
    #[wasm_bindgen]
    pub fn render(
        &mut self,
        #[wasm_bindgen(js_name = deltaTime)] delta_time: f64
    ) -> Result<(), Box<dyn Error>> {
        for i in 0..(FFT_SIZE - FFT_WINDOW_STRIDE) as usize {
            self.combined_sample_buffer[i] = (self.sample_buffer[i] + self.sample_buffer[self.sample_buffer.len() / 2 + i]) * 0.5;
        }
        let output = self.surface.get_current_texture()?;
        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
        self.pos_to_bins_shader.compute(&mut encoder.begin_compute_pass(&Default::default()), self.frame);
        self.vertex_gen_shader.compute(&mut encoder.begin_compute_pass(&Default::default()));
        self.bins_shader.render(&mut encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &self.msaa_view,
                depth_slice: None,
                resolve_target: Some(&view),
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Discard,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
            multiview_mask: None
        }));
        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        Ok(())
    }
}
