/// <reference types="audioworklet" />

export interface SharedRingBuffersState {
  /**
   * The actual ring buffers for each channel.
   */
  readonly buffers: Float32Array[],
  /**
   * The current write position in the ring buffers.
   */
  readonly writePos: Int32Array
}

class SampleCollector extends AudioWorkletProcessor {

  private state?: SharedRingBuffersState;
  private wrappingMask?: number;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<SharedRingBuffersState>) => {
      const capacity = e.data.buffers[0]!.length;
      if ((capacity & (capacity - 1)) !== 0)
        throw new Error(`Ring buffer capacity must be a power of two, got ${capacity}`);
      this.wrappingMask = capacity - 1;
      this.state = e.data;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    if (!this.state) return true;
    const writePos = Atomics.load(this.state.writePos, 0);
    const buffers = this.state.buffers;
    const capacity = buffers[0]!.length;
    const input = inputs[0];
    if (!input) return true;
    const blockSize = input[0]!.length;
    const wrappedWritePos = writePos & this.wrappingMask!;
    if (capacity - wrappedWritePos < blockSize) {
      // The block straddles the end of the ring buffer, so the write must be split.
      // `rem` is the number of samples that overflow past the end and wrap to the start.
      const rem = (blockSize + writePos) & this.wrappingMask!;
      // `offset` resolves to `writePos` in the normal case (blockSize <= capacity),
      // anchoring the first segment so it ends exactly at the buffer boundary.
      const offset = Math.max(capacity - blockSize, 0) + rem;
      for (let ch = 0; ch < buffers.length; ch++) {
        const channel = input[ch];
        if (!channel) continue;
        // Write the leading segment of the block into [offset, capacity).
        buffers[ch]!.set(channel.subarray(blockSize - rem - capacity + offset, blockSize - rem), offset);
        // Write the trailing `rem` samples that wrap around to the start of the buffer.
        buffers[ch]!.set(channel.subarray(blockSize - rem));
      }
    } else {
      for (let ch = 0; ch < buffers.length; ch++) {
        const channel = input[ch];
        if (!channel) continue;
        buffers[ch]!.set(channel, wrappedWritePos);
      }
    }
    Atomics.store(this.state.writePos, 0, writePos + blockSize);
    return true;
  }
}

registerProcessor('sample-collector', SampleCollector);