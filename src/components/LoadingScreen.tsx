import clsx from 'clsx';
import { useIsLoading } from '../audio-controller.ts';

export function LoadingScreen() {
  const isLoading = useIsLoading();
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
