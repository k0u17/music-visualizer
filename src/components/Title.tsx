import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'jotai';
import { parseBlob } from 'music-metadata';
import { audioFileAtom } from '../atoms.ts';
import { useIsPlaying } from '../audio-controller.ts';

const NO_MUSIC_TITLE = 'NO MUSIC';

function useTrackTitle() {
  const store = useStore();
  const [title, setTitle] = useState(NO_MUSIC_TITLE);

  useEffect(() => {
    function updateTitle() {
      const audioFile = store.get(audioFileAtom);
      if (!audioFile) {
        setTitle(NO_MUSIC_TITLE);
        return;
      }
      function getAudioFileName(audioFile: File | null) {
        if (!audioFile) return NO_MUSIC_TITLE;
        const name = audioFile.name;
        const dotIndex = name.lastIndexOf('.');
        return dotIndex !== -1 ? name.substring(0, dotIndex) : name;
      }
      parseBlob(audioFile)
        .then(meta => {
          if (store.get(audioFileAtom) === audioFile)
            setTitle(meta.common.title ?? getAudioFileName(audioFile));
        })
        .catch(() => {
          if (store.get(audioFileAtom) === audioFile)
            setTitle(getAudioFileName(audioFile));
        });
    }
    updateTitle();
    return store.sub(audioFileAtom, updateTitle);
  }, []);

  return title;
}

function useScrollingTitleAnimation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  textRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  title: string
) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    let animation: Animation | null = null;
    const updateKeyframes = () => {
      animation?.cancel();
      const containerWidth = container.getBoundingClientRect().width;
      const textWidth = text.scrollWidth;
      const pauseTime = 2.0; // s
      const scrollRate = 0.015; // s/px
      const keyframes: (Keyframe & { offset: number })[] = [
        { transform: 'translateX(0)', offset: pauseTime },
        { transform: `translateX(-${textWidth}px)`, offset: textWidth * scrollRate + pauseTime },
        { transform: `translateX(${containerWidth}px)`, offset: textWidth * scrollRate + pauseTime },
        { transform: `translateX(${containerWidth}px)`, offset: textWidth * scrollRate + pauseTime + 0.5 },
        { transform: 'translateX(0)', offset: (textWidth + containerWidth) * scrollRate + pauseTime + 0.5 },
      ];
      const duration = keyframes[keyframes.length - 1]!.offset;
      keyframes.forEach(frame => {
        frame.offset /= duration;
      });
      animation = text.animate(keyframes, {
        duration: duration * 1000,
        iterations: Infinity,
        easing: 'linear',
      });
    };
    updateKeyframes();
    const observer = new ResizeObserver(updateKeyframes);
    observer.observe(container);
    return () => {
      animation?.cancel();
      observer.disconnect();
    };
  }, [enabled, title]);
}

export function Title() {
  const playing = useIsPlaying();
  const title = useTrackTitle();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useScrollingTitleAnimation(containerRef, textRef, playing, title);

  return (
    <div className="min-w-0 w-full">
      <div ref={containerRef} className="w-2/3 overflow-clip flex">
        <div ref={textRef} className="text-sm text-neutral-100 whitespace-nowrap">{title}</div>
      </div>
    </div>
  );
}
