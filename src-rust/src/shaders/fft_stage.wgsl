struct StageUniform {
    chunks: u32,
    stage: u32
}

@group(0) @binding(0) var<storage, read> input_buffer: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> output_buffer: array<vec2<f32>>;
@group(1) @binding(0) var<storage, read> twiddle_buffer: array<vec2<f32>>;
@group(2) @binding(0) var<uniform> uniform_buffer: StageUniform;

@id(0) override FFT_SIZE_LOG: u32;
@id(1) override FFT_SIZE: u32;

fn complex_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

@compute
@workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let chunk_index = global_id.x;
    if (chunk_index >= uniform_buffer.chunks) {
        return;
    }
    let offset = global_id.y;
    if (offset >= FFT_SIZE) {
        return;
    }
    let stage = uniform_buffer.stage;
    output_buffer[chunk_index << FFT_SIZE_LOG | offset] =
        input_buffer[chunk_index << FFT_SIZE_LOG | (offset & ~(1u << stage))] +
        complex_mul(
            twiddle_buffer[(offset << (FFT_SIZE_LOG - stage - 1)) & (FFT_SIZE - 1u)],
            input_buffer[chunk_index << FFT_SIZE_LOG | (offset | (1u << stage))]
        );
}