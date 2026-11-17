import config from './arena.json' with { type: 'json' };
import { towerObstacles } from './tower.js';

export { config };
export const arenaBounds=mode=>mode==='race'?(config.race.bounds??config):config;
// Lean redirects part of the pogo's spring impulse into horizontal momentum.
export function pogoLaunch(power,leanX=0,leanZ=0){
  const length=Math.hypot(leanX,leanZ),angle=Math.min(1,length)*config.pogo.maxLeanAngle;
  const speed=config.jumpMinSpeed+Math.max(0,Math.min(1,power))*(config.jumpMaxSpeed-config.jumpMinSpeed);
  const lateral=speed*Math.sin(angle)/(length||1);
  return {vx:leanX*lateral,vy:speed*Math.cos(angle),vz:leanZ*lateral};
}
export function pogoMomentum(x,z,age){
  const drag=Math.exp(-config.pogo.airDrag*Math.max(0,age));
  return {x:x*drag,z:z*drag};
}
export function pogoStanceAngles(p){
  const x=p.leanX??p.moveX??0,z=p.leanZ??p.moveZ??0,yaw=p.yaw??0;
  const steer=(p.grounded?config.pogo.maxLeanAngle:.14)/Math.max(1,Math.hypot(x,z));
  return {pitch:steer*(x*Math.sin(yaw)+z*Math.cos(yaw)),roll:-steer*(x*Math.cos(yaw)-z*Math.sin(yaw))};
}
// Balloons follow the same pivot and local X/Z rotations as the character stance.
export function balloonOffsets(p){
  const {pitch,roll}=pogoStanceAngles(p),yaw=p.yaw??0;
  const cx=Math.cos(pitch),sx=Math.sin(pitch),cz=Math.cos(roll),sz=Math.sin(roll);
  const cy=Math.cos(yaw),sy=Math.sin(yaw);
  return config.balloons.targets.map(([x,y,z])=>{
    y-=.03;z-=.52;
    const rx=x*cz-y*sz,ry=x*sz+y*cz;
    const ty=ry*cx-z*sx+.03,tz=ry*sx+z*cx+.52;
    return [rx*cy+tz*sy,ty,-rx*sy+tz*cy];
  });
}
export const arenaObstacles = mode => mode === 'race' ? towerObstacles : config.flatObstacles;
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
export function segmentObstacle(start,end,o,box,margin=0){
  if(o.shape!=='ellipse')return segmentBox(start,end,
    {x:box.x-o.w/2-margin,y:box.bottom-margin,z:box.z-o.d/2-margin},
    {x:box.x+o.w/2+margin,y:box.top+margin,z:box.z+o.d/2+margin});
  const rx=o.w/2+margin,rz=o.d/2+margin,x=(start.x-box.x)/rx,z=(start.z-box.z)/rz;
  const dx=(end.x-start.x)/rx,dz=(end.z-start.z)/rz,a=dx*dx+dz*dz,b=2*(x*dx+z*dz),c=x*x+z*z-1;
  let near=0,far=1;
  if(a<1e-12){if(c>0)return null;}
  else{
    const discriminant=b*b-4*a*c;if(discriminant<0)return null;
    const root=Math.sqrt(discriminant);near=Math.max(near,(-b-root)/(2*a));far=Math.min(far,(-b+root)/(2*a));
  }
  const dy=end.y-start.y;
  if(Math.abs(dy)<1e-12){if(start.y<box.bottom-margin||start.y>box.top+margin)return null;}
  else{
    const y1=(box.bottom-margin-start.y)/dy,y2=(box.top+margin-start.y)/dy;
    near=Math.max(near,Math.min(y1,y2));far=Math.min(far,Math.max(y1,y2));
  }
  return near<=far?near:null;
}
// Same 50 ms collision samples and ballistic equation as the server.
export function trajectory(origin, velocity, kind = 'standard', startTime = 0, obstacles = towerObstacles) {
  const bounds=obstacles===config.flatObstacles?config:arenaBounds('race');
  const stats = bottleStats(kind);
  const points = [origin], step = 1 / config.tickRate, r = stats.shotRadius;
  const reachable = obstacles.filter(o => {
    const top = heightAt(o.x,o.z)+o.h;
    return top-(o.thickness??o.h) <= origin.y+Math.max(0,velocity.y)**2/(2*stats.shotGravity)+r;
  });
  for (let t = step; t <= stats.shotLifetime + 1e-6; t += step) {
    const a = points.at(-1), b = positionAt(origin, velocity, t, kind);
    let nearest = 1, collided = false;
    for (const o of reachable) {
      const top=heightAt(o.x,o.z)+o.h;
      if(top < Math.min(a.y,b.y)-r || top-(o.thickness??o.h) > Math.max(a.y,b.y)+r)continue;
      const box = obstacleAt(o, startTime+t);
      let start = a;
      if (o.motion) {
        const delta = platformOffset(o, startTime+t)-platformOffset(o, startTime+t-step);
        start = { ...a, [o.motion.axis]: a[o.motion.axis]+delta };
      }
      const hit = segmentObstacle(start,b,o,box,r);
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
    if (Math.abs(b.x) > bounds.width/2 || Math.abs(b.z) > bounds.depth/2) {
      for (const [axis, limit] of [['x',bounds.width/2], ['z',bounds.depth/2]]) {
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
