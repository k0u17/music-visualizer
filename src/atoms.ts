import { atom } from 'jotai';

export const audioFileAtom = atom<File | null>(null);
export const isLoadingAtom = atom(false);
export const hasLoadedAtom = atom(get => !!get(audioFileAtom));
export const isLoopingAtom = atom(false);
export const isPlayingAtom = atom(false);
export const isScrubberBeingDraggedAtom = atom(false);
export const isActuallyPlayingAtom = atom(get => get(isPlayingAtom) && !get(isScrubberBeingDraggedAtom))
export const volumeAtom = atom(1);
export const currentTimeAtom = atom(10);
export const durationAtom = atom(60);
export const canvasWidthAtom = atom(0);
export const canvasHeightAtom = atom(0);
export const canvasDimsAtom = atom(get => {
  return {
    width: get(canvasWidthAtom),
    height: get(canvasHeightAtom)
  };
})
