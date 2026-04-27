@group(0) @binding(0) var<storage, read> position_buffer: array<f32>;
@group(0) @binding(1) var<storage, read_write> vertex_buffer: array<vec2<f32>>;

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let size = arrayLength(&position_buffer);
    if (index >= size) {
        return;
    }
    let width = 1.0 / (f32(size) - 0.1);
    let vis_w = width * 0.9;
    let offset = width * f32(index);
    let height = position_buffer[index] + 0.1;
    vertex_buffer[index * 4u] = vec2<f32>(offset, height);
    vertex_buffer[index * 4u + 1u] = vec2<f32>(offset + vis_w, height);
    vertex_buffer[index * 4u + 2u] = vec2<f32>(offset + vis_w, 0.0);
    vertex_buffer[index * 4u + 3u] = vec2<f32>(offset, 0.0);
}