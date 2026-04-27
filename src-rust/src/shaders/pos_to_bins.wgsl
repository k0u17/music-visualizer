@group(0) @binding(0) var<storage, read> position_buffer: array<f32>;
@group(0) @binding(1) var<storage, read_write> bins_buffer: array<f32>;

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let bins = arrayLength(&bins_buffer);
    if (index >= bins) {
        return;
    }
    let N = arrayLength(&position_buffer);
    let bin_start = f32(index) / f32(bins);
    let bin_end = f32(index + 1u) / f32(bins);
    let i_start = u32(bin_start * f32(N));
    let i_end = min(u32(ceil(bin_end * f32(N))), N);
    var integral = 0.0;
    for (var i = i_start; i < i_end; i++) {
        let step_start = f32(i) / f32(N);
        let step_end = f32(i + 1u) / f32(N);
        let overlap = max(0.0, min(bin_end, step_end) - max(bin_start, step_start));
        integral += position_buffer[i] * overlap;
    }
    bins_buffer[index] = integral * f32(bins);
}