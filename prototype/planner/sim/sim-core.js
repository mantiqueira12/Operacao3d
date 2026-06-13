/* =====================================================================
   sim-core.js — Motor de simulação de operação · LOJA 206
   Lê a MESMA cena do estúdio de planta (localStorage loja206_studio_v2).
   Estações, rotas (A*) e tempos derivam das posições reais das peças.
   Unidades: metros · minutos simulados. Dia: 10:00 → 22:00.
   DOM-free: a UI lê/escreve SIM.cfg e consome SIM.S / SIM.agents.
   ===================================================================== */
(function(){
"use strict";

/* ---------- geometria da casca (igual à planta) ---------- */
var ROOM=[[0,0],[2.00,0],[2.00,3.00],[2.60,3.00],[2.60,5.15],[0,5.15]];
var W=2.60, D=5.15, CUT_X=2.00, CUT_Y=3.00, GATE=5.15;
var OUT={x0:-0.90, x1:3.50, y1:6.90};       // calçada da galeria (clientes)
var LS_SCENE="loja206_studio_v2";
var LS_SIM="loja206_sim_v1";

function inShell(x,y){
  if(x<0||y<0||y>GATE) return false;
  if(y<CUT_Y) return x<=CUT_X;
  return x<=W;
}

/* cena padrão (fallback = mesma da planta) */
var DEFAULT_SCENE=[
  {t:"caixa",    n:"Caixa · PDV",            x:0.00, y:4.60, w:0.77, h:0.55},
  {t:"vitrine",  n:"Vitrine refrigerada",    x:0.80, y:4.40, w:1.70, h:0.72},
  {t:"montagem", n:"Bancada de montagem",    x:2.00, y:3.00, w:0.60, h:1.25},
  {t:"estoque",  n:"Estoque",                x:0.08, y:0.10, w:1.00, h:0.40},
  {t:"forno",    n:"Forno focaccia",         x:1.05, y:0.10, w:0.88, h:0.70},
  {t:"batedeira",n:"Batedeira de massa",     x:1.40, y:1.05, w:0.55, h:0.55},
  {t:"estufa",   n:"Estufa de fermentação",  x:1.35, y:1.75, w:0.62, h:0.75},
  {t:"prep",     n:"Bancada de prep",        x:0.08, y:0.70, w:0.58, h:1.35},
  {t:"pia",      n:"Pia / lavagem",          x:0.08, y:2.15, w:0.58, h:0.55},
  {t:"bibite",   n:"Geladeira bibite",       x:0.00, y:3.35, w:0.48, h:0.70},
  {t:"painel",   n:"Painel de fundo (FOH/BOH)", x:0.00, y:2.95, w:2.00, h:0.10}
];

/* ---------- configuração (UI escreve aqui) ---------- */
var cfg={
  ops:2,                 // operadores
  fixedEq:["",""],       // por op: id da estação fixa ("" = volante)
  rate:30,               // clientes/hora (base)
  demandCurve:"both",    // flat | lunch | dinner | both
  maxItems:3, groupBias:30,
  tol:12,                // desistência fila (min)
  pickupTimeout:30,      // limite retirada (min)
  sla:15,                // alvo entrega (min)
  opCost:25, fixedCost:800,
  walkSpeed:30,          // m/min (operador, inclui manobra)
  custSpeed:40,          // m/min (cliente)
  payTime:1.0,           // min no PDV
  capacity:{forno:2,estufa:2},  // capacidade simultânea por tipo
  cfgV:2,
  menu:[
    {id:"spaccata", name:"La Spaccata",    prob:0.55, price:92, cat:"lanche", pao:1,
      steps:[{type:"montagem",time:2.5},{type:"vitrine",time:0.4}]},
    {id:"panino",   name:"Panino Simples", prob:0.30, price:45, cat:"lanche", pao:1,
      steps:[{type:"montagem",time:2.0}]},
    {id:"bebida",   name:"Bebida",         prob:0.15, price:15, cat:"bebida", pao:0,
      steps:[{type:"bibite",time:0.5}]}
  ],
  /* ---- padaria (produção de pães no fundo / BOH) ---- */
  bread:{
    mode:"propria",        // propria | terc
    batchSize:20,          // pães por fornada
    mixTime:18,            // batedeira (min)
    proofTime:75,          // estufa de fermentação (min)
    bakeTime:22,           // forno (min)
    breadStart:30,         // pães prontos na abertura
    target:60,             // estoque alvo (padeiro produz p/ manter)
    flourStart:50,         // farinha disponível (kg)
    flourPerBread:0.12,    // kg de farinha por pão
    flourPrice:6.5,        // R$/kg
    extraPerBread:0.6,     // outros insumos R$/pão
    energyPerBatch:7,      // energia R$/fornada
    bakerCost:28,          // padeiro R$/h
    bakerHours:8,          // horas contratadas/dia
    invest:15700,          // investimento batedeira+estufa (R$)
    deprecMonths:36,       // depreciação (meses)
    rentM2:250,            // aluguel R$/m²·mês
    tercPrice:4.8,         // pão terceirizado R$/un
    tercFrete:25,          // frete entrega R$/dia
    tercQty:140,           // pães entregues por dia
    /* fábrica (BOH) */
    storageCap:120,        // capacidade do estoque de pães (espaço)
    shiftStart:600,        // início do turno do padeiro (min) 10h
    shiftHours:8,          // horas por turno
    shifts:1,              // turnos de padeiro por dia (1 ou 2)
    hybridOwnPct:60,       // % produzido internamente no modo híbrido
    /* investimento por equipamento (#19) */
    investBatedeira:6200, lifeBatedeira:60,
    investEstufa:5400,    lifeEstufa:48,
    investForno:4100,     lifeForno:36
  },
  /* estoques/capacidade de outros equipamentos (FOH) */
  inv:{
    bibiteStart:60, bibiteCap:72,   // geladeira de bebidas
    vitrineCap:24                   // vitrine refrigerada (itens prontos em exposição)
  }
};
function lancheCat(m){ return m.cat||(m.steps&&m.steps.some(function(s){return s.type==="montagem"||s.type==="forno"||s.type==="prep";})?"lanche":"bebida"); }

/* ---------- estado da simulação ---------- */
var simTime=10*60, running=false;
var customers=[], operators=[], waitQueue=[], prepQueue=[], activeOrders=[];
var pdvBusy=false;
var S={};                                    // métricas
var eqLock={};                               // stationId -> Set(opIdx)
var stations=[], stById={}, typesInScene=[]; // derivadas da cena
var sceneItems=[], blockers=[];
var queueSlots=[], pickupSlots=[];
var navGrid=null, ngW=0, ngH=0;
var NAV_CELL=0.05, MARGIN=0.10;
var pathCache=new Map();
var lastSceneRaw=null;
var heat=null, HEAT_CELL=0.10, heatW=0, heatH=0;
var missingTypes=[];

function resetStats(){
  S={nextId:0,nextArr:10*60+0.3,orderNum:0,
    served:0,balked:0,balkedPickup:0,totalWait:0,totalPrepTime:0,
    totalQueueWait:0,totalActualPrep:0,
    revenue:0,revenueBruto:0,reembolsos:0,servedRevenue:0,itemsSold:{},
    eqBusy:{},eqTotal:{},eqCount:{},
    opBusy:[],opOrders:[],opDist:[],congestMin:0,
    simStartTime:10*60,maxQueue:0,slaOk:0,
    servedHist:[],balkedHist:[],queueHist:[],lastHistMin:10*60,
    alerts:[], alertKeys:{}, alertSeq:0,
    bibite:0, bibiteSold:0, bibiteEmptyMin:0, vitrineSold:0,
    breadProducedShift:0};
}
resetStats();

/* ---------- central de eventos / alertas ao vivo ---------- */
var ALERT_TTL=8*60;                 // some do feed depois de 8 min simulados (mantém histórico curto)
function logEvent(sev,msg,key){
  if(!S.alerts) return;
  key=key||msg;
  var prev=S.alertKeys[key];
  if(prev!=null&&(simTime-prev)<2.5) return;   // de-dup: no máx 1 a cada 2,5 min simulados
  S.alertKeys[key]=simTime;
  S.alerts.push({id:++S.alertSeq,t:simTime,sev:sev,msg:msg,key:key});
  if(S.alerts.length>60) S.alerts.shift();
}
function clearOldAlerts(){
  if(S.alerts) S.alerts=S.alerts.filter(function(a){ return simTime-a.t<ALERT_TTL; });
}

/* =====================================================================
   CENA → ESTAÇÕES
   ===================================================================== */
function loadScene(){
  var items=null, raw=null;
  try{ raw=localStorage.getItem(LS_SCENE); var s=JSON.parse(raw); if(s&&s.scene&&s.scene.length) items=s.scene; }catch(e){}
  lastSceneRaw=raw;
  if(!items) items=DEFAULT_SCENE.map(function(o){ return JSON.parse(JSON.stringify(o)); });
  sceneItems=items;
  stations=[]; stById={}; blockers=[]; typesInScene=[];
  var seen={};
  items.forEach(function(it,i){
    if(it.t==="wall"||it.t==="painel"){ blockers.push(it); return; }
    if(it.t==="porta"||it.t==="extintor") return;
    var st={id:it.id||("st"+i), type:it.t, name:it.n||it.t,
      x:it.x, y:it.y, w:it.w, h:it.h, cx:it.x+it.w/2, cy:it.y+it.h/2,
      color:it.color||"#9A9284", hz:it.hz,
      capacity:cfg.capacity[it.t]||1, sp:null};
    stations.push(st); stById[st.id]=st;
    if(!seen[it.t]){ seen[it.t]=true; typesInScene.push({type:it.t,label:it.n||it.t}); }
  });
  checkMenu();
}
function stationsOfType(t){ return stations.filter(function(s){ return s.type===t; }); }
/* zonas: BOH (fundo, fábrica de pães) = y<CUT_Y · FOH (frente, atendimento) = y>=CUT_Y */
function zoneOf(st){ return st.cy<CUT_Y ? "boh" : "foh"; }
function stationsZone(t,zone){ return stations.filter(function(s){ return s.type===t && (!zone||zoneOf(s)===zone); }); }
function checkMenu(){
  missingTypes=[];
  cfg.menu.forEach(function(mi){ mi.steps.forEach(function(s){
    if(!stationsOfType(s.type).length && missingTypes.indexOf(s.type)<0) missingTypes.push(s.type);
  });});
}

/* =====================================================================
   NAVGRID + A*  (operadores, dentro da casca)
   ===================================================================== */
function w2gx(v){ return Math.max(0,Math.min(ngW-1,Math.round(v/NAV_CELL))); }
function w2gy(v){ return Math.max(0,Math.min(ngH-1,Math.round(v/NAV_CELL))); }
function g2w(g){ return g*NAV_CELL; }
function gFree(gx,gz){ return gx>=0&&gx<ngW&&gz>=0&&gz<ngH&&navGrid[gx+gz*ngW]===0; }

function markBlocked(x0,y0,x1,y1,m){
  if(m==null) m=MARGIN;
  var gx0=Math.max(0,Math.floor((x0-m)/NAV_CELL)), gx1=Math.min(ngW-1,Math.ceil((x1+m)/NAV_CELL));
  var gy0=Math.max(0,Math.floor((y0-m)/NAV_CELL)), gy1=Math.min(ngH-1,Math.ceil((y1+m)/NAV_CELL));
  for(var gy=gy0;gy<=gy1;gy++) for(var gx=gx0;gx<=gx1;gx++) navGrid[gx+gy*ngW]=1;
}
function unblock(x0,y0,x1,y1){
  var gx0=Math.max(0,Math.ceil(x0/NAV_CELL)), gx1=Math.min(ngW-1,Math.floor(x1/NAV_CELL));
  var gy0=Math.max(0,Math.ceil(y0/NAV_CELL)), gy1=Math.min(ngH-1,Math.floor(y1/NAV_CELL));
  for(var gy=gy0;gy<=gy1;gy++) for(var gx=gx0;gx<=gx1;gx++){
    if(inShell(gx*NAV_CELL,gy*NAV_CELL)) navGrid[gx+gy*ngW]=0;
  }
}
function buildNavGrid(){
  ngW=Math.ceil(W/NAV_CELL)+1; ngH=Math.ceil(GATE/NAV_CELL)+1;
  navGrid=new Uint8Array(ngW*ngH);
  /* casca: borda com folga de meio corpo */
  var BODY=0.10;
  for(var gy=0;gy<ngH;gy++) for(var gx=0;gx<ngW;gx++){
    var x=gx*NAV_CELL, y=gy*NAV_CELL;
    if(!inShell(x,y)||!inShell(x-BODY,y)||!inShell(x+BODY,y)||!inShell(x,y-BODY)) navGrid[gx+gy*ngW]=1;
  }
  /* paredes e painéis bloqueiam (vidas reais: ninguém atravessa) */
  blockers.forEach(function(b){ markBlocked(b.x,b.y,b.x+b.w,b.y+b.h,0.08); });
  /* vão da porta de correr do painel volta a ser passável */
  blockers.forEach(function(b){
    if(b.t!=="painel") return;
    var horiz=b.w>=b.h, len=horiz?b.w:b.h;
    if(len<1.10) return;
    /* vão real é 0,80 m; encolhe só 5 cm por lado — pessoa passa de ombro como na vida real */
    var d0=0.10+0.05, d1=Math.min(0.90,len-0.20)-0.05;
    if(d1-d0<0.15) return;
    if(horiz) unblock(b.x+d0,b.y-0.10,b.x+d1,b.y+b.h+0.10);
    else unblock(b.x-0.10,b.y+d0,b.x+b.w+0.10,b.y+d1);
  });
  /* mobiliário bloqueia com folga de circulação (corpo do operador) */
  stations.forEach(function(st){ markBlocked(st.x,st.y,st.x+st.w,st.y+st.h,MARGIN); });
  pathCache.clear();
  stations.forEach(function(st){ st.sp=servicePoint(st); });
  computeReach();
}
/* flood-fill: quais células são alcançáveis a partir do miolo da loja */
var reach=null;
function computeReach(){
  reach=new Uint8Array(ngW*ngH);
  var seed=null, tries=[[0.9,1.5],[1.3,4.0],[0.5,2.5],[1.3,0.5]];
  for(var s=0;s<tries.length&&!seed;s++) seed=findNearFree(w2gx(tries[s][0]),w2gy(tries[s][1]),12);
  if(!seed) return;
  var stack=[seed.gx+seed.gz*ngW]; reach[seed.gx+seed.gz*ngW]=1;
  while(stack.length){
    var k=stack.pop(), gx=k%ngW, gz=(k/ngW)|0;
    var nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var n=0;n<4;n++){
      var nx=gx+nb[n][0], nz=gz+nb[n][1];
      if(!gFree(nx,nz)) continue;
      var nk=nx+nz*ngW;
      if(!reach[nk]){ reach[nk]=1; stack.push(nk); }
    }
  }
  stations.forEach(function(st){
    st.unreachable=!(st.sp&&reach[w2gx(st.sp.x)+w2gy(st.sp.y)*ngW]);
  });
}
function findNearFree(gx,gz,maxR){
  if(gFree(gx,gz)) return {gx:gx,gz:gz};
  for(var r=1;r<=maxR;r++)
    for(var dx=-r;dx<=r;dx++)
      for(var dz=-r;dz<=r;dz++){
        if(Math.abs(dx)!==r&&Math.abs(dz)!==r) continue;
        if(gFree(gx+dx,gz+dz)) return {gx:gx+dx,gz:gz+dz};
      }
  return null;
}
function servicePoint(st){
  /* candidatos: frente (y+), trás, esquerda, direita — pega célula livre mais próxima */
  var cands=[
    {x:st.cx, y:st.y+st.h+0.22},{x:st.cx, y:st.y-0.22},
    {x:st.x-0.22, y:st.cy},{x:st.x+st.w+0.22, y:st.cy}
  ];
  for(var i=0;i<cands.length;i++){
    var c=cands[i];
    if(c.y>GATE-0.10) continue;
    var nf=findNearFree(w2gx(c.x),w2gy(c.y),6);
    if(nf){
      var px=g2w(nf.gx), py=g2w(nf.gz);
      if(Math.hypot(px-c.x,py-c.y)<0.30) return {x:px,y:py};
    }
  }
  var any=findNearFree(w2gx(st.cx),w2gy(st.cy),24);
  return any?{x:g2w(any.gx),y:g2w(any.gz)}:{x:st.cx,y:st.cy};
}

function MinHeap(){ this.d=[]; }
MinHeap.prototype={
  push:function(n){ this.d.push(n); this._u(this.d.length-1); },
  pop:function(){ var t=this.d[0],l=this.d.pop(); if(this.d.length>0){this.d[0]=l;this._d(0);} return t; },
  size:function(){ return this.d.length; },
  _u:function(i){ while(i>0){ var p=(i-1)>>1; if(this.d[p].f<=this.d[i].f)break; var tmp=this.d[p];this.d[p]=this.d[i];this.d[i]=tmp; i=p; } },
  _d:function(i){ var n=this.d.length; for(;;){ var s=i,l=2*i+1,r=2*i+2;
    if(l<n&&this.d[l].f<this.d[s].f)s=l; if(r<n&&this.d[r].f<this.d[s].f)s=r;
    if(s===i)break; var tmp=this.d[s];this.d[s]=this.d[i];this.d[i]=tmp; i=s; } }
};
var DIRS=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,1.414],[-1,1,1.414],[1,-1,1.414],[1,1,1.414]];
function findPath(sx,sy,ex,ey){
  if(!navGrid) return [];
  var sgx=w2gx(sx),sgz=w2gy(sy),egx=w2gx(ex),egz=w2gy(ey);
  var key=sgx+","+sgz+">"+egx+","+egz;
  if(pathCache.has(key)) return pathCache.get(key).slice();
  if(sgx===egx&&sgz===egz) return [{x:ex,y:ey}];
  var fs=findNearFree(sgx,sgz,24), fe=findNearFree(egx,egz,24);
  if(!fs||!fe) return [];
  var destFree=gFree(egx,egz);
  var open=new MinHeap(), gScore=new Map(), from=new Map(), closed=new Set();
  function heur(gx,gz){ var dx=Math.abs(gx-fe.gx),dz=Math.abs(gz-fe.gz); return Math.max(dx,dz)+0.414*Math.min(dx,dz); }
  var startKey=fs.gx*10000+fs.gz;
  gScore.set(startKey,0); open.push({gx:fs.gx,gz:fs.gz,f:heur(fs.gx,fs.gz)});
  var iter=0,bestKey=startKey,bestDist=heur(fs.gx,fs.gz);
  function rebuild(endKey,snapEnd){
    var raw=[],k=endKey;
    while(k!==undefined){ raw.push(k); k=from.get(k); }
    raw.reverse();
    var path=[];
    for(var i=1;i<raw.length;i++){ var ggx=Math.floor(raw[i]/10000),ggz=raw[i]%10000; path.push({x:g2w(ggx),y:g2w(ggz)}); }
    if(snapEnd&&destFree&&path.length>0) path[path.length-1]={x:ex,y:ey};
    return path;
  }
  while(open.size()>0&&iter<9000){
    iter++;
    var cur=open.pop(), curKey=cur.gx*10000+cur.gz;
    if(closed.has(curKey)) continue;
    closed.add(curKey);
    var dh=heur(cur.gx,cur.gz);
    if(dh<bestDist){ bestDist=dh; bestKey=curKey; }
    if(cur.gx===fe.gx&&cur.gz===fe.gz){
      var p=rebuild(curKey,true);
      if(p.length>0){ if(pathCache.size>600)pathCache.clear(); pathCache.set(key,p); return p.slice(); }
    }
    var cg=gScore.get(curKey);
    for(var i=0;i<DIRS.length;i++){
      var dx=DIRS[i][0],dz=DIRS[i][1],cost=DIRS[i][2];
      var nx=cur.gx+dx,nz=cur.gz+dz;
      if(!gFree(nx,nz)) continue;
      if(dx!==0&&dz!==0&&(!gFree(cur.gx+dx,cur.gz)||!gFree(cur.gx,cur.gz+dz))) continue;
      var nKey=nx*10000+nz;
      if(closed.has(nKey)) continue;
      var ng=cg+cost;
      if(!gScore.has(nKey)||ng<gScore.get(nKey)){
        gScore.set(nKey,ng); from.set(nKey,curKey);
        open.push({gx:nx,gz:nz,f:ng+heur(nx,nz)});
      }
    }
  }
  /* caminho parcial: vai até onde dá — NUNCA salta para o destino */
  if(bestKey!==startKey){ var pb=rebuild(bestKey,false); if(pb.length>0) return pb; }
  if(pathCache.size>600)pathCache.clear();
  pathCache.set(key,[]);
  return [];
}
function pathLen(path,sx,sy){
  var L=0,px=sx,py=sy;
  for(var i=0;i<path.length;i++){ L+=Math.hypot(path[i].x-px,path[i].y-py); px=path[i].x; py=path[i].y; }
  return L;
}

/* =====================================================================
   FILA / RETIRADA (lado de fora, calçada)
   ===================================================================== */
function computeSlots(){
  queueSlots=[]; pickupSlots=[];
  var cx=stationsOfType("caixa")[0], vt=stationsOfType("vitrine")[0];
  var qx0=cx?Math.max(OUT.x0+0.25,Math.min(cx.cx,W-0.2)):0.40;
  var row=0,count=0;
  while(count<40&&row<4){
    var y=GATE+0.45+row*0.55;
    var goingRight=(row%2===0);
    var x=goingRight?qx0:OUT.x1-0.30;
    while(count<40){
      if(goingRight?(x>OUT.x1-0.30):(x<qx0)) break;
      queueSlots.push({x:x,y:y});
      x+=goingRight?0.50:-0.50; count++;
    }
    row++;
  }
  var px0=vt?vt.cx-0.55:1.10;
  for(var r=0;r<2;r++) for(var i=0;i<5;i++)
    pickupSlots.push({x:Math.max(OUT.x0+0.25,px0+i*0.45), y:GATE+0.40+r*0.50});
}

/* =====================================================================
   HEATMAP
   ===================================================================== */
function buildHeat(){
  heatW=Math.ceil((OUT.x1-OUT.x0)/HEAT_CELL);
  heatH=Math.ceil((OUT.y1+0.2)/HEAT_CELL);
  heat=new Float32Array(heatW*heatH);
}
function heatAdd(x,y,v){
  var gx=Math.floor((x-OUT.x0)/HEAT_CELL), gy=Math.floor((y+0.2)/HEAT_CELL);
  if(gx>=0&&gx<heatW&&gy>=0&&gy<heatH) heat[gx+gy*heatW]+=v;
}

/* =====================================================================
   OPERADORES / CLIENTES
   ===================================================================== */
var OP_COLORS=["#2A6FDB","#1F8A5B","#8E44AD","#0E8A8A"];
function buildOperators(){
  operators=[];
  var n=Math.max(1,Math.min(4,cfg.ops|0));
  for(var i=0;i<n;i++){
    /* atendentes começam na FOH (frente, y>CUT_Y) */
    var spot=findNearFree(w2gx(0.45+i*0.55),w2gy(3.65+ (i%2)*0.35),30)||{gx:w2gx(0.6),gz:w2gy(3.8)};
    operators.push({
      idx:i, role:"atendente", zone:"foh",
      x:g2w(spot.gx), y:g2w(spot.gz),
      idleX:g2w(spot.gx), idleY:g2w(spot.gz),
      state:"idle", task:null, statusText:"Livre",
      path:[], pathIdx:0, tX:0, tY:0,
      color:OP_COLORS[i%4], trail:[],
      fixedEq:cfg.fixedEq[i]||"", fixoStep:null, placed:false,
      stuck:0, carrying:null, waitFor:null, waitT:0
    });
    S.opBusy[i]=S.opBusy[i]||0; S.opOrders[i]=S.opOrders[i]||0; S.opDist[i]=S.opDist[i]||0;
  }
  /* padeiro: agente dedicado do BOH (fundo, y<CUT_Y) quando a produção é própria/híbrida */
  if(cfg.bread.mode!=="terc"){
    var bi=operators.length;
    var bspot=findNearFree(w2gx(0.9),w2gy(1.1),30)||{gx:w2gx(0.9),gz:w2gy(1.1)};
    operators.push({
      idx:bi, role:"padeiro", tag:"P", zone:"boh",
      x:g2w(bspot.gx), y:g2w(bspot.gz), idleX:g2w(bspot.gx), idleY:g2w(bspot.gz),
      state:"idle", bstate:"idle", bt:0, task:null, statusText:"Padeiro · livre",
      path:[], pathIdx:0, tX:0, tY:0,
      color:"#8A5A2B", trail:[], fixedEq:"", fixoStep:null, placed:false,
      stuck:0, carrying:null, waitFor:null, waitT:0
    });
    S.opBusy[bi]=S.opBusy[bi]||0; S.opOrders[bi]=S.opOrders[bi]||0; S.opDist[bi]=S.opDist[bi]||0;
  }
}
function setOpTarget(op,tx,ty){
  ty=Math.min(ty,GATE-0.12);
  if(op.path&&op.path.length&&Math.abs(op.tX-tx)<0.08&&Math.abs(op.tY-ty)<0.08) return;
  op.tX=tx; op.tY=ty;
  op.path=findPath(op.x,op.y,tx,ty);
  op.pathIdx=0;
}
function stepAlong(op,spd){
  if(!op.path||op.path.length===0) return false;
  if(op.pathIdx>=op.path.length) return true;
  var wp=op.path[op.pathIdx];
  var dx=wp.x-op.x, dy=wp.y-op.y, d=Math.hypot(dx,dy);
  var mv=Math.min(d,spd);
  if(d>0.0001){ op.x+=dx/d*mv; op.y+=dy/d*mv; S.opDist[op.idx]+=mv; }
  if(d<=spd){ op.pathIdx++; if(op.pathIdx>=op.path.length) return true; }
  return false;
}
function stepTo(a,tx,ty,spd){
  var dx=tx-a.x, dy=ty-a.y, d=Math.hypot(dx,dy);
  if(d<0.001) return true;
  var mv=Math.min(d,spd);
  a.x+=dx/d*mv; a.y+=dy/d*mv;
  return d<=spd;
}

/* locks por estação (instância) */
function eqCap(id){ var st=stById[id]; return st?(st.capacity||1):1; }
function lockHas(id,oi){ return !!(eqLock[id]&&eqLock[id].has(oi)); }
function lockFull(id,oi){ return !!(eqLock[id]&&eqLock[id].size>=eqCap(id)&&!lockHas(id,oi)); }
function lockAdd(id,oi){ if(!eqLock[id])eqLock[id]=new Set(); eqLock[id].add(oi); }
function lockDel(id,oi){ if(!eqLock[id])return; eqLock[id].delete(oi); if(eqLock[id].size===0)delete eqLock[id]; }
function lockClear(oi){ Object.keys(eqLock).forEach(function(k){ lockDel(k,oi); }); }

/* escolhe instância da estação: livre e mais perto (respeitando zona quando indicada) */
function pickStation(type,fromX,fromY,oi,zone){
  var list=zone?stationsZone(type,zone):stationsOfType(type);
  if(!list.length){ list=stationsOfType(type); if(zone&&list.length) logEvent("warn","Etapa “"+type+"” não tem estação na frente (FOH) — atendente usando o fundo","zone-"+type); }
  if(!list.length) return null;
  var best=null,bd=1e9,bestAny=null,bdAny=1e9;
  list.forEach(function(st){
    var d=Math.hypot(st.sp.x-fromX,st.sp.y-fromY);
    if(d<bdAny){ bdAny=d; bestAny=st; }
    if(!lockFull(st.id,oi)&&d<bd){ bd=d; best=st; }
  });
  return best||bestAny;
}

/* =====================================================================
   PADARIA — produção de pães no BOH (padeiro, batedeira, estufa, forno)
   ===================================================================== */
var BR={stock:0,flour:0,consumed:0,baked:0,mixes:0,flourUsed:0,stockoutMin:0,waitingBread:0,hist:[],lastHist:600,batches:[],bid:0};
function resetBread(){
  var b=cfg.bread;
  var ownPct=b.mode==="hibrido"?Math.max(0,Math.min(100,b.hybridOwnPct))/100:(b.mode==="terc"?0:1);
  var startStock=b.mode==="terc"?Math.round(b.tercQty)
               : b.mode==="hibrido"?Math.round(b.breadStart+b.tercQty*(1-ownPct))
               : Math.round(b.breadStart);
  BR={stock:startStock,
      flour:b.mode==="terc"?0:b.flourStart,
      consumed:0,baked:0,mixes:0,flourUsed:0,stockoutMin:0,waitingBread:0,
      peakStock:startStock,tercUsed:0,
      hist:[],lastHist:10*60,batches:[],bid:0};
}
function breadMissing(){
  if(cfg.bread.mode==="terc") return [];
  return ["batedeira","estufa","forno"].filter(function(t){ return !stationsOfType(t).length; });
}
function stOf(t){ return stationsOfType(t)[0]||null; }
function bSpot(t,fbx,fby){ var st=stOf(t); return st&&st.sp?{x:st.sp.x,y:st.sp.y,st:st}:{x:fbx,y:fby,st:null}; }
function typeCap(t){ var st=stOf(t); return st?Math.max(1,(cfg.capacity[t]||1)*stationsOfType(t).length):(cfg.capacity[t]||1); }
function pipelineBreads(baker){
  var n=BR.batches.length*cfg.bread.batchSize;
  if(baker&&baker.bstate&&baker.bstate!=="idle") n+=cfg.bread.batchSize;
  return n;
}
/* estágios passivos (fermentação/forno) avançam sozinhos */
function breadPassive(dt){
  var b=cfg.bread;
  var stE=stOf("estufa"), stF=stOf("forno");
  var capE=Math.max(1,typeCap("estufa")), capF=Math.max(1,typeCap("forno"));
  BR.batches.forEach(function(bt){
    if(bt.phase==="proof"){
      bt.t+=dt;
      if(stE) S.eqBusy[stE.id]=(S.eqBusy[stE.id]||0)+dt/capE;
      if(bt.t>=b.proofTime) bt.phase="ready_oven";
    } else if(bt.phase==="bake"){
      bt.t+=dt;
      if(stF) S.eqBusy[stF.id]=(S.eqBusy[stF.id]||0)+dt/capF;
      if(bt.t>=b.bakeTime) bt.phase="ready_out";
    }
  });
  if(simTime-BR.lastHist>=5){
    BR.hist.push({t:simTime,stock:BR.stock,flour:+BR.flour.toFixed(2)});
    BR.lastHist=simTime;
    if(BR.hist.length>200) BR.hist.shift();
  }
}
/* máquina de estados do padeiro */
function bakerTick(op,dt,spd){
  var b=cfg.bread;
  var last=op.trail[op.trail.length-1];
  if(op.bstate!=="idle"&&(!last||Math.hypot(op.x-last.x,op.y-last.y)>0.15)){
    op.trail.push({x:op.x,y:op.y}); if(op.trail.length>90) op.trail.shift();
  }
  heatAdd(op.x,op.y,dt);
  if(op.bstate!=="idle") S.opBusy[op.idx]=(S.opBusy[op.idx]||0)+dt;

  function go(spot){ setOpTarget(op,spot.x,spot.y); return stepAlong(op,spd); }
  var mixer=bSpot("batedeira",1.0,1.3), estufa=bSpot("estufa",1.0,2.0),
      forno=bSpot("forno",1.4,0.6), farinha=bSpot("estoque",0.5,0.35);
  /* BOH é zona exclusiva: o pão pronto vai para o ESTOQUE do fundo (handoff). A frente consome do estoque. */
  var estoqueSt=stationsZone("estoque","boh")[0]||stOf("estoque");
  var deliver=estoqueSt&&estoqueSt.sp?{x:estoqueSt.sp.x,y:estoqueSt.sp.y}:{x:0.9,y:CUT_Y-0.35};

  var readyOut=BR.batches.find(function(x){return x.phase==="ready_out";});
  var readyOven=BR.batches.find(function(x){return x.phase==="ready_oven";});
  var bakingN=BR.batches.filter(function(x){return x.phase==="bake";}).length;
  var proofN=BR.batches.filter(function(x){return x.phase==="proof"||x.phase==="ready_oven";}).length;

  switch(op.bstate){
    case "idle":
      var shiftEnd=(b.shiftStart||600)+(b.shiftHours||8)*60*Math.max(1,b.shifts||1);
      var working=simTime<shiftEnd;
      op.busyState="idle"; op.statusText=working?"Padeiro · livre":"Padeiro · turno encerrado";
      if(readyOut){ op.bstate="to_oven_out"; break; }
      if(readyOven&&bakingN<typeCap("forno")){ op.bstate="to_estufa_out"; break; }
      var kgNeed=b.batchSize*b.flourPerBread;
      var inPipe=BR.stock+pipelineBreads(null);
      /* FÁBRICA: produz continuamente durante o turno, até encher o estoque (limite de espaço) */
      if(working&&inPipe+b.batchSize<=(b.storageCap||999)&&BR.flour>=kgNeed&&proofN<typeCap("estufa")){
        op.bstate="to_flour"; break;
      }
      if(working){
        if(BR.flour<kgNeed) logEvent("warn","Padeiro sem farinha — produção parada (reabastecer farinha)","flour-out");
        else if(inPipe+b.batchSize>(b.storageCap||999)){ op.statusText="Estoque cheio ("+Math.round(inPipe)+"/"+b.storageCap+") — aguardando venda"; logEvent("info","Estoque de pães no limite ("+b.storageCap+") — o espaço de estoque é o gargalo, não o padeiro","bread-full"); }
        else if(proofN>=typeCap("estufa")) op.statusText="Estufa cheia — aguardando fermentação";
      }
      go({x:op.idleX,y:op.idleY});
      break;
    case "to_flour":
      op.busyState="busy"; op.statusText="Buscando farinha";
      if(go(farinha)){ op.bstate="get_flour"; op.bt=0; }
      break;
    case "get_flour":
      op.busyState="busy"; op.statusText="Pesando farinha"; op.bt+=dt;
      if(op.bt>=0.6){ op.bstate="to_mixer"; op.carrying="farinha"; }
      break;
    case "to_mixer":
      op.busyState="busy"; op.statusText="Indo à batedeira";
      if(go(mixer)){ op.bstate="mixing"; op.bt=0; }
      break;
    case "mixing":
      op.busyState="busy"; op.bt+=dt;
      op.statusText="Batedeira "+Math.min(100,Math.round(op.bt/b.mixTime*100))+"%";
      if(mixer.st) S.eqBusy[mixer.st.id]=(S.eqBusy[mixer.st.id]||0)+dt;
      if(op.bt>=b.mixTime){
        var kg=b.batchSize*b.flourPerBread;
        BR.flour=Math.max(0,BR.flour-kg); BR.flourUsed+=kg; BR.mixes++;
        if(mixer.st) S.eqCount[mixer.st.id]=(S.eqCount[mixer.st.id]||0)+1;
        op.carrying="massa"; op.bstate="to_estufa";
      }
      break;
    case "to_estufa":
      op.busyState="busy"; op.statusText="Levando massa à estufa";
      if(go(estufa)){ op.bt=0; op.bstate="load_estufa"; }
      break;
    case "load_estufa":
      op.busyState="busy"; op.statusText="Carregando estufa"; op.bt+=dt;
      if(op.bt>=0.4){
        BR.batches.push({id:++BR.bid,phase:"proof",t:0,size:b.batchSize});
        if(estufa.st) S.eqCount[estufa.st.id]=(S.eqCount[estufa.st.id]||0)+1;
        op.carrying=null; op.bstate="idle";
      }
      break;
    case "to_estufa_out":
      op.busyState="busy"; op.statusText="Retirando da estufa";
      if(go(estufa)){
        var bt1=BR.batches.find(function(x){return x.phase==="ready_oven";});
        if(!bt1){ op.bstate="idle"; break; }
        bt1.phase="carried"; op.batch=bt1; op.carrying="massa"; op.bstate="to_oven_in";
      }
      break;
    case "to_oven_in":
      op.busyState="busy"; op.statusText="Levando ao forno";
      if(go(forno)){
        if(op.batch){ op.batch.phase="bake"; op.batch.t=0; }
        if(forno.st) S.eqCount[forno.st.id]=(S.eqCount[forno.st.id]||0)+1;
        op.batch=null; op.carrying=null; op.bstate="idle";
      }
      break;
    case "to_oven_out":
      op.busyState="busy"; op.statusText="Retirando pães do forno";
      if(go(forno)){
        var bt2=BR.batches.find(function(x){return x.phase==="ready_out";});
        if(!bt2){ op.bstate="idle"; break; }
        BR.batches.splice(BR.batches.indexOf(bt2),1);
        op.batchSize=bt2.size; op.carrying="pao"; op.bstate="deliver";
      }
      break;
    case "deliver":
      op.busyState="busy"; op.statusText="Estocando "+(op.batchSize||0)+" pães (fundo)";
      if(go(deliver)){
        BR.stock+=op.batchSize||0; BR.baked+=op.batchSize||0; S.breadProducedShift+=op.batchSize||0;
        BR.peakStock=Math.max(BR.peakStock||0,BR.stock);
        op.batchSize=0; op.carrying=null; op.bstate="idle";
      }
      break;
    default: op.bstate="idle";
  }
}
function orderBreadNeed(order){
  return (order.items||[]).reduce(function(s,it){ return s+(it.pao||0); },0);
}

/* =====================================================================
   DEMANDA / PEDIDOS
   ===================================================================== */
function demandMultiplier(timeMin){
  if(cfg.demandCurve==="flat") return 1;
  var h=timeMin/60;
  function peak(c,s,a){ return a*Math.exp(-Math.pow(h-c,2)/(2*s*s)); }
  var m=0.35;
  if(cfg.demandCurve==="lunch"||cfg.demandCurve==="both") m+=peak(13,1.0,2.0);
  if(cfg.demandCurve==="dinner"||cfg.demandCurve==="both") m+=peak(20,1.0,1.6);
  if(cfg.demandCurve==="lunch"&&h>16) m=0.30;
  return Math.max(0.1,m);
}
function spawnCustomer(){
  var id=S.nextId++;
  customers.push({
    id:id, x:OUT.x0+0.3+Math.random()*(OUT.x1-OUT.x0-0.6), y:OUT.y1-0.15,
    state:"entering", tArr:simTime, tSS:null, order:null, orderTotal:0,
    itemName:"", orderNum:null, queuePos:-1, pdvTimer:0, pickupSlot:0
  });
  var base=Math.max(1,cfg.rate)/60;
  var rate=Math.max(0.001,base*demandMultiplier(simTime));
  S.nextArr=simTime+(-Math.log(Math.random())/rate);
}
function pickByCategory(cat){
  var sw=cfg.menu.filter(function(m){ return lancheCat(m)==="lanche"; });
  var dr=cfg.menu.filter(function(m){ return lancheCat(m)!=="lanche"; });
  var pool=cat==="sandwich"?sw:dr;
  if(!pool.length) return null;
  var tot=pool.reduce(function(a,m){return a+m.prob;},0), r=Math.random()*tot, acc=0;
  for(var i=0;i<pool.length;i++){ acc+=pool[i].prob; if(r<=acc) return pool[i]; }
  return pool[0];
}
function generateOrder(){
  var maxI=Math.max(1,Math.min(6,cfg.maxItems|0));
  var bias=Math.max(0,Math.min(100,cfg.groupBias|0))/100;
  var decay=Math.pow(0.05,bias), weights=[],n;
  for(n=1;n<=maxI;n++) weights.push(Math.pow(decay,n-1));
  var tot=weights.reduce(function(a,b){return a+b;},0), r=Math.random()*tot, acc=0, nItems=1;
  for(var i=0;i<maxI;i++){ acc+=weights[i]; if(r<=acc){ nItems=i+1; break; } }
  var pattern=[]; for(i=0;i<nItems;i++) pattern.push("sandwich");
  if(Math.random()<0.6) pattern.push("drink");
  var orders=[];
  pattern.forEach(function(cat){
    var it=pickByCategory(cat); if(!it) return;
    orders.push({id:it.id,name:it.name,price:it.price,pao:it.pao||0,
      steps:it.steps.filter(function(s){return stationsOfType(s.type).length>0;})
        .map(function(s){return {type:s.type,time:s.time,done:false};})});
  });
  if(!orders.length&&cfg.menu.length){
    var it0=cfg.menu[0];
    orders.push({id:it0.id,name:it0.name,price:it0.price,pao:it0.pao||0,
      steps:it0.steps.map(function(s){return {type:s.type,time:s.time,done:false};})});
  }
  return orders;
}

/* =====================================================================
   TICK
   ===================================================================== */
function tick(dt){
  if(simTime>=S.nextArr) spawnCustomer();
  var opSpd=cfg.walkSpeed*dt, cuSpd=cfg.custSpeed*dt;
  var tol=cfg.tol;

  if(simTime-S.lastHistMin>=1.0){
    S.servedHist.push(S.served); S.balkedHist.push(S.balked); S.queueHist.push(waitQueue.length);
    S.lastHistMin=simTime;
    if(S.servedHist.length>720){ S.servedHist.shift(); S.balkedHist.shift(); S.queueHist.shift(); }
  }
  stations.forEach(function(st){
    S.eqTotal[st.id]=(S.eqTotal[st.id]||0)+dt;
    if(!S.eqBusy[st.id]) S.eqBusy[st.id]=0;
  });

  var caixa=stationsOfType("caixa")[0];
  var pdvX=caixa?Math.max(0.25,Math.min(caixa.cx,W-0.25)):0.4, pdvY=GATE+0.35;

  /* ---- clientes ---- */
  for(var i=customers.length-1;i>=0;i--){
    var c=customers[i];
    if(c.state==="entering"){
      var slot=queueSlots[Math.min(waitQueue.length,queueSlots.length-1)]||{x:pdvX,y:GATE+0.5};
      if(stepTo(c,slot.x,slot.y,cuSpd)||Math.hypot(c.x-slot.x,c.y-slot.y)<0.15){
        c.state="waiting";
        var order=generateOrder();
        c.order=order;
        c.orderTotal=order.reduce(function(s,it){return s+it.price;},0);
        c.itemName=order.map(function(it){return it.name;}).join(" + ");
        waitQueue.push(c); c.queuePos=waitQueue.length-1;
        S.maxQueue=Math.max(S.maxQueue,waitQueue.length);
      }
    }
    else if(c.state==="waiting"){
      var qs=queueSlots[Math.min(c.queuePos,queueSlots.length-1)];
      if(qs) stepTo(c,qs.x,qs.y,cuSpd);
      var waited=simTime-c.tArr;
      if(waited>tol){
        c.state="leaving"; S.balked++;
        logEvent("warn","Cliente desistiu da fila (esperou "+waited.toFixed(0)+" min). Fila longa demais na frente.","balk");
        var qi=waitQueue.indexOf(c); if(qi>=0) waitQueue.splice(qi,1);
        waitQueue.forEach(function(cu,k){ cu.queuePos=k; });
        continue;
      }
      if(c.queuePos===0&&!pdvBusy){
        pdvBusy=true;
        waitQueue.shift(); waitQueue.forEach(function(cu,k){ cu.queuePos=k; });
        c.state="at_pdv"; c.pdvTimer=0;
      }
    }
    else if(c.state==="at_pdv"){
      if(stepTo(c,pdvX,pdvY,cuSpd)||Math.hypot(c.x-pdvX,c.y-pdvY)<0.12){
        c.pdvTimer+=dt;
        if(caixa){ S.eqBusy[caixa.id]=(S.eqBusy[caixa.id]||0)+dt; }
        if(c.pdvTimer>=cfg.payTime){
          S.revenue+=c.orderTotal; S.revenueBruto+=c.orderTotal;
          c.order.forEach(function(it){
            S.itemsSold[it.id]=(S.itemsSold[it.id]||0)+1;
            var mi=cfg.menu.find(function(m){ return m.id===it.id; });
            if(mi&&lancheCat(mi)!=="lanche"){
              if(S.bibite>0){ S.bibite--; S.bibiteSold++; }
              else logEvent("warn","Geladeira de bebidas vazia — bebida vendida sem estoque (repor)","bibite-out");
            } else if(mi){ S.vitrineSold++; }
          });
          pdvBusy=false;
          var used=customers.filter(function(cu){return cu.state==="waiting_pickup";}).map(function(cu){return cu.pickupSlot;});
          var ps=-1;
          for(var s2=0;s2<pickupSlots.length;s2++){ if(used.indexOf(s2)<0){ ps=s2; break; } }
          if(ps<0) ps=0;
          c.pickupSlot=ps; c.state="waiting_pickup"; c.tSS=simTime;
          var orderNum=++S.orderNum; c.orderNum=orderNum;
          /* agrupa etapas da mesma estação: 1º item tempo cheio, extras +50% */
          var typeOrder=[], byType={};
          c.order.forEach(function(it){ it.steps.forEach(function(st){
            if(!byType[st.type]){ typeOrder.push(st.type); byType[st.type]=0; }
            byType[st.type]+=byType[st.type]===0?st.time:st.time*0.5;
          });});
          var allSteps=typeOrder.map(function(t){ return {type:t,time:byType[t],done:false}; });
          prepQueue.push({customer:c,items:c.order,orderNum:orderNum,startTime:simTime,steps:allSteps,custArrTime:c.tArr});
          activeOrders.push({num:orderNum,items:c.order.map(function(it){return it.name;}),opIdx:-1,
            status:"Fila preparo",startTime:simTime,custId:c.id,
            totalSteps:allSteps.length+1,currentStep:0,phase:"queued"});
        }
      }
    }
    else if(c.state==="waiting_pickup"){
      var pk=pickupSlots[c.pickupSlot]||pickupSlots[0];
      if(pk) stepTo(c,pk.x,pk.y,cuSpd);
      var pw=simTime-(c.tSS||simTime);
      if(pw>cfg.pickupTimeout){
        c.state="leaving"; S.balkedPickup++;
        logEvent("crit","Abandono na retirada (#"+(c.orderNum||"?")+") — pedido pago e não entregue no prazo (reembolso).","balk-pickup");
        S.reembolsos+=(c.orderTotal||0); S.revenue=S.revenueBruto-S.reembolsos;
        c.order.forEach(function(it){ if(S.itemsSold[it.id]) S.itemsSold[it.id]--; });
        var pi=prepQueue.findIndex(function(p){return p.customer===c;}); if(pi>=0) prepQueue.splice(pi,1);
        if(c.orderNum) removeOrder(c.orderNum);
        operators.forEach(function(op){ if(op.task&&op.task.customer===c) op.task.customer=null; });
      }
    }
    else if(c.state==="leaving"){
      stepTo(c,c.x,OUT.y1+0.5,cuSpd*1.8);
      if(c.y>OUT.y1+0.3){ customers.splice(i,1); }
    }
    if(c.state!=="leaving"&&c.state!=="entering") heatAdd(c.x,c.y,dt);
  }

  /* repulsão entre clientes */
  var MIN_D=0.34;
  for(i=0;i<customers.length;i++){
    var ci=customers[i]; if(ci.state==="leaving") continue;
    for(var j=i+1;j<customers.length;j++){
      var cj=customers[j]; if(cj.state==="leaving") continue;
      var dx=ci.x-cj.x, dy=ci.y-cj.y, d=Math.hypot(dx,dy);
      if(d<MIN_D&&d>0.001){
        var ov=(MIN_D-d)*0.4, nx=dx/d, ny=dy/d;
        ci.x+=nx*ov*0.5; ci.y+=ny*ov*0.5; cj.x-=nx*ov*0.5; cj.y-=ny*ov*0.5;
      }
    }
    ci.x=Math.max(OUT.x0+0.15,Math.min(OUT.x1-0.15,ci.x));
    ci.y=Math.max(GATE+0.20,Math.min(OUT.y1,ci.y));
  }

  /* ---- atribuição: volantes pegam pedidos (se há pão em estoque) ---- */
  operators.forEach(function(op){
    if(op.fixedEq||op.role==="padeiro") return;
    if(op.state!=="idle"||prepQueue.length===0) return;
    var pick=-1;
    for(var q=0;q<prepQueue.length;q++){
      if(orderBreadNeed(prepQueue[q])<=BR.stock){ pick=q; break; }
    }
    if(pick<0) return;
    var order=prepQueue.splice(pick,1)[0];
    var bn=orderBreadNeed(order);
    if(bn>0){ BR.stock-=bn; BR.consumed+=bn; }
    op.task={customer:order.customer,items:order.items,steps:order.steps,si:0,atEq:false,tAtEq:0,
      orderNum:order.orderNum,startTime:order.startTime,pickedAt:simTime,deliverTimer:0,
      custArrTime:order.custArrTime,stId:null};
    op.state="working"; op.statusText="Preparando #"+op.task.orderNum;
    var ao=activeOrders.find(function(a){return a.num===op.task.orderNum;});
    if(ao){ ao.opIdx=op.idx; ao.status="Preparando"; ao.phase="preparing"; }
  });

  /* ---- padaria: estágios passivos + falta de pão ---- */
  breadPassive(dt);
  clearOldAlerts();
  BR.waitingBread=prepQueue.filter(function(o){ return orderBreadNeed(o)>BR.stock; }).length;
  if(BR.waitingBread>0){
    BR.stockoutMin+=dt;
    logEvent("crit","Pão esgotado — "+BR.waitingBread+" pedido(s) parados na frente. A produção do fundo não acompanha a demanda.","bread-stockout");
    prepQueue.forEach(function(o){
      if(orderBreadNeed(o)>BR.stock) updateOrder(o.orderNum,"Sem pão — aguardando",null,null);
    });
  }
  if(S.bibite<=0&&simTime>S.simStartTime+1) S.bibiteEmptyMin+=dt;

  /* pré-passo: proximidade entre operadores reduz velocidade (corredor estreito) */
  operators.forEach(function(op){ op.slow=1; });
  for(i=0;i<operators.length;i++){
    for(var j2=i+1;j2<operators.length;j2++){
      var d2=Math.hypot(operators[i].x-operators[j2].x,operators[i].y-operators[j2].y);
      if(d2<0.42){ operators[i].slow=0.5; operators[j2].slow=0.5; }
    }
  }

  /* ---- operadores ---- */
  operators.forEach(function(op,oi){
    var opSpdEff=opSpd*(op.slow||1);
    /* PADEIRO: máquina de estados própria (produção de pães) */
    if(op.role==="padeiro"){ bakerTick(op,dt,opSpdEff); return; }
    /* FIXO: parado na estação, faz marcha */
    if(op.fixedEq){
      var stF=stById[op.fixedEq];
      if(!stF){ op.statusText="fixo inválido"; return; }
      if(!op.placed){ op.x=stF.sp.x; op.y=stF.sp.y; op.idleX=op.x; op.idleY=op.y; op.path=[]; op.placed=true; }
      if(!op.fixoStep){
        var cand=null;
        for(var k=0;k<operators.length&&!cand;k++){
          var op2=operators[k];
          if(!op2.task||op2.fixedEq) continue;
          for(var si=0;si<op2.task.steps.length;si++){
            var st2=op2.task.steps[si];
            if(st2.type===stF.type&&!st2.done&&st2.busy===undefined){ cand=st2; break; }
          }
        }
        if(!cand){
          for(k=0;k<prepQueue.length&&!cand;k++){
            for(si=0;si<prepQueue[k].steps.length;si++){
              var st3=prepQueue[k].steps[si];
              if(st3.type===stF.type&&!st3.done&&st3.busy===undefined){ cand=st3; break; }
            }
          }
        }
        if(cand){ cand.busy=op.idx; cand.elapsed=0; op.fixoStep=cand; }
      }
      if(op.fixoStep){
        S.eqBusy[stF.id]=(S.eqBusy[stF.id]||0)+dt;
        S.opBusy[oi]=(S.opBusy[oi]||0)+dt;
        op.fixoStep.elapsed+=dt;
        var pctF=Math.min(100,Math.round(op.fixoStep.elapsed/op.fixoStep.time*100));
        op.statusText=stF.name+" "+pctF+"%"; op.busyState="busy";
        if(op.fixoStep.elapsed>=op.fixoStep.time){
          op.fixoStep.done=true; delete op.fixoStep.busy; delete op.fixoStep.elapsed;
          S.eqCount[stF.id]=(S.eqCount[stF.id]||0)+1;
          op.fixoStep=null;
        }
      } else { op.statusText="aguardando em "+stF.name; op.busyState="idle"; }
      heatAdd(op.x,op.y,dt);
      return;
    }

    if(op.state!=="idle"){
      var last=op.trail[op.trail.length-1];
      if(!last||Math.hypot(op.x-last.x,op.y-last.y)>0.15){
        op.trail.push({x:op.x,y:op.y});
        if(op.trail.length>90) op.trail.shift();
      }
    }
    heatAdd(op.x,op.y,dt);

    if(op.state==="idle"){
      setOpTarget(op,op.idleX,op.idleY); stepAlong(op,opSpdEff);
      op.statusText="Livre"; op.busyState="idle"; op.stuck=0; return;
    }
    S.opBusy[oi]=(S.opBusy[oi]||0)+dt;

    if(op.state==="working"){
      var t=op.task;
      if(!t||t.si>=t.steps.length){
        lockClear(oi);
        op.carrying=t.items&&t.items[0]?t.items[0].id:"spaccata";
        op.state="to_balcao";
        var cx2=t.customer?Math.max(0.25,Math.min(t.customer.x,W-0.25)):W/2;
        setOpTarget(op,cx2,GATE-0.30);
        op.statusText="Levando #"+t.orderNum; op.busyState="busy";
        updateOrder(t.orderNum,"Entregando","delivering",t.steps.length);
        return;
      }
      var step=t.steps[t.si];
      if(step.done){ t.si++; t.atEq=false; t.tAtEq=0; t.stId=null; updateOrder(t.orderNum,null,"preparing",t.si); return; }
      var hasFixo=operators.some(function(o2){ var sf=stById[o2.fixedEq]; return sf&&sf.type===step.type; });
      if(hasFixo){
        op.statusText="Aguardando fixo: "+step.type; op.busyState="wait";
        updateOrder(t.orderNum,"Fixo: "+step.type,null,null);
        return;
      }
      if(!t.stId){
        var stPick=pickStation(step.type,op.x,op.y,oi,"foh");
        if(!stPick){ step.done=true; return; }
        t.stId=stPick.id;
      }
      var stp=stById[t.stId];
      if(!stp){ t.stId=null; t.atEq=false; t.tAtEq=0; return; } /* estação sumiu (planta editada) */
      if(!t.atEq){
        if(lockFull(t.stId,oi)){
          op.statusText="Aguardando "+stp.name; op.busyState="wait";
          updateOrder(t.orderNum,"Aguardando "+stp.name,null,null);
          return;
        }
        op.busyState="busy"; op.statusText="Indo p/ "+stp.name;
        setOpTarget(op,stp.sp.x,stp.sp.y);
        if(stepAlong(op,opSpdEff)){ t.atEq=true; lockAdd(t.stId,oi); op.stuck=0; }
        else if(!op.path||op.path.length===0){
          /* sem rota: re-tenta; só “chega” quando realmente está ao lado da estação */
          op.stuck+=dt;
          if(op.stuck>0.8){ pathCache.clear(); setOpTarget(op,stp.sp.x,stp.sp.y); }
          if(op.stuck>3.0&&Math.hypot(op.x-stp.sp.x,op.y-stp.sp.y)<0.45){
            t.atEq=true; lockAdd(t.stId,oi); op.stuck=0;
          } else if(op.stuck>6.0){
            /* isolado de verdade: tenta outra instância do mesmo tipo */
            t.stId=null; op.stuck=0;
          }
        }
      } else {
        op.busyState="busy";
        S.eqBusy[t.stId]=(S.eqBusy[t.stId]||0)+dt;
        t.tAtEq+=dt;
        var pct=Math.min(100,Math.round(t.tAtEq/step.time*100));
        op.statusText=stp.name+" "+pct+"%";
        updateOrder(t.orderNum,stp.name+" "+(t.si+1)+"/"+t.steps.length+" ("+pct+"%)",null,null);
        if(t.tAtEq>=step.time){
          S.eqCount[t.stId]=(S.eqCount[t.stId]||0)+1;
          lockDel(t.stId,oi); t.si++; t.atEq=false; t.tAtEq=0; t.stId=null;
          updateOrder(t.orderNum,null,"preparing",t.si);
        }
      }
    }
    else if(op.state==="to_balcao"){
      op.busyState="busy";
      var arr=stepAlong(op,opSpdEff);
      if(!arr&&(!op.path||op.path.length===0)){
        op.stuck+=dt;
        if(op.stuck>0.8){ pathCache.clear(); op.path=findPath(op.x,op.y,op.tX,op.tY); op.pathIdx=0; }
        if(op.stuck>3.0&&Math.hypot(op.x-op.tX,op.y-op.tY)<0.60) arr=true;
      }
      if(arr){
        op.state="delivering"; op.task.deliverTimer=0;
        op.statusText="Entregando #"+op.task.orderNum; op.stuck=0;
      }
    }
    else if(op.state==="delivering"){
      op.busyState="busy";
      op.task.deliverTimer+=dt;
      if(op.task.deliverTimer>=0.3){
        var c2=op.task.customer;
        var prepDur=simTime-op.task.startTime;
        var actualPrep=simTime-(op.task.pickedAt||op.task.startTime);
        var queueW=(op.task.pickedAt||op.task.startTime)-op.task.startTime;
        if(prepDur<=cfg.sla) S.slaOk++;
        S.served++; S.totalPrepTime+=prepDur;
        S.totalActualPrep+=actualPrep; S.totalQueueWait+=queueW;
        S.opOrders[op.idx]=(S.opOrders[op.idx]||0)+1;
        S.totalWait+=simTime-(op.task.custArrTime||op.task.startTime);
        if(c2){
          S.servedRevenue+=(c2.orderTotal||0);
          c2.state="leaving"; c2.served=true;
        } else {
          S.servedRevenue+=(op.task.items?op.task.items.reduce(function(s,it){return s+it.price;},0):0);
        }
        op.carrying=null; removeOrder(op.task.orderNum);
        op.task=null; op.state="idle";
      }
    }
  });

  /* ---- watchdog: diagnostica travas e ociosidade (alimenta a central de alertas) ---- */
  operators.forEach(function(op){
    if(op.role==="padeiro") return;
    if(op.busyState==="wait"){
      op.waitT=(op.waitT||0)+dt;
      if(op.waitT>4){ logEvent("warn","Atendente "+(op.idx+1)+": "+(op.statusText||"aguardando"),"op-wait-"+op.idx); }
    } else op.waitT=0;
    if(op.state==="idle"&&!op.fixedEq){
      var feasible=prepQueue.some(function(o){ return orderBreadNeed(o)<=BR.stock; });
      if(feasible){ op.idleStall=(op.idleStall||0)+dt; if(op.idleStall>3){ logEvent("crit","Atendente "+(op.idx+1)+" parado com fila e pão disponível — travamento; reatribuindo","op-stall-"+op.idx); op.stuck=0; op.idleStall=0; pathCache.clear(); } }
      else op.idleStall=0;
    } else op.idleStall=0;
  });

  /* congestionamento entre operadores (corredor apertado) + separação física */
  for(i=0;i<operators.length;i++){
    for(j=i+1;j<operators.length;j++){
      var oa=operators[i], ob=operators[j];
      var ddx=oa.x-ob.x, ddy=oa.y-ob.y, dd=Math.hypot(ddx,ddy);
      if(dd<0.36&&(oa.state!=="idle"||ob.state!=="idle")) S.congestMin+=dt;
      if(dd<0.30&&dd>0.001){
        var ov2=(0.30-dd)*0.5, nx2=ddx/dd, ny2=ddy/dd;
        var ax=oa.x+nx2*ov2, ay=oa.y+ny2*ov2;
        var bx=ob.x-nx2*ov2, by=ob.y-ny2*ov2;
        if(gFree(w2gx(ax),w2gy(ay))){ oa.x=ax; oa.y=ay; }
        if(gFree(w2gx(bx),w2gy(by))){ ob.x=bx; ob.y=by; }
      }
    }
  }
}

function updateOrder(num,status,phase,step){
  var o=activeOrders.find(function(x){return x.num===num;});
  if(!o) return;
  if(status!=null) o.status=status;
  if(phase!=null) o.phase=phase;
  if(step!=null) o.currentStep=step;
}
function removeOrder(num){
  var idx=activeOrders.findIndex(function(x){return x.num===num;});
  if(idx>=0) activeOrders.splice(idx,1);
}

/* =====================================================================
   KPIs / DIAGNÓSTICO
   ===================================================================== */
function computeKPIs(){
  var totalArrived=S.nextId;
  var elapsedH=Math.max(0.001,(simTime-S.simStartTime)/60);
  var breadCost=breadCostNow(elapsedH);
  var totalCost=cfg.opCost*attendantCount()*elapsedH+cfg.fixedCost*(elapsedH/12)+breadCost;
  var margin=S.revenue-totalCost;
  var slaPct=S.served>0?(S.slaOk/S.served*100):0;
  var balkPct=totalArrived>0?(S.balked/totalArrived*100):0;
  var eqUtils={};
  stations.forEach(function(st){
    var tot=S.eqTotal[st.id]||1, busy=S.eqBusy[st.id]||0;
    eqUtils[st.id]=Math.min(100,Math.round(busy/tot*100));
  });
  var opUtils=operators.map(function(op,i){
    return Math.min(100,Math.round((S.opBusy[i]||0)/(elapsedH*60)*100));
  });
  var totDist=S.opDist.reduce(function(a,b){return a+(b||0);},0);
  return {
    timestamp:new Date().toISOString(),
    config:{operators:operators.length,
      fixedAssignments:operators.map(function(o){var st=stById[o.fixedEq];return st?st.name:"volante";}),
      rate:cfg.rate,maxItems:cfg.maxItems,groupBias:cfg.groupBias,tolerance:cfg.tol,
      slaTarget:cfg.sla,pickupTimeout:cfg.pickupTimeout,opCostHour:cfg.opCost,
      fixedCostDay:cfg.fixedCost,demandCurve:cfg.demandCurve,walkSpeed:cfg.walkSpeed},
    elapsedHours:+elapsedH.toFixed(2),
    arrived:totalArrived, served:S.served, balked:S.balked, balkedPickup:S.balkedPickup,
    balkPct:+balkPct.toFixed(1),
    serviceRate:totalArrived>0?+((S.served/totalArrived)*100).toFixed(1):0,
    throughputPerHour:+(S.served/elapsedH).toFixed(1),
    avgWaitMin:S.served>0?+(S.totalWait/S.served).toFixed(2):0,
    avgPrepTimeMin:S.served>0?+(S.totalPrepTime/S.served).toFixed(2):0,
    avgActualPrepMin:S.served>0?+(S.totalActualPrep/S.served).toFixed(2):0,
    avgQueueWaitMin:S.served>0?+(S.totalQueueWait/S.served).toFixed(2):0,
    maxQueue:S.maxQueue, slaOk:S.slaOk, slaPct:+slaPct.toFixed(1),
    revenueGross:Math.round(S.revenueBruto), refunds:Math.round(S.reembolsos),
    revenueNet:Math.round(S.revenue), operationalCost:Math.round(totalCost),
    breadCost:Math.round(breadCost),
    margin:Math.round(margin),
    avgTicket:S.served>0?+(S.servedRevenue/S.served).toFixed(2):0,
    walkMetersTotal:Math.round(totDist),
    walkMetersPerOrder:S.served>0?+(totDist/S.served).toFixed(1):0,
    congestionMin:+S.congestMin.toFixed(1),
    itemsSold:Object.assign({},S.itemsSold),
    eqUtilizationPct:eqUtils, opUtilizationPct:opUtils,
    bread:breadKPIs()
  };
}

/* distância de fluxo por item do cardápio (layout real) */
function flowDistances(){
  return cfg.menu.map(function(mi){
    var pts=[], ok=true;
    mi.steps.forEach(function(s){
      var st=stationsOfType(s.type)[0];
      if(st&&st.sp) pts.push(st.sp); else ok=false;
    });
    var d=0;
    for(var i=1;i<pts.length;i++){
      var p=findPath(pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y);
      d+=pathLen(p,pts[i-1].x,pts[i-1].y);
    }
    /* + entrega: última estação → divisa */
    if(pts.length){
      var lp=pts[pts.length-1];
      var pd=findPath(lp.x,lp.y,W/2,GATE-0.3);
      d+=pathLen(pd,lp.x,lp.y);
    }
    return {id:mi.id,name:mi.name,dist:ok?+d.toFixed(1):null,steps:mi.steps.length};
  });
}

/* depreciação diária e investimento total a partir do detalhe por equipamento (#19), com fallback ao total antigo */
function breadInvest(){
  var b=cfg.bread;
  var tot=(b.investBatedeira||0)+(b.investEstufa||0)+(b.investForno||0);
  if(tot<=0) return {total:b.invest||0, deprecDay:(b.invest||0)/Math.max(1,(b.deprecMonths||36)*30)};
  var dd=(b.investBatedeira||0)/Math.max(1,(b.lifeBatedeira||60)*30)
        +(b.investEstufa||0)/Math.max(1,(b.lifeEstufa||48)*30)
        +(b.investForno||0)/Math.max(1,(b.lifeForno||36)*30);
  return {total:tot, deprecDay:dd};
}
function breadFootprintM2(){
  var FB={batedeira:0.30,estufa:0.47,forno:0.62}, foot=0;
  ["batedeira","estufa","forno"].forEach(function(t){
    var list=stationsOfType(t);
    if(list.length) list.forEach(function(st){ foot+=st.w*st.h; }); else foot+=FB[t];
  });
  return +(foot*1.8).toFixed(2);
}
/* custo da padaria acumulado até agora (R$) — entra no custo operacional */
function breadCostNow(elapsedH){
  var b=cfg.bread;
  if(b.mode==="terc") return BR.consumed*b.tercPrice + b.tercFrete*(elapsedH/12);
  var inv=breadInvest();
  var fixedDay=b.bakerCost*b.shiftHours*Math.max(1,b.shifts||1)+inv.deprecDay+breadFootprintM2()*b.rentM2/30;
  return fixedDay*(elapsedH/12)+BR.flourUsed*b.flourPrice+BR.mixes*b.energyPerBatch+BR.consumed*b.extraPerBread;
}
function attendantCount(){ return operators.filter(function(o){ return o.role!=="padeiro"; }).length; }

/* ---------- viabilidade da padaria: própria × terceirizar × híbrido + capacidade fábrica ---------- */
function breadKPIs(){
  var b=cfg.bread;
  var elapsedH=Math.max(0.001,(simTime-S.simStartTime)/60);
  var consPerH=BR.consumed/elapsedH;
  var projDay=Math.round(consPerH*12);
  var areaM2=breadFootprintM2();
  var capE=typeCap("estufa"), capF=typeCap("forno");
  /* CAPACIDADE DE FÁBRICA: gargalo entre batedeira (serial, +manuseio), estufa e forno (paralelos) */
  var handling=3;
  var cyclePerBatch=Math.max(b.mixTime+handling, b.proofTime/Math.max(1,capE), b.bakeTime/Math.max(1,capF));
  var batchesPerHour=60/cyclePerBatch;
  var capPerShift=Math.floor(batchesPerHour*b.shiftHours*b.batchSize);
  var capPerDay=capPerShift*Math.max(1,b.shifts||1);
  var shiftsNeeded=projDay>0?Math.max(1,Math.ceil(projDay/Math.max(1,capPerShift))):null;
  var hoursNeeded=projDay>0?+(projDay/Math.max(1,batchesPerHour*b.batchSize)).toFixed(1):null;

  var varPerBread=b.flourPerBread*b.flourPrice+b.extraPerBread+b.energyPerBatch/b.batchSize;
  var inv=breadInvest();
  var deprecDay=inv.deprecDay;
  var spaceDay=areaM2*b.rentM2/30;
  var laborDay=b.bakerCost*b.shiftHours*Math.max(1,b.shifts||1);
  var fixedDay=laborDay+deprecDay+spaceDay;
  var Q=Math.max(1,projDay||b.tercQty);
  var ownDay=fixedDay+Q*varPerBread;
  var ownPerBread=+(ownDay/Q).toFixed(2);
  var tercAtQ=Q*b.tercPrice+b.tercFrete;
  var savingDay=tercAtQ-ownDay;
  var breakeven=(b.tercPrice>varPerBread)?Math.ceil(fixedDay/(b.tercPrice-varPerBread)):null;
  var paybackM=savingDay>0?+(inv.total/(savingDay*30)).toFixed(1):null;
  /* híbrido: mistura % própria + resto terceirizado */
  var ownPct=b.mode==="hibrido"?Math.max(0,Math.min(100,b.hybridOwnPct))/100:(b.mode==="terc"?0:1);
  var hybridPerBread=+(ownPct*ownPerBread+(1-ownPct)*b.tercPrice).toFixed(2);
  /* curva de sensibilidade custo/pão × volume (#18) */
  var sens=[];
  [40,80,120,160,200,260,320].forEach(function(q){
    sens.push({q:q, own:+((fixedDay+q*varPerBread)/q).toFixed(2), terc:b.tercPrice});
  });
  return {
    mode:b.mode, stock:BR.stock, flourKg:+BR.flour.toFixed(1),
    consumed:BR.consumed, baked:BR.baked, mixes:BR.mixes,
    producedShift:BR.baked, peakStock:BR.peakStock||BR.stock, storageCap:b.storageCap,
    flourUsedKg:+BR.flourUsed.toFixed(1),
    stockoutMin:+BR.stockoutMin.toFixed(1), waitingBread:BR.waitingBread,
    projDemandDay:projDay, capacityDay:capDayCompat(capPerDay), capPerShift:capPerShift, capPerDay:capPerDay,
    shiftHours:b.shiftHours, shifts:Math.max(1,b.shifts||1), shiftsNeeded:shiftsNeeded, hoursNeeded:hoursNeeded,
    areaM2:areaM2, varPerBread:+varPerBread.toFixed(2),
    ownCostDay:Math.round(ownDay), ownPerBread:ownPerBread,
    laborDay:Math.round(laborDay), deprecDay:+deprecDay.toFixed(0), spaceDay:+spaceDay.toFixed(0),
    investTotal:Math.round(inv.total),
    tercAtQ:Math.round(tercAtQ), tercPerBread:b.tercPrice,
    hybridOwnPct:Math.round(ownPct*100), hybridPerBread:hybridPerBread,
    savingDay:Math.round(savingDay), breakevenDay:breakeven, paybackMonths:paybackM,
    leftover:BR.stock, leftoverCost:Math.round(BR.stock*(b.mode==="terc"?b.tercPrice:varPerBread)),
    sens:sens
  };
}
function capDayCompat(v){ return v; }

function recommendations(k){
  var recs=[];
  if(k.served<5) return ["Simulação curta demais — rode até o fim do dia para recomendações confiáveis."];
  if(k.balkPct>15) recs.push("<strong>Crítico:</strong> "+k.balkPct+"% dos clientes desistiram na fila. Adicione operador, acelere o preparo ou amplie a tolerância.");
  if(k.slaPct<70) recs.push("<strong>SLA baixo ("+k.slaPct+"%):</strong> menos de 70% dos pedidos no prazo. Reduza tempos de preparo ou redistribua operadores.");
  var avgOpU=k.opUtilizationPct.length?k.opUtilizationPct.reduce(function(a,b){return a+b;},0)/k.opUtilizationPct.length:0;
  if(avgOpU>85) recs.push("<strong>Operadores saturados ("+avgOpU.toFixed(0)+"%):</strong> considere +1 operador no horário de pico.");
  else if(avgOpU<35&&k.served>20) recs.push("<strong>Operadores ociosos ("+avgOpU.toFixed(0)+"%):</strong> considere reduzir o time fora de pico.");
  var bn=null,bv=0;
  Object.keys(k.eqUtilizationPct).forEach(function(id){ if(k.eqUtilizationPct[id]>bv){ bv=k.eqUtilizationPct[id]; bn=id; } });
  if(bn&&bv>75){ var stb=stById[bn]; recs.push("<strong>Gargalo:</strong> "+(stb?stb.name:bn)+" a "+bv+"%. Adicione capacidade ou acelere a etapa."); }
  if(k.walkMetersPerOrder>14) recs.push("<strong>Layout:</strong> operadores caminham "+k.walkMetersPerOrder+" m por pedido. Aproxime as estações do fluxo principal (montagem → forno → vitrine) na planta.");
  if(k.congestionMin>10) recs.push("<strong>Corredor congestionado:</strong> "+k.congestionMin+" min de bloqueio entre operadores. Reveja a largura de circulação na planta (alvo ≥ 0,60 m).");
  if(k.margin<0) recs.push("<strong>Prejuízo: R$"+k.margin+".</strong> A receita não cobre o custo operacional. Revise preço, custos ou volume.");
  else if(k.margin/Math.max(1,k.revenueNet)<0.15) recs.push("<strong>Margem baixa ("+Math.round(k.margin/Math.max(1,k.revenueNet)*100)+"%):</strong> otimize custos ou aumente o ticket médio.");
  if(k.maxQueue>10) recs.push("<strong>Fila de pico com "+k.maxQueue+" pessoas</strong> na calçada — avalie sinalização e fila física na galeria.");
  if(k.bread){
    var kb=k.bread;
    if(kb.stockoutMin>5) recs.push("<strong>Falta de pão ("+kb.stockoutMin.toFixed(0)+" min):</strong> pedidos travaram esperando pão. Aumente o estoque alvo, o tamanho da fornada ou antecipe a produção.");
    if(kb.mode!=="terc"&&kb.projDemandDay>kb.capacityDay) recs.push("<strong>Capacidade de panificação insuficiente:</strong> demanda ~"+kb.projDemandDay+" pães/dia × capacidade "+kb.capacityDay+". O gargalo limita o cardápio — avalie 2ª estufa/forno ou terceirizar.");
    if(kb.mode!=="terc"&&kb.savingDay<0) recs.push("<strong>Viabilidade:</strong> no volume atual (~"+kb.projDemandDay+" pães/dia) a produção própria custa R$"+kb.ownPerBread.toFixed(2)+"/pão — mais caro que terceirizar (R$"+kb.tercPerBread.toFixed(2)+"). Ponto de equilíbrio: "+(kb.breakevenDay||"—")+" pães/dia.");
    if(kb.mode!=="terc"&&kb.savingDay>0&&kb.paybackMonths) recs.push("<strong>Padaria própria compensa:</strong> economia de R$"+kb.savingDay+"/dia vs terceirizar; payback do investimento em ~"+kb.paybackMonths+" meses.");
    if(kb.leftover>kb.projDemandDay*0.25&&simTime>=21*60) recs.push("<strong>Sobra de "+kb.leftover+" pães</strong> (~R$"+kb.leftoverCost+" de perda) — reduza o estoque alvo ou a última fornada do dia.");
  }
  if(!recs.length) recs.push("Operação saudável. Sem alertas críticos identificados.");
  return recs;
}

/* =====================================================================
   CONTROLE
   ===================================================================== */
function rebuild(){
  loadScene(); buildNavGrid(); computeSlots(); buildHeat();
}
/* a planta mudou no localStorage? */
function sceneChanged(){
  var raw=null;
  try{ raw=localStorage.getItem(LS_SCENE); }catch(e){}
  return raw!==lastSceneRaw;
}
/* re-lê a planta SEM perder o dia simulado: re-deriva estações, rotas e alvos */
function syncScene(){
  loadScene(); buildNavGrid(); computeSlots();
  Object.keys(eqLock).forEach(function(k){ delete eqLock[k]; });
  /* operadores: limpa rotas/alvos e valida atribuições fixas */
  operators.forEach(function(op,i){
    op.path=[]; op.pathIdx=0; op.stuck=0;
    if(op.fixedEq&&!stById[op.fixedEq]){ op.fixedEq=""; cfg.fixedEq[i]=""; op.state="idle"; op.fixoStep=null; }
    op.placed=false;
    /* se ficou dentro de um móvel novo, empurra para célula livre */
    if(!gFree(w2gx(op.x),w2gy(op.y))){
      var nf=findNearFree(w2gx(op.x),w2gy(op.y),30);
      if(nf){ op.x=g2w(nf.gx); op.y=g2w(nf.gz); }
    }
    /* re-valida lock da estação atual */
    if(op.task&&op.task.atEq){
      if(stById[op.task.stId]) lockAdd(op.task.stId,i);
      else { op.task.stId=null; op.task.atEq=false; op.task.tAtEq=0; }
    }
  });
  checkMenu();
}
function reset(){
  running=false; simTime=10*60;
  customers=[]; waitQueue=[]; prepQueue=[]; activeOrders=[]; pdvBusy=false;
  resetStats(); resetBread();
  S.bibite=Math.round(cfg.inv.bibiteStart);
  Object.keys(eqLock).forEach(function(k){ delete eqLock[k]; });
  pathCache.clear();
  rebuild(); buildOperators();
}
function saveCfg(){
  try{ localStorage.setItem(LS_SIM,JSON.stringify(cfg)); }catch(e){}
}
function loadCfg(){
  var savedV=1;
  try{
    var c=JSON.parse(localStorage.getItem(LS_SIM));
    if(c&&c.menu){ savedV=c.cfgV||1; Object.keys(c).forEach(function(k){ cfg[k]=c[k]; }); }
  }catch(e){}
  cfg.cfgV=savedV;            // o que estava REALMENTE salvo decide a migração
  migrateCfg();
}
/* migração v2: lanches são montados na FRENTE (sem etapa de forno — forno agora é da padaria) */
var BREAD_DEFAULTS=JSON.parse(JSON.stringify(cfg.bread));
function migrateCfg(){
  if(!cfg.bread||typeof cfg.bread!=="object") cfg.bread={};
  Object.keys(BREAD_DEFAULTS).forEach(function(k){ if(cfg.bread[k]==null) cfg.bread[k]=BREAD_DEFAULTS[k]; });
  if(!cfg.inv||typeof cfg.inv!=="object") cfg.inv={};
  if(cfg.inv.bibiteStart==null) cfg.inv.bibiteStart=60;
  if(cfg.inv.bibiteCap==null) cfg.inv.bibiteCap=72;
  if(cfg.inv.vitrineCap==null) cfg.inv.vitrineCap=24;
  if(cfg.capacity==null) cfg.capacity={forno:2,estufa:2};
  if(cfg.capacity.estufa==null) cfg.capacity.estufa=2;
  cfg.menu.forEach(function(m){
    if(!m.cat) m.cat=lancheCat(m);
    if(m.pao==null) m.pao=m.cat==="lanche"?1:0;
    if(!(cfg.cfgV>=2)&&m.cat==="lanche"){
      m.steps=m.steps.filter(function(s){ return s.type!=="forno"&&s.type!=="batedeira"&&s.type!=="estufa"; });
      if(!m.steps.length) m.steps=[{type:"montagem",time:2.0}];
    }
  });
  cfg.cfgV=2;
}

window.SIM={
  cfg:cfg, ROOM:ROOM, W:W, D:D, GATE:GATE, OUT:OUT, CUT_X:CUT_X, CUT_Y:CUT_Y,
  get simTime(){ return simTime; }, set simTime(v){ simTime=v; },
  get running(){ return running; }, set running(v){ running=v; },
  get customers(){ return customers; },
  get operators(){ return operators; },
  get waitQueue(){ return waitQueue; },
  get prepQueue(){ return prepQueue; },
  get activeOrders(){ return activeOrders; },
  get stations(){ return stations; },
  get sceneItems(){ return sceneItems; },
  get blockers(){ return blockers; },
  get queueSlots(){ return queueSlots; },
  get pickupSlots(){ return pickupSlots; },
  get typesInScene(){ return typesInScene; },
  get missingTypes(){ return missingTypes; },
  get heat(){ return heat; }, heatW:function(){return heatW;}, heatH:function(){return heatH;},
  HEAT_CELL:HEAT_CELL,
  S:function(){ return S; },
  bread:function(){ return BR; },
  breadKPIs:breadKPIs, breadMissing:breadMissing, lancheCat:lancheCat,
  breadCostNow:breadCostNow, attendantCount:attendantCount,
  alerts:function(){ return S.alerts||[]; },
  invKPIs:function(){
    var wp=customers.filter(function(c){ return c.state==="waiting_pickup"; }).length;
    return { bibite:S.bibite||0, bibiteCap:cfg.inv.bibiteCap, bibiteStart:cfg.inv.bibiteStart,
      bibiteSold:S.bibiteSold||0, bibiteEmptyMin:+(S.bibiteEmptyMin||0).toFixed(1),
      vitrineLoad:wp, vitrineCap:cfg.inv.vitrineCap, vitrineSold:S.vitrineSold||0 };
  },
  stById:function(id){ return stById[id]; },
  tick:tick, reset:reset, rebuild:rebuild, buildOperators:buildOperators,
  sceneChanged:sceneChanged, syncScene:syncScene,
  computeKPIs:computeKPIs, recommendations:recommendations, flowDistances:flowDistances,
  demandMultiplier:demandMultiplier, checkMenu:checkMenu,
  saveCfg:saveCfg, loadCfg:loadCfg,
  inShell:inShell, findPath:findPath
};
})();
