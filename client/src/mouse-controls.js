const TURN_EDGE = 12;
const EDGE_TURN_PIXELS_PER_SECOND = 520;

export function bindMouseControls({canvas, doc, active, aim, charge, release, tap, cancel, capture, now=()=>performance.now()}) {
  let cursor = null;
  let edgeTurn = 0;
  let leftDown = false;
  let lastRelease = -Infinity;

  function resetCursor() {
    cursor = null;
    edgeTurn = 0;
  }

  canvas.addEventListener('mouseenter', event => {
    if (active() && doc.pointerLockElement !== canvas) {
      cursor = { x: event.clientX, y: event.clientY };
    }
  });
  canvas.addEventListener('mouseleave', resetCursor);
  doc.addEventListener('pointerlockchange', resetCursor);
  canvas.addEventListener('mousemove', event => {
    if (!active() || doc.pointerLockElement === canvas) return;
    const next = { x: event.clientX, y: event.clientY };
    if (cursor) {
      const dx = next.x - cursor.x;
      const dy = next.y - cursor.y;
      if (dx || dy) aim(dx, dy);
      // Continue a turn when the visible cursor has reached the canvas edge.
      const direction = Math.sign(dx) || edgeTurn;
      if (direction === -1 && event.offsetX <= TURN_EDGE) {
        edgeTurn = -1;
      } else if (direction === 1 && event.offsetX >= canvas.clientWidth - TURN_EDGE) {
        edgeTurn = 1;
      } else {
        edgeTurn = 0;
      }
    }
    cursor = next;
  });

  canvas.addEventListener('mousedown', event => {
    if (!active() || event.button !== 0) return;
    leftDown = true;
    if (doc.pointerLockElement !== canvas) capture?.();
    charge();
    event.preventDefault();
    canvas.focus({ preventScroll: true });
  });

  doc.addEventListener('mousemove', event => {
    if (!active()) return;
    if (leftDown && !(event.buttons & 1)) {
      leftDown = false;
      lastRelease = now();
      cancel();
    }
    if (doc.pointerLockElement === canvas) {
      aim(event.movementX || 0, event.movementY || 0);
    }
  });

  doc.addEventListener('mouseup', event => {
    if (event.button !== 0 || !leftDown) return;
    leftDown = false;
    lastRelease = now();
    if (active()) release();
  });

  // Click-only input is a short throw. A mouseup already handled the normal click.
  canvas.addEventListener('click', event => {
    if (active() && event.button === 0 && !leftDown && now()-lastRelease > 400) tap();
  });
  canvas.addEventListener('contextmenu', event => {
    if (active()) event.preventDefault();
  });

  return {
    advance(dt) {
      if (edgeTurn && active() && doc.pointerLockElement !== canvas) {
        aim(edgeTurn * EDGE_TURN_PIXELS_PER_SECOND * dt, 0);
      }
    },
    reset() {
      resetCursor();
      leftDown = false;
    },
  };
}
