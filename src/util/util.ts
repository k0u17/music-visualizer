export function animate(draw: (deltaTime: number) => void) {
  let then = performance.now();
  let requestId = window.requestAnimationFrame(loop);
  function loop(now: number) {
    requestId = window.requestAnimationFrame(loop);
    const deltaTime = now - then;
    then = now;
    draw(deltaTime);
  }
  return () => window.cancelAnimationFrame(requestId);
}

export function deferredCallback<T extends unknown[]>(
  callbackPromise: Promise<(...args: T) => void>
): (...args: T) => void {
  let callback: ((...args: T) => void) | null = null;
  const pendingCalls: T[] = [];
  callbackPromise.then(cb => {
    callback = cb;
    for (const args of pendingCalls) {
      callback(...args);
    }
    pendingCalls.length = 0;
  });
  return (...args) => {
    if (callback)
      callback(...args);
    else
      pendingCalls.push(args);
  }
}