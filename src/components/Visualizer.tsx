import { useEffect, useRef } from 'react';
import { animate, deferredCallback } from '../util/util.ts';

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopAnimationPromise = Promise.withResolvers<() => void>();
    const onResizePromise = Promise.withResolvers<(width: number, height: number) => void>();
    const stopAnimation = deferredCallback(stopAnimationPromise.promise);
    const onResize = deferredCallback(onResizePromise.promise);

    (async () => {
    })();

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        onResize(width, height);
      }
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      stopAnimation();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full min-w-0 min-h-0"
    />
  );
}
