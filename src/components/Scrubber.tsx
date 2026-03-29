import type * as React from 'react';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
  type AudioController,
  useAudioController,
  useCurrentTime,
  useDuration,
  useHasLoaded,
  useIsPlaying,
} from '../audio-controller.ts';
import {
  type Gradient,
  type GradientStop,
  stopsIntoGradient,
  gradientToCSS,
  normalizeGradient,
  repeatGradient,
  scaleGradient,
  shiftGradient,
} from '../util/gradient-util.ts';
import { animate } from '../util/util.ts';

function getScrubberFillGradient({
  gradient,
  gradientSize,
  progress,
  width,
  offset,
  paused,
}: {
  gradient: Gradient;
  gradientSize: number;
  progress: number;
  width: number;
  offset: number;
  paused: boolean;
}): Gradient {
  let background: GradientStop[];
  if (paused) {
    background = [['var(--color-sky-500)', progress]];
  } else {
    background = [];
    if (progress > 0) {
      const progressPx = width * progress;
      background.push(...scaleGradient(
        repeatGradient(
          scaleGradient(
            shiftGradient(gradient, offset / gradientSize),
            gradientSize / progressPx
          )
        ),
        progress
      ));
    }
  }
  background.push(['var(--color-neutral-600)', progress]);
  return stopsIntoGradient(background);
}

function useScrubberFillAnimation(
  inputRef: React.RefObject<HTMLInputElement | null>,
  ac: AudioController,
  playing: boolean
) {
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = 0;
  }, [playing]);

  useEffect(() => {
    const animationBaseSpeed = 0.15; // px/ms
    const gradientSize = 200;
    const gradient = normalizeGradient([
      'var(--color-sky-500)',
      ['var(--color-sky-400)', 0.3],
      'var(--color-sky-300)',
      ['var(--color-sky-400)', 0.7],
      'var(--color-sky-500)'
    ]);

    return animate(deltaTime => {
      const elem = inputRef.current;
      if (!elem) return;
      const progress = isNaN(ac.duration) ? 0 : ac.currentTime / ac.duration;
      const speed = !ac.paused ? animationBaseSpeed * ac.playbackRate : 0;
      const width = elem.clientWidth;
      const offset = (offsetRef.current + speed * deltaTime) % gradientSize;
      offsetRef.current = offset;
      const fillGradient = getScrubberFillGradient({
        gradient,
        gradientSize,
        progress,
        width,
        offset,
        paused: ac.paused,
      });
      elem.style.setProperty('--slider-fill', gradientToCSS(fillGradient, { direction: 'to right' }));
    });
  }, []);
}

export function Scrubber() {
  const ac = useAudioController();
  const hasLoaded = useHasLoaded();
  const currentTime = useCurrentTime();
  const duration = useDuration();
  const playing = useIsPlaying();
  const inputRef = useRef<HTMLInputElement>(null);
  const seekingRef = useRef(false);
  useScrubberFillAnimation(inputRef, ac, playing);

  useEffect(() => {
    const restorePlaybackRate = () => {
      if (!seekingRef.current) return;
      seekingRef.current = false;
      ac.setPlaybackRate(1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        restorePlaybackRate();
      }
    };

    window.addEventListener('blur', restorePlaybackRate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', restorePlaybackRate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      restorePlaybackRate();
    };
  }, [ac]);

  return (
    <div className="w-full flex justify-center relative">
      <div
        className={clsx(
          'absolute top-0 left-0 h-full pointer-events-none',
          '[box-shadow:0_0_8px_var(--color-sky-300)]',
          playing ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          width: isNaN(duration) ? 0 : `${(currentTime / duration) * 100}%`
        }}
      />
      <input
        ref={inputRef}
        type="range"
        className={clsx(
          'custom-slider m-0 w-full',
        )}
        min="0"
        max={isNaN(duration) ? 1 : duration}
        step="0.01"
        value={currentTime}
        onChange={e => ac.seek(parseFloat(e.target.value))}
        onPointerDown={() => {
          seekingRef.current = true;
          ac.setPlaybackRate(0);
        }}
        onPointerUp={() => {
          seekingRef.current = false;
          ac.setPlaybackRate(1);
        }}
        onPointerCancel={() => {
          seekingRef.current = false;
          ac.setPlaybackRate(1);
        }}
        disabled={!hasLoaded}
      />
    </div>
  );
}
