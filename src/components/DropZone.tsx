import type * as React from 'react';
import { useSetAtom } from 'jotai';
import { audioFileAtom } from '../atoms.ts';

export function DropZone({ children }: { children: React.ReactNode }) {
  const setAudioFile = useSetAtom(audioFileAtom);
  return (
    <div
      className="grow flex min-w-0 min-h-0 items-center justify-center bg-black"
      onDragOver={e => {
        if (!e.dataTransfer) return;
        if ([...e.dataTransfer.items].some(item => item.kind === 'file' && item.type.startsWith('audio/')))
          e.dataTransfer.dropEffect = 'copy';
        else
          e.dataTransfer.dropEffect = 'none';
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={e => {
        if (!e.dataTransfer) return;
        const audioFile = [...e.dataTransfer.items]
          .filter(item => item.kind === 'file' && item.type.startsWith('audio/'))
          .map(item => item.getAsFile())
          .find(file => file != null);
        if (!audioFile) return;
        setAudioFile(audioFile);
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
