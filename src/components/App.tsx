import { AudioController, AudioControllerContext } from '../audio-controller.ts';
import { BottomBar } from './BottomBar.tsx';
import { DropZone } from './DropZone.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';
import { Visualizer } from './Visualizer.tsx';

export default function App({ audioController }: { audioController: AudioController }) {
  return (
    <AudioControllerContext.Provider value={audioController}>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <LoadingScreen />
        <DropZone>
          <Visualizer />
        </DropZone>
        <BottomBar />
      </div>
    </AudioControllerContext.Provider>
  );
}
