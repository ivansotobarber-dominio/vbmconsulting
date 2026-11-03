import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const material = (color, metalness = 0, roughness = .6) => new THREE.MeshStandardMaterial({color, metalness, roughness});
const M = {
  shell: material('#68716f', .5, .35), dark: material('#202b2c', .45, .4),
  black: material('#141d1e', .2, .42), silver: material('#d1d8d5', .7, .25),
  lens: material('#143d4e', .8, .12), yellow: material('#dedb66', .2, .4),
  concrete: material('#d1d5cc', .06, .83), edge: material('#b7c3ba', .2, .6),
  steel: material('#477d7d', .6, .35), asphalt: material('#4d5857', .05, .95),
  marking: material('#f0f0db', 0, .8), grass: material('#7f9276', 0, .95),
  rock: material('#88918a', 0, .95), soil: material('#b4b5a2', 0, 1),
  water: material('#609fa2', .3, .25), red: material('#b24f3d', .15, .45)
};
function mesh(parent, geometry, mat, xyz = [0,0,0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...xyz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(p, size, pos, mat, radius = 0) {
  return mesh(p, radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size), mat, pos);
}
function cylinder(p, radius, height, pos, mat, top = radius) {
  return mesh(p, new THREE.CylinderGeometry(top, radius, height, 24), mat, pos);
}
function rod(p, a, b, radius, mat) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const m = cylinder(p, radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(.5).toArray(), mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), end.sub(start).normalize()); return m;
}
function outline(m, color = '#64796c', opacity = .16) {
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({color, transparent:true, opacity})); m.add(lines);
}
function buildDrone() {
  const group = new THREE.Group();
  box(group, [1.65,.62,2.55], [0,0,0], M.shell, .23);
  box(group, [1.4,.22,2.05], [0,.38,.18], M.silver, .14);
  box(group, [1.1,.12,1.5], [0,.54,.35], M.dark, .08);
  box(group, [.8,.018,.12], [0,.608,.75], M.yellow, .01);
  box(group, [1.3,.36,.65], [0,-.07,-1.1], M.dark, .12);
  for (const x of [-.42,.42]) {
    const sensor = cylinder(group,.145,.06,[x,.06,-1.445],M.black); sensor.rotation.x = Math.PI/2;
    const glass = cylinder(group,.095,.063,[x,.06,-1.48],M.lens); glass.rotation.x = Math.PI/2;
  }
  for (let i=0;i<9;i++) {
    box(group,[.035,.22,.66],[-.835,-.02,-.35+i*.085],M.black,.01);
    box(group,[.035,.22,.66],[.835,-.02,-.35+i*.085],M.black,.01);
  }
  const rotors = [];
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const x=sx*2.7,z=sz*2.05;
    rod(group,[sx*.65,0,sz*.77],[x,.12,z],.16,M.dark);
    rod(group,[sx*.7,.04,sz*.7],[sx*1.2,.055,sz*1.1],.24,M.shell);
    cylinder(group,.31,.11,[sx*1.13,.16,sz*1.04],M.silver);
    cylinder(group,.32,.34,[x,.2,z],M.dark);
    cylinder(group,.27,.09,[x,.42,z],M.silver);
    for(let a=0;a<8;a++) { const t=a*Math.PI/4; box(group,[.04,.16,.04],[x+Math.cos(t)*.31,.24,z+Math.sin(t)*.31],M.silver); }
    const rotor=new THREE.Group(); rotor.position.set(x,.52,z); group.add(rotor); rotors.push(rotor);
    const shape=new THREE.Shape(); shape.moveTo(0,-.07); shape.bezierCurveTo(.45,-.25,1.12,-.27,1.48,-.15); shape.lineTo(1.55,-.04); shape.bezierCurveTo(.96,.07,.4,.19,0,.08); shape.closePath();
    const bladeGeo=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.015,bevelThickness:.008,bevelSegments:1,steps:1});
    for(const angle of [0,Math.PI]){const blade=mesh(rotor,bladeGeo,M.black);blade.rotation.x=-Math.PI/2;blade.rotation.z=angle;}
    cylinder(rotor,.13,.12,[0,.045,0],M.shell);
    box(group,[.14,.07,.25],[x,.12,z+sz*.3],sz<0?M.red:M.yellow,.025);
    rod(group,[sx*.65,-.25,sz*.7],[sx*.88,-1.16,sz*.91],.08,M.dark);
    box(group,[.22,.12,.46],[sx*.88,-1.16,sz*.91],M.black,.05);
  }
  cylinder(group,.32,.22,[0,-.45,-.86],M.silver);
  rod(group,[-.38,-.56,-.86],[-.38,-.94,-1.02],.055,M.dark);
  rod(group,[.38,-.56,-.86],[.38,-.94,-1.02],.055,M.dark);
  box(group,[.75,.48,.52],[0,-.91,-1.05],M.dark,.1);
  const lensOuter=cylinder(group,.24,.2,[0,-.91,-1.37],M.silver);lensOuter.rotation.x=Math.PI/2;
  const lensRing=cylinder(group,.20,.22,[0,-.91,-1.405],M.black);lensRing.rotation.x=Math.PI/2;
  const glass=cylinder(group,.155,.225,[0,-.91,-1.42],M.lens);glass.rotation.x=Math.PI/2;
  box(group,[.10,.035,.045],[.26,-.82,-1.32],M.yellow);
  group.rotation.y=-.2;
  return {group, rotors};
}
function terrainLayer(p, bottom, mat) {
  const profile=[[-7,1.18],[-5.6,1.05],[-4.1,.65],[-2.6,.13],[-1.5,-.35],[1.4,-.4],[2.8,.1],[4.1,.74],[5.8,1.18],[7,1.28]];
  const shape=new THREE.Shape();
  if(bottom===-1.1){shape.moveTo(-7,bottom-.45);shape.lineTo(7,bottom-.45);}
  else profile.forEach(([x,y],i)=>i===0?shape.moveTo(x,y+bottom+.05):shape.lineTo(x,y+bottom+.05));
  for(const [x,y] of [...profile].reverse())shape.lineTo(x,y+bottom+.42);
  shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:7.2,steps:1,bevelEnabled:false});
  const layer=mesh(p,geo,mat,[0,0,-3.6]);outline(layer);return layer;
}
function buildBridge() {
  const group=new THREE.Group(), terrain=new THREE.Group(), foundation=new THREE.Group(), structure=new THREE.Group(), deck=new THREE.Group();
  group.add(terrain,foundation,structure,deck);
  terrainLayer(terrain,-1.1,M.rock);terrainLayer(terrain,-.73,M.soil);terrainLayer(terrain,-.36,M.grass);
  box(terrain,[1.3,.045,7.12],[0,-.33,0],M.water);
  for(const z of [-3.2,-2.4,1.5,2.8])box(terrain,[.8,.012,.035],[0,-.302,z],M.edge);
  for(const x of [-5.5,5.5]) {
    box(foundation,[1.25,.28,3.8],[x,.68,0],M.concrete);
    box(structure,[.5,1.6,3.5],[x,1.55,0],M.edge);
    for(const side of [-1,1])box(structure,[1.3,.65,.18],[x+Math.sign(x)*.4,1.7,side*1.64],M.concrete);
  }
  for(const x of [-2.0,2.0]) {
    box(foundation,[1.5,.25,2.9],[x,-.12,0],M.concrete);
    for(const z of [-.95,.95]) {
      cylinder(foundation,.16,.8,[x,-.64,z],M.edge);
      box(structure,[.42,2.02,.48],[x,1,z],M.concrete,.04);
    }
    box(structure,[.75,.35,3.35],[x,2.16,0],M.edge);
    for(const z of [-1.2,-.4,.4,1.2])box(structure,[.33,.08,.26],[x,2.38,z],M.dark);
  }
  for(const z of [-1.2,-.4,.4,1.2]) {
    box(structure,[11.5,.38,.17],[0,2.62,z],M.concrete);
    box(structure,[11.5,.10,.4],[0,2.43,z],M.edge);
    box(structure,[11.5,.12,.4],[0,2.83,z],M.edge);
  }
  const slab=box(deck,[11.8,.18,3.45],[0,3.02,0],M.concrete);outline(slab);
  box(deck,[11.85,.035,2.72],[0,3.127,0],M.asphalt);
  for(let x=-5.2;x<5.4;x+=1.2)box(deck,[.65,.01,.055],[x,3.152,0],M.marking);
  for(const side of [-1,1]) {
    box(deck,[11.85,.1,.22],[0,3.14,side*1.6],M.edge);
    box(deck,[11.85,.015,.05],[0,3.15,side*1.21],M.marking);
    for(let x=-5.7;x<=5.8;x+=.65)box(deck,[.045,.64,.045],[x,3.5,side*1.65],M.steel);
    for(const y of [3.53,3.8])box(deck,[11.85,.045,.045],[0,y,side*1.65],M.steel);
  }
  group.scale.setScalar(.67);group.position.y=-.2;
  return {group,layers:[terrain,foundation,structure,deck]};
}

export async function mountScene(host) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor('#edf1ee');renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.autoClear=false;
  const drone=buildDrone(),bim=buildBridge();
  bim.layers.forEach((layer,i)=>{layer.position.y=.68*i*.9;});
  const items=[{model:drone.group,name:'drone',direction:new THREE.Vector3(7,6.3,-10)},{model:bim.group,name:'bim',direction:new THREE.Vector3(9,7.6,11)}].map(item=>{
    const scene=new THREE.Scene();scene.add(item.model,new THREE.HemisphereLight('#ffffff','#809084',2));
    const key=new THREE.DirectionalLight('#fffef4',3);key.position.set(-3,12,5);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9});key.shadow.normalBias=.04;key.shadow.bias=-.0002;scene.add(key);
    const fill=new THREE.DirectionalLight('#c4dce2',1.6);fill.position.set(7,3,-5);scene.add(fill);
    const floor=mesh(scene,new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.045}),[0,-2.65,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
    const bounds=new THREE.Box3().setFromObject(item.model);
    if(item.name==='drone')bounds.expandByVector(new THREE.Vector3(.16,.2,1.4));
    return {...item,scene,bounds,camera:new THREE.PerspectiveCamera(34,1,.1,100),slot:host.querySelector('[data-object="'+item.name+'"]')};
  });
  const canvas=renderer.domElement;
  canvas.setAttribute('aria-label','Dron con cámara y puente con terreno por capas, modelos conceptuales. No representan equipo propio ni obra real.');canvas.setAttribute('role','img');
  host.append(canvas);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),started=performance.now(),duration=2800;
  let raf=0,frames=0,lost=false,finished=reduced.matches,visible=true;
  function fit() {
    const outer=host.getBoundingClientRect();renderer.setSize(outer.width,outer.height,false);
    for(const item of items){
      const r=item.slot.getBoundingClientRect();item.rect={x:r.left-outer.left,y:outer.height-(r.bottom-outer.top),width:r.width,height:r.height};
      const center=item.bounds.getCenter(new THREE.Vector3()),normal=item.direction.clone().normalize();
      const right=new THREE.Vector3(0,1,0).cross(normal).normalize(),up=normal.clone().cross(right),tan=Math.tan(THREE.MathUtils.degToRad(17));
      item.camera.aspect=r.width/r.height;let distance=1;
      // Fit the complete model envelope, including rotor travel, inside its own viewport.
      for(const x of [item.bounds.min.x,item.bounds.max.x])for(const y of [item.bounds.min.y,item.bounds.max.y])for(const z of [item.bounds.min.z,item.bounds.max.z]){
        const d=new THREE.Vector3(x,y,z).sub(center),depth=d.dot(normal);
        distance=Math.max(distance,depth+Math.abs(d.dot(right))/(tan*item.camera.aspect*.91),depth+Math.abs(d.dot(up))/(tan*.79));
      }
      item.camera.position.copy(normal.multiplyScalar(distance)).add(center);item.camera.lookAt(center);item.camera.updateProjectionMatrix();
    }
    draw();
  }
  function pose(progress){
    const t=1-Math.pow(1-progress,3);
    drone.group.position.y=.12*(1-t);drone.group.rotation.y=-.2-.08*(1-t);
    drone.rotors.forEach((r,i)=>{r.rotation.y=(i%2?1:-1)*(1-t)*Math.PI*2;});
    bim.layers.forEach((layer,i)=>{layer.position.y=(.45+.23*t)*i*.9;});
  }
  function draw(){
    if(lost)return;
    renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
    for(const item of items){const r=item.rect;if(!r)continue;renderer.setViewport(r.x,r.y,r.width,r.height);renderer.setScissor(r.x,r.y,r.width,r.height);renderer.render(item.scene,item.camera);}
    host.dataset.frames=String(++frames);
  }
  function frame(now){raf=0;const progress=finished?1:Math.min((now-started)/duration,1);pose(progress);draw();
    if(progress>=1){finished=true;host.dataset.motion='still';return;}
    host.dataset.motion='intro';raf=requestAnimationFrame(frame);
  }
  function sync(){cancelAnimationFrame(raf);raf=0;if(document.hidden||!visible||reduced.matches)finished=true;
    if(lost)return;if(finished){pose(1);draw();host.dataset.motion='still';}else raf=requestAnimationFrame(frame);
  }
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05});observer.observe(host);
  const resize=new ResizeObserver(fit);resize.observe(host);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;finished=true;sync();host.classList.remove('ready');host.dataset.state='fallback';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;fit();host.classList.add('ready');host.dataset.state='ready';sync();});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();renderer.dispose();},{once:true});
  pose(finished?1:0);fit();host.classList.add('ready');host.setAttribute('aria-busy','false');host.dataset.state='ready';host.dataset.objects='drone,bim';sync();
}
