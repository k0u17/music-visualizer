import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useAtom, useStore } from 'jotai';
import clsx from 'clsx';
import {
  isLoadingAtom,
  hasLoadedAtom,
  isLoopingAtom,
  isPlayingAtom,
  volumeAtom,
  currentTimeAtom,
  durationAtom,
  isScrubberBeingDraggedAtom, isActuallyPlayingAtom
} from './atoms';
import {
  type Gradient,
  gradientToCSS,
  scaleGradient,
  repeatGradient,
  shiftGradient, normalizeGradient
} from './util/gradient-util';

import FolderOpenIcon from './assets/folder-open.svg?react';
import PlayIcon from './assets/play.svg?react';
import PauseIcon from './assets/pause.svg?react';
import RepeatIcon from './assets/repeat.svg?react';
import VolumeMuteIcon from './assets/volume-mute.svg?react';
import VolumeLowIcon from './assets/volume-low.svg?react';
import VolumeIcon from './assets/volume.svg?react';

function LoadingScreen() {
  const [isLoading] = useAtom(isLoadingAtom);
  return (
    <div className={clsx(
      "absolute top-0 left-0 w-full h-full z-50 flex flex-col items-center justify-center",
      "transition-all duration-200",
      isLoading ? "opacity-100 pointer-events-auto backdrop-blur-xs" : "opacity-0 pointer-events-none backdrop-blur-none"
    )}>
      <svg
        className={clsx(
          "w-10 h-10 mb-2.5 text-sky-400",
          "origin-center animate-spin [animation-duration:1.5s]"
        )}
        viewBox="0 0 50 50"
      >
        <circle
          className="stroke-current animate-[stretch_1.5s_ease-in-out_infinite] [stoke-linecap:round]"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="5"
        ></circle>
      </svg>
      <p>Loading...</p>
    </div>
  );
}

interface ButtonProps {
  width?: number,
  height?: number,
  disabled?: boolean,
  className?: string,
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  children?: React.ReactNode
}

function Button(
  {
    width = 32,
    height = 32,
    disabled = false,
    className,
    onClick,
    children
  }: ButtonProps
) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "p-0 flex items-center justify-center",
        "bg-transparent border-none text-neutral-400",
        "transition-all ease-in-out duration-200",
        "select-none cursor-pointer",
        "hover:text-white hover:scale-105",
        "active:text-white active:scale-95",
        "disabled:opacity-30 disabled:cursor-default",
        "disabled:hover:transform-none disabled:hover:text-neutral-400",
        className,
      )}
      style={
        {
          width: `${width}px`,
          height: `${height}px`
        }
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function FileSelector() {
  const [isLoading] = useAtom(isLoadingAtom);
  return (
    <Button disabled={isLoading}>
      <FolderOpenIcon />
    </Button>
  );
}

function PlaybackButton() {
  const [hasLoaded] = useAtom(hasLoadedAtom)
  const [isPlaying, setPlaying] = useAtom(isPlayingAtom);
  return (
    <Button
      className="bg-white! text-black! hover:text-neutral-600! rounded-full! shrink-0!"
      onClick={() => setPlaying(!isPlaying)} disabled={!hasLoaded}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </Button>
  )
}

function LoopButton() {
  const [hasLoaded] = useAtom(hasLoadedAtom);
  const [isLooping, setLooping] = useAtom(isLoopingAtom);
  return (
    <Button
      className={isLooping ? "opacity-100! text-sky-500! hover:text-sky-400! active:text-sky-400!" : ""}
      onClick={() => setLooping(!isLooping)}
      disabled={!hasLoaded}
    >
      <RepeatIcon />
    </Button>
  );
}

interface TimeProps {
  seconds: number
}

function Time({ seconds }: TimeProps) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return (
    <span className="text-xs text-neutral-400 tabular-nums min-w-8.75 text-center">
      {`${min}:${sec.toString().padStart(2, '0')}`}
    </span>
  );
}

function CurrentTime() {
  const [currentTime] = useAtom(currentTimeAtom);
  return <Time seconds={currentTime} />;
}

function Duration() {
  const [duration] = useAtom(durationAtom);
  return <Time seconds={duration} />;
}

function Scrubber() {
  const [hasLoaded] = useAtom(hasLoadedAtom);
  const [duration] = useAtom(durationAtom);
  const [, setScrubberBeingDragged] = useAtom(isScrubberBeingDraggedAtom);
  const [isPlaying] = useAtom(isPlayingAtom);
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);

  const store = useStore();
  const offsetRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    offsetRef.current = 0;
  }, [isPlaying]);

  useEffect(() => {

    const animationSpeed = 0.15 // px/ms
    const gradientSize = 200;
    const gradient = normalizeGradient([
      'var(--color-sky-500)',
      ['var(--color-sky-400)', 0.3],
      ['var(--color-sky-300)', 0.5],
      ['var(--color-sky-400)', 0.7],
      'var(--color-sky-500)'
    ]);

    function updateBackground(deltaTime: number) {
      const elem = inputRef.current;
      if (!elem) return;
      const progress = store.get(currentTimeAtom) / store.get(durationAtom);
      const speed = store.get(isActuallyPlayingAtom) ? animationSpeed : 0;
      const width = elem.clientWidth;
      const progressPx = width * progress;
      const offset = (offsetRef.current + speed * deltaTime) % gradientSize;
      offsetRef.current = offset;
      let background: Gradient;
      if (store.get(isPlayingAtom)) {
        const repeated = repeatGradient(
          scaleGradient(
            shiftGradient(gradient, offset / gradientSize),
            gradientSize / progressPx
          )
        );
        background = scaleGradient(repeated, progress);
      } else {
        background = [['var(--color-sky-500)', progress]];
      }
      background.push(['var(--color-neutral-600)', progress]);
      elem.style.setProperty('--slider-fill', gradientToCSS(background, { direction: 'to right' }));
    }

    let then = performance.now();
    function animate(now: number) {
      requestRef.current = window.requestAnimationFrame(animate);
      const deltaTime = now - then;
      then = now;
      updateBackground(deltaTime);
    }

    requestRef.current = window.requestAnimationFrame(animate);
    return () => {
      const handle = requestRef.current;
      if (handle) window.cancelAnimationFrame(handle);
    };
  }, [store]);

  return (
    <div className="w-full flex justify-center relative">
      <div // glow
        className={clsx(
          "absolute top-0 left-0 h-full pointer-events-none",
          "[box-shadow:0_0_8px_var(--color-sky-300)]"
        )}
        style={{
          width: `${currentTime / duration * 100}%`,
          opacity: isPlaying ? 1 : 0
        }}
      />
      <input
        ref={inputRef}
        type="range"
        className={clsx(
          "custom-slider m-0 w-full",
        )}
        min="0"
        max={duration}
        step="0.01"
        value={currentTime}
        onChange={
          e => {
            const newTime = parseFloat(e.target.value);
            setCurrentTime(newTime);
          }
        }
        onMouseDown={() => setScrubberBeingDragged(true)}
        onMouseUp={() => setScrubberBeingDragged(false)}
        disabled={!hasLoaded}
      />
    </div>
  );
}

function VolumeController() {
  const step = 0.01;
  const [hasLoaded] = useAtom(hasLoadedAtom);
  const [volume, setVolume] = useAtom(volumeAtom);
  const prevVolumeRef = useRef(step);
  return (
    <div className={clsx(
      "relative flex items-center justify-center group",
      "after:content-[''] after:absolute after:bottom-full after:left-0 after:w-full after:h-2 after:bg-transparent",
      "after:hidden hover:after:block",
      !hasLoaded && "pointer-events-none"
    )}>
      <div className={clsx(
        "absolute left-1/2 bottom-full p-[10px_4px] w-7 h-35 z-40",
        "-translate-x-1/2 translate-y-2.5",
        "group-hover:-translate-x-1/2 group-hover:-translate-y-2.5",
        "flex items-center justify-center",
        "bg-neutral-900 border border-solid border-neutral-800 rounded-lg shadow-[0_4px_15px] shadow-black/50",
        "transition-all delay-100 duration-200 ease-out",
        "opacity-0 invisible pointer-events-none",
        "group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto",

        "after:content-[''] after:absolute",
        "after:-bottom-1.25 after:left-1/2 after:-translate-x-1/2 after:rotate-45 after:w-2.5 after:h-2.5",
        "after:bg-neutral-900 after:border-r after:border-b after:border-solid after:border-neutral-800"
      )}>
        <input
          type="range"
          className={clsx(
            "custom-slider vertical m-0 w-1 h-30"
          )}
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={
            e => {
              const newVolume = parseFloat(e.target.value);
              if (newVolume === 0) {
                prevVolumeRef.current = step;
              }
              setVolume(newVolume);
            }
          }
          style={
            {
              '--slider-fill': `linear-gradient(to top, #FFF ${volume * 100}%, var(--color-neutral-600) ${volume * 100}%)`
            } as React.CSSProperties
          }
        />
      </div>
      <Button
        onClick={() => {
          if (volume === 0) {
            setVolume(Math.max(prevVolumeRef.current, step));
          } else {
            prevVolumeRef.current = volume;
            setVolume(0);
          }
        }}
        disabled={!hasLoaded}
      >
        {volume === 0 ? <VolumeMuteIcon /> : volume < 0.5 ? <VolumeLowIcon /> : <VolumeIcon />}
      </Button>
    </div>
  );
}

function BottomBar() {
  return (
    <div className={clsx(
      "bg-neutral-900 border-t border-t-neutral-800 border-solid flex flex-col gap-2 p-4 z-10",
    )}>
      <div className="grid grid-cols-3 items-center">
        <div className="flex items-center justify-start gap-4">
          <FileSelector />
        </div>
        <div className="flex items-center justify-center gap-4">
          <PlaybackButton />
          <LoopButton />
          <div className="flex items-center gap-2 mt-0 w-full mx-4">
            <CurrentTime />
            <Scrubber />
            <Duration />
          </div>
          <VolumeController />
        </div>
      </div>
    </div>
  );
}

function Visualizer() {
  return (
    <div
      ref={container => {
        if (!container) return;
        // TODO
      }}
      className="grow flex items-center justify-center bg-black"
    />
  );
}

export default function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <LoadingScreen />
      <Visualizer />
      <BottomBar />
    </div>
  );
}