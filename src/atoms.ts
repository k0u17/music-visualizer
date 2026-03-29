import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const audioFileAtom = atom<File | null>(null);
export const loopAtom = atomWithStorage('loop', false);
export const volumeAtom = atomWithStorage('volume', 0.5);
