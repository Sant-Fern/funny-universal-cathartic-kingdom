import config from './arena.json' with { type: 'json' };

export { config };
export function heightAt(x, z) {
  const t = config.terrain;
  return t.waveHeight * Math.sin(x * t.waveX) * Math.cos(z * t.waveZ)
    + t.rippleHeight * Math.sin((x + z) * t.rippleFrequency)
    + t.mounds.reduce((sum,m)=>sum+m.height*Math.exp(-((x-m.x)**2+(z-m.z)**2)/m.radius**2),0);
}
export function platformOffset(obstacle, time) {
  const motion = obstacle.motion;
  return motion ? motion.amplitude * Math.sin(2 * Math.PI * time / motion.period + motion.phase) : 0;
}
export function obstacleAt(obstacle, time) {
  const offset = platformOffset(obstacle, time);
  const top = heightAt(obstacle.x, obstacle.z) + obstacle.h;
  return {
    x: obstacle.x + (obstacle.motion?.axis === 'x' ? offset : 0),
    z: obstacle.z + (obstacle.motion?.axis === 'z' ? offset : 0),
    bottom: top - (obstacle.thickness ?? obstacle.h),
    top,
  };
}
export function bottleStats(kind) {
  return kind === 'heavy' ? config.heavyBottle : config;
}
export function launchVelocity(yaw, pitch, power, kind = 'standard') {
  const angle = Math.max(.12, Math.min(1.2, .56 + pitch));
  const stats = bottleStats(kind);
  const speed = stats.shotMinSpeed + Math.max(0, Math.min(1, power)) * (stats.shotSpeed - stats.shotMinSpeed);
  return { x: Math.sin(yaw) * Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: Math.cos(yaw) * Math.cos(angle) * speed };
}
export function throwOrigin(x, y, z, yaw) {
  return { x: x + Math.cos(yaw) * .3 + Math.sin(yaw) * .35, y: y + config.throwHeight,
    z: z - Math.sin(yaw) * .3 + Math.cos(yaw) * .35 };
}
export function positionAt(origin, velocity, time, kind = 'standard') {
  return { x: origin.x + velocity.x * time, y: origin.y + velocity.y * time - .5 * bottleStats(kind).shotGravity * time * time,
    z: origin.z + velocity.z * time };
}
export function segmentBox(start, end, low, high) {
  let near = 0, far = 1;
  for (const axis of ['x', 'y', 'z']) {
    const d = end[axis] - start[axis];
    if (Math.abs(d) < 1e-9) { if (start[axis] < low[axis] || start[axis] > high[axis]) return null; continue; }
    const a = (low[axis] - start[axis]) / d, b = (high[axis] - start[axis]) / d;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return near;
}
// Same 50 ms collision samples and ballistic equation as the server.
export function trajectory(origin, velocity, kind = 'standard', startTime = 0) {
  const stats = bottleStats(kind);
  const points = [origin], step = 1 / config.tickRate, r = stats.shotRadius;
  for (let t = step; t <= stats.shotLifetime + 1e-6; t += step) {
    const a = points.at(-1), b = positionAt(origin, velocity, t, kind);
    let nearest = 1, collided = false;
    for (const o of config.obstacles) {
      const box = obstacleAt(o, startTime+t);
      let start = a;
      if (o.motion) {
        const delta = platformOffset(o, startTime+t)-platformOffset(o, startTime+t-step);
        start = { ...a, [o.motion.axis]: a[o.motion.axis]+delta };
      }
      const hit = segmentBox(start, b, { x: box.x-o.w/2-r, y: box.bottom-r, z: box.z-o.d/2-r },
        { x: box.x+o.w/2+r, y: box.top+r, z: box.z+o.d/2+r });
      if (hit !== null && hit <= nearest) { nearest = hit; collided = true; }
    }
    if (b.y - r <= heightAt(b.x, b.z)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) {
        const m = (lo+hi)/2, x = a.x+(b.x-a.x)*m, y = a.y+(b.y-a.y)*m, z = a.z+(b.z-a.z)*m;
        if (y-r <= heightAt(x,z)) hi=m; else lo=m;
      }
      if (hi <= nearest) { nearest=hi; collided=true; }
    }
    if (Math.abs(b.x) > config.width/2 || Math.abs(b.z) > config.depth/2) {
      for (const [axis, limit] of [['x',config.width/2], ['z',config.depth/2]]) {
        if (Math.abs(b[axis]) > limit) {
          const hit = ((b[axis] > 0 ? limit : -limit) - a[axis]) / (b[axis]-a[axis]);
          if (hit <= nearest) { nearest = Math.max(0,hit); collided=true; }
        }
      }
    }
    points.push({ x: a.x+(b.x-a.x)*nearest, y: a.y+(b.y-a.y)*nearest, z: a.z+(b.z-a.z)*nearest });
    if (collided) break;
  }
  return points;
}
