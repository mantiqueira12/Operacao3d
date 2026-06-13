/* =====================================================================
   sim-3d.js — Vista 3D da operação (Three.js + props.js da planta)
   Bonecos animados (operadores/clientes) sobre o layout real.
   ===================================================================== */
(function(){
"use strict";
var THREE=window.THREE;
var WALL_H=2.80, WALL_T=0.12;
var CX=1.30, CZ=2.575;

var scene3, renderer, camera, canvas, labelHost;
var root, furnGroup, agentGroup, trailGroup;
var shellWalls=[], opAvatars=[], custAvatars={}, opTrails=[];
var orbit={theta:-Math.PI*0.62,phi:0.92,radius:11.0,target:null};
var showLabels=true, showTrails=true, inited=false;

function mat(c,opts){ return new THREE.MeshLambertMaterial(Object.assign({color:c},opts||{})); }

/* ---------- acabamentos (mesma persistência da planta: loja206_fin_v2) ---------- */
var FIN_LS="loja206_fin_v2";
var finishes={floor:"porcelanato",wall:"panna"};
var WALL_FIN={panna:0xF2ECDD,branco:0xFAF8F2,oliva:0xA8AE94};
var floorMesh=null, shellWallMat=null;
function loadFinishes(){
  try{ var f=JSON.parse(localStorage.getItem(FIN_LS)); if(f&&f.floor) finishes=f; }catch(e){}
}
function makeFloorTex(kind){
  var c=document.createElement("canvas"); c.width=256; c.height=256;
  var ctx=c.getContext("2d"), i, period=0.6;
  if(kind==="porcelanato"){
    ctx.fillStyle="#EFE9D8"; ctx.fillRect(0,0,256,256);
    ctx.strokeStyle="#D6CEB8"; ctx.lineWidth=3; ctx.strokeRect(1.5,1.5,253,253);
    ctx.fillStyle="rgba(255,255,255,.25)";
    for(i=0;i<14;i++){ ctx.fillRect(Math.random()*256,Math.random()*256,22,3); }
  } else if(kind==="granilite"){
    period=0.5;
    ctx.fillStyle="#DCD5C2"; ctx.fillRect(0,0,256,256);
    var cols=["#B5AD98","#8E8775","#C9C2AE","#A39B85","#6F6857"];
    for(i=0;i<420;i++){ ctx.fillStyle=cols[i%cols.length];
      var r=1+Math.random()*2.4;
      ctx.beginPath(); ctx.arc(Math.random()*256,Math.random()*256,r,0,7); ctx.fill(); }
  } else {
    period=1.2;
    ctx.fillStyle="#B9B5AB"; ctx.fillRect(0,0,256,256);
    for(i=0;i<26;i++){
      ctx.fillStyle="rgba("+(150+Math.random()*40)+","+(146+Math.random()*40)+","+(136+Math.random()*40)+",0.18)";
      ctx.beginPath(); ctx.ellipse(Math.random()*256,Math.random()*256,30+Math.random()*60,20+Math.random()*40,Math.random()*3,0,7); ctx.fill(); }
  }
  var tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(1/period,1/period); tex.anisotropy=4;
  return tex;
}
function applyFinishes(){
  loadFinishes();
  if(floorMesh) floorMesh.material=new THREE.MeshLambertMaterial({map:makeFloorTex(finishes.floor)});
  if(shellWallMat) shellWallMat.color.setHex(WALL_FIN[finishes.wall]||WALL_FIN.panna);
  document.querySelectorAll("#fin3d [data-floor]").forEach(function(b){ b.classList.toggle("active",b.dataset.floor===finishes.floor); });
  document.querySelectorAll("#fin3d [data-wallfin]").forEach(function(b){ b.classList.toggle("active",b.dataset.wallfin===finishes.wall); });
}
function setFinish(kind,val){
  finishes[kind==='floor'?'floor':'wall']=val;
  try{ localStorage.setItem(FIN_LS,JSON.stringify(finishes)); }catch(e){}
  applyFinishes();
}

/* ---------- pessoa (mesma linguagem da vista 3D da planta) ---------- */
function makePerson(o){
  var g=new THREE.Group();
  function add(m,x,y,z){ m.position.set(x,y,z); m.castShadow=true; g.add(m); return m; }
  var skin=mat(0xD9B38C), shirt=mat(o.shirt), pants=mat(o.pants);
  [-0.07,0.07].forEach(function(x){ add(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,0.82,8),pants),x,0.41,0); });
  var torso=add(new THREE.Mesh(new THREE.CylinderGeometry(0.125,0.15,0.58,10),shirt),0,1.11,0);
  [-0.185,0.185].forEach(function(x){ var a=add(new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.52,6),shirt),x,1.10,0); a.rotation.z=x<0?0.12:-0.12; });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.105,12,10),skin),0,1.53,0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.108,12,8,0,Math.PI*2,0,Math.PI*0.55),mat(o.hair||0x3a2e24)),0,1.555,0);
  if(o.apron) add(new THREE.Mesh(new THREE.BoxGeometry(0.30,0.46,0.02),mat(0xE2000F)),0,1.00,0.155);
  g.userData.shirtMat=shirt;
  return g;
}

/* ---------- sala ---------- */
function buildRoom(){
  var SIM=window.SIM, ROOM=SIM.ROOM;
  /* piso */
  var shape=new THREE.Shape();
  ROOM.forEach(function(p,i){ if(i===0) shape.moveTo(p[0],p[1]); else shape.lineTo(p[0],p[1]); });
  shape.closePath();
  var geo=new THREE.ExtrudeGeometry(shape,{depth:0.06,bevelEnabled:false});
  geo.rotateX(Math.PI/2);
  var fl=new THREE.Mesh(geo,mat(0xEDE3CB)); fl.receiveShadow=true; root.add(fl);
  floorMesh=new THREE.Mesh(geo.clone(),mat(0xF7F2E7));
  floorMesh.position.y=0.001; floorMesh.receiveShadow=true; root.add(floorMesh);

  /* calçada */
  var walk=new THREE.Mesh(new THREE.BoxGeometry(SIM.OUT.x1-SIM.OUT.x0,0.02,SIM.OUT.y1-SIM.GATE),mat(0xD8D2C2));
  walk.position.set((SIM.OUT.x0+SIM.OUT.x1)/2,0.01,(SIM.GATE+SIM.OUT.y1)/2);
  walk.receiveShadow=true; root.add(walk);

  /* casca (frente aberta) */
  shellWalls=[];
  shellWallMat=mat(0xF2ECDD);
  for(var i=0;i<ROOM.length;i++){
    var a=ROOM[i], b=ROOM[(i+1)%ROOM.length];
    if(a[1]===SIM.GATE&&b[1]===SIM.GATE) continue;
    var dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    if(len<0.001) continue;
    var w=new THREE.Mesh(new THREE.BoxGeometry(len,WALL_H,WALL_T),shellWallMat);
    var cx=(a[0]+b[0])/2, cz=(a[1]+b[1])/2;
    w.position.set(cx,WALL_H/2,cz);
    w.rotation.y=-Math.atan2(dz,dx);
    w.castShadow=true; w.receiveShadow=true;
    var nx=dz/len, nz=-dx/len;
    if(nx*(cx-CX)+nz*(cz-CZ)<0){ nx=-nx; nz=-nz; }
    w.userData={nx:nx,nz:nz,cx:cx,cz:cz};
    shellWalls.push(w); root.add(w);
  }
  /* portão recolhido */
  var mtl=new THREE.MeshPhongMaterial({color:0x707070,shininess:30});
  var housing=new THREE.Mesh(new THREE.BoxGeometry(2.60,0.32,0.30),mtl);
  housing.position.set(1.30,WALL_H-0.16,window.SIM.GATE); housing.castShadow=true; root.add(housing);
  [0.045,2.555].forEach(function(x){
    var rail=new THREE.Mesh(new THREE.BoxGeometry(0.09,WALL_H,0.11),mtl);
    rail.position.set(x,WALL_H/2,window.SIM.GATE); rail.castShadow=true; root.add(rail);
  });
}

/* ---------- mobiliário (PROPS da planta, fallback genérico) ---------- */
var HZ_DEF={balcao:1.05,caixa:1.05,vitrine:1.20,forno:1.60,geladeira:1.90,bibite:1.40,prep:0.90,batedeira:1.30,estufa:1.75,
  montagem:0.90,pia:0.90,estoque:1.80,apoio:0.75,lixeira:0.70,extintor:0.55,porta:2.10,wall:2.80,painel:2.80};
function buildFurniture(){
  furnGroup.clear();
  window.SIM.sceneItems.forEach(function(it){
    var h=it.hz!=null?it.hz:(HZ_DEF[it.t]||0.90);
    var g;
    if(it.t==="painel"){
      g=buildPanel3D(it,h);
    } else if(it.t==="wall"){
      g=new THREE.Group();
      var m=new THREE.Mesh(new THREE.BoxGeometry(it.w,h,it.h),mat(0xEDE7D7));
      m.position.y=h/2; m.castShadow=true; m.receiveShadow=true; g.add(m);
    } else if(window.PROPS&&window.PROPS[it.t]){
      g=window.PROPS[it.t](it.w,it.h,h);
      g.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    } else {
      g=new THREE.Group();
      var col=parseInt(String(it.color||"#CBC4B2").replace("#",""),16);
      var bx=new THREE.Mesh(new THREE.BoxGeometry(it.w,h,it.h),mat(col));
      bx.position.y=h/2; bx.castShadow=true; bx.receiveShadow=true; g.add(bx);
    }
    g.position.set(it.x+it.w/2,0,it.y+it.h/2);
    furnGroup.add(g);
  });
}

/* painel divisor detalhado (mesma linguagem da vista 3D da planta) */
function buildPanel3D(it,h){
  var horiz=it.w>=it.h;
  var L=horiz?it.w:it.h, T=horiz?it.h:it.w;
  var g=new THREE.Group();
  function add(mesh){ mesh.castShadow=true; mesh.receiveShadow=true; g.add(mesh); return mesh; }
  var BAND=0.40, bodyH=h-BAND;
  add(new THREE.Mesh(new THREE.BoxGeometry(L,h,T*0.5),mat(0xD9D0BB))).position.y=h/2;
  var d0=-L/2+0.10, d1=-L/2+Math.min(0.90,L-0.20), dw=d1-d0, hasDoor=L>=1.10;
  var slatW=0.06, gap=0.018, zFace=T*0.25+0.012;
  for(var x=-L/2+slatW/2; x<=L/2-slatW/2+0.001; x+=slatW+gap){
    if(hasDoor&&x>d0-slatW/2&&x<d1+slatW/2) continue;
    var tone=(Math.round((x+L/2)/(slatW+gap))%2===0)?0xC69A64:0xB98F5C;
    var s=add(new THREE.Mesh(new THREE.BoxGeometry(slatW,bodyH,0.024),mat(tone)));
    s.position.set(x,bodyH/2,zFace);
  }
  var band=add(new THREE.Mesh(new THREE.BoxGeometry(L,BAND,T*0.5+0.05),mat(0xE2000F)));
  band.position.y=h-BAND/2;
  var lc=document.createElement("canvas"); lc.width=1024; lc.height=128;
  var lx=lc.getContext("2d");
  lx.fillStyle="#FFFFFF"; lx.font="italic 800 76px Bitter, Georgia, serif";
  lx.textAlign="center"; lx.textBaseline="middle";
  lx.fillText("All'Antico Panino",512,68);
  var ltex=new THREE.CanvasTexture(lc); ltex.anisotropy=8;
  var letW=Math.min(1.7,L*0.85);
  var plane=new THREE.Mesh(new THREE.PlaneGeometry(letW,letW*0.125),
    new THREE.MeshBasicMaterial({map:ltex,transparent:true}));
  plane.position.set(0,h-BAND/2,T*0.25+0.032); g.add(plane);
  if(hasDoor){
    var rec=add(new THREE.Mesh(new THREE.BoxGeometry(dw,2.10,T*0.18),mat(0x4a4438)));
    rec.position.set(d0+dw/2,1.05,T*0.16);
    var slide=0.30;
    var leaf=add(new THREE.Mesh(new THREE.BoxGeometry(dw,2.06,0.035),mat(0x8A6A44)));
    leaf.position.set(d0+dw/2+slide,1.03,zFace+0.03);
    var trackLen=dw*2.2;
    var track=add(new THREE.Mesh(new THREE.BoxGeometry(trackLen,0.06,0.05),mat(0x1A1A1A)));
    track.position.set(d0+trackLen/2,2.16,zFace+0.03);
  }
  if(!horiz) g.rotation.y=Math.PI/2;
  return g;
}

/* ---------- avatares ---------- */
var OP_COLORS=[0x2A6FDB,0x1F8A5B,0x8E44AD,0x0E8A8A];
function buildOpAvatars(){
  opAvatars.forEach(function(a){ agentGroup.remove(a.g); });
  opTrails.forEach(function(t){ if(t) trailGroup.remove(t); });
  opAvatars=[]; opTrails=[];
  window.SIM.operators.forEach(function(op,i){
    var g=makePerson({shirt:OP_COLORS[i%4],pants:0x2B2B2B,apron:true});
    var food=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.10,0.16),mat(0xC0763A));
    food.position.set(0.22,1.05,0.12); food.visible=false; g.add(food);
    agentGroup.add(g);
    opAvatars.push({g:g,food:food,lastX:op.x,lastY:op.y});
    opTrails.push(null);
  });
}
function custAvatar(c){
  if(custAvatars[c.id]) return custAvatars[c.id];
  var shirts=[0x6E7B8B,0x8B6E5A,0x5A7B6E,0x7B5A6E,0x9A8454];
  var g=makePerson({shirt:shirts[c.id%5],pants:0x4A4438,hair:[0x1f1a14,0x3a2e24,0x6b5436][c.id%3]});
  g.scale.set(0.96,0.96,0.96);
  agentGroup.add(g);
  custAvatars[c.id]={g:g,shirt:g.userData.shirtMat};
  return custAvatars[c.id];
}

/* ---------- labels HTML ---------- */
function project(x,y,z){
  var v=new THREE.Vector3(x,y,z).project(camera);
  return {x:(v.x*0.5+0.5)*canvas.clientWidth, y:(-v.y*0.5+0.5)*canvas.clientHeight, behind:v.z>1};
}
var opLabelEls=[];
function syncLabels(){
  var SIM=window.SIM;
  while(opLabelEls.length<SIM.operators.length){
    var el=document.createElement("div");
    el.className="s3-lbl s3-op"; labelHost.appendChild(el); opLabelEls.push(el);
  }
  while(opLabelEls.length>SIM.operators.length){ opLabelEls.pop().remove(); }
  SIM.operators.forEach(function(op,i){
    var el=opLabelEls[i];
    if(!showLabels){ el.style.display="none"; return; }
    var p=project(op.x,2.05,op.y);
    if(p.behind){ el.style.display="none"; return; }
    el.style.display="block";
    el.style.left=p.x+"px"; el.style.top=p.y+"px";
    el.textContent=(op.fixedEq?"FIXO · ":"")+(op.tag||("O"+(i+1)))+" · "+op.statusText;
    el.className="s3-lbl s3-op"+(op.busyState==="busy"?" busy":op.busyState==="wait"?" wait":"");
  });
}

/* ---------- trilhas 3D ---------- */
function syncTrails(){
  if(!showTrails){ trailGroup.clear(); return; }
  window.SIM.operators.forEach(function(op,i){
    if(opTrails[i]){ trailGroup.remove(opTrails[i]); opTrails[i]=null; }
    if(op.trail.length<2) return;
    var pts=op.trail.map(function(p){ return new THREE.Vector3(p.x,0.04,p.y); });
    var geo=new THREE.BufferGeometry().setFromPoints(pts);
    var line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:OP_COLORS[i%4],transparent:true,opacity:0.5}));
    trailGroup.add(line); opTrails[i]=line;
  });
}

/* ---------- agentes por frame ---------- */
var CUST_COL={waiting:0xC0392B,at_pdv:0x1F8A5B,waiting_pickup:0x2A6FDB,entering:0x6E7B8B,leaving:0x9A9284};
function syncAgents(){
  var SIM=window.SIM;
  if(opAvatars.length!==SIM.operators.length) buildOpAvatars();
  SIM.operators.forEach(function(op,i){
    var a=opAvatars[i];
    a.g.position.set(op.x,0,op.y);
    var dx=op.x-a.lastX, dy=op.y-a.lastY;
    if(Math.hypot(dx,dy)>0.005) a.g.rotation.y=Math.atan2(dx,dy);
    a.lastX=op.x; a.lastY=op.y;
    a.food.visible=!!op.carrying;
  });
  var alive={};
  SIM.customers.forEach(function(c){
    var a=custAvatar(c); alive[c.id]=true;
    a.g.position.set(c.x,0,c.y);
    a.g.rotation.y=Math.atan2(CX-c.x, SIM.GATE-0.5-c.y);
    var col=CUST_COL[c.state]||0x6E7B8B;
    if(c.state==="leaving") col=c.served?0x1F8A5B:0xC0392B;
    a.shirt.color.setHex(col);
  });
  Object.keys(custAvatars).forEach(function(id){
    if(!alive[id]){ agentGroup.remove(custAvatars[id].g); delete custAvatars[id]; }
  });
}

/* ---------- câmera / órbita ---------- */
function updateCamera(){
  var r=orbit.radius, st=Math.sin(orbit.phi)*r;
  camera.position.set(
    orbit.target.x+st*Math.cos(orbit.theta),
    orbit.target.y+Math.cos(orbit.phi)*r,
    orbit.target.z+st*Math.sin(orbit.theta));
  camera.lookAt(orbit.target);
  cullWalls();
}
function cullWalls(){
  var cp=camera.position;
  shellWalls.forEach(function(w){
    var u=w.userData;
    var facing=u.nx*(cp.x-u.cx)+u.nz*(cp.z-u.cz);
    w.visible=facing<0.15;
  });
}
function bindOrbit(){
  var dragO=null;
  canvas.addEventListener("pointerdown",function(e){
    dragO={x:e.clientX,y:e.clientY,th:orbit.theta,ph:orbit.phi,pan:e.shiftKey||e.button===2,tx:orbit.target.x,tz:orbit.target.z};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",function(e){
    if(!dragO) return;
    var dx=e.clientX-dragO.x, dy=e.clientY-dragO.y;
    if(dragO.pan){
      orbit.target.x=dragO.tx-dx*0.0012*orbit.radius;
      orbit.target.z=dragO.tz-dy*0.0012*orbit.radius;
    } else {
      orbit.theta=dragO.th+dx*0.008;
      orbit.phi=Math.max(0.12,Math.min(1.45,dragO.ph-dy*0.006));
    }
    updateCamera();
  });
  ["pointerup","pointercancel"].forEach(function(ev){ canvas.addEventListener(ev,function(){ dragO=null; }); });
  canvas.addEventListener("wheel",function(e){
    e.preventDefault();
    orbit.radius=Math.max(2.2,Math.min(18,orbit.radius*(e.deltaY>0?1.1:1/1.1)));
    updateCamera();
  },{passive:false});
  canvas.addEventListener("contextmenu",function(e){ e.preventDefault(); });
}
function preset(name){
  if(name==="iso"){ orbit.theta=-Math.PI*0.62; orbit.phi=0.92; orbit.radius=11.0; orbit.target.set(CX,0.4,CZ+0.6); }
  else if(name==="top"){ orbit.theta=-Math.PI/2; orbit.phi=0.12; orbit.radius=10.5; orbit.target.set(CX,0,CZ+0.7); }
  else if(name==="cliente"){ orbit.target.set(CX,1.1,4.4); orbit.theta=Math.PI*0.5; orbit.phi=1.18; orbit.radius=3.8; }
  else if(name==="balcao"){ orbit.target.set(CX,1.0,4.2); orbit.theta=-Math.PI*0.5; orbit.phi=1.18; orbit.radius=3.4; }
  updateCamera();
}

function resize(){
  if(!canvas) return;
  var w=canvas.clientWidth, h=canvas.clientHeight;
  if(w<4||h<4) return;
  if(canvas.width!==w||canvas.height!==h){
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }
}

var frame=0;
window.SIM3D={
  init:function(canvasEl,labelEl){
    if(inited) return;
    inited=true;
    canvas=canvasEl; labelHost=labelEl;
    scene3=new THREE.Scene();
    scene3.background=new THREE.Color(0xE6E1D5);
    scene3.fog=new THREE.Fog(0xE6E1D5,14,32);
    renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    camera=new THREE.PerspectiveCamera(50,1,0.1,200);
    orbit.target=new THREE.Vector3(CX,0.4,CZ+0.6);
    scene3.add(new THREE.HemisphereLight(0xffffff,0xcfc8b6,0.65));
    scene3.add(new THREE.AmbientLight(0xffffff,0.35));
    var sun=new THREE.DirectionalLight(0xfff4e0,1.0);
    sun.position.set(5,9,3); sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-6; sun.shadow.camera.right=6;
    sun.shadow.camera.top=8; sun.shadow.camera.bottom=-6;
    sun.shadow.camera.near=0.5; sun.shadow.camera.far=40; sun.shadow.bias=-0.0004;
    scene3.add(sun);
    root=new THREE.Group(); scene3.add(root);
    furnGroup=new THREE.Group(); root.add(furnGroup);
    agentGroup=new THREE.Group(); root.add(agentGroup);
    trailGroup=new THREE.Group(); root.add(trailGroup);
    buildRoom(); buildFurniture(); buildOpAvatars(); applyFinishes();
    bindOrbit(); preset("iso"); resize();
    window.addEventListener("resize",resize);
  },
  rebuild:function(){ if(!inited) return; buildFurniture(); buildOpAvatars(); applyFinishes(); },
  setFinish:setFinish,
  render:function(){
    if(!inited) return;
    frame++;
    resize();
    syncAgents();
    if(frame%12===0) syncTrails();
    syncLabels();
    renderer.render(scene3,camera);
  },
  preset:preset,
  set labels(v){ showLabels=v; },
  set trails(v){ showTrails=v; if(!v&&trailGroup) trailGroup.clear(); },
  get inited(){ return inited; }
};
})();
