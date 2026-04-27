import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer } from 'music-visualizer-wasm';
import { memory } from 'music-visualizer-wasm/src_rust_bg.wasm';
import { animate, deferredCallback } from '../util/util.ts';
import { type SampleRingBuffer, useAudioController } from '../audio-controller.ts';

const WINDOW_STRIDE = 128;
const WINDOW_SIZE = 2048;
// The number of samples that must be preserved between frames to maintain the WINDOW_SIZE-wide analysis window for the next read.
const OVERLAP_SIZE = WINDOW_SIZE - WINDOW_STRIDE;
// Bound per-frame catch-up work so a temporary backlog does not stall rendering.
const MAX_STEP = 16;

/**
 * Copies a linear per-channel snapshot of the unread audio currently buffered for visualization
 * into `dests`.
 *
 * The copied data is laid out so it can be interpreted as `steps` overlapping `WINDOW_SIZE`
 * sample windows, where adjacent windows start `WINDOW_STRIDE` samples apart.
 *
 * The snapshot may be trimmed in two ways before it is materialized:
 * - if the producer has lapped the consumer, the oldest overwritten samples are discarded
 * - if the backlog spans more than `MAX_STEP` analysis strides, the oldest excess strides are skipped
 *
 * After the copy, `readPos` advances by the bounded number of whole strides for this frame while
 * preserving `OVERLAP_SIZE` samples, so the next call still has enough history to form the next
 * overlapped analysis window.
 */
function readBufferedSamples(buffer: SampleRingBuffer, dests: Float32Array[]): number {
  const writePos = buffer.writePos;
  // Clamp the consumer to the newest window if the producer has already overwritten older samples.
  buffer.readPos = Math.max(buffer.readPos, buffer.writePos - buffer.capacity);
  const bufferedSamples = writePos - buffer.readPos;
  // Count how many analysis windows we can advance while preserving the overlap
  // required for the next WINDOW_SIZE-wide frame.
  let steps = Math.floor(
    Math.max(0, bufferedSamples - OVERLAP_SIZE) / WINDOW_STRIDE
  );
  const overflow = steps - MAX_STEP;
  if (overflow > 0) {
    // Skip the oldest excess strides so we only process a bounded amount this frame.
    steps = MAX_STEP;
    buffer.readPos += overflow*WINDOW_STRIDE;
  }
  if (steps === 0) {
    return 0;
  }
  const wrappedWritePos = writePos % buffer.capacity;
  const wrappedReadPos = buffer.readPos % buffer.capacity;
  if (wrappedWritePos >= wrappedReadPos) {
    // Fast path: unread samples are contiguous in the ring buffer.
    for (let ch = 0; ch < buffer.channelCount; ch++) {
      dests[ch]!.set(buffer.buffer(ch)!.subarray(wrappedReadPos, wrappedWritePos));
    }
  } else {
    // Wrapped path: stitch together the tail and head segments into a linear view per channel.
    for (let ch = 0; ch < buffer.channelCount; ch++) {
      dests[ch]!.set(buffer.buffer(ch)!.subarray(wrappedReadPos, buffer.capacity));
      dests[ch]!.set(buffer.buffer(ch)!.subarray(0, wrappedWritePos), buffer.capacity - wrappedReadPos);
    }
  }
  // Consume only the strides scheduled for this frame; the overlap stays available for the next read.
  buffer.readPos += steps*WINDOW_STRIDE;
  return steps;
}

function useVisualizer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {

  const ac = useAudioController();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopAnimationPromise = Promise.withResolvers<() => void>();
    const onResizePromise = Promise.withResolvers<(width: number, height: number) => void>();
    const stopAnimation = deferredCallback(stopAnimationPromise.promise);
    const onResize = deferredCallback(onResizePromise.promise);

    (async () => {
      try {
        const renderer = await Renderer.create(canvas);
        onResizePromise.resolve((width, height) => renderer.onResize(width, height));
        stopAnimationPromise.resolve(animate(deltaTime => {
          const bufferSize = renderer.sampleBufferSize();
          const bufferL = new Float32Array(memory.buffer, renderer.sampleBufferPtrL(), bufferSize);
          const bufferR = new Float32Array(memory.buffer, renderer.sampleBufferPtrR(), bufferSize);
          const steps = readBufferedSamples(ac.sampleBuffer, [bufferL, bufferR]);
          renderer.render(deltaTime, steps);
        }));
      } catch (err) {
        console.error('Failed to initialize WebGPU renderer:', err);
      }
    })();

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        onResize(width, height);
      }
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      stopAnimation();
    };
  }, []);
}

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useVisualizer(canvasRef);
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full min-w-0 min-h-0"
    />
  );
}
