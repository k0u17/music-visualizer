import * as React from 'react';
import { useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import clsx from 'clsx';
import {
  audioFileAtom,
  loopAtom,
  volumeAtom
} from '../atoms.ts';
import FolderOpenIcon from '../assets/folder-open.svg?react';
import PauseIcon from '../assets/pause.svg?react';
import PlayIcon from '../assets/play.svg?react';
import RepeatIcon from '../assets/repeat.svg?react';
import VolumeIcon from '../assets/volume.svg?react';
import VolumeLowIcon from '../assets/volume-low.svg?react';
import VolumeMuteIcon from '../assets/volume-mute.svg?react';
import {
  useAudioController,
  useCurrentTime,
  useDuration,
  useHasLoaded,
  useIsLoading,
  useIsPlaying,
} from '../audio-controller.ts';
import { Scrubber } from './Scrubber.tsx';
import { Title } from './Title.tsx';

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
        "disabled:opacity-30 disabled:pointer-events-none",
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
  );
}

function FileSelector() {
  const isLoading = useIsLoading();
  const setAudioFile = useSetAtom(audioFileAtom);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        ref={inputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files![0];
          if (file) {
            setAudioFile(file);
            e.target.value = '';
          }
        }}
      />
      <Button
        disabled={isLoading}
        onClick={() => inputRef.current?.click()}
      >
        <FolderOpenIcon />
      </Button>
    </div>
  );
}

function PlayButton() {
  const ac = useAudioController();
  const hasLoaded = useHasLoaded();
  const playing = useIsPlaying();

  return (
    <Button
      className="bg-white! text-black! hover:text-neutral-600! rounded-full! shrink-0!"
      onClick={() => playing ? ac.pause() : ac.play()}
      disabled={!hasLoaded}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </Button>
  );
}

function LoopButton() {
  const hasLoaded = useHasLoaded();
  const [loop, setLoop] = useAtom(loopAtom);
  return (
    <Button
      className={loop ? "opacity-100! text-sky-500! hover:text-sky-400! active:text-sky-400!" : ""}
      onClick={() => setLoop(!loop)}
      disabled={!hasLoaded}
    >
      <RepeatIcon />
    </Button>
  );
}

function Time({ seconds }: { seconds: number }) {
  let text;
  if (isNaN(seconds) || !isFinite(seconds)) {
    text = '--:--';
  } else {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    text = `${min}:${sec.toString().padStart(2, '0')}`;
  }
  return (
    <span className="text-xs text-neutral-400 tabular-nums min-w-8.75 text-center">
      {text}
    </span>
  );
}

function CurrentTime() {
  const currentTime = useCurrentTime();
  return <Time seconds={currentTime} />;
}

function Duration() {
  const duration = useDuration();
  return <Time seconds={duration} />;
}

function VolumeController() {
  const step = 0.01;
  const hasLoaded = useHasLoaded();
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
          step={step}
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

export function BottomBar() {
  return (
    <div className={clsx(
      "bg-neutral-900 border-t border-t-neutral-800 border-solid flex flex-col gap-2 p-4 z-10",
    )}>
      <div className="grid grid-cols-3 items-center">
        <div className="flex items-center justify-start gap-4">
          <FileSelector />
          <Title />
        </div>
        <div className="flex items-center justify-center gap-4">
          <PlayButton />
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
