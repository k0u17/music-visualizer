@group(0) @binding(0) var<storage, read> sample_buffer_left: array<f32>;
@group(0) @binding(1) var<storage, read> sample_buffer_right: array<f32>;
@group(0) @binding(2) var<storage, read_write> output_buffer: array<vec2<f32>>;
@group(1) @binding(0) var<storage, read> window_buffer: array<f32>;
@group(2) @binding(0) var<uniform> chunks: u32;

@id(0) override FFT_SIZE_LOG: u32;
@id(1) override FFT_SIZE: u32;
@id(2) override FFT_WINDOW_STRIDE: u32;

fn reverse_bits(value: u32) -> u32 {
    return reverseBits(value) >> (32u - FFT_SIZE_LOG);
}

@compute
@workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let chunk_index = global_id.x;
    if (chunk_index >= chunks) {
        return;
    }
    let offset = global_id.y;
    if (offset >= FFT_SIZE) {
        return;
    }
    let rev_offset = reverse_bits(offset);
    let left = sample_buffer_left[FFT_WINDOW_STRIDE * chunk_index + offset];
    let right = sample_buffer_right[FFT_WINDOW_STRIDE * chunk_index + offset];
    let index = chunk_index << FFT_SIZE_LOG | rev_offset;
    output_buffer[index] = vec2((left + right) * window_buffer[offset] * 0.5, 0.0);
}