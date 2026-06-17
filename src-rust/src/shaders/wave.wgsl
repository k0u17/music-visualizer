@group(0) @binding(0) var<storage, read_write> position_buffer: array<f32>;
@group(0) @binding(1) var<storage, read> velocity_buffer_in: array<f32>;
@group(0) @binding(2) var<storage, read_write> velocity_buffer_out: array<f32>;
@group(0) @binding(3) var<storage, read> frequency_buffer: array<vec2<f32>>;
@group(1) @binding(0) var<uniform> step: u32;

@id(0) override FFT_SIZE_LOG: u32;
@id(1) override FFT_SIZE: u32;

const COHERENT_GAIN_INV: f32 = 2.0;
const MIN_DB: f32 = -80.0;
const MAX_DB: f32 = 0.0;
const EPSILON: f32 = 1e-7;
const LN_10: f32 = 2.3025851;

const COEFF: f32 = 0.3;
const DAMPING: f32 = 0.05;
const SPRING: f32 = 0.01;
const FORCE_SCALE: f32 = 0.02;

fn normalize_fft_output(fft_output: vec2<f32>) -> f32 {
    let factor = COHERENT_GAIN_INV / f32(FFT_SIZE >> 1);
    let db = clamp(10*log(dot(fft_output, fft_output)*factor*factor + EPSILON)/LN_10, MIN_DB, MAX_DB);
    return (db - MIN_DB) / (MAX_DB - MIN_DB);
}

@compute
@workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = i32(global_id.x);
    if (index >= FFT_SIZE >> 1) {
        return;
    }
    let mask = (FFT_SIZE >> 1) - 1u;
    let du2 = position_buffer[(index + 1) & mask] - 2.0 * position_buffer[index] + position_buffer[(index - 1) & mask];
    position_buffer[index] = position_buffer[index] + velocity_buffer_in[index];
    velocity_buffer_out[index] = velocity_buffer_in[index]
        + COEFF * du2
        - SPRING * position_buffer[index]
        - DAMPING * velocity_buffer_in[index]
        + FORCE_SCALE * normalize_fft_output(frequency_buffer[(step << FFT_SIZE_LOG) | index]);
}
