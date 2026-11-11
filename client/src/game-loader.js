// Imports cannot be cancelled by the browser. Reject promptly on cancellation
// and dispose any world that finishes building after its caller has left.
export function waitForLoad(pending, signal, disposeLate) {
  return new Promise((resolve, reject) => {
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      reject(signal.reason ?? new DOMException('Carga cancelada', 'AbortError'));
    };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    Promise.resolve(pending).then(value => {
      signal?.removeEventListener('abort', cancel);
      if (cancelled) disposeLate?.(value);
      else resolve(value);
    }, error => {
      signal?.removeEventListener('abort', cancel);
      if (!cancelled) reject(error);
    });
  });
}

export async function loadGameWorld(canvas, updateMouse, options) {
  options.onProgress?.('Cargando el motor del juego…');
  const { createWorld } = await waitForLoad(import('./world.js'), options.signal);
  options.signal?.throwIfAborted();
  return waitForLoad(
    createWorld(canvas, updateMouse, options.quality, options),
    options.signal,
    world => world.dispose(),
  );
}
