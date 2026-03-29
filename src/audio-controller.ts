import sampleCollectorWorkerUrl from './sample-collector.ts?worker&url';
import type { SharedRingBuffersState } from './sample-collector.ts';
import { createContext, useContext, useSyncExternalStore } from 'react';

const CAPACITY = 1 << 16;

export interface SampleRingBuffer {
  readonly channelCount: number;
  readonly writePos: number;
  buffer(channel: number): Float32Array | undefined;
}

class SampleRingBufferImpl implements SampleRingBuffer {

  readonly buffers: Float32Array[];
  readonly writePosBuffer: Int32Array;

  constructor(readonly channelCount: number) {
    const rawBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT * CAPACITY * this.channelCount);
    this.buffers = [];
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.buffers.push(new Float32Array(rawBuffer, Int32Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT * CAPACITY * ch, CAPACITY));
    }
    this.writePosBuffer = new Int32Array(rawBuffer, 0, 1);
  }

  get writePos() {
    return Atomics.load(this.writePosBuffer, 0);
  }

  buffer(channel: number) {
    return this.buffers[channel];
  }
}

export class AudioController {
  private readonly ctx: AudioContext;
  private readonly audio: HTMLAudioElement;
  private readonly gain: GainNode;
  readonly sampleBuffer: SampleRingBuffer;
  private currentObjectUrl: string | null = null;
  private loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

  constructor(parent: Node) {
    this.audio = document.createElement('audio');
    this.audio.style.display = 'none';
    parent.appendChild(this.audio);
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaElementSource(this.audio);
    this.gain = this.ctx.createGain();
    const buffer = new SampleRingBufferImpl(source.channelCount);
    this.sampleBuffer = buffer;
    source.connect(this.gain).connect(this.ctx.destination);
    this.ctx.audioWorklet.addModule(sampleCollectorWorkerUrl).then(() => {
      const sampleCollector = new AudioWorkletNode(this.ctx, 'sample-collector');
      const msg: SharedRingBuffersState = {
        buffers: buffer.buffers,
        writePos: buffer.writePosBuffer
      };
      sampleCollector.port.postMessage(msg);
      source.connect(sampleCollector);
    });
    this.audio.addEventListener('loadstart', () => {
      this.loadState = 'loading';
    });
    this.audio.addEventListener('loadeddata', () => {
      this.loadState = 'ready';
    });
    this.audio.addEventListener('error', () => {
      this.loadState = 'error';
    });
    this.audio.addEventListener('emptied', () => {
      this.loadState = 'idle';
    });
  }

  listenTo(listeners: Partial<Record<keyof HTMLMediaElementEventMap, () => void>>): () => void {
    for (const [event, handler] of Object.entries(listeners))
      this.audio.addEventListener(event, handler);
    return () => {
      for (const [event, handler] of Object.entries(listeners))
        this.audio.removeEventListener(event, handler);
    };
  }

  load(file: File) {
    if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    this.currentObjectUrl = URL.createObjectURL(file);
    this.audio.src = this.currentObjectUrl;
    this.audio.load();
  }

  play() {
    if (this.ctx.state === 'suspended')
      this.ctx.resume();
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  set volume(value: number) {
    this.gain.gain.value = value;
  }

  set loop(value: boolean) {
    this.audio.loop = value;
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get duration(): number {
    return this.audio.duration;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  set currentTime(value: number) {
    this.audio.currentTime = value;
  }

  get playbackRate(): number {
    return this.audio.playbackRate;
  }

  set playbackRate(value: number) {
    this.audio.playbackRate = value;
  }

  get isLoading(): boolean {
    return this.loadState === 'loading';
  }

  get hasLoaded(): boolean {
    return this.loadState === 'ready';
  }

  // Setters to clarify the intent of the imperative operations and avoid confusion with state value mutations in React.
  seek(value: number) {
    this.currentTime = value;
  }

  setPlaybackRate(value: number) {
    this.playbackRate = value;
  }
}

export const AudioControllerContext = createContext<AudioController | null>(null);

export function useAudioController(): AudioController {
  return useContext(AudioControllerContext)!;
}

export function useACState<T>(
  selector: (ac: AudioController) => T,
  events: (keyof HTMLMediaElementEventMap)[]
): T {
  const ac = useAudioController();
  return useSyncExternalStore(
    onStoreChange =>
      ac.listenTo(
        Object.fromEntries(
          events.map(event => [event, onStoreChange])
        )
      ),
    () => selector(ac),
    () => selector(ac),
  );
}

export function useIsPlaying(): boolean {
  return useACState(ac => !ac.paused, ['play', 'pause', 'emptied']);
}

export function useCurrentTime(): number {
  return useACState(ac => ac.currentTime, ['timeupdate', 'emptied']);
}

export function useDuration(): number {
  return useACState(ac => ac.duration, ['loadedmetadata', 'emptied']);
}

export function useIsLoading(): boolean {
  return useACState(ac => ac.isLoading, ['loadstart', 'loadeddata', 'error', 'emptied']);
}

export function useHasLoaded(): boolean {
  return useACState(ac => ac.hasLoaded, ['loadstart', 'loadeddata', 'error', 'emptied']);
}
