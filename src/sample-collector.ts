/// <reference types="audioworklet" />

export type SharedRingBuffers = {
  readonly buffers: Float32Array[];
  readonly writePos: Int32Array;
}

class SampleCollector extends AudioWorkletProcessor {

  private buffers?: SharedRingBuffers;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<SharedRingBuffers>) => {
      this.buffers = e.data;
    }
  }

  process(inputs: Float32Array[][]): boolean {
    if (!this.buffers) return true;
    let writePos = Atomics.load(this.buffers.writePos, 0);
    const buffers = this.buffers.buffers;
    const capacity = buffers[0]!.length;
    const input = inputs[0];
    if (!input) return true;
    const blockSize = input[0]!.length;
    if (capacity - writePos < blockSize) {
      const rem = (blockSize - capacity + writePos) % capacity;
      const offset = Math.max(capacity - blockSize, 0) + rem;
      for (let ch = 0; ch < buffers.length; ch++) {
        const channel = input[ch];
        if (!channel) continue;
        buffers[ch]!.set(channel.subarray(blockSize - rem - capacity + offset, blockSize - rem), offset);
        buffers[ch]!.set(channel.subarray(blockSize - rem));
      }
    } else {
      for (let ch = 0; ch < buffers.length; ch++) {
        const channel = input[ch];
        if (!channel) continue;
        buffers[ch]!.set(channel, writePos);
      }
      writePos = (writePos + blockSize) % capacity;
    }
    Atomics.store(this.buffers.writePos, 0, writePos);
    return true;
  }
}

registerProcessor('sample-collector', SampleCollector);