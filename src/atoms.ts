import { atom } from 'jotai';

export const isLoadingAtom = atom(false);
export const hasLoadedAtom = atom(true);
export const isLoopingAtom = atom(false);
export const isPlayingAtom = atom(false);
export const isScrubberBeingDraggedAtom = atom(false);
export const isActuallyPlayingAtom = atom(get => get(isPlayingAtom) && !get(isScrubberBeingDraggedAtom))
export const volumeAtom = atom(1);
export const currentTimeAtom = atom(10);
export const durationAtom = atom(60);
