@group(0) @binding(0) var<storage, read> samples_buffer: array<f32>;
@group(0) @binding(1) var<storage, read_write> output_buffer: array<f32>;
@group(1) @binding(0) var<storage, read> window_buffer: array<f32>;

const FFT_SIZE: u32 = 2048u;
const FFT_WINDOW_STRIDE: u32 = 128u;

fn reverse_bits(value: u32) -> u32 {
    return reverseBits(value) >> (32u - firstLeadingBit(FFT_SIZE));
}

@compute
@workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let offset = global_id.y;
}