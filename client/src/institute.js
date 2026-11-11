import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { config } from '../../shared/physics.js';
import { summit,towerTracks } from '../../shared/tower.js';

// Set pieces stay outside the collision boundary or above the jump envelope.
// Walkable decks themselves are built from the shared collision data.
export function buildInstitute({scene,lab,glow,bone,material,sign,plate,attach,
  layouts,towerLevels,levelHeight,roomX,roomZ,gallerySeats}){
  const steel='#526e7b',dark='#1e3545',ivory='#d5dfd8';
  const cylinder=(name,x,y,z,height,diameter,hex,top=diameter)=>{
    const mesh=MeshBuilder.CreateCylinder(name,{height,diameterTop:top,diameterBottom:diameter,tessellation:16},scene);
    mesh.position.set(x,y,z);mesh.material=material(hex);mesh.isPickable=false;return mesh;
  };
  const hoop=(name,x,y,z,diameter,thickness,hex,vertical=false)=>{
    const mesh=MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:48},scene);
    mesh.position.set(x,y,z);mesh.material=material(hex);mesh.isPickable=false;
    if(vertical)mesh.rotation.x=Math.PI/2;
    return mesh;
  };
  const banner=(text,tint,x,y,z,width=12,yaw=0)=>plate(sign(text,tint),width,width/5,x,y,z,yaw);
  const fixture=(x,y,z,tint)=>{
    cylinder('lámpara-de-examen',x,y,z,.45,4.7,steel,3.7);
    cylinder('difusor-de-examen',x,y-.26,z,.08,4.25,ivory);
    hoop('bisel-de-examen',x,y-.33,z,4.35,.12,tint);
    for(const [dx,dz] of [[0,0],[-1.1,0],[1.1,0],[0,-1.1],[0,1.1]]){
      const lens=cylinder('lente-de-examen',x+dx,y-.34,z+dz,.05,.56,tint);
      lens.material=material(tint,true);
    }
  };

  // Six vast observation chambers give scale to the climb without solid pillars
  // beneath the floating trays. A differently shaped landmark marks each chamber.
  for(const [index,section] of config.race.sections.entries()){
    const base=index*levelHeight,root=towerLevels[index],tint=section.color;
    attach(root,()=>{
      const y=base+12;
      for(const side of [-1,1]){
        const z=side*(config.depth/2+4.8);
        lab('galería-suspendida',[41,1.25,6.6],[0,y,z],steel);
        lab('caja-de-observación',[41,8,.7],[0,y+4.5,z+side*3.1],dark);
        lab('friso-marfil',[41,1.4,.35],[0,y+8.1,z+side*2.8],section.shell);
        lab('baranda-de-palco',[40,.13,.15],[0,y+2,z-side*3.3],ivory);
        glow('luz-de-palco',[40,.12,.1],[0,y-.48,z-side*3.35],tint);
        for(const x of [-19,-12,-5,5,12,19]){
          lab('marco-de-ventanal',[.28,7.2,.65],[x,y+4.4,z-side*2.8],steel);
          lab('mesa-de-observación',[3,.12,1],[x,y+1.45,z-side*1.85],ivory);
          gallerySeats.push({x,y:y+.6,z:z-side*.9});
        }
        banner(String(index+1).padStart(2,'0')+' / '+section.name,tint,0,y+6.3,z-side*3.2,21,side>0?Math.PI:0);
        // Side bays and cross braces extend to the ceiling: the world no longer
        // ends just above the first floor of the tower.
        for(const x of [-roomX,roomX]){
          lab('nervio-monumental',[1.8,levelHeight,2],[x,base+levelHeight/2,z],steel);
          lab('panel-de-céramica',[7,levelHeight-3,.6],[x-side*3.5,base+levelHeight/2,z],section.shell);
          glow('baliza-vertical',[.14,levelHeight-5,.1],[x,base+levelHeight/2,z-side*1.06],tint);
        }
        for(const x of [-29,29]){
          bone('arriostramiento',[x,base+1,z],[x*.65,base+levelHeight-1,z],.19,steel);
        }
      }
      // Service trusses sit behind the playable boundary.
      for(const side of [-1,1]){
        const x=side*(config.width/2+4);
        lab('costado-del-instituto',[.8,levelHeight,config.depth+12],[x+side*7,base+levelHeight/2,0],dark);
        for(const z of [-26,-13,0,13,26]){
          lab('contrafuerte',[2.2,levelHeight,1.6],[x,base+levelHeight/2,z],section.shell);
          glow('ranura-de-servicio',[.1,levelHeight*.7,.15],[x-side*1.14,base+levelHeight*.53,z],tint);
        }
      }
      // Surgical islands have overhead booms, archive stacks, conduits and scanners.
      if(section.kind==='theatre'||section.kind==='crown'){
        for(const side of [-1,1]){
          fixture(side*28,base+21,side*6,tint);
          bone('brazo-quirúrgico',[side*28,base+21.5,side*6],[side*34,base+27,side*6],.24,ivory);
          bone('brazo-quirúrgico',[side*34,base+27,side*6],[side*40,base+27,side*6],.24,steel);
        }
      }else if(section.kind==='archive'){
        for(const side of [-1,1])for(let i=0;i<5;i++){
          const x=side*(40+i%2*3),z=(i-2)*8;
          lab('archivo-monumental',[3.6,16,5.8],[x,base+15,z],section.shell);
          for(let row=0;row<5;row++){
            lab('fichero',[3.1,2.4,.08],[x,base+8+row*2.8,z-2.94],steel);
            glow('tirador-clínico',[.85,.12,.1],[x,base+8+row*2.8,z-3.02],tint);
          }
        }
      }else if(section.kind==='pipes'){
        for(const side of [-1,1])for(const z of [-20,0,20]){
          cylinder('depósito-de-perfusión',side*40,base+16,z,18,4.8,section.shell,4.8);
          for(const h of [base+8,base+24])hoop('abrazadera',side*40,h,z,4.9,.26,steel);
          bone('tubería-de-retorno',[side*40,base+25,z],[side*47,base+28,z],.36,tint);
          glow('visor-de-nivel',[.15,11,.15],[side*37.5,base+16,z],tint);
        }
      }else if(section.kind==='scanner'){
        for(const side of [-1,1]){
          hoop('resonador-gigante',0,base+17,side*36,19,2.3,ivory,true);
          hoop('anillo-de-resonancia',0,base+17,side*34.8,16.8,.24,tint,true);
          lab('base-del-resonador',[19,2.2,5],[0,base+6.5,side*36],steel);
        }
      }else{
        for(const side of [-1,1]){
          const x=side*41;
          lab('cabina-del-observatorio',[7.2,11,15],[x,base+18,0],section.shell);
          lab('ventana-panorámica',[.14,7.2,12.5],[x-side*3.68,base+19,0],dark);
          glow('retícula-de-observación',[.17,.14,12.5],[x-side*3.77,base+19,0],tint);
          for(const z of [-4,0,4])lab('montante-del-observatorio',[.18,7.2,.18],[x-side*3.8,base+19,z],ivory);
        }
      }
      // Overhead route gates at safe clearances are visible from the preceding landings.
      for(const track of towerTracks){
        const pad=track[index*config.race.stepsPerSection+10];
        banner(section.name,tint,pad.x,pad.h+7,pad.z,7.5);
      }
    });
  }

  attach(layouts.race,()=>{
    const y=summit.h+13;
    lab('plafón-de-la-cúpula',[roomX*2+16,1,roomZ*2+12],[0,y+4,0],ivory);
    for(const radius of [9,18,29]){
      const ring=hoop('lucernario-de-coronación',0,y,0,radius*2,.32,'#ffe0ab');
      ring.material=material('#ffe0ab',true);
    }
    for(const side of [-1,1]){
      banner('ALTA / SUJETO IMPROBABLE','#ffe0ab',0,summit.h+6,side*9,14,side>0?Math.PI:0);
    }
  });

  // Compact sibling arena: a central theatre, a raised observation loop,
  // two examination stages and equipment bays. No floating clutter above fights.
  attach(layouts.eliminations,()=>{
    for(const side of [-1,1]){
      const x=side*18,z=side*9;
      fixture(x,12,z,'#bbf0e8');
      bone('potence-opératoire',[x,12.5,z],[side*29,19,z],.18,ivory);
      bone('potence-opératoire',[side*29,19,z],[side*38,19,z],.18,steel);
      banner('EXAMEN '+(side<0?'A':'B'),'#d7f0e4',x,9.5,z+side*6,9,side>0?Math.PI:0);
      banner('GALERÍA / FLANCO','#eac795',0,9,side*22,12,side>0?Math.PI:0);
      const ring=hoop('marca-de-examen',x,1.67,z,4.4,.035,'#e7ce9e');
      ring.material=material('#e7ce9e',true);
      // Giant medical scanners outside the glass serve as arena landmarks.
      hoop('escáner-de-arena',side*(config.width/2+9),10,0,12,1.7,ivory,true);
      for(const end of [-1,1]){
        cylinder('réservoir-de-servicio',side*39,5,end*25,10,3.8,steel);
        hoop('depósito-anillo',side*39,8,end*25,3.9,.2,'#92cbc6');
      }
    }
  });
}
