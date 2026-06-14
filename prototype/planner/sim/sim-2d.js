/* =====================================================================
   sim-2d.js — Vista 2D da operação (SVG, linguagem visual da planta)
   Camada estática (planta) + camada dinâmica (agentes) + heatmap.
   ===================================================================== */
(function(){
"use strict";
var NS="http://www.w3.org/2000/svg";
var SCALE=100;
function px(m){ return m*SCALE; }
function E(tag,attrs,parent){
  var e=document.createElementNS(NS,tag);
  if(attrs) for(var k in attrs) e.setAttribute(k,attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}
function fmt(m){ return m.toFixed(2).replace(".",","); }

var svg=null, worldG=null, gStatic=null, gHeat=null, gTrail=null, gAgents=null, gFx=null;
var view={zoom:1,panX:0,panY:0};
var CONTENT={minX:-1.05,minY:-0.45,maxX:3.65,maxY:7.05};
var showTrails=true, showHeat=false, showLabels=true;

function applyView(){
  if(worldG) worldG.setAttribute("transform","translate("+view.panX+","+view.panY+") scale("+view.zoom+")");
}
function fit(){
  if(!svg) return;
  var r=svg.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  var cw=px(CONTENT.maxX-CONTENT.minX), ch=px(CONTENT.maxY-CONTENT.minY);
  var z=Math.min(r.width/cw,r.height/ch)*0.95;
  view.zoom=z;
  view.panX=(r.width-cw*z)/2-px(CONTENT.minX)*z;
  view.panY=(r.height-ch*z)/2-px(CONTENT.minY)*z;
  applyView();
}

/* ---------- camada estática: a planta ---------- */
function pathD(poly){ return "M"+poly.map(function(p){return px(p[0])+","+px(p[1]);}).join(" L")+" Z"; }

/* rótulo em até 2 linhas (mesma lógica da planta) */
function wrapLabel(textEl,str,cx){
  var words=String(str).split(" "), lines=[], cur="";
  words.forEach(function(w){
    var test=cur?cur+" "+w:w;
    if(test.length>14&&cur){ lines.push(cur); cur=w; } else cur=test;
  });
  if(cur) lines.push(cur);
  if(lines.length>2) lines=[lines[0],lines.slice(1).join(" ")];
  var y0=lines.length>1?-5:0;
  lines.forEach(function(ln,i){
    var ts=E("tspan",{x:cx,dy:(i===0?y0:11)},textEl); ts.textContent=ln;
  });
}
/* porta com arco (simbologia da planta) */
function drawDoor(g,it){
  var w=px(it.w), h=px(it.h), col=it.color||"#9A9284";
  E("rect",{x:0,y:0,width:w,height:h,fill:"#fff",stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
  if(it.w>=it.h){
    E("line",{x1:0,y1:h/2,x2:0,y2:h/2-w,stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
    E("path",{d:"M0,"+(h/2-w)+" A"+w+","+w+" 0 0 1 "+w+","+(h/2),fill:"none",stroke:col,"stroke-width":1,"stroke-dasharray":"3 3","vector-effect":"non-scaling-stroke"},g);
  } else {
    E("line",{x1:w/2,y1:0,x2:w/2+h,y2:0,stroke:col,"stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
    E("path",{d:"M"+(w/2+h)+",0 A"+h+","+h+" 0 0 1 "+(w/2)+","+h,fill:"none",stroke:col,"stroke-width":1,"stroke-dasharray":"3 3","vector-effect":"non-scaling-stroke"},g);
  }
}
/* painel com hachura + vão da porta de correr (simbologia da planta) */
function drawPanel(g,it){
  var w=px(it.w), h=px(it.h);
  E("rect",{x:0,y:0,width:w,height:h,fill:"#EDE7D7",stroke:"#1A1A1A","stroke-width":1,"vector-effect":"non-scaling-stroke"},g);
  var step=7, lim=w+h;
  for(var o=step;o<lim;o+=step){
    var x1=Math.max(0,o-h), y1=Math.min(o,h), x2=Math.min(o,w), y2=Math.max(0,o-w);
    E("line",{x1:x1,y1:y1,x2:x2,y2:y2,stroke:"#1A1A1A","stroke-width":0.5,opacity:0.5,"vector-effect":"non-scaling-stroke"},g);
  }
  var horiz=it.w>=it.h, len=horiz?it.w:it.h;
  if(len>=1.10){
    var d0=px(0.10), d1=px(Math.min(0.90,len-0.20));
    if(horiz){
      E("rect",{x:d0,y:-1,width:d1-d0,height:h+2,fill:"#FDFBF4"},g);
      E("rect",{x:d1,y:-h*0.65-3,width:d1-d0,height:h*0.65,fill:"#fff",stroke:"#1A1A1A","stroke-width":0.8,"vector-effect":"non-scaling-stroke"},g);
    } else {
      E("rect",{x:-1,y:d0,width:w+2,height:d1-d0,fill:"#FDFBF4"},g);
      E("rect",{x:-w*0.65-3,y:d1,width:w*0.65,height:d1-d0,fill:"#fff",stroke:"#1A1A1A","stroke-width":0.8,"vector-effect":"non-scaling-stroke"},g);
    }
  }
}

function buildStatic(){
  var SIM=window.SIM;
  gStatic.innerHTML="";
  var ROOM=SIM.ROOM, W=SIM.W, GATE=SIM.GATE, OUT=SIM.OUT;

  /* calçada da galeria */
  E("rect",{x:px(OUT.x0),y:px(GATE),width:px(OUT.x1-OUT.x0),height:px(OUT.y1-GATE),
    fill:"#E9E3D3",stroke:"none"},gStatic);
  E("line",{x1:px(OUT.x0),y1:px(OUT.y1),x2:px(OUT.x1),y2:px(OUT.y1),
    stroke:"#D9D3C4","stroke-width":2,"vector-effect":"non-scaling-stroke"},gStatic);
  var ct=E("text",{x:px((OUT.x0+OUT.x1)/2),y:px(OUT.y1-0.12),class:"s2-zone","font-size":12,"text-anchor":"middle"},gStatic);
  ct.textContent="GALERIA · CLIENTES";

  /* piso */
  E("path",{d:pathD(ROOM),fill:"#FDFBF4",stroke:"none"},gStatic);

  /* grade 0,5 m */
  var clip=E("clipPath",{id:"s2clip"},gStatic); E("path",{d:pathD(ROOM)},clip);
  var gg=E("g",{"clip-path":"url(#s2clip)"},gStatic);
  for(var x=0.5;x<W;x+=0.5) E("line",{x1:px(x),y1:0,x2:px(x),y2:px(GATE),stroke:"#EFE9DA","stroke-width":1,"vector-effect":"non-scaling-stroke"},gg);
  for(var y=0.5;y<GATE;y+=0.5) E("line",{x1:0,y1:px(y),x2:px(W),y2:px(y),stroke:"#EFE9DA","stroke-width":1,"vector-effect":"non-scaling-stroke"},gg);

  /* zonas FOH/BOH */
  E("path",{d:"M0,0 L"+px(2.0)+",0 L"+px(2.0)+","+px(3.0)+" L0,"+px(3.0)+" Z",
    fill:"rgba(154,146,132,0.06)"},gStatic);
  var tb=E("text",{x:px(0.18),y:px(0.28),class:"s2-zone","font-size":10},gStatic); tb.textContent="BOH · PRODUÇÃO";
  var tf=E("text",{x:px(0.18),y:px(3.24),class:"s2-zone","font-size":10},gStatic); tf.textContent="FOH · ATENDIMENTO";

  /* casca (parede aberta na frente) */
  var open="M"+px(0)+","+px(GATE)+" L0,0 L"+px(2.0)+",0 L"+px(2.0)+","+px(3.0)
    +" L"+px(2.6)+","+px(3.0)+" L"+px(2.6)+","+px(GATE);
  E("path",{d:open,fill:"none",stroke:"#1A1A1A","stroke-width":10,"stroke-linejoin":"miter","vector-effect":"non-scaling-stroke"},gStatic);
  E("line",{x1:0,y1:px(GATE),x2:px(W),y2:px(GATE),stroke:"#1A1A1A","stroke-width":1.4,
    "stroke-dasharray":"7 5","vector-effect":"non-scaling-stroke"},gStatic);
  var gt=E("text",{x:px(1.3),y:px(GATE)+14,class:"s2-dim","font-size":9,"text-anchor":"middle"},gStatic);
  gt.textContent="portão de enrolar · 2,60 m";

  /* itens da cena */
  SIM.sceneItems.forEach(function(it){
    var g=E("g",{transform:"translate("+px(it.x)+","+px(it.y)+")"},gStatic);
    if(it.t==="porta"){ drawDoor(g,it); return; }
    if(it.t==="wall"){
      E("rect",{x:0,y:0,width:px(it.w),height:px(it.h),fill:"#2B2B2B"},g);
      return;
    }
    if(it.t==="painel"){ drawPanel(g,it); return; }
    var col=it.color||"#9A9284";
    E("rect",{x:0,y:0,width:px(it.w),height:px(it.h),rx:3,fill:"#fff",stroke:"#1A1A1A","stroke-width":1.2,"vector-effect":"non-scaling-stroke"},g);
    E("rect",{x:0,y:0,width:px(it.w),height:4,fill:col},g);
    if(showLabels){
      var cx=px(it.w)/2, cy=px(it.h)/2;
      var fs=Math.min(11,Math.max(8,px(it.w)/10));
      var lab=E("text",{x:cx,y:cy+3,class:"s2-lab","font-size":fs},g);
      wrapLabel(lab,it.n||it.t,cx);
      if(px(it.h)<26) lab.setAttribute("y",px(it.h)-5);
    }
  });

  /* pontos de serviço das estações (vermelho = sem acesso a pé) */
  SIM.stations.forEach(function(st){
    if(!st.sp) return;
    if(st.unreachable){
      E("circle",{cx:px(st.cx),cy:px(st.cy),r:13,fill:"none",stroke:"#E2000F",
        "stroke-width":2,"stroke-dasharray":"4 3","vector-effect":"non-scaling-stroke"},gStatic);
      var w=E("text",{x:px(st.cx),y:px(st.cy)-16,class:"s2-dim","font-size":8.5,"text-anchor":"middle",fill:"#E2000F"},gStatic);
      w.textContent="sem acesso";
      return;
    }
    E("circle",{cx:px(st.sp.x),cy:px(st.sp.y),r:3.2,fill:"none",stroke:st.color||"#9A9284",
      "stroke-width":1.2,"vector-effect":"non-scaling-stroke",opacity:0.65},gStatic);
  });

  /* fila + retirada (marcadores) */
  SIM.queueSlots.slice(0,14).forEach(function(s,i){
    E("rect",{x:px(s.x)-9,y:px(s.y)-9,width:18,height:18,rx:3,fill:"rgba(226,0,15,0.05)",
      stroke:"rgba(226,0,15,0.25)","stroke-width":1,"stroke-dasharray":"3 3","vector-effect":"non-scaling-stroke"},gStatic);
  });
  SIM.pickupSlots.forEach(function(s){
    E("rect",{x:px(s.x)-8,y:px(s.y)-8,width:16,height:16,rx:8,fill:"rgba(42,111,219,0.06)",
      stroke:"rgba(42,111,219,0.3)","stroke-width":1,"vector-effect":"non-scaling-stroke"},gStatic);
  });
  var qt=E("text",{x:px(SIM.queueSlots[0]?SIM.queueSlots[0].x:0.5),y:px(GATE+0.45)-14,class:"s2-dim","font-size":8.5},gStatic);
  qt.textContent="fila / PDV";
  var pt=E("text",{x:px(SIM.pickupSlots[0]?SIM.pickupSlots[0].x:1.2),y:px(GATE+0.40)+22,class:"s2-dim","font-size":8.5},gStatic);
  pt.textContent="retirada";
}

/* ---------- heatmap ---------- */
function renderHeat(){
  gHeat.innerHTML="";
  if(!showHeat) return;
  var SIM=window.SIM, heat=SIM.heat;
  if(!heat) return;
  var hw=SIM.heatW(), hh=SIM.heatH(), cell=SIM.HEAT_CELL, OUT=SIM.OUT;
  var max=0;
  for(var i=0;i<heat.length;i++) if(heat[i]>max) max=heat[i];
  if(max<=0) return;
  for(var gy=0;gy<hh;gy++) for(var gx=0;gx<hw;gx++){
    var v=heat[gx+gy*hw];
    if(v<max*0.04) continue;
    var t=Math.min(1,v/max);
    var col=t<0.5?"rgba(242,162,60,"+(0.10+t*0.5)+")":"rgba(226,0,15,"+(0.12+t*0.45)+")";
    E("rect",{x:px(OUT.x0+gx*cell),y:px(gy*cell-0.2),width:px(cell),height:px(cell),fill:col},gHeat);
  }
}

/* ---------- camada dinâmica ---------- */
function renderAgents(){
  var SIM=window.SIM;
  gTrail.innerHTML=""; gAgents.innerHTML=""; gFx.innerHTML="";

  /* trilhas */
  if(showTrails){
    SIM.operators.forEach(function(op){
      if(op.trail.length<2) return;
      var d="M"+op.trail.map(function(p){return px(p.x)+","+px(p.y);}).join(" L");
      E("path",{d:d,fill:"none",stroke:op.color,"stroke-width":1.6,opacity:0.4,
        "stroke-linejoin":"round","vector-effect":"non-scaling-stroke"},gTrail);
    });
  }

  /* clientes */
  SIM.customers.forEach(function(c){
    var col="#9A9284";
    if(c.state==="waiting"){
      var ratio=(SIM.simTime-c.tArr)/Math.max(1,SIM.cfg.tol);
      col=ratio<0.5?"#1F8A5B":ratio<0.8?"#D29922":"#E2000F";
    }
    else if(c.state==="at_pdv") col="#1F8A5B";
    else if(c.state==="waiting_pickup"){
      var pw=(SIM.simTime-(c.tSS||SIM.simTime))/Math.max(1,SIM.cfg.pickupTimeout);
      col=pw>0.66?"#D2691E":"#2A6FDB";
    }
    else if(c.state==="leaving") col=c.served?"#1F8A5B":"#C0392B";
    var g=E("g",{transform:"translate("+px(c.x)+","+px(c.y)+")"},gAgents);
    E("circle",{r:12,fill:col,opacity:c.state==="leaving"?0.45:0.9,stroke:"#fff","stroke-width":1.5,"vector-effect":"non-scaling-stroke"},g);
    if(c.orderNum&&c.state==="waiting_pickup"){
      var t=E("text",{y:3.4,class:"s2-agent","font-size":9},g); t.textContent="#"+c.orderNum;
    }
  });

  /* operadores */
  SIM.operators.forEach(function(op,i){
    var ring=op.busyState==="busy"?"#D29922":op.busyState==="wait"?"#E2000F":op.color;
    var g=E("g",{transform:"translate("+px(op.x)+","+px(op.y)+")"},gAgents);
    E("circle",{r:15,fill:op.color,stroke:"#fff","stroke-width":2,"vector-effect":"non-scaling-stroke"},g);
    E("circle",{r:19,fill:"none",stroke:ring,"stroke-width":2,opacity:0.85,"vector-effect":"non-scaling-stroke"},g);
    var t=E("text",{y:4,class:"s2-agent","font-size":11,fill:"#fff"},g); t.textContent=op.tag||("O"+(i+1));
    if(op.carrying){
      E("rect",{x:10,y:-22,width:13,height:9,rx:2,fill:"#C0763A",stroke:"#7c4a1d","stroke-width":1,"vector-effect":"non-scaling-stroke"},g);
    }
    if(op.fixedEq){
      E("rect",{x:-24,y:-30,width:18,height:11,rx:2,fill:"#D2691E"},g);
      var fb=E("text",{x:-15,y:-21.5,class:"s2-agent","font-size":7.5,fill:"#fff"},g); fb.textContent="FIXO";
    }
    /* status flutuante */
    var st=E("text",{y:-22,class:"s2-status","font-size":9.5},g);
    st.textContent="O"+(i+1)+" · "+op.statusText;
  });

  /* zona da fila destacada quando longa */
  var q=SIM.waitQueue.length;
  if(q>0){
    var first=SIM.queueSlots[0], last=SIM.queueSlots[Math.min(q-1,SIM.queueSlots.length-1)];
    if(first&&last){
      var col2=q>10?"rgba(226,0,15,0.10)":q>5?"rgba(210,153,34,0.10)":"rgba(31,138,91,0.07)";
      E("rect",{x:px(SIM.OUT.x0+0.1),y:px(SIM.GATE+0.18),width:px(SIM.OUT.x1-SIM.OUT.x0-0.2),
        height:px(Math.max(0.55,last.y-SIM.GATE+0.3)),rx:6,fill:col2},gFx);
    }
  }
}

/* ---------- interação (zoom / pan) ---------- */
function bindInteraction(){
  var dragP=null;
  svg.addEventListener("pointerdown",function(e){
    dragP={x:e.clientX,y:e.clientY,px:view.panX,py:view.panY};
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove",function(e){
    if(!dragP) return;
    view.panX=dragP.px+(e.clientX-dragP.x);
    view.panY=dragP.py+(e.clientY-dragP.y);
    applyView();
  });
  ["pointerup","pointercancel"].forEach(function(ev){ svg.addEventListener(ev,function(){ dragP=null; }); });
  svg.addEventListener("wheel",function(e){
    e.preventDefault();
    var r=svg.getBoundingClientRect();
    var cx=e.clientX-r.left, cy=e.clientY-r.top;
    var f=e.deltaY<0?1.1:1/1.1;
    var nz=Math.max(0.25,Math.min(4,view.zoom*f));
    var wx=(cx-view.panX)/view.zoom, wy=(cy-view.panY)/view.zoom;
    view.zoom=nz; view.panX=cx-wx*nz; view.panY=cy-wy*nz;
    applyView();
  },{passive:false});
}

window.SIM2D={
  init:function(el){
    svg=el;
    svg.innerHTML="";
    worldG=E("g",{},svg);
    gStatic=E("g",{},worldG);
    gHeat=E("g",{},worldG);
    gTrail=E("g",{},worldG);
    gFx=E("g",{},worldG);
    gAgents=E("g",{},worldG);
    bindInteraction();
    buildStatic(); fit();
  },
  rebuild:buildStatic,
  render:function(){ renderAgents(); },
  renderHeat:renderHeat,
  fit:fit,
  set trails(v){ showTrails=v; },
  set heatmap(v){ showHeat=v; if(!v) gHeat.innerHTML=""; },
  set labels(v){ showLabels=v; buildStatic(); }
};
})();
