/* =====================================================================
   props.js — modelos 3D detalhados para a LOJA 206
   Cada builder recebe (w, d, h) em metros e devolve um THREE.Group
   centrado em X/Z, apoiado no piso (y: 0..h). "Frente" = +Z.
   ===================================================================== */
(function(){
"use strict";
var THREE=window.THREE;

/* ---------- texturas procedurais ---------- */
function tex(draw,rep){
  var c=document.createElement("canvas"); c.width=c.height=128;
  draw(c.getContext("2d"),128);
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  if(rep) t.repeat.set(rep[0],rep[1]); t.anisotropy=4; return t;
}
var steelTex=tex(function(x,s){
  var g=x.createLinearGradient(0,0,s,0);
  g.addColorStop(0,"#cdd0d6");g.addColorStop(.5,"#eef1f4");g.addColorStop(1,"#c7cad0");
  x.fillStyle=g;x.fillRect(0,0,s,s);
  x.globalAlpha=.06;x.strokeStyle="#5a6068";
  for(var i=0;i<s;i+=2){ x.beginPath();x.moveTo(i,0);x.lineTo(i,s);x.stroke(); }
});
var woodTex=tex(function(x,s){
  x.fillStyle="#b98a52";x.fillRect(0,0,s,s);
  x.globalAlpha=.18;x.strokeStyle="#8a6038";x.lineWidth=1;
  for(var i=0;i<14;i++){ var y=Math.random()*s; x.beginPath();x.moveTo(0,y);
    x.bezierCurveTo(s*.3,y+4,s*.6,y-4,s,y+2);x.stroke(); }
});
var stoneTex=tex(function(x,s){
  x.fillStyle="#ece8df";x.fillRect(0,0,s,s);
  x.globalAlpha=.12;
  for(var i=0;i<40;i++){ x.fillStyle=Math.random()>.5?"#cfc9ba":"#d8d3c6";
    x.beginPath();x.arc(Math.random()*s,Math.random()*s,Math.random()*5+1,0,7);x.fill(); }
});

/* ---------- materiais (cache) ---------- */
var M=null;
function mats(){
  if(M) return M;
  M={
    steel:new THREE.MeshPhongMaterial({color:0xeef1f4,map:steelTex,shininess:78,specular:0x555b63}),
    steelDark:new THREE.MeshPhongMaterial({color:0x6b7078,map:steelTex,shininess:60,specular:0x33373c}),
    black:new THREE.MeshPhongMaterial({color:0x2b2d30,shininess:30,specular:0x222}),
    wood:new THREE.MeshPhongMaterial({color:0xc69a64,map:woodTex,shininess:14}),
    stone:new THREE.MeshPhongMaterial({color:0xece8df,map:stoneTex,shininess:24,specular:0x888}),
    rosso:new THREE.MeshPhongMaterial({color:0xE2000F,shininess:30,specular:0x551}),
    rossoDark:new THREE.MeshPhongMaterial({color:0xB80714,shininess:20}),
    glass:new THREE.MeshPhongMaterial({color:0xCfe6ea,transparent:true,opacity:0.3,shininess:100,specular:0xffffff}),
    glowGlass:new THREE.MeshPhongMaterial({color:0xE88A2A,transparent:true,opacity:0.55,shininess:80,emissive:0x6a2c00,emissiveIntensity:0.5}),
    screen:new THREE.MeshPhongMaterial({color:0x121821,emissive:0x16324a,emissiveIntensity:0.4,shininess:60}),
    shelf:new THREE.MeshPhongMaterial({color:0xb9b0a0,shininess:10}),
    white:new THREE.MeshPhongMaterial({color:0xf3efe6,shininess:18}),
    rubber:new THREE.MeshPhongMaterial({color:0x3a3a3a,shininess:8})
  };
  return M;
}

/* ---------- helpers ---------- */
function box(w,h,d,m){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); }
function at(mesh,x,y,z){ mesh.position.set(x,y,z); return mesh; }
function cyl(r1,r2,h,m,seg){ return new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg||20),m); }
function legs(g,w,d,h,inset,thick,m){
  inset=inset||0.04; thick=thick||0.035;
  var xs=[-w/2+inset,w/2-inset], zs=[-d/2+inset,d/2-inset];
  xs.forEach(function(x){ zs.forEach(function(z){ g.add(at(box(thick,h,thick,m),x,h/2,z)); }); });
}
function bottles(g,w,d,topY,rows){
  var cols=[0xE2000F,0xF2A23C,0x2E9E5B,0x2A6FDB,0xEAD24A,0xC0392B];
  rows.forEach(function(sy){
    var n=Math.max(3,Math.floor(w/0.09));
    for(var i=0;i<n;i++){
      var m=new THREE.MeshPhongMaterial({color:cols[(i+Math.round(sy*10))%cols.length],shininess:60});
      var b=cyl(0.028,0.028,0.16,m,10);
      at(b, -w/2+0.06+i*(w-0.12)/(n-1||1), sy+0.08, d*0.10);
      g.add(b);
    }
  });
}

/* =====================================================================
   BUILDERS
   ===================================================================== */
var B={};

B.geladeira=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  g.add(at(box(w,h,d,m.steel),0,h/2,0));
  // vinco horizontal (2 portas) + vertical
  g.add(at(box(w+0.004,0.012,d+0.004,m.steelDark),0,h*0.52,0));
  // puxadores verticais
  g.add(at(box(0.04,h*0.34,0.05,m.steelDark), w/2-0.10, h*0.74, d/2+0.01));
  g.add(at(box(0.04,h*0.34,0.05,m.steelDark), w/2-0.10, h*0.30, d/2+0.01));
  // friso de topo
  g.add(at(box(w,0.03,d,m.steelDark),0,h-0.015,0));
  return g;
};

B.bibite=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  // corpo
  g.add(at(box(w,h,d,m.steel),0,h/2,0));
  // banner topo rosso
  g.add(at(box(w+0.01,0.14,d+0.01,m.rosso),0,h-0.07,0));
  // nicho interno escuro
  g.add(at(box(w-0.08,h-0.30,d*0.7,m.black),0,(h-0.18)/2,-d*0.05));
  // prateleiras + garrafas
  bottles(g,w-0.10,d,0,[0.12,0.52,0.92].filter(function(y){return y<h-0.30;}));
  // porta de vidro
  g.add(at(box(w-0.05,h-0.22,0.02,m.glass),0,(h-0.18)/2,d/2-0.01));
  g.add(at(box(0.03,h*0.4,0.04,m.steelDark), w/2-0.07,(h-0.18)/2,d/2+0.01));
  return g;
};

B.vitrine=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  var baseH=h*0.55;
  g.add(at(box(w,baseH,d,m.steel),0,baseH/2,0));
  g.add(at(box(w,0.03,d*0.5,m.rosso),0,0.05,d/2-d*0.25)); // friso rosso frente
  // tampo
  g.add(at(box(w,0.03,d,m.stone),0,baseH+0.015,0));
  // bandejas de comida
  var foods=[0xE3B23C,0xC0392B,0xE9DCC0,0x7BAE5A];
  var n=Math.max(2,Math.floor(w/0.4));
  for(var i=0;i<n;i++){
    var fm=new THREE.MeshPhongMaterial({color:foods[i%foods.length],shininess:24});
    g.add(at(box((w-0.1)/n-0.04,0.06,d*0.5,fm), -w/2+(i+0.5)*(w/n), baseH+0.06, 0));
  }
  // vidro inclinado (frente baixa)
  var gh=h-baseH;
  var glass=box(w,gh,0.02,m.glass); at(glass,0,baseH+gh/2,d/2-0.02); glass.rotation.x=-0.32; g.add(glass);
  g.add(at(box(w,0.02,d*0.6,m.glass),0,h-0.02,-d*0.05)); // topo vidro
  g.add(at(box(0.02,gh*0.8,d*0.55,m.glass),-w/2+0.01,baseH+gh*0.45,0));
  g.add(at(box(0.02,gh*0.8,d*0.55,m.glass), w/2-0.01,baseH+gh*0.45,0));
  return g;
};

B.batedeira=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  // base/pedestal
  g.add(at(box(w*0.92,h*0.46,d*0.92,m.steel),0,h*0.23,0));
  g.add(at(box(w*0.7,0.03,d*0.7,m.steelDark),0,h*0.47,0)); // borda da base
  // tigela (bowl) inox
  var bowl=cyl(w*0.30,w*0.22,h*0.30,m.steel,20); at(bowl,0,h*0.30,d*0.05); g.add(bowl);
  // coluna do braço
  g.add(at(box(w*0.18,h*0.5,d*0.22,m.black),-w*0.30,h*0.7,-d*0.18));
  // cabeçote inclinado sobre a tigela
  var head=box(w*0.6,h*0.16,d*0.34,m.black); at(head,w*0.02,h*0.86,d*0.0); g.add(head);
  // batedor descendo
  g.add(at(cyl(0.018,0.018,h*0.22,m.steelDark),w*0.02,h*0.62,d*0.05));
  return g;
};

B.estufa=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  // gabinete (armário de fermentação)
  g.add(at(box(w,h,d,m.steel),0,h/2,0));
  // moldura da porta
  g.add(at(box(w*0.86,h*0.9,0.02,m.steelDark),0,h*0.5,d/2));
  // janela de vidro embaçado (grande)
  g.add(at(box(w*0.66,h*0.66,0.02,m.glass),0,h*0.54,d/2+0.012));
  // bandejas visíveis atrás do vidro
  [0.32,0.5,0.68].forEach(function(fr){
    g.add(at(box(w*0.6,0.015,d*0.5,m.wood),0,h*fr,d*0.02));
  });
  // puxador vertical
  g.add(at(box(0.035,h*0.4,0.05,m.steelDark),w*0.40,h*0.55,d/2+0.02));
  // painel de controle (luz)
  g.add(at(box(w*0.5,0.05,0.02,m.glowGlass),0,h*0.93,d/2+0.01));
  // pés
  legs(g,w,d,0.06,0.05,0.05,m.steelDark);
  return g;
};

B.forno=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  // pés
  legs(g,w,d,0.18,0.05,0.05,m.steelDark);
  var bodyY=0.18, bodyH=h-0.18;
  g.add(at(box(w,bodyH,d,m.black),0,bodyY+bodyH/2,0));
  // duas câmaras (deck) com visor e puxador
  [0.30,0.66].forEach(function(fr){
    var cy=bodyY+bodyH*fr;
    g.add(at(box(w*0.9,bodyH*0.30,0.03,m.steelDark),0,cy,d/2+0.005));
    g.add(at(box(w*0.62,bodyH*0.16,0.02,m.glowGlass),0,cy+0.01,d/2+0.02));
    g.add(at(box(w*0.82,0.035,0.05,m.steel),0,cy-bodyH*0.17,d/2+0.03)); // barra puxador
  });
  // chaminé/topo
  g.add(at(box(w,0.04,d,m.steel),0,h-0.02,0));
  g.add(at(cyl(0.05,0.05,0.18,m.steelDark),w*0.3,h+0.09,-d*0.2));
  return g;
};

function counterBase(g,w,d,h,m,frontMat){
  // base + tampo de pedra com beiral; frente opcional
  var baseH=h-0.04;
  g.add(at(box(w,baseH,d*0.96,m.wood),0,baseH/2,0));
  g.add(at(box(w+0.05,0.04,d+0.05,m.stone),0,h-0.02,0)); // tampo
  g.add(at(box(w,baseH,0.02,frontMat||m.wood),0,baseH/2,d/2-0.005)); // frente
}

B.balcao=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  counterBase(g,w,d,h,m,m.rosso);
  // rodapé/descanso de pé na frente
  g.add(at(box(w*0.9,0.04,0.04,m.steelDark),0,0.08,d/2+0.04));
  // friso superior
  g.add(at(box(w+0.05,0.015,d+0.05,m.rossoDark),0,h-0.045,0));
  return g;
};

B.caixa=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  counterBase(g,w,d,h,m,m.rosso);
  // monitor/PDV inclinado
  var stand=at(box(0.06,0.14,0.06,m.black),0,h+0.07,-d*0.05); g.add(stand);
  var scr=box(0.30,0.22,0.03,m.screen); at(scr,0,h+0.22,-d*0.02); scr.rotation.x=0.18; g.add(scr);
  var frame=box(0.33,0.25,0.02,m.black); at(frame,0,h+0.22,-d*0.03); frame.rotation.x=0.18; g.add(frame);
  // gaveta
  g.add(at(box(w*0.5,0.06,d*0.6,m.steelDark),0,h-0.10,d*0.1));
  return g;
};

function prepTable(g,w,d,h,m){
  legs(g,w,d,h-0.04,0.05,0.035,m.steel);
  g.add(at(box(w,0.04,d,m.steel),0,h-0.02,0));          // tampo
  g.add(at(box(w*0.94,0.03,d*0.86,m.steel),0,0.16,0));  // prateleira baixa
}
B.prep=function(w,d,h){ var g=new THREE.Group(); prepTable(g,w,d,h,mats()); 
  // tábua de corte
  g.add(at(box(w*0.4,0.03,d*0.5,mats().wood),0,h+0.005,0)); return g; };
B.montagem=function(w,d,h){ var g=new THREE.Group(),m=mats(); prepTable(g,w,d,h,m);
  // anteparo traseiro
  g.add(at(box(w,0.12,0.02,m.steel),0,h+0.06,-d/2+0.02)); return g; };

B.pia=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  prepTable(g,w,d,h,m);
  // cuba
  g.add(at(box(w*0.55,0.14,d*0.6,m.steelDark),0,h-0.05,d*0.02));
  g.add(at(box(w*0.48,0.10,d*0.5,m.black),0,h-0.03,d*0.02));
  // torneira
  g.add(at(cyl(0.018,0.018,0.22,m.steelDark),-w*0.0,h+0.10,-d/2+0.10));
  var spout=at(cyl(0.016,0.016,0.14,m.steelDark),0,h+0.20,-d/2+0.16); spout.rotation.x=Math.PI/2; g.add(spout);
  return g;
};

B.estoque=function(w,d,h){
  var g=new THREE.Group(),m=mats();
  // montantes
  var xs=[-w/2+0.03,w/2-0.03],zs=[-d/2+0.03,d/2-0.03];
  xs.forEach(function(x){ zs.forEach(function(z){ g.add(at(box(0.03,h,0.03,m.steelDark),x,h/2,z)); }); });
  // prateleiras + caixas
  var shelves=4, crates=[0xC9A05A,0xD8CDB6,0xB7895A,0xA9B0A0];
  for(var s=0;s<shelves;s++){
    var y=0.18+s*(h-0.2)/(shelves-1);
    g.add(at(box(w-0.02,0.025,d-0.02,m.shelf),0,y,0));
    if(s<shelves-1){
      var cm=new THREE.MeshPhongMaterial({color:crates[s%crates.length],shininess:8});
      g.add(at(box(w*0.4,0.16,d*0.7,cm),-w*0.22,y+0.10,0));
      g.add(at(box(w*0.34,0.14,d*0.6,cm),w*0.24,y+0.09,0));
    }
  }
  return g;
};

B.apoio=function(w,d,h){ var g=new THREE.Group(),m=mats();
  legs(g,w,d,h-0.03,0.05,0.04,m.steelDark);
  g.add(at(box(w,0.03,d,m.wood),0,h-0.015,0)); return g; };

B.lixeira=function(w,d,h){ var g=new THREE.Group(),m=mats();
  var r=Math.min(w,d)/2*0.9;
  g.add(at(cyl(r,r*0.86,h*0.9,m.steelDark,18),0,h*0.45,0));
  g.add(at(cyl(r*1.05,r*1.05,0.04,m.steel,18),0,h*0.9,0)); return g; };

B.extintor=function(w,d,h){ var g=new THREE.Group(),m=mats();
  var r=Math.min(w,d)/2*0.8;
  g.add(at(cyl(r,r,h*0.8,m.rosso,16),0,h*0.42,0));
  g.add(at(cyl(r*0.5,r*0.5,0.06,m.black,12),0,h*0.85,0));
  g.add(at(box(0.05,0.05,0.04,m.black),0,h*0.92,r*0.4)); return g; };

B.porta=function(w,d,h){ var g=new THREE.Group(),m=mats();
  // marco
  g.add(at(box(0.06,h,d,m.steelDark),-w/2,h/2,0));
  g.add(at(box(0.06,h,d,m.steelDark), w/2,h/2,0));
  g.add(at(box(w+0.06,0.06,d,m.steelDark),0,h-0.03,0));
  // folha aberta (gira no batente esquerdo, abre p/ +z)
  var leaf=new THREE.Group();
  leaf.add(at(box(0.04,h-0.06,w*0.92,m.wood),0,0,w*0.46));
  leaf.add(at(cyl(0.02,0.02,0.10,m.steel,10),0.03,0,w*0.86));
  leaf.position.set(-w/2,h/2,0); leaf.rotation.y=-0.5; g.add(leaf);
  return g; };

B.wall=function(w,d,h){ var g=new THREE.Group();
  g.add(at(box(w,h,d,new THREE.MeshPhongMaterial({color:0xEDE7D7,shininess:6})),0,h/2,0)); return g; };

window.PROPS=B;
})();
