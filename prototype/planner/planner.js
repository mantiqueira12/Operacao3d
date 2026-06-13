/* =====================================================================
   All'Antico Panino — LOJA 206 · Estúdio de planta
   Vanilla SVG floor-planner. 1 unidade SVG = 1 px ; SCALE px = 1 metro.
   ===================================================================== */
(function(){
"use strict";
var NS="http://www.w3.org/2000/svg";
var SCALE=100;                 // px por metro (no espaço "world")
var ROOM=[                     // polígono interno (metros)
  [0,0],[2.00,0],[2.00,3.00],[2.60,3.00],[2.60,5.15],[0,5.15]
];
var CUT_X=2.00, CUT_Y=3.00;    // recorte ausente: x>CUT_X & y<CUT_Y
var AREA_M2=2.00*3.00 + 2.60*2.15;  // 11,59 (geom.) — rótulo oficial: 11,00
var FOH_DEPTH=2.15;            // profundidade FOH (frente p/ cliente)
var DIVIDER_Y=5.15-FOH_DEPTH;  // y do painel divisor = 3,00 m
var SNAP=0.05;                 // grade de encaixe (m)
var MIN=0.20;                  // tamanho mínimo de peça (m)
var EPS=0.0005;

/* ---------- catálogo ---------- */
var CAT_COLORS={atendimento:"#E2000F",cozinha:"#1A1A1A",gerais:"#9A9284",estrutura:"#2B2B2B"};
/* altura (m) p/ a visão 3D, por tipo */
var HZ={balcao:1.05,caixa:1.05,vitrine:1.20,forno:1.60,geladeira:1.90,bibite:1.40,prep:0.90,batedeira:1.30,estufa:1.75,
  montagem:0.90,pia:0.90,estoque:1.80,apoio:0.75,lixeira:0.70,extintor:0.55,porta:2.10,wall:2.80,painel:2.80};
function hzFor(t){ return HZ[t]!=null?HZ[t]:0.90; }
var CATALOG={
  atendimento:[
    {t:"balcao",  n:"Balcão (divisa)",      w:1.80,h:0.55},
    {t:"caixa",   n:"Caixa · PDV",          w:0.70,h:0.55},
    {t:"vitrine", n:"Vitrine refrigerada",  w:1.20,h:0.55}
  ],
  cozinha:[
    {t:"forno",    n:"Forno focaccia",       w:0.90,h:0.70},
    {t:"batedeira",n:"Batedeira de massa",   w:0.55,h:0.55},
    {t:"estufa",   n:"Estufa de fermentação",w:0.62,h:0.75},
    {t:"geladeira",n:"Geladeira",            w:0.70,h:0.70},
    {t:"bibite",   n:"Geladeira bibite",     w:0.50,h:0.60},
    {t:"prep",     n:"Bancada de prep",      w:1.40,h:0.60},
    {t:"montagem", n:"Bancada de montagem",  w:1.20,h:0.60},
    {t:"pia",      n:"Pia / lavagem",        w:0.60,h:0.55},
    {t:"estoque",  n:"Estoque / prateleira", w:1.00,h:0.40}
  ],
  gerais:[
    {t:"porta",   n:"Porta",         w:0.80,h:0.12},
    {t:"lixeira", n:"Lixeira",       w:0.40,h:0.40},
    {t:"extintor",n:"Extintor",      w:0.25,h:0.15},
    {t:"apoio",   n:"Mesa de apoio", w:0.60,h:0.60}
  ],
  estrutura:[
    {t:"wall",    n:"Parede",         w:1.00,h:0.12},
    {t:"painel",  n:"Painel divisor", w:2.00,h:0.10}
  ]
};
var TYPE={}; // t -> {cat,n,w,h,hz}
Object.keys(CATALOG).forEach(function(c){ CATALOG[c].forEach(function(o){ TYPE[o.t]={cat:c,n:o.n,w:o.w,h:o.h,hz:hzFor(o.t)}; }); });

/* ---------- modelos personalizados (criados pelo usuário) ---------- */
var LS_CUSTOM="loja206_custom_v2";
var CUSTOM=[]; // [{t,n,w,h,hz,cat,color,arch}]
function regCustom(o){ TYPE[o.t]={cat:o.cat||"gerais",n:o.n,w:o.w,h:o.h,hz:o.hz,color:o.color,arch:o.arch,custom:true}; }
var DEFAULT_CUSTOM=[
  {t:"cstmq5i9f2u5",n:"Char-broiler 2 bocas",w:1.10,h:0.70,hz:1.15,cat:"cozinha",color:"#1A1A1A",arch:"appliance"}
];
function loadCustom(){
  CUSTOM=DEFAULT_CUSTOM.map(function(o){ return JSON.parse(JSON.stringify(o)); });
  try{ var a=JSON.parse(localStorage.getItem(LS_CUSTOM)); if(Array.isArray(a)&&a.length) CUSTOM=a; }catch(e){}
  CUSTOM.forEach(regCustom);
}
function saveCustom(){ try{ localStorage.setItem(LS_CUSTOM,JSON.stringify(CUSTOM)); }catch(e){} }
function normItem(o){
  var meta=TYPE[o.t]||{};
  if(o.hz==null) o.hz=(meta.hz!=null?meta.hz:hzFor(o.t));
  if(o.t==="painel" && o.hz<2.79) o.hz=2.80; // migração: painel divisor vai até o teto
  if(!o.color) o.color=meta.color||CAT_COLORS[meta.cat]||"#9A9284";
  if(!o.arch) o.arch=meta.arch||null;
  return o;
}

/* ---------- cena padrão (layout oficial validado no estudo — jun/2026) ---------- */
var DEFAULT_SCENE=[
  {t:"caixa",    n:"Caixa · PDV",            x:0.00, y:4.60, w:0.77, h:0.55, hz:1.05, color:"#E2000F"},
  {t:"vitrine",  n:"Vitrine refrigerada",    x:0.80, y:4.40, w:1.70, h:0.72, hz:1.20, color:"#E2000F"},
  {t:"montagem", n:"Bancada de montagem",    x:2.00, y:3.00, w:0.60, h:1.25, hz:0.90, color:"#1A1A1A"},
  {t:"estoque",  n:"Estoque",                x:0.08, y:0.10, w:1.00, h:0.40, hz:1.80, color:"#1A1A1A"},
  {t:"forno",    n:"Forno focaccia",         x:1.05, y:0.10, w:0.88, h:0.70, hz:1.60, color:"#1A1A1A"},
  {t:"batedeira",n:"Batedeira de massa",     x:1.40, y:1.00, w:0.55, h:0.55, hz:1.30, color:"#8A5A2B"},
  {t:"estufa",   n:"Estufa de fermentação",  x:1.32, y:1.70, w:0.62, h:0.75, hz:1.75, color:"#B5781F"},
  {t:"prep",     n:"Bancada de prep",        x:0.08, y:0.70, w:0.58, h:1.35, hz:0.90, color:"#1A1A1A"},
  {t:"pia",      n:"Pia / lavagem",          x:0.08, y:2.15, w:0.58, h:0.55, hz:0.90, color:"#1A1A1A"},
  {t:"bibite",   n:"Geladeira bibite",       x:0.00, y:3.35, w:0.48, h:0.70, hz:1.40, color:"#1A1A1A"},
  {t:"painel",   n:"Painel de fundo (FOH/BOH)", x:0.00, y:2.95, w:2.00, h:0.10, hz:2.80, color:"#EDE7D7", arch:"panel"}
];

/* ---------- estado ---------- */
var LS="loja206_studio_v2";
var scene=[], selId=null, idc=1;
var view={zoom:1,panX:0,panY:0};
var tool="select"; // select | measure
var measure={a:null,b:null};
var snapOn=true;

function uid(){ return "p"+(idc++); }
function loadState(){
  try{
    var s=JSON.parse(localStorage.getItem(LS));
    if(s&&s.scene&&s.scene.length){ scene=s.scene; idc=s.idc||(scene.length+1); scene.forEach(normItem); return; }
  }catch(e){}
  scene=DEFAULT_SCENE.map(function(o){ return clone(o); });
  scene.forEach(function(o){ o.id=uid(); normItem(o); });
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
/* ---------- histórico (undo/redo) ---------- */
var hist=[], hi=-1, HMAX=80, histLock=false;
function pushHist(){
  if(histLock) return;
  var s=JSON.stringify({scene:scene,idc:idc});
  if(hist[hi]===s) return;
  hist=hist.slice(0,hi+1); hist.push(s);
  if(hist.length>HMAX) hist.shift();
  hi=hist.length-1;
}
function restoreHist(s){
  histLock=true;
  var o=JSON.parse(s); scene=o.scene; idc=o.idc; scene.forEach(normItem);
  selId=null; renderItems(); syncProps(); updateStats(); persist();
  histLock=false;
}
function undo(){ if(hi>0){ hi--; restoreHist(hist[hi]); } }
function redo(){ if(hi<hist.length-1){ hi++; restoreHist(hist[hi]); } }
function persist(){ try{ localStorage.setItem(LS,JSON.stringify({scene:scene,idc:idc})); }catch(e){} pushHist(); }

/* ---------- helpers svg ---------- */
function E(tag,attrs,parent){
  var e=document.createElementNS(NS,tag);
  if(attrs) for(var k in attrs) e.setAttribute(k,attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}
function snap(v){ return snapOn ? Math.round(v/SNAP)*SNAP : Math.round(v*1000)/1000; }
function fmt(m){ return m.toFixed(2).replace(".",","); }

/* ---------- validação / encaixe na sala ---------- */
function inRoom(r){
  if(r.x< -EPS||r.y< -EPS) return false;
  if(r.x+r.w>2.60+EPS||r.y+r.h>5.15+EPS) return false;
  if(r.x+r.w>CUT_X+EPS && r.y<CUT_Y-EPS) return false; // recorte
  return true;
}
function clampMove(r){ // empurra peça pra dentro (usado em mover/inserir)
  if(r.x<0) r.x=0; if(r.y<0) r.y=0;
  if(r.x+r.w>2.60) r.x=2.60-r.w; if(r.y+r.h>5.15) r.y=5.15-r.h;
  if(r.x<0) r.x=0; if(r.y<0) r.y=0;
  if(r.x+r.w>CUT_X+EPS && r.y<CUT_Y-EPS){
    var pushL=(r.x+r.w)-CUT_X, pushD=CUT_Y-r.y;
    if(pushL<=pushD && (CUT_X-r.w)>=-EPS) r.x=CUT_X-r.w; else r.y=CUT_Y;
  }
  if(r.x+r.w>2.60) r.x=2.60-r.w; if(r.y+r.h>5.15) r.y=5.15-r.h;
  if(r.x<0) r.x=0; if(r.y<0) r.y=0;
  return r;
}

/* =====================================================================
   RENDER
   ===================================================================== */
var svg=document.getElementById("scene");
var worldG, gGrid,gFloor,gCota,gZone,gFoh,gItems,gOverlay,gMeasure,gDraft;

function buildSkeleton(){
  svg.innerHTML="";
  worldG=E("g",{id:"world"},svg);
  gFloor=E("g",{class:"floor-layer"},worldG);
  gGrid =E("g",{class:"grid-layer"},worldG);
  gFoh  =E("g",{class:"fohboh-layer"},worldG);
  gZone =E("g",{class:"zone-layer"},worldG);
  gItems=E("g",{class:"item-layer"},worldG);
  gCota =E("g",{class:"cota-layer"},worldG);
  gMeasure=E("g",{class:"measure-layer"},worldG);
  gDraft=E("g",{class:"draft-layer"},worldG);
  gOverlay=E("g",{class:"overlay-layer"},worldG); // handles
  drawFloor(); drawGrid(); drawFohBoh(); drawZones(); drawCotas();
}
/* ---- setor FOH (frente, cliente) / BOH (produção) ---- */
function drawFohBoh(){
  if(!gFoh) return; gFoh.innerHTML="";
  var W=2.60, H=5.15, dy=DIVIDER_Y;
  // BOH = topo (y 0..dy) ; FOH = base (y dy..H)
  // BOH respeita o recorte: x 0..2.00 acima do degrau
  E("path",{d:"M0,0 L"+px(2.00)+",0 L"+px(2.00)+","+px(dy)+" L0,"+px(dy)+" Z",class:"boh-fill"},gFoh);
  E("rect",{x:0,y:px(dy),width:px(W),height:px(H-dy),class:"foh-fill"},gFoh);
  // linha divisora
  E("line",{x1:0,y1:px(dy),x2:px(W),y2:px(dy),class:"fohboh-div"},gFoh);
  // rótulos
  var b=E("text",{x:px(0.30),y:px(0.30),class:"fohboh-t","font-size":11,"text-anchor":"start"},gFoh); b.textContent="BOH · PRODUÇÃO";
  var f=E("text",{x:px(0.30),y:px(dy)+18,class:"fohboh-t","font-size":11,"text-anchor":"start"},gFoh); f.textContent="FOH · ATENDIMENTO";
  var d=E("text",{x:px(W)-6,y:px(dy)-7,class:"fohboh-d","font-size":10,"text-anchor":"end"},gFoh); d.textContent="divisa · "+fmt(FOH_DEPTH)+" m da frente";
}

function px(m){ return m*SCALE; }
function pathD(poly){ return "M"+poly.map(function(p){return px(p[0])+","+px(p[1]);}).join(" L")+" Z"; }

function drawFloor(){
  var d=pathD(ROOM);
  // casca aberta na frente: o vão de 2,60 é portão de enrolar, não parede
  var open="M"+px(0)+","+px(5.15)+" L"+px(0)+","+px(0)+" L"+px(2.00)+","+px(0)
          +" L"+px(2.00)+","+px(3.00)+" L"+px(2.60)+","+px(3.00)+" L"+px(2.60)+","+px(5.15);
  E("path",{d:d,class:"floor"},gFloor);
  E("path",{d:open,fill:"none",stroke:"#1A1A1A","stroke-width":15,"stroke-linejoin":"miter","stroke-linecap":"square","vector-effect":"non-scaling-stroke"},gFloor);
  // portão de enrolar (simbologia: linha tracejada + batentes)
  E("line",{x1:0,y1:px(5.15),x2:px(2.60),y2:px(5.15),class:"gate-line"},gFloor);
  E("rect",{x:-2,y:px(5.15)-2,width:8,height:8,class:"gate-post"},gFloor);
  E("rect",{x:px(2.60)-6,y:px(5.15)-2,width:8,height:8,class:"gate-post"},gFloor);
  var gt=E("text",{x:px(1.30),y:px(5.15)-8,class:"gate-t","font-size":9.5},gFloor);
  gt.textContent="portão de enrolar · 2,60 m";
}
function drawGrid(){
  var clip=E("clipPath",{id:"rclip"},gGrid); E("path",{d:pathD(ROOM)},clip);
  var g=E("g",{"clip-path":"url(#rclip)"},gGrid);
  var x,y;
  for(x=0.1;x<2.60;x+=0.1){ E("line",{x1:px(x),y1:0,x2:px(x),y2:px(5.15),class:"grid-minor"},g); }
  for(y=0.1;y<5.15;y+=0.1){ E("line",{x1:0,y1:px(y),x2:px(2.60),y2:px(y),class:"grid-minor"},g); }
  for(x=0.5;x<2.60;x+=0.5){ E("line",{x1:px(x),y1:0,x2:px(x),y2:px(5.15),class:"grid-major"},g); }
  for(y=0.5;y<5.15;y+=0.5){ E("line",{x1:0,y1:px(y),x2:px(2.60),y2:px(y),class:"grid-major"},g); }
}
function drawZones(){
  var t1=E("text",{x:px(1.0),y:px(2.55),class:"zone-t","font-size":15,transform:"rotate(-90 "+px(1.0)+" "+px(2.55)+")"},gZone); t1.textContent="01 · COZINHA";
  var t2=E("text",{x:px(1.0),y:px(4.30),class:"zone-t","font-size":13},gZone); t2.textContent="02 · PREPARO";
  // entrada / cliente externo (abaixo do balcão)
  var ey=px(5.35);
  var arr="M"+px(1.3)+","+(ey)+" l-7,8 l4,0 l0,9 l6,0 l0,-9 l4,0 Z";
  [-0.45,0,0.45].forEach(function(dx){
    E("path",{d:"M"+px(1.3+dx)+","+(ey-2)+" l-6,7 l3.5,0 l0,8 l5,0 l0,-8 l3.5,0 Z",class:"ent-arr"},gZone);
  });
  var et=E("text",{x:px(1.3),y:ey+34,class:"ent-t","font-size":13},gZone); et.textContent="CLIENTE · ATENDIMENTO EXTERNO";
  var es=E("text",{x:px(1.3),y:ey+50,class:"ent-sub","font-size":10},gZone); es.textContent="portão de enrolar · vão livre 2,60 m";
}

/* cotas fixas (descrevem a casca) */
function dimLine(g,x1,y1,x2,y2){
  E("line",{x1:x1,y1:y1,x2:x2,y2:y2,class:"cota-l","marker-start":"url(#ah)","marker-end":"url(#ah)"},g);
}
function dimWit(g,x1,y1,x2,y2){ E("line",{x1:x1,y1:y1,x2:x2,y2:y2,class:"cota-w"},g); }
function dimTxt(g,x,y,t,rot){
  var e=E("text",{x:x,y:y,class:"cota-t","font-size":13,"dominant-baseline":"middle"},g);
  if(rot) e.setAttribute("transform","rotate("+rot+" "+x+" "+y+")");
  e.textContent=t;
}
function drawCotas(){
  var defs=E("defs",{},gCota);
  var mk=E("marker",{id:"ah",markerWidth:9,markerHeight:9,refX:7,refY:4.5,orient:"auto",markerUnits:"userSpaceOnUse"},defs);
  E("path",{d:"M7,1 L1,4.5 L7,8 Z",fill:"#3a3a3a"},mk);
  var g=gCota, W=px(2.60),H=px(5.15), X2=px(2.00),Y3=px(3.00);
  // 2,00 topo
  dimWit(g,0,0,0,-46); dimWit(g,X2,0,X2,-46); dimLine(g,0,-34,X2,-34); dimTxt(g,X2/2,-34,"2,00");
  // 5,15 esq
  dimWit(g,0,0,-66,0); dimWit(g,0,H,-66,H); dimLine(g,-54,0,-54,H); dimTxt(g,-54,H/2,"5,15",-90);
  // 3,00 dir (trecho sup)
  dimWit(g,X2,0,X2+96,0); dimWit(g,W,Y3,X2+96,Y3); dimLine(g,X2+84,0,X2+84,Y3); dimTxt(g,X2+84,Y3/2,"3,00",-90);
  // 0,60 degrau
  dimWit(g,X2,Y3,X2,Y3+30); dimWit(g,W,Y3,W,Y3+30); dimLine(g,X2,Y3+20,W,Y3+20); dimTxt(g,(X2+W)/2,Y3+20,"0,60");
  // 2,15 dir inf
  dimWit(g,W,Y3,W+72,Y3); dimWit(g,W,H,W+72,H); dimLine(g,W+60,Y3,W+60,H); dimTxt(g,W+60,(Y3+H)/2,"2,15",-90);
  // 2,60 base
  dimWit(g,0,H,0,H+46); dimWit(g,W,H,W,H+46); dimLine(g,0,H+34,W,H+34); dimTxt(g,W/2,H+34,"2,60");
}

/* ---------- itens ---------- */
function renderItems(){
  gItems.innerHTML="";
  scene.forEach(function(it){
    var meta=TYPE[it.t]||{cat:"gerais"};
    var col=it.color||meta.color||CAT_COLORS[meta.cat]||"#9A9284";
    var g=E("g",{class:"item"+(it.id===selId?" sel":""),"data-id":it.id,transform:"translate("+px(it.x)+","+px(it.y)+")"},gItems);
    if(it.t==="porta"){ drawDoor(g,it,col); }
    else if(it.t==="wall"){ drawWall(g,it); }
    else if(it.t==="painel"){ drawPanel(g,it); }
    else{
      E("rect",{x:0,y:0,width:px(it.w),height:px(it.h),rx:3,class:"item-rect"},g);
      E("rect",{x:0,y:0,width:px(it.w),height:5,fill:col,class:"item-accent"},g);
      var cx=px(it.w)/2, cy=px(it.h)/2, fs=Math.max(9,Math.min(13,px(it.w)/it.n.length*1.5));
      fs=Math.min(fs,12);
      var lab=E("text",{x:cx,y:cy-3,class:"item-label","font-size":fs},g);
      wrapLabel(lab,it.n,px(it.w)-8,cx);
      var dm=E("text",{x:cx,y:cy+ (px(it.h)>46?14:11),class:"item-dim","font-size":8.5},g);
      dm.textContent=fmt(it.w)+" × "+fmt(it.h);
      if(px(it.h)<34){ dm.setAttribute("y",px(it.h)-4); lab.setAttribute("y",13); }
    }
  });
  renderOverlay();
}
function wrapLabel(textEl,str,maxw,cx){
  // quebra simples em até 2 linhas
  var words=str.split(" "); var lines=[],cur="";
  words.forEach(function(w){
    var test=cur?cur+" "+w:w;
    if(test.length>14 && cur){ lines.push(cur); cur=w; } else cur=test;
  });
  if(cur) lines.push(cur);
  if(lines.length>2){ lines=[lines[0], lines.slice(1).join(" ")]; }
  var y0=lines.length>1?-5:0;
  lines.forEach(function(ln,i){
    var ts=E("tspan",{x:cx,dy:(i===0?y0:11)},textEl); ts.textContent=ln;
  });
}
function drawWall(g,it){
  E("rect",{x:0,y:0,width:px(it.w),height:px(it.h),fill:"#2B2B2B",stroke:"#000","stroke-width":1,"vector-effect":"non-scaling-stroke"},g);
}
function drawPanel(g,it){
  var w=px(it.w),h=px(it.h);
  var horiz=it.w>=it.h;
  var len=horiz?it.w:it.h;
  // porta de correr no lado esquerdo (0,10 → 0,90 m), se couber
  var hasDoor=len>=1.10;
  var d0=px(0.10), d1=px(Math.min(0.90,len-0.20));
  E("rect",{x:0,y:0,width:w,height:h,class:"panel-rect"},g);
  var step=7,lim=w+h;
  for(var o=step;o<lim;o+=step){
    var x1=Math.max(0,o-h), y1=Math.min(o,h), x2=Math.min(o,w), y2=Math.max(0,o-w);
    E("line",{x1:x1,y1:y1,x2:x2,y2:y2,class:"panel-hatch"},g);
  }
  if(hasDoor){
    var dw=d1-d0;
    if(horiz){
      E("rect",{x:d0,y:-1,width:dw,height:h+2,class:"panel-gap"},g);                  // vão
      E("rect",{x:d1,y:-h*0.65-3,width:dw,height:h*0.65,class:"panel-leaf"},g);       // folha aberta (desliza p/ direita)
      E("line",{x1:d1+dw-4,y1:-h*0.33-3,x2:d0+dw*0.55,y2:-h*0.33-3,class:"panel-arr","marker-end":"url(#ah)"},g);
      var dt=E("text",{x:d0+dw/2,y:h+11,class:"item-dim","font-size":8},g); dt.textContent="porta de correr "+fmt((d1-d0)/SCALE);
    } else {
      E("rect",{x:-1,y:d0,width:w+2,height:dw,class:"panel-gap"},g);
      E("rect",{x:-w*0.65-3,y:d1,width:w*0.65,height:dw,class:"panel-leaf"},g);
      E("line",{x1:-w*0.33-3,y1:d1+dw-4,x2:-w*0.33-3,y2:d0+dw*0.55,class:"panel-arr","marker-end":"url(#ah)"},g);
    }
  }
  var lab=E("text",{x:w/2,y:h/2,class:"item-dim","font-size":8.5,"dominant-baseline":"middle"},g);
  if(horiz) lab.textContent=it.n||"Painel";
}
function drawDoor(g,it,col){
  var w=px(it.w),h=px(it.h);
  E("rect",{x:0,y:0,width:w,height:h,fill:"#fff",stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
  // folha + arco
  if(it.w>=it.h){ // horizontal
    E("line",{x1:0,y1:h/2,x2:0,y2:h/2-w,stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
    E("path",{d:"M0,"+(h/2-w)+" A"+w+","+w+" 0 0 1 "+w+","+(h/2),fill:"none",stroke:col,"stroke-width":1,"stroke-dasharray":"3 3","vector-effect":"non-scaling-stroke"},g);
  } else {
    E("line",{x1:w/2,y1:0,x2:w/2+h,y2:0,stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
    E("path",{d:"M"+(w/2+h)+",0 A"+h+","+h+" 0 0 1 "+(w/2)+","+h,fill:"none",stroke:col,"stroke-width":1,"stroke-dasharray":"3 3","vector-effect":"non-scaling-stroke"},g);
  }
  var t=E("text",{x:w/2,y:h+11,class:"item-dim","font-size":8.5},g); t.textContent="porta "+fmt(it.w)+"m";
}

/* ---------- handles de seleção ---------- */
var HANDLES=[["nw",0,0],["n",.5,0],["ne",1,0],["e",1,.5],["se",1,1],["s",.5,1],["sw",0,1],["w",0,.5]];
function renderOverlay(){
  gOverlay.innerHTML="";
  if(!selId) return;
  var it=byId(selId); if(!it) return;
  drawClearances(it);
  var X=px(it.x),Y=px(it.y),W=px(it.w),H=px(it.h);
  E("rect",{x:X,y:Y,width:W,height:H,class:"selbox"},gOverlay);
  var hs=10/view.zoom;
  if(it.t!=="porta"){
    HANDLES.forEach(function(h){
      var hx=X+W*h[1], hy=Y+H*h[2];
      E("rect",{x:hx-hs/2,y:hy-hs/2,width:hs,height:hs,rx:2,class:"handle","data-handle":h[0],"data-id":it.id,style:"cursor:"+cursorFor(h[0])},gOverlay);
    });
  }
  // alça de girar
  var rx=X+W/2, ry=Y-22/view.zoom;
  E("line",{x1:X+W/2,y1:Y,x2:rx,y2:ry,class:"selbox"},gOverlay);
  E("circle",{cx:rx,cy:ry,r:hs/1.6,class:"handle rot","data-handle":"rot","data-id":it.id,style:"cursor:grab"},gOverlay);
}
function cursorFor(h){
  return {nw:"nwse-resize",se:"nwse-resize",ne:"nesw-resize",sw:"nesw-resize",n:"ns-resize",s:"ns-resize",e:"ew-resize",w:"ew-resize"}[h]||"move";
}

/* ---------- folgas automáticas (circulação) ---------- */
function drawClearances(it){
  if(it.t==="porta") return;
  // limites da casca conforme posição (recorte em L)
  var rightWall=(it.y>=CUT_Y-EPS)?2.60:CUT_X;
  var lE=0, rE=rightWall, tE=0, bE=5.15;
  scene.forEach(function(o){
    if(o.id===it.id||o.t==="porta") return;
    var yOver=o.y<it.y+it.h-EPS && o.y+o.h>it.y+EPS;
    var xOver=o.x<it.x+it.w-EPS && o.x+o.w>it.x+EPS;
    if(yOver){
      if(o.x+o.w<=it.x+EPS && o.x+o.w>lE) lE=o.x+o.w;
      if(o.x>=it.x+it.w-EPS && o.x<rE) rE=o.x;
    }
    if(xOver){
      if(o.y+o.h<=it.y+EPS && o.y+o.h>tE) tE=o.y+o.h;
      if(o.y>=it.y+it.h-EPS && o.y<bE) bE=o.y;
    }
  });
  var cy=px(it.y+it.h/2), cx=px(it.x+it.w/2);
  function cl(gap,x1,y1,x2,y2,vert){
    if(gap<0.03) return; // encostado: sem cota
    var cls=gap<0.60?"clr bad":(gap<0.90?"clr warn":"clr ok");
    E("line",{x1:x1,y1:y1,x2:x2,y2:y2,class:cls},gOverlay);
    E("line",{x1:x1,y1:y1-(vert?0:4),x2:x1,y2:y1+(vert?0:4),class:cls},gOverlay);
    E("line",{x1:x2-(vert?4:0),y1:y2-(vert?0:4),x2:x2+(vert?4:0),y2:y2+(vert?0:4),class:cls},gOverlay);
    if(vert){ E("line",{x1:x1-4,y1:y1,x2:x1+4,y2:y1,class:cls},gOverlay); E("line",{x1:x2-4,y1:y2,x2:x2+4,y2:y2,class:cls},gOverlay); }
    var t=E("text",{x:(x1+x2)/2+(vert?9:0),y:(y1+y2)/2-(vert?0:5),class:"clr-t "+cls.split(" ")[1],"font-size":9.5},gOverlay);
    if(vert) t.setAttribute("text-anchor","start");
    t.textContent=fmt(gap);
  }
  cl(it.x-lE,       px(lE),cy, px(it.x),cy, false);
  cl(rE-(it.x+it.w),px(it.x+it.w),cy, px(rE),cy, false);
  cl(it.y-tE,       cx,px(tE), cx,px(it.y), true);
  cl(bE-(it.y+it.h),cx,px(it.y+it.h), cx,px(bE), true);
}

/* =====================================================================
   VIEW: zoom / pan / fit
   ===================================================================== */
var CONTENT={minX:-1.15,minY:-0.70,maxX:3.55,maxY:6.05}; // metros (inclui cotas)
function applyView(){
  worldG.setAttribute("transform","translate("+view.panX+","+view.panY+") scale("+view.zoom+")");
  var z=document.getElementById("zoomlbl"); if(z) z.textContent=Math.round(view.zoom*100)+"%";
}
function fit(){
  var r=svg.getBoundingClientRect();
  var cw=px(CONTENT.maxX-CONTENT.minX), ch=px(CONTENT.maxY-CONTENT.minY);
  var z=Math.min(r.width/cw, r.height/ch)*0.94;
  view.zoom=z;
  view.panX=(r.width-cw*z)/2 - px(CONTENT.minX)*z;
  view.panY=(r.height-ch*z)/2 - px(CONTENT.minY)*z;
  applyView();
}
function zoomBy(f,cx,cy){
  var r=svg.getBoundingClientRect();
  if(cx==null){ cx=r.width/2; cy=r.height/2; }
  var nz=Math.max(0.3,Math.min(4,view.zoom*f));
  // ponto world sob cursor mantém-se fixo
  var wx=(cx-view.panX)/view.zoom, wy=(cy-view.panY)/view.zoom;
  view.zoom=nz; view.panX=cx-wx*nz; view.panY=cy-wy*nz;
  applyView(); renderOverlay();
}

/* client -> metros */
function toMeters(evt){
  var ctm=worldG.getScreenCTM().inverse();
  var pt=svg.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY;
  var p=pt.matrixTransform(ctm);
  return {x:p.x/SCALE, y:p.y/SCALE};
}
function localXY(evt){ var r=svg.getBoundingClientRect(); return {x:evt.clientX-r.left,y:evt.clientY-r.top}; }

/* =====================================================================
   INTERAÇÃO
   ===================================================================== */
function byId(id){ for(var i=0;i<scene.length;i++) if(scene[i].id===id) return scene[i]; return null; }
var drag=null;
var wallDraft=null;

/* ---------- desenhar parede ---------- */
function wallRect(s,e){
  var dx=e.x-s.x, dy=e.y-s.y, th=0.12;
  if(Math.abs(dx)>=Math.abs(dy)){ return {x:Math.min(s.x,e.x),y:s.y-th/2,w:Math.abs(dx),h:th}; }
  return {x:s.x-th/2,y:Math.min(s.y,e.y),w:th,h:Math.abs(dy)};
}
function drawWallDraft(){
  if(!gDraft) return; gDraft.innerHTML="";
  if(!wallDraft) return;
  var r=wallRect(wallDraft.s,wallDraft.e);
  E("rect",{x:px(r.x),y:px(r.y),width:px(r.w),height:px(r.h),fill:"rgba(43,43,43,.55)",stroke:"#2B2B2B","stroke-width":1.5,"vector-effect":"non-scaling-stroke"},gDraft);
  var len=Math.max(r.w,r.h);
  var t=E("text",{x:px(r.x+r.w/2),y:px(r.y+r.h/2)-6,class:"measure-t","font-size":12},gDraft); t.textContent=fmt(len)+" m";
}
function wallDown(evt){
  var m=toMeters(evt); var s={x:snap(m.x),y:snap(m.y)};
  wallDraft={s:s,e:s}; drawWallDraft(); svg.setPointerCapture(evt.pointerId);
}
function wallMove(evt){
  if(!wallDraft) return; var m=toMeters(evt); wallDraft.e={x:snap(m.x),y:snap(m.y)}; drawWallDraft();
}
function wallUp(evt){
  var dr=wallDraft; wallDraft=null; if(gDraft) gDraft.innerHTML="";
  if(!dr) return;
  var r=wallRect(dr.s,dr.e); var len=Math.max(r.w,r.h);
  if(len<0.20) return;
  var it={id:uid(),t:"wall",n:"Parede",x:r.x,y:r.y,w:r.w,h:r.h};
  normItem(it);
  clampMove(it);
  if(inRoom(it)){ scene.push(it); persist(); select(it.id); updateStats(); }
}

svg.addEventListener("pointerdown",function(evt){
  if(evt.button===1||evt.button===2){ startPan(evt); return; }
  if(tool==="measure"){ measureClick(evt); return; }
  if(tool==="wall"){ wallDown(evt); return; }
  var hEl=evt.target.closest("[data-handle]");
  if(hEl){ startHandle(evt,hEl); return; }
  var iEl=evt.target.closest(".item");
  if(iEl){ startItemDrag(evt,iEl.getAttribute("data-id")); return; }
  // vazio -> pan + deselect
  select(null);
  startPan(evt);
});

function startItemDrag(evt,id){
  select(id);
  var it=byId(id), m=toMeters(evt);
  drag={mode:"move",it:it,ox:m.x-it.x,oy:m.y-it.y,start:clone(it)};
  svg.setPointerCapture(evt.pointerId);
}
function startHandle(evt,el){
  var id=el.getAttribute("data-id"), h=el.getAttribute("data-handle"), it=byId(id);
  select(id);
  drag={mode:(h==="rot"?"rotate":"resize"),it:it,h:h,start:clone(it)};
  svg.setPointerCapture(evt.pointerId);
  evt.stopPropagation();
}
function startPan(evt){
  drag={mode:"pan",sx:evt.clientX,sy:evt.clientY,px0:view.panX,py0:view.panY};
  svg.classList.add("panning"); svg.setPointerCapture(evt.pointerId);
}

svg.addEventListener("pointermove",function(evt){
  var m;
  if(wallDraft){ wallMove(evt); return; }
  if(tool==="measure" && measure.a && !measure.b){ previewMeasure(evt); }
  if(!drag){ updateReadoutAt(evt); return; }
  if(drag.mode==="pan"){
    view.panX=drag.px0+(evt.clientX-drag.sx); view.panY=drag.py0+(evt.clientY-drag.sy); applyView(); return;
  }
  m=toMeters(evt);
  if(drag.mode==="move"){
    var r={x:snap(m.x-drag.ox),y:snap(m.y-drag.oy),w:drag.it.w,h:drag.it.h};
    clampMove(r); drag.it.x=r.x; drag.it.y=r.y;
    updateItemGfx(drag.it); renderOverlay(); syncProps(); updateReadoutItem(drag.it);
  } else if(drag.mode==="resize"){
    doResize(drag.it,drag.h,m); updateItemGfx(drag.it); renderOverlay(); syncProps(); updateReadoutItem(drag.it);
  } else if(drag.mode==="rotate"){
    // gira 90°: troca w<->h em torno do centro, se válido
    rotate90(drag.it); drag.mode="rotated"; // uma vez por gesto
  }
});
["pointerup","pointercancel"].forEach(function(ev){
  svg.addEventListener(ev,function(evt){
    if(wallDraft){ wallUp(evt); }
    if(drag){ svg.classList.remove("panning"); if(drag.it) persist(); }
    drag=null; updateStats();
  });
});

function doResize(it,h,m){
  var s=drag.start, r={x:it.x,y:it.y,w:it.w,h:it.h};
  var left=s.x,top=s.y,right=s.x+s.w,bot=s.y+s.h;
  if(h.indexOf("w")>=0) left=snap(m.x);
  if(h.indexOf("e")>=0) right=snap(m.x);
  if(h.indexOf("n")>=0) top=snap(m.y);
  if(h.indexOf("s")>=0) bot=snap(m.y);
  if(right-left<MIN){ if(h.indexOf("w")>=0) left=right-MIN; else right=left+MIN; }
  if(bot-top<MIN){ if(h.indexOf("n")>=0) top=bot-MIN; else bot=top+MIN; }
  var nr={x:left,y:top,w:right-left,h:bot-top};
  if(inRoom(nr)){ it.x=nr.x; it.y=nr.y; it.w=Math.round(nr.w*1000)/1000; it.h=Math.round(nr.h*1000)/1000; }
}
function rotate90(it){
  var cx=it.x+it.w/2, cy=it.y+it.h/2;
  var nr={x:cx-it.h/2, y:cy-it.w/2, w:it.h, h:it.w};
  nr.x=snap(nr.x); nr.y=snap(nr.y);
  clampMove(nr);
  if(inRoom(nr)){ it.x=nr.x; it.y=nr.y; it.w=nr.w; it.h=nr.h; updateItemGfx(it,true); renderOverlay(); syncProps(); persist(); }
}
function updateItemGfx(it,full){
  // re-render só o item (simples: re-render tudo p/ robustez visual)
  renderItems();
}

/* ---------- seleção ---------- */
function select(id){ selId=id; renderItems(); syncProps(); }

/* ---------- inserir do catálogo ---------- */
function addItem(t){
  var meta=TYPE[t]; if(!meta) return;
  // posição: centro da viewport, snap, encaixe
  var r=svg.getBoundingClientRect();
  var c=toMeters({clientX:r.left+r.width/2,clientY:r.top+r.height/2});
  var it={id:uid(),t:t,n:meta.n,x:snap(c.x-meta.w/2),y:snap(c.y-meta.h/2),w:meta.w,h:meta.h};
  normItem(it);
  clampMove(it);
  if(!inRoom(it)){ it.x=snap(0.1); it.y=snap(0.1); clampMove(it); }
  scene.push(it); persist(); select(it.id); updateStats();
}
function duplicateSel(){
  var it=byId(selId); if(!it) return;
  var c=clone(it); c.id=uid(); c.x=snap(it.x+0.15); c.y=snap(it.y+0.15); clampMove(c);
  scene.push(c); persist(); select(c.id); updateStats();
}
function deleteSel(){
  if(!selId) return;
  scene=scene.filter(function(z){return z.id!==selId;});
  selId=null; persist(); renderItems(); syncProps(); updateStats();
}

/* =====================================================================
   PROPRIEDADES (painel numérico)
   ===================================================================== */
var pEmpty=document.getElementById("propsEmpty"), pForm=document.getElementById("propsForm");
var fName=document.getElementById("f-name"),fW=document.getElementById("f-w"),fH=document.getElementById("f-h"),
    fX=document.getElementById("f-x"),fY=document.getElementById("f-y"),fZ=document.getElementById("f-z"),
    pBadge=document.getElementById("p-badge"), fColor=document.getElementById("f-color");
function syncProps(){
  var it=byId(selId);
  if(!it){ pEmpty.style.display="block"; pForm.style.display="none"; return; }
  pEmpty.style.display="none"; pForm.style.display="flex";
  if(document.activeElement!==fName) fName.value=it.n;
  if(document.activeElement!==fW) fW.value=fmt(it.w);
  if(document.activeElement!==fH) fH.value=fmt(it.h);
  if(document.activeElement!==fX) fX.value=fmt(it.x);
  if(document.activeElement!==fY) fY.value=fmt(it.y);
  if(document.activeElement!==fZ) fZ.value=fmt(it.hz!=null?it.hz:hzFor(it.t));
  var meta=TYPE[it.t]||{cat:"gerais"};
  var col=it.color||meta.color||CAT_COLORS[meta.cat]||"#9A9284";
  var tag=meta.custom?"modelo":(meta.cat||"");
  pBadge.innerHTML='<span class="dot" style="background:'+col+'"></span>'+tag;
  if(fColor) fColor.querySelectorAll(".swatch").forEach(function(s){ s.classList.toggle("active",s.dataset.col.toLowerCase()===String(col).toLowerCase()); });
}
function pnum(v){ return parseFloat(String(v).replace(",",".")); }
function applyProps(commit){
  var it=byId(selId); if(!it) return;
  it.n=fName.value||it.n;
  var z=pnum(fZ.value); if(!isNaN(z)) it.hz=Math.max(0.05,z);
  var w=pnum(fW.value),h=pnum(fH.value),x=pnum(fX.value),y=pnum(fY.value);
  var nr={x:isNaN(x)?it.x:x,y:isNaN(y)?it.y:y,w:isNaN(w)?it.w:Math.max(MIN,w),h:isNaN(h)?it.h:Math.max(MIN,h)};
  if(inRoom(nr)){ it.x=nr.x;it.y=nr.y;it.w=nr.w;it.h=nr.h; }
  else if(commit){ clampMove(nr); if(inRoom(nr)){it.x=nr.x;it.y=nr.y;it.w=nr.w;it.h=nr.h;} }
  renderItems(); if(commit){ syncProps(); persist(); updateStats(); }
}
[fName,fW,fH,fX,fY,fZ].forEach(function(inp){
  inp.addEventListener("input",function(){ applyProps(false); });
  inp.addEventListener("change",function(){ applyProps(true); });
  inp.addEventListener("keydown",function(e){
    if(e.key==="Enter"){ inp.blur(); }
    if((e.key==="ArrowUp"||e.key==="ArrowDown") && inp!==fName){
      e.preventDefault(); var step=e.shiftKey?0.10:0.05;
      var v=pnum(inp.value)||0; v+= (e.key==="ArrowUp"?step:-step);
      inp.value=fmt(Math.max(0,v)); applyProps(true);
    }
  });
});
if(fColor) fColor.querySelectorAll(".swatch").forEach(function(s){
  s.addEventListener("click",function(){ var it=byId(selId); if(!it) return; it.color=s.dataset.col; renderItems(); syncProps(); persist(); });
});
var bSave=document.getElementById("btn-savemodel");
if(bSave) bSave.addEventListener("click",function(){ var it=byId(selId); if(it) saveAsModel(it); });
document.getElementById("btn-rotate").addEventListener("click",function(){ var it=byId(selId); if(it) rotate90(it); });
document.getElementById("btn-dup").addEventListener("click",duplicateSel);
document.getElementById("btn-del").addEventListener("click",deleteSel);

/* =====================================================================
   STATS
   ===================================================================== */
function updateStats(){
  var occ=0,cnt=0; scene.forEach(function(it){ if(it.t!=="porta"&&it.t!=="wall"&&it.t!=="painel"){ occ+=it.w*it.h; cnt++; } });
  var label=11.00; // área oficial da planta
  var pct=Math.min(100,Math.round(occ/label*100));
  document.getElementById("st-occ").textContent=fmt(occ)+" m²";
  document.getElementById("st-free").textContent=fmt(Math.max(0,label-occ))+" m²";
  document.getElementById("st-count").textContent=cnt;
  document.getElementById("st-pct").textContent=pct+"%";
  document.getElementById("bar-fill").style.width=pct+"%";
}

/* =====================================================================
   READOUT
   ===================================================================== */
var roX=document.getElementById("ro-x"),roY=document.getElementById("ro-y"),roInfo=document.getElementById("ro-info");
function updateReadoutAt(evt){
  var m=toMeters(evt);
  if(m.x>=-0.2&&m.x<=2.8&&m.y>=-0.2&&m.y<=5.35){ roX.textContent=fmt(Math.max(0,m.x)); roY.textContent=fmt(Math.max(0,m.y)); }
}
function updateReadoutItem(it){ roInfo.innerHTML="<b>"+it.n+"</b> · "+fmt(it.w)+"×"+fmt(it.h)+" m"; }

/* =====================================================================
   MEDIR
   ===================================================================== */
var mPreview=null;
function measureClick(evt){
  var m=toMeters(evt);
  if(!measure.a){ measure.a={x:m.x,y:m.y}; measure.b=null; }
  else if(!measure.b){ measure.b={x:m.x,y:m.y}; drawMeasure(); }
  else { measure.a={x:m.x,y:m.y}; measure.b=null; drawMeasure(); }
}
function previewMeasure(evt){
  var m=toMeters(evt); var tmp={a:measure.a,b:{x:m.x,y:m.y}}; drawMeasure(tmp);
}
function drawMeasure(tmp){
  gMeasure.innerHTML="";
  var a=(tmp||measure).a, b=(tmp||measure).b;
  if(a){ E("circle",{cx:px(a.x),cy:px(a.y),r:3,fill:"#E2000F"},gMeasure); }
  if(a&&b){
    E("line",{x1:px(a.x),y1:px(a.y),x2:px(b.x),y2:px(b.y),class:"measure-l"},gMeasure);
    E("circle",{cx:px(b.x),cy:px(b.y),r:3,fill:"#E2000F"},gMeasure);
    var d=Math.hypot(b.x-a.x,b.y-a.y);
    var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    var t=E("text",{x:px(mx),y:px(my)-6,class:"measure-t","font-size":12},gMeasure); t.textContent=fmt(d)+" m";
  }
}
function clearMeasure(){ measure={a:null,b:null}; gMeasure.innerHTML=""; }

/* =====================================================================
   TOOLBAR / TOGGLES / TECLADO
   ===================================================================== */
function setTool(t){
  tool=t; clearMeasure(); wallDraft=null; if(gDraft) gDraft.innerHTML="";
  ["select","measure","wall"].forEach(function(k){ var b=document.getElementById("tool-"+k); if(b) b.classList.toggle("active",t===k); });
  svg.classList.toggle("tool-measure",t==="measure");
  svg.classList.toggle("tool-wall",t==="wall");
  if(t!=="select") select(null);
}
document.getElementById("tool-select").addEventListener("click",function(){setTool("select");});
document.getElementById("tool-measure").addEventListener("click",function(){setTool("measure");});
var twb=document.getElementById("tool-wall"); if(twb) twb.addEventListener("click",function(){setTool("wall");});
document.getElementById("z-in").addEventListener("click",function(){zoomBy(1.2);});
document.getElementById("z-out").addEventListener("click",function(){zoomBy(1/1.2);});
document.getElementById("z-fit").addEventListener("click",function(){fit();renderOverlay();});
document.getElementById("btn-print").addEventListener("click",function(){ window.print(); });
var b3d=document.getElementById("btn-3d"); if(b3d) b3d.addEventListener("click",function(){ persist(); window.location.href="operacao.html?view=3d"; });
document.getElementById("btn-reset").addEventListener("click",function(){
  if(!confirm("Restaurar a cena padrão? As alterações serão perdidas.")) return;
  localStorage.removeItem(LS); scene=DEFAULT_SCENE.map(function(o){var c=clone(o);c.id=uid();return c;});
  selId=null; renderItems(); syncProps(); updateStats(); persist();
});

svg.addEventListener("wheel",function(evt){
  evt.preventDefault();
  var l=localXY(evt); zoomBy(evt.deltaY<0?1.1:1/1.1,l.x,l.y);
},{passive:false});
svg.addEventListener("contextmenu",function(e){e.preventDefault();});

// camadas
document.querySelectorAll("#layers .sw").forEach(function(sw){
  sw.addEventListener("click",function(){ sw.classList.toggle("on"); document.body.classList.toggle(sw.dataset.cls,!sw.classList.contains("on")); });
});
// snap
var snapSw=document.getElementById("sw-snap");
snapSw.addEventListener("click",function(){ snapSw.classList.toggle("on"); snapOn=snapSw.classList.contains("on"); });

document.addEventListener("keydown",function(e){
  var t=e.target;
  if(t&&(/input|textarea/i.test(t.tagName)||t.isContentEditable)) return;
  if(e.key==="Delete"||e.key==="Backspace"){ if(selId){ e.preventDefault(); deleteSel(); } }
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); }
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){ e.preventDefault(); redo(); }
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="d"){ e.preventDefault(); duplicateSel(); }
  else if(e.key==="r"||e.key==="R"){ var it=byId(selId); if(it) rotate90(it); }
  else if(e.key==="Escape"){ select(null); clearMeasure(); setTool("select"); }
  else if(e.key==="f"||e.key==="F"){ fit(); renderOverlay(); }
  else if(e.key==="w"||e.key==="W"){ setTool("wall"); }
  else if(e.key==="v"||e.key==="V"){ setTool("select"); }
  else if(e.key==="m"||e.key==="M"){ setTool("measure"); }
  else if(selId&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].indexOf(e.key)>=0){
    e.preventDefault(); var it2=byId(selId); var s=e.shiftKey?0.10:SNAP;
    var r={x:it2.x,y:it2.y,w:it2.w,h:it2.h};
    if(e.key==="ArrowLeft")r.x-=s; else if(e.key==="ArrowRight")r.x+=s; else if(e.key==="ArrowUp")r.y-=s; else r.y+=s;
    r.x=Math.round(r.x*1000)/1000; r.y=Math.round(r.y*1000)/1000;
    clampMove(r); if(inRoom(r)){ it2.x=r.x; it2.y=r.y; renderItems(); syncProps(); persist(); }
  }
});

/* =====================================================================
   CATÁLOGO UI + CARIMBO
   ===================================================================== */
function glyph(t,w,h){
  // mini-ícone: retângulo proporcional
  var mw=34,mh=22, sc=Math.min(mw/(w*SCALE),mh/(h*SCALE),0.5)*SCALE;
  var rw=Math.max(8,w*sc), rh=Math.max(6,h*sc);
  var meta=TYPE[t]||{};
  var col=meta.color||CAT_COLORS[meta.cat]||"#9A9284";
  if(t==="wall") return '<svg width="36" height="24"><rect x="4" y="10" width="28" height="4" fill="#2B2B2B"/></svg>';
  if(t==="painel") return '<svg width="36" height="24"><rect x="3" y="9" width="30" height="6" fill="#EDE7D7" stroke="#1A1A1A" stroke-width="1"/><line x1="6" y1="15" x2="12" y2="9" stroke="#1A1A1A" stroke-width=".6"/><line x1="14" y1="15" x2="20" y2="9" stroke="#1A1A1A" stroke-width=".6"/><line x1="22" y1="15" x2="28" y2="9" stroke="#1A1A1A" stroke-width=".6"/></svg>';
  if(t==="porta") return '<svg width="36" height="24"><path d="M4,18 L4,6" stroke="'+col+'" stroke-width="1.4"/><path d="M4,6 A12,12 0 0 1 16,18" fill="none" stroke="'+col+'" stroke-width="1" stroke-dasharray="3 2"/><line x1="4" y1="18" x2="16" y2="18" stroke="'+col+'" stroke-width="1.4"/></svg>';
  return '<svg width="36" height="24"><rect x="'+((36-rw)/2)+'" y="'+((24-rh)/2)+'" width="'+rw+'" height="'+rh+'" rx="2" fill="#fff" stroke="#1A1A1A" stroke-width="1.3"/><rect x="'+((36-rw)/2)+'" y="'+((24-rh)/2)+'" width="'+rw+'" height="3" fill="'+col+'"/></svg>';
}
function buildCatalog(){
  var host=document.getElementById("catalog");
  var labels={atendimento:"Atendimento",cozinha:"Cozinha",gerais:"Gerais",estrutura:"Estrutura"};
  var html="";
  // Meus modelos (personalizados) primeiro, se houver
  if(CUSTOM.length){
    html+='<div class="catcat">Meus modelos</div><div class="cat-grid">';
    CUSTOM.forEach(function(o){
      html+='<div class="catitem" role="button" tabindex="0" data-add="'+o.t+'"><button class="del" data-del="'+o.t+'" title="Remover modelo">×</button><div class="gl">'+glyph(o.t,o.w,o.h)+'</div><div class="nm">'+o.n+'</div><div class="dm">'+fmt(o.w)+"×"+fmt(o.h)+'</div></div>';
    });
    html+="</div>";
  }
  Object.keys(CATALOG).forEach(function(cat){
    html+='<div class="catcat">'+labels[cat]+'</div><div class="cat-grid">';
    CATALOG[cat].forEach(function(o){
      html+='<div class="catitem" role="button" tabindex="0" data-add="'+o.t+'"><div class="gl">'+glyph(o.t,o.w,o.h)+'</div><div class="nm">'+o.n+'</div><div class="dm">'+fmt(o.w)+"×"+fmt(o.h)+'</div></div>';
    });
    html+="</div>";
  });
  host.innerHTML=html;
  host.querySelectorAll("[data-add]").forEach(function(b){
    b.addEventListener("click",function(){ addItem(b.dataset.add); });
    b.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); addItem(b.dataset.add); } });
  });
  host.querySelectorAll("[data-del]").forEach(function(b){ b.addEventListener("click",function(e){ e.stopPropagation(); delModel(b.dataset.del); }); });
}
function delModel(t){
  CUSTOM=CUSTOM.filter(function(o){ return o.t!==t; });
  saveCustom(); buildCatalog();
}
// carimbo
(function(){
  var TB="loja206_tb_v2";
  var saved={}; try{saved=JSON.parse(localStorage.getItem(TB))||{};}catch(e){}
  document.querySelectorAll("[data-tb]").forEach(function(c){
    if(saved[c.dataset.tb]!=null) c.textContent=saved[c.dataset.tb];
    c.addEventListener("input",function(){
      var o={}; document.querySelectorAll("[data-tb]").forEach(function(x){o[x.dataset.tb]=x.textContent;});
      localStorage.setItem(TB,JSON.stringify(o));
    });
  });
})();

/* =====================================================================
   V2 — CRIAR EQUIPAMENTO / MODELOS / PAINEL DIVISOR FOH-BOH
   ===================================================================== */
function archFromType(t){
  if(t==="forno"||t==="batedeira"||t==="estufa") return "appliance";
  if(t==="geladeira"||t==="bibite"||t==="vitrine") return "fridge";
  if(t==="prep"||t==="montagem"||t==="pia"||t==="balcao"||t==="caixa"||t==="apoio") return "counter";
  if(t==="estoque") return "shelf";
  if(t==="painel"||t==="wall") return "panel";
  return "box";
}
function colorToCat(c){ return {"#E2000F":"atendimento","#1A1A1A":"cozinha","#2B2B2B":"estrutura","#9A9284":"gerais","#2A6FDB":"gerais","#1F8A5B":"gerais"}[String(c).toUpperCase()]||"gerais"; }
function newType(){ return "cst"+Date.now().toString(36)+Math.floor(Math.random()*1000); }

function saveAsModel(it){
  var base=(it.n||"Modelo").trim();
  var meta=TYPE[it.t]||{};
  var o={t:newType(),n:base,w:it.w,h:it.h,hz:(it.hz!=null?it.hz:hzFor(it.t)),
    cat:meta.cat||colorToCat(it.color),color:it.color||meta.color||CAT_COLORS[meta.cat]||"#9A9284",
    arch:it.arch||meta.arch||archFromType(it.t)};
  CUSTOM.push(o); regCustom(o); saveCustom(); buildCatalog();
  flash("Modelo “"+base+"” salvo em Meus modelos");
}

/* ---- toast ---- */
function flash(msg){
  var el=document.getElementById("toast");
  if(!el){ el=document.createElement("div"); el.id="toast"; document.body.appendChild(el); }
  el.textContent=msg; el.classList.add("show");
  clearTimeout(el._t); el._t=setTimeout(function(){ el.classList.remove("show"); },2000);
}

/* ---- modal criar equipamento ---- */
var modal=document.getElementById("modal");
var mArch="box", mColor="#E2000F";
function setArch(a){ mArch=a; document.querySelectorAll("#m-arch .segb").forEach(function(b){ b.classList.toggle("active",b.dataset.arch===a); }); drawPreview(); }
function setMColor(c){ mColor=c; document.querySelectorAll("#m-color .swatch").forEach(function(b){ b.classList.toggle("active",b.dataset.col===c); }); drawPreview(); }
function mval(id){ return pnum(document.getElementById(id).value); }
function drawPreview(){
  var host=document.getElementById("m-prev"); if(!host) return;
  var w=mval("m-w")||1, d=mval("m-d")||0.6, h=mval("m-h")||0.9;
  var sc=Math.min(150/w, 60/h, 95);
  var rw=Math.max(14,w*sc), rh=Math.max(10,h*sc), top=64-rh+6;
  host.innerHTML='<svg width="'+(rw+128)+'" height="78">'
    +'<line x1="10" y1="70" x2="'+(rw+10)+'" y2="70" stroke="#D9D3C4" stroke-width="1"/>'
    +'<rect x="10" y="'+top+'" width="'+rw+'" height="'+rh+'" rx="2" fill="#fff" stroke="#1A1A1A" stroke-width="1.4"/>'
    +'<rect x="10" y="'+top+'" width="'+rw+'" height="4" fill="'+mColor+'"/>'
    +'<text x="'+(rw+24)+'" y="34" font-family="IBM Plex Mono,monospace" font-size="12" fill="#1A1A1A">'+fmt(w)+' × '+fmt(d)+' m</text>'
    +'<text x="'+(rw+24)+'" y="52" font-family="IBM Plex Mono,monospace" font-size="10" fill="#9A9284">alt. '+fmt(h)+' m · '+mArch+'</text>'
    +'</svg>';
}
function openModal(){
  document.getElementById("m-name").value="";
  document.getElementById("m-w").value="1,00";
  document.getElementById("m-d").value="0,60";
  document.getElementById("m-h").value="0,90";
  setArch("box"); setMColor("#E2000F");
  modal.style.display="flex"; setTimeout(function(){ document.getElementById("m-name").focus(); },30);
}
function closeModal(){ modal.style.display="none"; }
function createFromModal(){
  var name=(document.getElementById("m-name").value||"Equipamento").trim();
  var w=mval("m-w")||1, d=mval("m-d")||0.6, h=mval("m-h")||0.9;
  var o={t:newType(),n:name,w:Math.max(MIN,w),h:Math.max(MIN,d),hz:Math.max(0.05,h),
    cat:colorToCat(mColor),color:mColor,arch:mArch};
  CUSTOM.push(o); regCustom(o); saveCustom(); buildCatalog();
  closeModal(); addItem(o.t);
  flash("“"+name+"” criado e inserido");
}
document.getElementById("btn-create").addEventListener("click",openModal);
document.getElementById("m-close").addEventListener("click",closeModal);
document.getElementById("m-cancel").addEventListener("click",closeModal);
document.getElementById("m-save").addEventListener("click",createFromModal);
modal.addEventListener("click",function(e){ if(e.target===modal) closeModal(); });
document.querySelectorAll("#m-arch .segb").forEach(function(b){ b.addEventListener("click",function(){ setArch(b.dataset.arch); }); });
document.querySelectorAll("#m-color .swatch").forEach(function(b){ b.addEventListener("click",function(){ setMColor(b.dataset.col); }); });
["m-w","m-d","m-h"].forEach(function(id){ document.getElementById(id).addEventListener("input",drawPreview); });
document.getElementById("m-name").addEventListener("keydown",function(e){ if(e.key==="Enter") createFromModal(); });

/* ---- painel divisor FOH / BOH ---- */
function insertDivider(){
  var exists=null;
  scene.forEach(function(it){ if(it.t==="painel" && Math.abs((it.y+it.h/2)-DIVIDER_Y)<0.25) exists=it; });
  if(exists){ select(exists.id); flash("Painel divisor já existe — selecionado"); return; }
  var th=0.10;
  var it={id:uid(),t:"painel",n:"Painel de fundo (FOH/BOH)",x:0,y:snap(DIVIDER_Y-th/2),w:2.00,h:th,hz:2.80,color:"#EDE7D7",arch:"panel"};
  clampMove(it);
  scene.push(it); persist(); select(it.id); updateStats();
  flash("Painel divisor inserido a "+fmt(FOH_DEPTH)+" m da frente");
}
document.getElementById("btn-divisor").addEventListener("click",insertDivider);

/* ---- toggle setor FOH/BOH ---- */
var fohSw=document.getElementById("sw-fohboh");
if(fohSw) fohSw.addEventListener("click",function(){ fohSw.classList.toggle("on"); document.body.classList.toggle("hide-fohboh",!fohSw.classList.contains("on")); });

/* ---- exportar / importar projeto (JSON) ---- */
function exportProject(){
  var data={app:"loja206-studio",version:2,exportedAt:new Date().toISOString(),
    scene:scene,idc:idc,custom:CUSTOM,
    finishes:(function(){ try{ return JSON.parse(localStorage.getItem("loja206_fin_v2"))||null; }catch(e){ return null; } })()};
  var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="LOJA206-projeto.json";
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },400);
  flash("Projeto exportado (JSON)");
}
function importProject(file){
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var d=JSON.parse(rd.result);
      if(!d||!Array.isArray(d.scene)) throw new Error("formato");
      scene=d.scene; idc=d.idc||(scene.length+1); scene.forEach(normItem);
      if(Array.isArray(d.custom)){ CUSTOM=d.custom; CUSTOM.forEach(regCustom); saveCustom(); }
      if(d.finishes){ try{ localStorage.setItem("loja206_fin_v2",JSON.stringify(d.finishes)); }catch(e){} }
      selId=null; buildCatalog(); renderItems(); syncProps(); updateStats(); persist();
      flash("Projeto importado — "+scene.length+" peças");
    }catch(e){ flash("Arquivo inválido — use um JSON exportado daqui"); }
  };
  rd.readAsText(file);
}
document.getElementById("btn-export").addEventListener("click",exportProject);
document.getElementById("btn-import").addEventListener("click",function(){ document.getElementById("file-import").click(); });
document.getElementById("file-import").addEventListener("change",function(){ if(this.files[0]) importProject(this.files[0]); this.value=""; });

/* ---- atalho de teclado: D = divisor ---- */
document.addEventListener("keydown",function(e){
  var t=e.target; if(t&&(/input|textarea/i.test(t.tagName)||t.isContentEditable)) return;
  if(modal.style.display!=="none"){ if(e.key==="Escape") closeModal(); return; }
  if((e.key==="d"||e.key==="D") && !e.metaKey && !e.ctrlKey){ e.preventDefault(); insertDivider(); }
});

/* =====================================================================
   INIT
   ===================================================================== */
function init(){
  loadCustom(); loadState(); persist(); buildSkeleton(); buildCatalog(); renderItems(); syncProps(); updateStats();
  fit(); setTool("select");
  window.addEventListener("resize",function(){ applyView(); });
  window.addEventListener("beforeprint",function(){ fit(); });
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ renderItems(); fit(); renderOverlay(); });
  setTimeout(function(){ fit(); renderOverlay(); },300);
}
init();
})();
