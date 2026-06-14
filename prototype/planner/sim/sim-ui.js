/* =====================================================================
   sim-ui.js — UI do Modo Operação · LOJA 206
   Liga controles ↔ SIM.cfg, loop principal, painéis, relatórios.
   ===================================================================== */
(function(){
"use strict";
var SIM=window.SIM;
var $=function(id){ return document.getElementById(id); };

var simSpd=15, lastMs=0, frame=0, activeView="2d", mcRunning=false;
var compareSnapshots=[];

function syncInputsFromCfg(){
  $("cfg-rate").value=SIM.cfg.rate;
  $("cfg-curve").value=SIM.cfg.demandCurve;
  $("cfg-ops").value=SIM.cfg.ops;
  $("cfg-maxitems").value=SIM.cfg.maxItems;
  $("cfg-bias").value=SIM.cfg.groupBias;
  $("cfg-tol").value=SIM.cfg.tol;
  $("cfg-pickup").value=SIM.cfg.pickupTimeout;
  $("cfg-sla").value=SIM.cfg.sla;
  $("cfg-walk").value=SIM.cfg.walkSpeed;
  $("cfg-opcost").value=SIM.cfg.opCost;
  $("cfg-fixedcost").value=SIM.cfg.fixedCost;
}

/* ---------- bindings de config ---------- */
function bindNum(id,key,after){
  $(id).addEventListener("change",function(){
    var v=parseFloat(this.value);
    if(!isNaN(v)){ SIM.cfg[key]=v; SIM.saveCfg(); if(after) after(); }
  });
}
bindNum("cfg-rate","rate");
bindNum("cfg-maxitems","maxItems");
bindNum("cfg-bias","groupBias");
bindNum("cfg-tol","tol");
bindNum("cfg-pickup","pickupTimeout");
bindNum("cfg-sla","sla");
bindNum("cfg-walk","walkSpeed");
bindNum("cfg-opcost","opCost");
bindNum("cfg-fixedcost","fixedCost");
bindNum("cfg-ops","ops",function(){ SIM.cfg.ops=Math.max(1,Math.min(4,SIM.cfg.ops|0)); SIM.buildOperators(); renderOpAssign(); if(SIM3D.inited) SIM3D.rebuild(); });
$("cfg-curve").addEventListener("change",function(){ SIM.cfg.demandCurve=this.value; SIM.saveCfg(); });

/* cenários rápidos */
document.querySelectorAll("#scenario-chips .chip").forEach(function(ch){
  ch.addEventListener("click",function(){
    document.querySelectorAll("#scenario-chips .chip").forEach(function(c){ c.classList.remove("on"); });
    ch.classList.add("on");
    var s=ch.dataset.scn;
    if(s==="vale"){ SIM.cfg.rate=12; SIM.cfg.demandCurve="flat"; }
    else if(s==="almoco"){ SIM.cfg.rate=48; SIM.cfg.demandCurve="lunch"; }
    else { SIM.cfg.rate=30; SIM.cfg.demandCurve="both"; }
    $("cfg-rate").value=SIM.cfg.rate; $("cfg-curve").value=SIM.cfg.demandCurve;
    SIM.saveCfg();
  });
});

/* ---------- atribuições fixo/volante (só atendentes — padeiro é dedicado) ---------- */
function renderOpAssign(){
  var host=$("op-assign"); host.innerHTML="";
  SIM.operators.forEach(function(opAt,i){
    if(opAt.role==="padeiro") return;
    (function(i){
      var f=document.createElement("div"); f.className="field";
      var lab=document.createElement("label"); lab.textContent="Atendente "+(i+1)+" — função";
      var sel=document.createElement("select");
      var o0=document.createElement("option"); o0.value=""; o0.textContent="Volante (anda entre estações)";
      sel.appendChild(o0);
      SIM.stations.forEach(function(st){
        var o=document.createElement("option"); o.value=st.id; o.textContent="Fixo · "+st.name;
        if(SIM.operators[i].fixedEq===st.id) o.selected=true;
        sel.appendChild(o);
      });
      sel.addEventListener("change",function(){
        SIM.cfg.fixedEq[i]=sel.value;
        var op=SIM.operators[i];
        op.fixedEq=sel.value; op.placed=false;
        if(op.fixoStep){ delete op.fixoStep.busy; delete op.fixoStep.elapsed; op.fixoStep=null; }
        if(!sel.value){ op.state="idle"; op.task=null; }
        SIM.saveCfg();
      });
      f.appendChild(lab); f.appendChild(sel); host.appendChild(f);
    })(i);
  });
  var bh=$("baker-hint");
  if(bh) bh.style.display=SIM.cfg.bread.mode==="terc"?"none":"block";
}

/* ---------- toggles de camadas ---------- */
function bindToggle(id,fn){
  var el=$(id);
  el.addEventListener("click",function(){
    el.classList.toggle("on");
    fn(el.classList.contains("on"));
  });
}
bindToggle("sw-trails",function(v){ SIM2D.trails=v; SIM3D.trails=v; });
bindToggle("sw-heat",function(v){ SIM2D.heatmap=v; });
bindToggle("sw-labels",function(v){ SIM2D.labels=v; SIM3D.labels=v; });

/* ---------- play / reset / velocidade ---------- */
function setRunning(v){
  if(SIM.simTime>=22*60&&v){ doReset(); }
  SIM.running=v;
  var b=$("btn-play");
  b.textContent=v?"Pausar":"Iniciar";
  b.classList.toggle("paused",v);
  if(v) lastMs=performance.now();
}
$("btn-play").addEventListener("click",function(){ setRunning(!SIM.running); });
function doReset(){
  SIM.reset();
  SIM2D.rebuild(); SIM2D.fit();
  if(SIM3D.inited) SIM3D.rebuild();
  renderOpAssign(); updateSceneStamp(); updatePanels();
  $("btn-play").textContent="Iniciar"; $("btn-play").classList.remove("paused");
}
$("btn-reset").addEventListener("click",doReset);
document.querySelectorAll(".spd").forEach(function(b){
  b.addEventListener("click",function(){
    simSpd=parseInt(b.dataset.spd);
    document.querySelectorAll(".spd").forEach(function(x){ x.classList.remove("on"); });
    b.classList.add("on");
  });
});
window.addEventListener("keydown",function(e){
  var tag=document.activeElement?document.activeElement.tagName:"";
  if(/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if(e.key===" "){ e.preventDefault(); setRunning(!SIM.running); }
  else if(e.key==="r"||e.key==="R") doReset();
  else if(e.key>="1"&&e.key<="4"){
    var spds=[1,5,15,60]; simSpd=spds[+e.key-1];
    document.querySelectorAll(".spd").forEach(function(x,i){ x.classList.toggle("on",i===+e.key-1); });
  }
});

/* ---------- navegação topo ---------- */
$("btn-planta").addEventListener("click",function(){ window.location.href="index.html"; });

/* ---------- troca de vista 2D / 3D + dock do Monitor ---------- */
$("view-2d").addEventListener("click",function(){ switchView("2d"); });
$("view-3d").addEventListener("click",function(){ switchView("3d"); });
var kdsDockOn=false;
$("view-kds").addEventListener("click",function(){ toggleKdsDock(); });
$("km-collapse").addEventListener("click",function(){
  $("wrapKds").classList.toggle("collapsed");
  $("km-collapse").textContent=$("wrapKds").classList.contains("collapsed")?"▴":"▾";
  relayoutPlant();
});
function toggleKdsDock(force){
  kdsDockOn=(typeof force==="boolean")?force:!kdsDockOn;
  $("wrapKds").style.display=kdsDockOn?"block":"none";
  $("view-kds").classList.toggle("active",kdsDockOn);
  $("canvasWrap").classList.toggle("has-dock",kdsDockOn&&!$("wrapKds").classList.contains("collapsed"));
  if(kdsDockOn) renderMonitor(SIM.S());
  relayoutPlant();
}
function relayoutPlant(){
  $("canvasWrap").classList.toggle("has-dock",kdsDockOn&&!$("wrapKds").classList.contains("collapsed"));
  $("hintbar").style.display=kdsDockOn?"none":"block";
  if(activeView==="2d") SIM2D.fit();
  else if(activeView==="3d"){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} }
}
function switchView(v){
  activeView=v;
  $("view-2d").classList.toggle("active",v==="2d");
  $("view-3d").classList.toggle("active",v==="3d");
  $("sim2d").style.display=v==="2d"?"block":"none";
  $("wrap3d").style.display=v==="3d"?"block":"none";
  $("cam-presets").style.display=v==="3d"?"flex":"none";
  $("hintbar").textContent=v==="3d"
    ?"Arraste: orbitar · roda: zoom · Shift+arraste: deslocar"
    :"Cena lida da planta — edite o layout no estúdio e a operação se adapta · arraste: pan · roda: zoom";
  if(v==="3d"){
    if(SIM.sceneChanged()) syncNow();           /* garante cena fresca antes de montar o 3D */
    if(!SIM3D.inited) SIM3D.init($("sim3d"),$("labels3d"));
    else SIM3D.rebuild();                       /* sempre re-monta o mobiliário ao entrar no 3D */
  }
  if(v==="2d") SIM2D.fit();
}
document.querySelectorAll(".cam").forEach(function(b){
  b.addEventListener("click",function(){ SIM3D.preset(b.dataset.cam); });
});

/* ---------- tabs do painel direito ---------- */
document.querySelectorAll(".tab").forEach(function(t){
  t.addEventListener("click",function(){
    document.querySelectorAll(".tab").forEach(function(x){ x.classList.remove("on"); });
    document.querySelectorAll(".pane").forEach(function(x){ x.classList.remove("on"); });
    t.classList.add("on");
    $("pane-"+t.dataset.tab).classList.add("on");
    if(t.dataset.tab==="cardapio") renderMenuPanel();
    if(t.dataset.tab==="cliente") renderClientePanel();
    if(t.dataset.tab==="padaria"){ syncPadariaInputs(); updatePadariaLive(); }
  });
});

/* ---------- sincronização com a planta (automática + manual) ---------- */
function syncNow(reason){
  SIM.syncScene();
  SIM2D.rebuild();
  if(SIM3D.inited) SIM3D.rebuild();
  updateSceneStamp(); renderOpAssign(); renderMenuPanel(); renderCapPanel(); renderClientePanel();
  flash(reason||"Planta sincronizada — rotas recalculadas","var(--green)");
}
window.addEventListener("storage",function(e){
  if(e.key==="loja206_studio_v2") syncNow("Planta atualizada — operação adaptada");
});
window.addEventListener("focus",function(){ if(SIM.sceneChanged()) syncNow(); });
document.addEventListener("visibilitychange",function(){
  if(!document.hidden&&SIM.sceneChanged()) syncNow();
});
setInterval(function(){ if(!mcRunning&&SIM.sceneChanged()) syncNow(); },1500);
$("btn-sync").addEventListener("click",function(){
  if(SIM.sceneChanged()) syncNow();
  else { SIM.syncScene(); SIM2D.rebuild(); if(SIM3D.inited) SIM3D.rebuild(); updateSceneStamp(); flash("Planta já está em dia","var(--ink-soft)"); }
});
function updateSceneStamp(){
  var n=SIM.stations.length;
  var unr=SIM.stations.filter(function(s){ return s.unreachable; }).length;
  $("scene-stamp").textContent="cena da planta · "+n+" estações · "+SIM.sceneItems.length+" peças"
    +(unr?" · ⚠ "+unr+" sem acesso":"");
}

/* =====================================================================
   LOOP PRINCIPAL
   ===================================================================== */
var lastLoopMs=0;
function loop(){
  frame++; window.__f=frame; lastLoopMs=performance.now();
  try{
  if(SIM.running&&!mcRunning){
    var now=performance.now();
    var dt=(now-lastMs)/1000*simSpd/60;
    lastMs=now;
    if(dt>0){ dt=Math.min(dt,2.5); SIM.simTime+=dt; SIM.tick(dt); }
    if(SIM.simTime>=22*60){
      SIM.simTime=22*60; SIM.running=false;
      $("btn-play").textContent="Fim do dia"; $("btn-play").classList.remove("paused");
      updatePanels(); showEod();
    }
  }
  if(activeView==="2d"){ SIM2D.render(); if(frame%30===0) SIM2D.renderHeat(); }
  else if(activeView==="3d") SIM3D.render();
  if(frame%18===0) updatePanels();
  }catch(err){ window.__loopErr=err.message+"\n"+(err.stack||""); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
/* fallback: alguns contextos suspendem rAF — mantém a simulação viva */
setInterval(function(){ if(performance.now()-lastLoopMs>200) loop(); },120);

/* =====================================================================
   PAINÉIS
   ===================================================================== */
function fmtClock(t){
  var h=Math.floor(t/60), m=Math.floor(t%60);
  return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
}
function fmtT(m){ return m<60?Math.round(m)+"m":(m/60).toFixed(1)+"h"; }

function updatePanels(){
  var S=SIM.S();
  $("clk").textContent=fmtClock(SIM.simTime);
  var qLen=SIM.customers.filter(function(c){ return c.state==="waiting"||c.state==="at_pdv"; }).length;
  var wpLen=SIM.customers.filter(function(c){ return c.state==="waiting_pickup"; }).length;
  var elapsed=Math.max(0.001,(SIM.simTime-S.simStartTime)/60);

  $("m-served").textContent=S.served;
  $("m-queue").textContent=qLen;
  $("m-pickup").textContent=wpLen;
  $("m-wait").textContent=S.served>0?(S.totalWait/S.served).toFixed(1)+"m":"--";
  $("m-balk").textContent=S.balked;
  var balkPct=S.nextId>0?Math.round(S.balked/S.nextId*100):0;
  $("m-balkpct").textContent=balkPct+"%";

  $("m-revh").textContent="R$"+Math.round(S.revenue/elapsed)+"/h";
  $("m-ticket").textContent=S.served>0?"R$"+(S.servedRevenue/S.served).toFixed(0):"--";
  var nAtt=SIM.attendantCount();
  var totalCost=SIM.cfg.opCost*nAtt*elapsed+SIM.cfg.fixedCost*(elapsed/12)+SIM.breadCostNow(elapsed);
  $("m-cost").textContent="R$"+Math.round(totalCost);
  var margin=S.revenue-totalCost;
  var mEl=$("m-margin");
  mEl.textContent="R$"+Math.round(margin);
  mEl.classList.toggle("red",margin<0); mEl.classList.toggle("green",margin>=0);

  $("m-tput").textContent=Math.round(S.served/elapsed)+"/h";
  $("m-prep").textContent=S.served>0?(S.totalActualPrep/S.served).toFixed(1)+"m":"--";
  $("m-qwait").textContent=S.served>0?(S.totalQueueWait/S.served).toFixed(1)+"m":"--";
  $("m-peakq").textContent=S.maxQueue;
  var totDist=S.opDist.reduce(function(a,b){ return a+(b||0); },0);
  $("m-walk").textContent=S.served>0?(totDist/S.served).toFixed(1):"--";
  $("m-congest").textContent=S.congestMin.toFixed(0)+"m";

  renderSpark(S);
  renderMonitor(S);
  renderUtil(S,elapsed);
  renderAnalysis(S,balkPct);
  updateOpBanner(S);
  if($("pane-padaria").classList.contains("on")) updatePadariaLive();
}

/* banner de alerta sobre o canvas (#28 pão acabou / travas críticas) */
function updateOpBanner(S){
  var wrap=$("canvasWrap"); if(!wrap) return;
  var ban=$("op-banner");
  var kb=SIM.bread();
  var msg="";
  if(kb&&kb.waitingBread>0) msg="⚠ PÃO ESGOTADO — "+kb.waitingBread+" pedido(s) parados na frente. A produção do fundo não acompanha a demanda.";
  else if(S.bibite<=0&&S.bibiteSold>0) msg="⚠ Geladeira de bebidas vazia — repor estoque.";
  if(!msg){ if(ban) ban.style.display="none"; return; }
  if(!ban){ ban=document.createElement("div"); ban.id="op-banner"; ban.className="op-banner"; wrap.appendChild(ban); }
  ban.style.display="block"; ban.textContent=msg;
}
(function(){ var c=$("km-clear"); if(c) c.addEventListener("click",function(){ var s=SIM.S(); if(s.alerts){ s.alerts.length=0; s.alertKeys={}; } renderAlerts(); }); })();

/* ---------- sparkline ---------- */
function renderSpark(S){
  var el=$("spark");
  if(S.servedHist.length<3){ el.innerHTML='<div class="empty" style="text-align:center">Aguardando dados…</div>'; return; }
  var win=30, rate=[];
  for(var i=0;i<S.servedHist.length;i++){
    var j=Math.max(0,i-win), d=i-j;
    rate.push(d>0?((S.servedHist[i]-S.servedHist[j])/d)*60:0);
  }
  var maxR=Math.max(1,Math.max.apply(null,rate));
  var w=250,h=52;
  var pts=rate.map(function(v,i){ return ((i/Math.max(1,rate.length-1))*w).toFixed(1)+","+(h-(v/maxR)*h).toFixed(1); }).join(" ");
  var cur=rate[rate.length-1]||0;
  el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:52px;display:block">'
    +'<polyline points="'+pts+'" fill="none" stroke="#E2000F" stroke-width="1.4"/>'
    +'<polyline points="0,'+h+' '+pts+' '+w+','+h+'" fill="rgba(226,0,15,0.08)" stroke="none"/></svg>'
    +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:4px;font-family:var(--mono)">'
    +'<span>10h</span><span>atual: <b style="color:#E2000F">'+cur.toFixed(0)+'/h</b></span><span>22h</span></div>';
}

/* ---------- MONITOR DE OPERAÇÃO (KDS central) ---------- */
var SEV={crit:["#E2000F","CRÍTICO"],warn:["#D29922","ATENÇÃO"],info:["#2A6FDB","INFO"]};
function renderMonitor(S){
  if(!$("wrapKds")||$("wrapKds").style.display==="none") return;
  $("km-clock").textContent=fmtClock(SIM.simTime);
  var h=Math.floor(SIM.simTime/60);
  $("km-phase").textContent=h<12?"manhã":h<15?"pico almoço":h<18?"tarde":h<21?"pico jantar":"noite";
  var elapsed=Math.max(0.001,(SIM.simTime-S.simStartTime)/60);
  var qLen=SIM.customers.filter(function(c){ return c.state==="waiting"||c.state==="at_pdv"; }).length;
  var wp=SIM.customers.filter(function(c){ return c.state==="waiting_pickup"; }).length;
  function met(v,l,col){ return '<div class="km-met"><div class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</div><div class="l">'+l+'</div></div>'; }
  $("km-metrics").innerHTML=
     met(S.served,"servidos")
    +met(qLen,"na fila",qLen>8?"#E2000F":"")
    +met(wp,"retirada")
    +met(Math.round(S.served/elapsed)+"/h","ritmo")
    +met((S.served>0?(S.totalWait/S.served).toFixed(1):"--")+"m","espera",((S.totalWait/Math.max(1,S.served))>8)?"#E2000F":"")
    +met(S.balked,"desist.",S.balked>0?"#E2000F":"");

  /* tickets FOH */
  var orders=SIM.activeOrders;
  var pri={preparing:0,delivering:1,queued:2};
  var sorted=orders.slice().sort(function(a,b){ return (pri[a.phase]||2)-(pri[b.phase]||2)||(a.startTime-b.startTime); });
  $("km-foh-sub").textContent=orders.length+" ativos";
  $("km-orders").innerHTML=orders.length?sorted.slice(0,12).map(function(o){
    var el=SIM.simTime-o.startTime, ratio=Math.min(1,el/SIM.cfg.sla);
    var col=ratio<0.5?"#1F8A5B":ratio<0.85?"#D29922":"#E2000F";
    var ph=o.phase==="preparing"?"PREPARO":o.phase==="delivering"?"ENTREGA":"FILA";
    var late=el>SIM.cfg.sla;
    return '<div class="km-tk'+(late?" late":"")+'" data-foll="'+o.num+'" title="Clique para seguir no mapa 2D">'
      +'<div class="tk-top"><span class="tk-n">#'+o.num+'</span><span class="tk-ph" style="color:'+col+'">'+ph+'</span></div>'
      +'<div class="tk-it">'+o.items.join(" + ")+'</div>'
      +'<div class="tk-foot"><span class="tk-op">'+(o.opIdx>=0?"Atend. "+(o.opIdx+1):"—")+'</span>'
      +'<span class="tk-bar"><i style="width:'+Math.round(ratio*100)+'%;background:'+col+'"></i></span>'
      +'<span class="tk-t" style="color:'+col+'">'+el.toFixed(1)+'m</span></div>'
      +'<div class="tk-st">'+(o.status||"")+'</div></div>';
  }).join(""):'<div class="km-empty">Sem pedidos ativos</div>';
  $("km-orders").querySelectorAll("[data-foll]").forEach(function(tk){
    tk.addEventListener("click",function(){ followOrder(+tk.dataset.foll); });
  });

  /* BOH produção */
  var b=SIM.cfg.bread, BR=SIM.bread(), kb=SIM.breadKPIs();
  if(b.mode==="terc"){
    $("km-boh-sub").textContent="terceirizado";
    $("km-boh").innerHTML='<div class="km-boh-stock"><b>'+kb.stock+'</b> pães em estoque · entrega do fornecedor</div>';
  } else {
    var proof=(BR.batches||[]).filter(function(x){return x.phase==="proof"||x.phase==="ready_oven";}).length;
    var bake=(BR.batches||[]).filter(function(x){return x.phase==="bake";}).length;
    var baker=SIM.operators.filter(function(o){return o.role==="padeiro";})[0];
    $("km-boh-sub").textContent=kb.producedShift+" produzidos";
    $("km-boh").innerHTML='<div class="km-boh-stock"><b>'+kb.stock+'</b>/'+kb.storageCap+' pães'
      +'<span class="km-boh-bar"><i style="width:'+Math.min(100,Math.round(kb.stock/Math.max(1,kb.storageCap)*100))+'%"></i></span></div>'
      +'<div class="km-boh-row"><span>'+(baker?(baker.statusText||"").replace("Padeiro · ",""):"—")+'</span></div>'
      +'<div class="km-boh-tags"><span class="bt">batedeira '+(baker&&/Batedeira/.test(baker.statusText||"")?"●":"○")+'</span>'
      +'<span class="bt">estufa '+proof+'</span><span class="bt">forno '+bake+'</span></div>'
      +(kb.waitingBread>0?'<div class="km-boh-warn">⚠ '+kb.waitingBread+' pedido(s) sem pão</div>':'');
  }

  /* central de alertas */
  renderAlerts();
}
function renderAlerts(){
  var host=$("km-alerts"); if(!host) return;
  var al=SIM.alerts().slice().reverse();
  if(!al.length){ host.innerHTML='<div class="km-empty">Tudo tranquilo — sem ocorrências.</div>'; return; }
  host.innerHTML=al.slice(0,30).map(function(a){
    var s=SEV[a.sev]||SEV.info;
    return '<div class="km-al km-'+a.sev+'"><span class="al-t">'+fmtClock(a.t)+'</span>'
      +'<span class="al-tag" style="background:'+s[0]+'">'+s[1]+'</span>'
      +'<span class="al-m">'+a.msg+'</span></div>';
  }).join("");
}
function followOrder(num){
  var o=SIM.activeOrders.find(function(x){return x.num===num;});
  switchView("2d");
  document.querySelector(".tbtn#view-2d");
  var ord=SIM.activeOrders.find(function(x){return x.num===num;});
  if(ord&&ord.opIdx>=0){ SIM2D.focusOp&&SIM2D.focusOp(ord.opIdx); }
  flash("Seguindo pedido #"+num+(o&&o.opIdx>=0?" (Atendente "+(o.opIdx+1)+")":"")+" no mapa","var(--blue)");
}

/* ---------- utilização ---------- */
function renderUtil(S,elapsedH){
  var totalT=Math.max(1,SIM.simTime-S.simStartTime);
  var hOps="";
  SIM.operators.forEach(function(op,i){
    var busy=S.opBusy[i]||0;
    var pct=Math.min(100,Math.round(busy/totalT*100));
    var col=pct>85?"#E2000F":pct>60?"#D29922":"#1F8A5B";
    var nm=op.role==="padeiro"?"Padeiro · produção":"Atendente "+(i+1)+(op.fixedEq?" · fixo":"");
    var sub=op.role==="padeiro"
      ?fmtT(busy)+" ativo · "+SIM.bread().mixes+" fornadas · "+SIM.bread().baked+" pães entregues"
      :fmtT(busy)+" ativo · "+(S.opOrders[i]||0)+" pedidos · "+Math.round(S.opDist[i]||0)+" m";
    hOps+='<div class="util-row"><div class="util-head"><span class="nm">'+nm+'</span>'
      +'<span class="pc" style="color:'+col+'">'+pct+'%</span></div>'
      +'<div class="util-bar"><div class="util-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'
      +'<div class="util-sub">'+sub+'</div></div>';
  });
  $("util-ops").innerHTML=hOps||'<div class="empty">—</div>';

  var hEq="";
  SIM.stations.forEach(function(st){
    var busy=S.eqBusy[st.id]||0;
    var pct=Math.min(100,Math.round(busy/totalT*100));
    var col=pct>70?"#E2000F":pct>40?"#D29922":"#1F8A5B";
    hEq+='<div class="util-row"><div class="util-head"><span class="nm">'+st.name+'</span>'
      +'<span class="pc" style="color:'+col+'">'+pct+'%</span></div>'
      +'<div class="util-bar"><div class="util-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'
      +'<div class="util-sub">'+fmtT(busy)+' ativo · '+(S.eqCount[st.id]||0)+' usos</div></div>';
  });
  $("util-eq").innerHTML=hEq;
}

/* ---------- análise ---------- */
function renderAnalysis(S,balkPct){
  /* alerta de cardápio x planta */
  var warn="";
  if(SIM.missingTypes.length){
    warn='<div class="alr alr-r" style="margin:12px 16px 0">O cardápio usa estações que não existem na planta: <b>'
      +SIM.missingTypes.join(", ")+'</b>. Adicione-as no estúdio ou ajuste o cardápio — etapas ausentes são puladas.</div>';
  }
  var unr=SIM.stations.filter(function(s){ return s.unreachable; });
  if(unr.length){
    warn+='<div class="alr alr-r" style="margin:12px 16px 0"><b>Estação sem acesso:</b> '
      +unr.map(function(s){ return s.name; }).join(", ")
      +' — o operador não consegue chegar caminhando. Abra circulação na planta (vão ≥ 0,40 m).</div>';
  }
  $("menu-warn").innerHTML=warn;

  var el=$("ana-diag"), h="";
  if(S.served<5){ h='<div class="alr alr-b">Aguardando dados (mín. 5 atendidos)…</div>'; }
  else{
    var aw=S.totalWait/S.served;
    var cls=aw>8?"alr-r":aw>4?"alr-y":"alr-g";
    h+='<div class="alr '+cls+'"><b>Espera média '+aw.toFixed(1)+' min</b>'
      +(aw>8?" — crítica: considere +1 operador ou reduza tempos":aw>4?" — monitorando":" — saudável")+'</div>';
    var slaPct=S.served>0?Math.round(S.slaOk/S.served*100):0;
    h+='<div class="alr '+(slaPct>=80?"alr-g":"alr-y")+'"><b>'+slaPct+'% no prazo</b> (alvo '+SIM.cfg.sla+' min) — '
      +(S.served-S.slaOk)+' atrasados</div>';
    var totalT=Math.max(1,SIM.simTime-S.simStartTime);
    var avgU=S.opBusy.slice(0,SIM.operators.length).reduce(function(a,b){return a+(b||0);},0)/SIM.operators.length/totalT*100;
    if(avgU>90) h+='<div class="alr alr-r"><b>Operadores sobrecarregados ('+avgU.toFixed(0)+'%)</b> — adicione operadores</div>';
    else if(avgU<30&&S.served>10) h+='<div class="alr alr-y"><b>Operadores ociosos ('+avgU.toFixed(0)+'%)</b> — considere reduzir equipe</div>';
    if(S.balkedPickup>0) h+='<div class="alr alr-r"><b>'+S.balkedPickup+' abandono(s) na retirada</b> — pedidos pagos sem entrega (reembolso)</div>';
    if(balkPct>15) h+='<div class="alr alr-r"><b>'+S.balked+' desistências ('+balkPct+'%)</b> — fila longa demais na calçada</div>';
    else if(balkPct>5) h+='<div class="alr alr-y"><b>'+S.balked+' desistências ('+balkPct+'%)</b> na fila</div>';
    if(S.congestMin>10) h+='<div class="alr alr-y"><b>'+S.congestMin.toFixed(0)+' min de congestionamento</b> entre operadores — reveja circulação na planta</div>';
  }
  el.innerHTML=h;

  /* fluxo no layout */
  var fl=SIM.flowDistances();
  $("ana-flow").innerHTML=fl.map(function(f){
    return '<div class="flow-row"><span class="nm">'+f.name+'</span>'
      +'<span class="dd">'+(f.dist!=null?f.dist.toFixed(1)+" m / pedido":"estação ausente")+'</span></div>';
  }).join("")+'<div class="util-sub" style="margin-top:4px">caminho real (A*) pelas estações + entrega na divisa</div>';

  /* vendas */
  var sh="";
  var keys=Object.keys(S.itemsSold).filter(function(k){ return S.itemsSold[k]>0; });
  if(keys.length){
    keys.sort(function(a,b){ return S.itemsSold[b]-S.itemsSold[a]; });
    keys.forEach(function(k){
      var mi=SIM.cfg.menu.find(function(m){ return m.id===k; });
      var qty=S.itemsSold[k], rev=qty*(mi?mi.price:0);
      sh+='<div class="flow-row"><span class="nm">'+(mi?mi.name:k)+'</span>'
        +'<span class="dd">'+qty+'× · R$'+rev+'</span></div>';
    });
    sh+='<div class="flow-row" style="background:var(--rail)"><span class="nm">Receita líquida</span>'
      +'<span class="dd" style="color:var(--green);font-weight:700">R$'+Math.round(S.revenue)+'</span></div>';
    if(S.reembolsos>0) sh+='<div class="flow-row"><span class="nm">Reembolsos</span><span class="dd" style="color:var(--rosso)">− R$'+Math.round(S.reembolsos)+'</span></div>';
  } else sh='<div class="empty">Aguardando dados…</div>';
  $("ana-sales").innerHTML=sh;

  /* gargalos */
  var bh="";
  if(S.served<5){ bh='<div class="empty">Aguardando dados…</div>'; }
  else{
    var utils=SIM.stations.map(function(st){
      var tot=S.eqTotal[st.id]||1, busy=S.eqBusy[st.id]||0;
      return {name:st.name,pct:Math.min(100,Math.round(busy/tot*100))};
    }).sort(function(a,b){ return b.pct-a.pct; });
    utils.slice(0,6).forEach(function(u){
      var col=u.pct>70?"#E2000F":u.pct>40?"#D29922":"#1F8A5B";
      bh+='<div class="util-row"><div class="util-head"><span class="nm">'+u.name+'</span>'
        +'<span class="pc" style="color:'+col+'">'+u.pct+'%</span></div>'
        +'<div class="util-bar"><div class="util-fill" style="width:'+Math.max(3,u.pct)+'%;background:'+col+'"></div></div></div>';
    });
    if(utils[0]&&utils[0].pct>50)
      bh+='<div class="alr alr-y">Principal gargalo: <b>'+utils[0].name+'</b> a '+utils[0].pct+'% — adicione capacidade ou acelere a etapa</div>';
  }
  $("ana-bottle").innerHTML=bh;
}

/* =====================================================================
   CARDÁPIO
   ===================================================================== */
var TYPE_COLORS={montagem:"#1A1A1A",forno:"#C0392B",vitrine:"#E2000F",prep:"#6F6857",pia:"#2A6FDB",
  geladeira:"#2A6FDB",bibite:"#1F8A5B",estoque:"#9A9284",caixa:"#E2000F",balcao:"#E2000F",
  batedeira:"#8A5A2B",estufa:"#B5781F"};
function renderMenuPanel(){
  var host=$("menu-list"); host.innerHTML="";
  SIM.cfg.menu.forEach(function(item,ii){
    var isL=SIM.lancheCat(item)==="lanche";
    var tt=item.steps.reduce(function(a,s){ return a+s.time; },0);
    var d=document.createElement("div"); d.className="mic";
    var typeOpts=SIM.typesInScene.map(function(t){ return t.type; })
      .filter(function(t){ return t!=="batedeira"&&t!=="estufa"&&t!=="forno"; }); /* fluxo do cliente é só na frente */
    item.steps.forEach(function(s){ if(typeOpts.indexOf(s.type)<0) typeOpts.push(s.type); });
    var flow=item.steps.map(function(s,si){
      var ok=SIM.typesInScene.some(function(t){ return t.type===s.type; });
      return '<span class="flow-chip" style="background:'+(ok?(TYPE_COLORS[s.type]||"#9A9284"):"#C0392B")+'">'
        +s.type+' '+s.time+'m'+(ok?'':' ⚠')+'</span>'
        +(si<item.steps.length-1?'<span class="flow-arrow">▶</span>':'');
    }).join("");
    d.innerHTML='<div class="mi-h">'
      +'<input class="nm" value="'+item.name.replace(/"/g,"&quot;")+'" data-mi="'+ii+'" data-k="name" />'
      +'<div class="mi-meta">'
      +'<button class="catbtn '+(isL?"lanche":"")+'" data-cat="'+ii+'">'+(isL?"Lanche":"Bebida")+'</button>'
      +'<span class="mi-price">R$<input type="number" value="'+item.price+'" min="0" data-mi="'+ii+'" data-k="price" /></span>'
      +'<button class="rm-btn" data-rm="'+ii+'">×</button></div></div>'
      +'<div class="mi-total">tempo de bancada: '+tt.toFixed(1)+' min + caminhada (layout)'
      +' · pedido a cada ~'+(item.prob>0?Math.round(1/item.prob):"–")+' do tipo</div>'
      +(isL?'<div class="mi-pao">consome <input type="number" value="'+(item.pao||0)+'" min="0" max="4" data-mi="'+ii+'" data-k="pao" /> pão(es) por unidade (do estoque da padaria)</div>':'')
      +'<div class="flow-vis">'+flow+'</div>'
      +'<div class="sr-head"><span>#</span><span>Estação (na frente)</span><span>Tempo</span><span></span><span></span></div>'
      +item.steps.map(function(s,si){
        return '<div class="sr"><span class="sr-num">'+(si+1)+'</span>'
          +'<select data-mi="'+ii+'" data-si="'+si+'" data-k="type">'
          +typeOpts.map(function(t){
            var lb=SIM.typesInScene.find(function(x){ return x.type===t; });
            return '<option value="'+t+'"'+(t===s.type?' selected':'')+'>'+(lb?lb.label:t+" (ausente)")+'</option>';
          }).join("")
          +'</select>'
          +'<input type="number" value="'+s.time+'" min="0.1" max="30" step="0.1" data-mi="'+ii+'" data-si="'+si+'" data-k="time" />'
          +'<span class="sr-lbl">min</span>'
          +'<button class="rm-btn" data-rms="'+ii+':'+si+'">×</button></div>';
      }).join("")
      +'<button class="add-s" data-add="'+ii+'">+ etapa</button>';
    host.appendChild(d);
  });
  host.querySelectorAll("[data-cat]").forEach(function(b){
    b.addEventListener("click",function(){
      var item=SIM.cfg.menu[+b.dataset.cat]; if(!item) return;
      var isL=SIM.lancheCat(item)==="lanche";
      item.cat=isL?"bebida":"lanche";
      item.pao=item.cat==="lanche"?(item.pao||1):0;
      SIM.checkMenu(); SIM.saveCfg(); renderMenuPanel(); renderClientePanel();
    });
  });

  host.querySelectorAll("input,select").forEach(function(inp){
    inp.addEventListener("change",function(){
      var mi=+inp.dataset.mi, k=inp.dataset.k;
      var item=SIM.cfg.menu[mi]; if(!item) return;
      if(inp.dataset.si!=null){
        var st=item.steps[+inp.dataset.si]; if(!st) return;
        if(k==="type") st.type=inp.value;
        else st.time=Math.max(0.1,parseFloat(inp.value)||st.time);
      } else {
        if(k==="name") item.name=inp.value;
        else if(k==="price") item.price=Math.max(0,parseFloat(inp.value)||0);
        else if(k==="pao") item.pao=Math.max(0,Math.min(4,parseInt(inp.value)||0));
      }
      SIM.checkMenu(); SIM.saveCfg(); renderMenuPanel();
    });
  });
  host.querySelectorAll("[data-rm]").forEach(function(b){
    b.addEventListener("click",function(){
      SIM.cfg.menu.splice(+b.dataset.rm,1); normProbs(); SIM.checkMenu(); SIM.saveCfg(); renderMenuPanel();
    });
  });
  host.querySelectorAll("[data-rms]").forEach(function(b){
    b.addEventListener("click",function(){
      var p=b.dataset.rms.split(":");
      SIM.cfg.menu[+p[0]].steps.splice(+p[1],1);
      SIM.checkMenu(); SIM.saveCfg(); renderMenuPanel();
    });
  });
  host.querySelectorAll("[data-add]").forEach(function(b){
    b.addEventListener("click",function(){
      var t=SIM.typesInScene[0]?SIM.typesInScene[0].type:"montagem";
      SIM.cfg.menu[+b.dataset.add].steps.push({type:t,time:1.0});
      SIM.saveCfg(); renderMenuPanel();
    });
  });
}
function normProbs(){
  var t=SIM.cfg.menu.reduce(function(a,m){ return a+m.prob; },0);
  if(t>0) SIM.cfg.menu.forEach(function(m){ m.prob=m.prob/t; });
}
$("btn-add-menu").addEventListener("click",function(){
  var t=SIM.typesInScene[0]?SIM.typesInScene[0].type:"montagem";
  SIM.cfg.menu.push({id:"it_"+Date.now(),name:"Novo item",prob:0.1,price:30,steps:[{type:t,time:2}]});
  normProbs(); SIM.checkMenu(); SIM.saveCfg(); renderMenuPanel();
});

/* ---------- capacidade simultânea por tipo de estação ---------- */
function renderCapPanel(){
  var host=$("cap-list"); if(!host) return;
  host.innerHTML="";
  SIM.typesInScene.forEach(function(t){
    var row=document.createElement("div"); row.className="cap-row";
    var nm=document.createElement("span"); nm.className="nm"; nm.textContent=t.label;
    var inp=document.createElement("input");
    inp.type="number"; inp.min="1"; inp.max="8"; inp.step="1";
    inp.value=SIM.cfg.capacity[t.type]||1;
    inp.addEventListener("change",function(){
      var v=Math.max(1,Math.min(8,parseInt(inp.value)||1));
      inp.value=v;
      SIM.cfg.capacity[t.type]=v;
      SIM.saveCfg(); SIM.syncScene(); SIM2D.rebuild();
      flash(t.label+": capacidade "+v,"var(--green)");
    });
    row.appendChild(nm); row.appendChild(inp); host.appendChild(row);
  });
}

/* =====================================================================
   CLIENTE — quem chega, quando, e o que pede
   ===================================================================== */
function demandMult(h,curve){
  if(curve==="flat") return 1;
  function peak(c,s,a){ return a*Math.exp(-Math.pow(h-c,2)/(2*s*s)); }
  var m=0.35;
  if(curve==="lunch"||curve==="both") m+=peak(13,1.0,2.0);
  if(curve==="dinner"||curve==="both") m+=peak(20,1.0,1.6);
  if(curve==="lunch"&&h>16) m=0.30;
  return Math.max(0.1,m);
}
function renderCurvePreview(){
  var box=$("curve-preview"); if(!box) return;
  var curve=SIM.cfg.demandCurve, rate=SIM.cfg.rate;
  var w=250,h=46,pts=[],peakV=0,vals=[];
  for(var hh=10;hh<=22;hh+=0.25){ var v=demandMult(hh,curve)*rate; vals.push({h:hh,v:v}); if(v>peakV)peakV=v; }
  var maxR=Math.max(1,peakV);
  vals.forEach(function(d,i){ pts.push(((i/(vals.length-1))*w).toFixed(1)+","+(h-(d.v/maxR)*h).toFixed(1)); });
  box.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:46px;display:block">'
    +'<polyline points="0,'+h+' '+pts.join(" ")+' '+w+','+h+'" fill="rgba(226,0,15,0.08)" stroke="none"/>'
    +'<polyline points="'+pts.join(" ")+'" fill="none" stroke="#E2000F" stroke-width="1.4"/></svg>'
    +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:3px;font-family:var(--mono)">'
    +'<span>10h</span><span>pico ~'+Math.round(peakV)+'/h</span><span>22h</span></div>';
}
function renderMixList(){
  var host=$("mix-list"); if(!host) return;
  host.innerHTML="";
  ["lanche","bebida"].forEach(function(cat){
    var grp=SIM.cfg.menu.filter(function(m){ return SIM.lancheCat(m)===(cat==="lanche"?"lanche":"bebida"); });
    if(!grp.length) return;
    var tot=grp.reduce(function(a,m){ return a+m.prob; },0)||1;
    var lbl=document.createElement("div"); lbl.className="mix-group";
    lbl.textContent=cat==="lanche"?"Lanches — mix de preferência":"Bebidas — mix de preferência";
    host.appendChild(lbl);
    grp.forEach(function(item){
      var ii=SIM.cfg.menu.indexOf(item);
      var pct=Math.round(item.prob/tot*100);
      var row=document.createElement("div"); row.className="mix-row";
      row.innerHTML='<span class="nm"><span class="cat-dot" style="background:'+(cat==="lanche"?"#E2000F":"#1F8A5B")+'"></span>'+item.name+'</span>'
        +'<input type="number" value="'+pct+'" min="0" max="100" data-mix="'+ii+'" />'
        +'<span class="bar"><i style="width:'+pct+'%"></i></span>';
      host.appendChild(row);
    });
  });
  host.querySelectorAll("[data-mix]").forEach(function(inp){
    inp.addEventListener("change",function(){
      var item=SIM.cfg.menu[+inp.dataset.mix]; if(!item) return;
      item.prob=Math.max(0.001,(parseFloat(inp.value)||0)/100);
      SIM.saveCfg(); renderMixList();
    });
  });
}
function renderClientePanel(){
  renderCurvePreview();
  renderMixList();
  document.querySelectorAll("#scenario-chips .chip").forEach(function(c){
    var s=c.dataset.scn, on=false;
    if(s==="vale") on=SIM.cfg.rate<=14&&SIM.cfg.demandCurve==="flat";
    else if(s==="almoco") on=SIM.cfg.rate>=40&&SIM.cfg.demandCurve==="lunch";
    else on=SIM.cfg.demandCurve==="both";
    c.classList.toggle("on",on);
  });
}
$("cfg-rate").addEventListener("input",renderCurvePreview);
$("cfg-curve").addEventListener("change",renderCurvePreview);

/* =====================================================================
   PADARIA — origem do pão, produção ao vivo, viabilidade própria × terceirizar
   ===================================================================== */
function bindBread(id,key,after){
  var el=$(id); if(!el) return;
  el.addEventListener("change",function(){
    var v=parseFloat(this.value);
    if(!isNaN(v)){ SIM.cfg.bread[key]=v; SIM.saveCfg(); if(after) after(); updatePadariaLive(); }
  });
}
[["pad-batch","batchSize"],["pad-target","target"],["pad-mix","mixTime"],["pad-proof","proofTime"],
 ["pad-bake","bakeTime"],["pad-breadstart","breadStart"],["pad-flourstart","flourStart"],
 ["pad-flourperb","flourPerBread"],["pad-flourprice","flourPrice"],["pad-extra","extraPerBread"],
 ["pad-energy","energyPerBatch"],["pad-bakercost","bakerCost"],["pad-rentm2","rentM2"],
 ["pad-shifthours","shiftHours"],["pad-shifts","shifts"],["pad-storage","storageCap"],
 ["pad-inv-bat","investBatedeira"],["pad-life-bat","lifeBatedeira"],
 ["pad-inv-est","investEstufa"],["pad-life-est","lifeEstufa"],
 ["pad-inv-for","investForno"],["pad-life-for","lifeForno"],
 ["pad-tercprice","tercPrice"],["pad-tercfrete","tercFrete"],["pad-tercqty","tercQty"]
].forEach(function(p){ bindBread(p[0],p[1]); });
(function(){
  var hy=$("pad-hybrid");
  if(hy) hy.addEventListener("input",function(){
    SIM.cfg.bread.hybridOwnPct=parseInt(hy.value)||0;
    var hv=$("hybrid-val"); if(hv) hv.textContent=hy.value;
    SIM.saveCfg(); updatePadariaLive();
  });
  [["inv-bibstart","bibiteStart"],["inv-bibcap","bibiteCap"],["inv-vitcap","vitrineCap"]].forEach(function(p){
    var el=$(p[0]); if(!el) return;
    el.addEventListener("change",function(){ var v=parseFloat(this.value); if(!isNaN(v)){ SIM.cfg.inv[p[1]]=v; SIM.saveCfg(); updatePadariaLive(); } });
  });
})();

document.querySelectorAll("#bread-mode .chip").forEach(function(ch){
  ch.addEventListener("click",function(){
    SIM.cfg.bread.mode=ch.dataset.bmode;
    SIM.saveCfg();
    SIM.buildOperators(); renderOpAssign();
    if(SIM3D.inited) SIM3D.rebuild();
    syncPadariaInputs(); updatePadariaLive();
    flash(ch.dataset.bmode==="terc"?"Pão terceirizado — sem padeiro no fundo":"Produção própria — padeiro ativo no fundo","var(--green)");
  });
});

function syncPadariaInputs(){
  var b=SIM.cfg.bread, iv=SIM.cfg.inv;
  var map={"pad-batch":"batchSize","pad-target":"target","pad-mix":"mixTime","pad-proof":"proofTime",
    "pad-bake":"bakeTime","pad-breadstart":"breadStart","pad-flourstart":"flourStart",
    "pad-flourperb":"flourPerBread","pad-flourprice":"flourPrice","pad-extra":"extraPerBread",
    "pad-energy":"energyPerBatch","pad-bakercost":"bakerCost","pad-rentm2":"rentM2",
    "pad-shifthours":"shiftHours","pad-shifts":"shifts","pad-storage":"storageCap",
    "pad-inv-bat":"investBatedeira","pad-life-bat":"lifeBatedeira",
    "pad-inv-est":"investEstufa","pad-life-est":"lifeEstufa",
    "pad-inv-for":"investForno","pad-life-for":"lifeForno",
    "pad-tercprice":"tercPrice","pad-tercfrete":"tercFrete","pad-tercqty":"tercQty"};
  Object.keys(map).forEach(function(id){ var el=$(id); if(el) el.value=b[map[id]]; });
  var hy=$("pad-hybrid"); if(hy){ hy.value=b.hybridOwnPct; var hv=$("hybrid-val"); if(hv) hv.textContent=b.hybridOwnPct; }
  $("hybrid-field").style.display=b.mode==="hibrido"?"block":"none";
  if($("inv-bibstart")) $("inv-bibstart").value=iv.bibiteStart;
  if($("inv-bibcap")) $("inv-bibcap").value=iv.bibiteCap;
  if($("inv-vitcap")) $("inv-vitcap").value=iv.vitrineCap;
  document.querySelectorAll("#bread-mode .chip").forEach(function(c){ c.classList.toggle("on",c.dataset.bmode===b.mode); });
  var own=b.mode!=="terc";
  $("sec-pad-fabrica").style.display=own?"block":"none";
  $("sec-pad-prod").style.display=own?"block":"none";
  $("sec-pad-custos").style.display=own?"block":"none";
  $("bread-mode-note").textContent=
      b.mode==="propria" ? "F\u00e1brica no fundo: um padeiro bate, fermenta e assa o turno inteiro, estocando p\u00e3es para a frente vender. Equipamentos ocupam espa\u00e7o e exigem investimento."
    : b.mode==="hibrido" ? "Parte produzida internamente, o restante comprado de fornecedor \u2014 \u00fatil para garantir volume de pico sem superdimensionar a f\u00e1brica."
    : "P\u00e3es chegam prontos de um fornecedor. Sem padeiro, sem equipamentos \u2014 custo por p\u00e3o fixo + frete di\u00e1rio.";
  var miss=SIM.breadMissing();
  $("pad-warn").innerHTML=(own&&miss.length)
    ? '<div class="alr alr-r" style="margin:0 0 4px"><b>Falta na planta:</b> '+miss.join(", ")
      +'. A f\u00e1brica de p\u00e3es precisa de batedeira, estufa e forno no fundo \u2014 adicione no est\u00fadio.</div>'
    : "";
}

function gauge(name,val,max,unit,target,sub){
  var pct=Math.max(0,Math.min(100,max>0?val/max*100:0));
  var col=pct<15?"#E2000F":pct<35?"#D29922":"#1F8A5B";
  var tgt=target!=null&&max>0?'<span class="tgt" style="left:'+Math.min(100,target/max*100)+'%"></span>':"";
  return '<div class="gauge"><div class="gh"><span class="nm">'+name+'</span><span class="vv">'+val+' '+unit+'</span></div>'
    +'<div class="gbar"><i style="width:'+pct.toFixed(0)+'%;background:'+col+'"></i>'+tgt+'</div>'
    +(sub?'<div class="gsub">'+sub+'</div>':'')+'</div>';
}
function updatePadariaLive(){
  if(!$("pane-padaria")) return;
  var b=SIM.cfg.bread, BR=SIM.bread(), k=SIM.breadKPIs();

  /* pipeline */
  var pipeHost=$("pad-pipe");
  if(b.mode==="terc"){
    pipeHost.innerHTML='<div class="empty">Pão terceirizado — sem produção interna. '+k.stock+' pães em estoque (entrega do fornecedor).</div>';
  } else {
    var batches=BR.batches||[];
    var proof=batches.filter(function(x){return x.phase==="proof"||x.phase==="ready_oven";});
    var bake=batches.filter(function(x){return x.phase==="bake";});
    var miss=SIM.breadMissing();
    function cell(type,label,activeN,extra,prog){
      var m=miss.indexOf(type)>=0;
      var cls="pipe-st"+(m?" miss":(activeN>0?" busy":""));
      var st=m?"ausente":(activeN>0?extra:"livre");
      var bar=prog!=null?'<div class="pbar"><i style="width:'+Math.round(prog*100)+'%"></i></div>':'';
      return '<div class="'+cls+'"><span class="ic">'+label+'</span><span class="st">'+st+'</span>'+bar+'</div>';
    }
    var baker=SIM.operators.filter(function(o){return o.role==="padeiro";})[0];
    var mixing=baker&&/Batedeira/.test(baker.statusText||"");
    var mixProg=mixing?(baker.bt/b.mixTime):null;
    var proofProg=proof.length?Math.max.apply(null,proof.map(function(x){return Math.min(1,x.t/b.proofTime);})):null;
    var bakeProg=bake.length?Math.max.apply(null,bake.map(function(x){return Math.min(1,x.t/b.bakeTime);})):null;
    pipeHost.innerHTML='<div class="pipe">'
      +cell("batedeira","Batedeira",mixing?1:0,"batendo",mixProg)
      +cell("estufa","Estufa",proof.length,proof.length+" fermentando",proofProg)
      +cell("forno","Forno",bake.length,bake.length+" assando",bakeProg)
      +'<div class="pipe-st"><span class="ic">Padeiro</span><span class="st">'+(baker?(baker.statusText||"livre").replace("Padeiro · ",""):"—")+'</span></div>'
      +'</div>';
  }

  /* estoques */
  var stockHost=$("pad-stocks"), gh="";
  gh+=gauge("Pães em estoque",k.stock,Math.max(b.target*1.3,b.batchSize*2),"un",b.target,
    "alvo "+b.target+" · consumidos hoje: "+k.consumed+(k.waitingBread>0?" · ⚠ "+k.waitingBread+" pedido(s) sem pão":""));
  if(b.mode!=="terc"){
    gh+=gauge("Farinha",k.flourKg,Math.max(b.flourStart,1),"kg",null,
      "usados "+k.flourUsedKg+" kg · rende ~"+Math.floor(k.flourKg/Math.max(0.001,b.flourPerBread))+" pães · "+k.mixes+" fornadas batidas");
    gh+='<div class="gsub" style="padding:2px 2px 0">Tempo de uma fornada completa: <b>'+(b.mixTime+b.proofTime+b.bakeTime)+' min</b> (batedeira '+b.mixTime+' + estufa '+b.proofTime+' + forno '+b.bakeTime+')</div>';
  }
  stockHost.innerHTML=gh;

  /* viabilidade + capacidade + sensibilidade + estoques + premissas */
  renderViability(k,b);
  renderCapacity(k,b);
  renderSensitivity(k);
  renderInventory();
  renderPremissas(b);
}
function renderCapacity(k,b){
  var host=$("pad-capacity"); if(!host) return;
  if(b.mode==="terc"){ host.innerHTML=""; return; }
  var dem=k.projDemandDay, cps=k.capPerShift, need=k.shiftsNeeded;
  var ok=dem>0&&dem<=k.capPerDay;
  var h='<div class="viab-vs">'
    +'<div class="viab-card"><div class="tt">Produzido no turno</div><div class="big">'+k.producedShift+'</div><div class="sm">pães · pico estoque '+k.peakStock+'/'+k.storageCap+'</div></div>'
    +'<div class="viab-card"><div class="tt">Capacidade / turno</div><div class="big">'+cps+'</div><div class="sm">'+b.shiftHours+'h · '+k.shifts+' turno(s) = '+k.capPerDay+'/dia</div></div>'
    +'</div>';
  h+='<div class="viab-line"><span class="k">Demanda projetada</span><span class="v">'+(dem||"—")+' pães/dia</span></div>'
    +'<div class="viab-line"><span class="k">Horas de produção necessárias</span><span class="v">'+(k.hoursNeeded!=null?k.hoursNeeded+" h":"—")+'</span></div>';
  var verdict,vcls;
  if(dem<=0){ verdict="Rode a simulação para medir a demanda real e dimensionar os turnos."; vcls=""; }
  else if(ok&&need<=k.shifts){ verdict="<b>1 turno basta</b> (precisa de "+need+"). A fábrica produz "+k.capPerDay+" pães/dia para uma demanda de "+dem+". Folga de "+(k.capPerDay-dem)+" pães."; vcls=""; }
  else { verdict="<b>Capacidade insuficiente em "+k.shifts+" turno(s).</b> A demanda ("+dem+"/dia) exige ~"+need+" turnos de padeiro ou +1 estufa/forno. Hoje o teto é "+k.capPerDay+"/dia."; vcls="bad"; }
  h+='<div class="viab-verdict '+vcls+'">'+verdict+'</div>';
  host.innerHTML=h;
}
function renderSensitivity(k){
  var host=$("pad-sens"); if(!host||!k.sens) return;
  var maxC=Math.max.apply(null,k.sens.map(function(s){return Math.max(s.own,s.terc);}));
  var w=250,h=84,n=k.sens.length;
  function X(i){ return (i/(n-1))*w; }
  function Y(v){ return h-(v/maxC)*h*0.9-4; }
  var ownP=k.sens.map(function(s,i){return X(i)+","+Y(s.own);}).join(" ");
  var tercP=k.sens.map(function(s,i){return X(i)+","+Y(s.terc);}).join(" ");
  /* ponto de cruzamento aproximado */
  var cross=null;
  for(var i=1;i<n;i++){ if((k.sens[i-1].own-k.sens[i-1].terc)*(k.sens[i].own-k.sens[i].terc)<=0){ cross=k.sens[i].q; break; } }
  host.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:84px;display:block">'
    +'<polyline points="'+tercP+'" fill="none" stroke="#9A9284" stroke-width="1.6" stroke-dasharray="4 3"/>'
    +'<polyline points="'+ownP+'" fill="none" stroke="#E2000F" stroke-width="1.8"/></svg>'
    +'<div class="senleg"><span><i style="background:#E2000F"></i>Própria</span><span><i style="background:#9A9284"></i>Terceirizado R$'+k.tercPerBread.toFixed(2)+'</span>'
    +'<span>'+k.sens[0].q+'→'+k.sens[n-1].q+' pães/dia</span></div>'
    +(cross?'<div class="gsub" style="text-align:center">Equilíbrio em ~<b>'+cross+' pães/dia</b> — acima disso, produzir compensa.</div>':'');
}
function renderInventory(){
  var host=$("pad-inv"); if(!host) return;
  var iv=SIM.invKPIs();
  var h=gauge("Bebidas (geladeira)",iv.bibite,Math.max(iv.bibiteCap,1),"un",null,
    "vendidas "+iv.bibiteSold+" · cap "+iv.bibiteCap+(iv.bibiteEmptyMin>1?" · ⚠ "+iv.bibiteEmptyMin.toFixed(0)+" min vazia":""));
  h+=gauge("Vitrine (exposição)",iv.vitrineLoad,Math.max(iv.vitrineCap,1),"itens",null,
    "prontos aguardando retirada · cap "+iv.vitrineCap+(iv.vitrineLoad>iv.vitrineCap?" · ⚠ acima da capacidade":""));
  host.innerHTML=h;
}
function renderPremissas(b){
  var host=$("pad-premissas"); if(!host) return;
  host.innerHTML=[
    "Dia de vendas (FOH): <b>10h–22h</b> (12h). Turno do padeiro (BOH) configurável.",
    "Fornada = batedeira ("+b.mixTime+"m, serial) → estufa ("+b.proofTime+"m) → forno ("+b.bakeTime+"m); estufa/forno em paralelo conforme capacidade.",
    "Capacidade/turno = gargalo entre as 3 etapas × tamanho da fornada × horas, com ~3 min de manuseio por fornada.",
    "Custo variável/pão = farinha + outros insumos + energia/fornada. Custo fixo/dia = padeiro + depreciação (por equipamento) + aluguel da área ocupada.",
    "Demanda de pães projetada = consumo observado/h × 12. Sobra ao fim do dia vira perda.",
    "BOH e FOH são zonas exclusivas: o padeiro estoca no fundo, os atendentes consomem do estoque sem cruzar a divisa."
  ].map(function(t){ return '<div class="prem">'+t+'</div>'; }).join("");
}
function renderViability(k,b){
  var host=$("pad-viab"); if(!host) return;
  var own=k.ownPerBread, terc=k.tercPerBread, hyb=k.hybridPerBread;
  var best=Math.min(own,terc,(b.mode==="hibrido"?hyb:Infinity));
  function card(mode,label,val,sub){
    var active=b.mode===mode;
    var win=Math.abs(val-best)<0.005;
    return '<div class="viab-card'+(win?" win":"")+(active?" active":"")+'"><div class="tt">'+label+(active?" ·":"")+'</div>'
      +'<div class="big">R$'+val.toFixed(2)+'</div><div class="sm">'+sub+'</div></div>';
  }
  var h='<div class="viab-vs3">'
    +card("propria","Própria",own,"R$"+k.ownCostDay+"/dia")
    +card("hibrido","Híbrido "+k.hybridOwnPct+"%",hyb,"mix produção+compra")
    +card("terc","Terceirizado",terc,"R$"+k.tercAtQ+"/dia")
    +'</div>';
  h+='<div class="viab-line"><span class="k">Demanda projetada (dia)</span><span class="v">'+(k.projDemandDay||"—")+' pães</span></div>';
  if(b.mode!=="terc"){
    h+='<div class="viab-line"><span class="k">Custo variável / pão</span><span class="v">R$'+k.varPerBread.toFixed(2)+'</span></div>'
      +'<div class="viab-line"><span class="k">Padeiro / dia</span><span class="v">R$'+k.laborDay+'</span></div>'
      +'<div class="viab-line"><span class="k">Depreciação equip. / dia</span><span class="v">R$'+k.deprecDay+'</span></div>'
      +'<div class="viab-line"><span class="k">Espaço (aluguel) / dia</span><span class="v">R$'+k.spaceDay+' · '+k.areaM2+' m²</span></div>'
      +'<div class="viab-line"><span class="k">Investimento total</span><span class="v">R$'+k.investTotal+'</span></div>'
      +'<div class="viab-line"><span class="k">Ponto de equilíbrio</span><span class="v">'+(k.breakevenDay?k.breakevenDay+' pães/dia':'—')+'</span></div>';
  }
  h+='<div class="viab-line"><span class="k">Própria vs terceirizar (dia)</span><span class="v" style="color:'+(k.savingDay>=0?"var(--green)":"var(--rosso)")+'">'+(k.savingDay>=0?"+":"")+'R$'+k.savingDay+'</span></div>';
  var verdict,vcls;
  if(b.mode==="terc"){
    verdict="Operando <b>terceirizado</b> a R$"+terc.toFixed(2)+"/pão (R$"+k.tercAtQ+"/dia para "+k.projDemandDay+" pães). "
      +(k.savingDay>0?"Nesse volume, produzir economizaria R$"+k.savingDay+"/dia (payback ~"+(k.paybackMonths||"–")+" meses).":"Nesse volume, produzir sairia mais caro — manter terceirizado faz sentido.");
    vcls=k.savingDay>0?"":"bad";
  } else if(b.mode==="hibrido"){
    verdict="<b>Híbrido "+k.hybridOwnPct+"%:</b> custo médio R$"+hyb.toFixed(2)+"/pão. Produz o miolo do volume e compra os picos — reduz risco de falta sem superdimensionar a fábrica.";
    vcls=hyb<=terc?"":"bad";
  } else if(k.savingDay>=0){
    verdict="<b>Produção própria compensa:</b> R$"+own.toFixed(2)+"/pão vs R$"+terc.toFixed(2)+" terceirizado. Economia de R$"+k.savingDay+"/dia"+(k.paybackMonths?", payback ~"+k.paybackMonths+" meses.":".");
    vcls="";
  } else {
    verdict="<b>Neste volume, terceirizar é mais barato.</b> Própria custa R$"+own.toFixed(2)+"/pão (fixos diluídos em poucos pães). Só compensa acima de "+(k.breakevenDay||"–")+" pães/dia.";
    vcls="bad";
  }
  h+='<div class="viab-verdict '+vcls+'">'+verdict+'</div>';
  host.innerHTML=h;
}

/* ---------- acabamentos (3D) ---------- */
document.querySelectorAll("#fin3d [data-floor]").forEach(function(b){
  b.addEventListener("click",function(){ SIM3D.setFinish("floor",b.dataset.floor); });
});
document.querySelectorAll("#fin3d [data-wallfin]").forEach(function(b){
  b.addEventListener("click",function(){ SIM3D.setFinish("wall",b.dataset.wallfin); });
});

/* =====================================================================
   MODAL: RELATÓRIO / COMPARAÇÃO / MONTE CARLO
   ===================================================================== */
function openModal(title,bodyHtml,footHtml){
  $("md-title").textContent=title;
  $("md-body").innerHTML=bodyHtml;
  $("md-foot").innerHTML=footHtml||"";
  $("modal").style.display="flex";
}
function closeModal(){ $("modal").style.display="none"; }
$("md-close").addEventListener("click",closeModal);
$("modal").addEventListener("click",function(e){ if(e.target===$("modal")) closeModal(); });

function kpiCard(v,l,col){
  return '<div class="mc"><div class="mv"'+(col?' style="color:'+col+'"':'')+'>'+v+'</div><div class="ml">'+l+'</div></div>';
}
function showEod(){
  var k=SIM.computeKPIs();
  var recs=SIM.recommendations(k);
  var h='<div class="eod-kpi">'
    +kpiCard(k.served,"Pedidos servidos")
    +kpiCard(k.throughputPerHour+"/h","Throughput")
    +kpiCard("R$"+k.revenueNet,"Receita líquida")
    +kpiCard("R$"+k.margin,"Margem",k.margin>=0?"var(--green)":"var(--rosso)")
    +kpiCard(k.avgActualPrepMin.toFixed(1)+"m","Preparo médio")
    +kpiCard(k.slaPct.toFixed(0)+"%","No SLA")
    +kpiCard(k.balked,"Desistências ("+k.balkPct.toFixed(0)+"%)","var(--rosso)")
    +kpiCard(k.walkMetersPerOrder+" m","Caminhada/pedido")
    +'</div><div style="font-size:12px;font-weight:800;margin:6px 0 8px">Recomendações</div>';
  recs.forEach(function(r){ h+='<div class="eod-reco">'+r+'</div>'; });
  openModal(SIM.simTime>=22*60?"Relatório — fim do dia":"Resumo parcial",h,
    '<button class="pbtn" id="md-exp-json">Exportar JSON</button>'
    +'<button class="pbtn" id="md-snap">Salvar p/ comparar</button>'
    +'<button class="pbtn" id="md-ok">Fechar</button>');
  $("md-exp-json").addEventListener("click",function(){ exportKPIs("json"); });
  $("md-snap").addEventListener("click",function(){ saveSnapshot(); });
  $("md-ok").addEventListener("click",closeModal);
}
$("btn-eod").addEventListener("click",showEod);

/* ---------- export ---------- */
function exportKPIs(fmt){
  var k=SIM.computeKPIs(), blob, fn;
  if(fmt==="csv"){
    var rows=[["Metrica","Valor"]];
    (function flat(obj,pre){
      Object.keys(obj).forEach(function(key){
        var v=obj[key], kk=pre?pre+"."+key:key;
        if(v&&typeof v==="object"&&!Array.isArray(v)) flat(v,kk);
        else rows.push([kk,Array.isArray(v)?v.join(";"):v]);
      });
    })(k,"");
    var csv=rows.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(","); }).join("\n");
    blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); fn="loja206-operacao-kpis.csv";
  } else {
    blob=new Blob([JSON.stringify(k,null,2)],{type:"application/json"}); fn="loja206-operacao-kpis.json";
  }
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=fn; a.click();
  flash("KPIs exportados","var(--green)");
}
$("btn-exp-json").addEventListener("click",function(){ exportKPIs("json"); });
$("btn-exp-csv").addEventListener("click",function(){ exportKPIs("csv"); });

/* ---------- comparar cenários ---------- */
function saveSnapshot(){
  var name=prompt("Nome deste cenário:","Cenário "+(compareSnapshots.length+1));
  if(!name) return;
  compareSnapshots.push({name:name,kpis:SIM.computeKPIs()});
  flash("Cenário salvo ("+compareSnapshots.length+")","var(--green)");
}
$("btn-snapshot").addEventListener("click",saveSnapshot);
$("btn-compare").addEventListener("click",function(){
  if(!compareSnapshots.length){ flash("Salve ao menos 1 cenário antes","var(--rosso)"); return; }
  var all=[{name:"ATUAL",kpis:SIM.computeKPIs()}].concat(compareSnapshots);
  var metrics=[
    ["served","Servidos",function(v){return v;}],
    ["throughputPerHour","Throughput/h",function(v){return v.toFixed(1);}],
    ["avgActualPrepMin","Preparo (min)",function(v){return v.toFixed(1);}],
    ["slaPct","SLA %",function(v){return v.toFixed(0)+"%";}],
    ["balked","Desistências",function(v){return v;}],
    ["walkMetersPerOrder","m/pedido",function(v){return v;}],
    ["revenueNet","Receita líq.",function(v){return "R$"+v;}],
    ["margin","Margem",function(v){return "R$"+v;}]
  ];
  var h='<table class="cmp-table"><tr><th>Métrica</th>';
  all.forEach(function(s){ h+='<th>'+s.name+'</th>'; });
  h+='</tr>';
  metrics.forEach(function(m){
    var vals=all.map(function(s){ return s.kpis[m[0]]||0; });
    var lowerBetter=(m[0]==="balked"||m[0]==="walkMetersPerOrder"||m[0]==="avgActualPrepMin");
    var best=lowerBetter?Math.min.apply(null,vals):Math.max.apply(null,vals);
    h+='<tr><td>'+m[1]+'</td>';
    all.forEach(function(s){
      var v=s.kpis[m[0]]||0;
      h+='<td class="'+(v===best&&all.length>1?"cmp-best":"")+'">'+m[2](v)+'</td>';
    });
    h+='</tr>';
  });
  h+='</table>';
  openModal("Comparação de cenários",h,
    '<button class="pbtn" id="md-clear">Limpar cenários</button><button class="pbtn" id="md-ok2">Fechar</button>');
  $("md-clear").addEventListener("click",function(){ compareSnapshots.length=0; closeModal(); flash("Cenários limpos","var(--amber)"); });
  $("md-ok2").addEventListener("click",closeModal);
});

/* ---------- Monte Carlo ---------- */
$("btn-mc").addEventListener("click",function(){
  if(mcRunning) return;
  if(!confirm("Rodar 5 simulações do dia inteiro (10h–22h)? Leva alguns segundos.")) return;
  runMonteCarlo();
});
function runMonteCarlo(){
  mcRunning=true; SIM.running=false;
  var results=[], run=0;
  flash("Monte Carlo: rodando 1/5…","var(--blue)");
  function step(){
    SIM.reset();
    function chunk(){
      var n=0;
      while(SIM.simTime<22*60&&n<400){ SIM.simTime+=0.1; SIM.tick(0.1); n++; }
      if(SIM.simTime<22*60){ setTimeout(chunk,0); return; }
      results.push(SIM.computeKPIs());
      run++;
      if(run<5){ flash("Monte Carlo: rodando "+(run+1)+"/5…","var(--blue)"); setTimeout(step,0); }
      else finish();
    }
    chunk();
  }
  function finish(){
    mcRunning=false;
    doReset();
    function agg(key){
      var vals=results.map(function(r){ return r[key]||0; });
      var mean=vals.reduce(function(a,b){return a+b;},0)/vals.length;
      var sd=Math.sqrt(vals.reduce(function(a,b){return a+Math.pow(b-mean,2);},0)/vals.length);
      return {mean:mean.toFixed(1),sd:sd.toFixed(1),min:Math.min.apply(null,vals).toFixed(1),max:Math.max.apply(null,vals).toFixed(1)};
    }
    var keys=[["served","Servidos"],["throughputPerHour","Throughput/h"],["avgActualPrepMin","Preparo min"],
      ["slaPct","SLA %"],["balked","Desistências"],["walkMetersPerOrder","m/pedido"],["revenueNet","Receita líq."],["margin","Margem"]];
    var h='<table class="cmp-table"><tr><th>Métrica</th><th>Média</th><th>± DP</th><th>Mín</th><th>Máx</th></tr>';
    keys.forEach(function(kk){
      var a=agg(kk[0]);
      h+='<tr><td>'+kk[1]+'</td><td class="cmp-best">'+a.mean+'</td><td>'+a.sd+'</td><td>'+a.min+'</td><td>'+a.max+'</td></tr>';
    });
    h+='</table><div class="util-sub" style="margin-top:8px">5 dias completos (10h–22h), mesma config, aleatoriedade diferente.</div>';
    openModal("Monte Carlo — 5 execuções",h,'<button class="pbtn" id="md-ok3">Fechar</button>');
    $("md-ok3").addEventListener("click",closeModal);
    flash("Monte Carlo concluído","var(--green)");
  }
  step();
}

/* ---------- toast ---------- */
function flash(msg,col){
  var st=$("save-status");
  st.textContent=msg; st.style.color=col||"var(--ink-soft)";
  clearTimeout(st._t); st._t=setTimeout(function(){ st.textContent=""; },3500);
}

/* API de depuração/automação */
window.SIMUI={
  refresh:function(){
    updatePanels();
    if(activeView==="2d"){ SIM2D.render(); SIM2D.renderHeat(); }
    else SIM3D.render();
  },
  advance:function(min){
    var step=0.05;
    for(var t=0;t<min;t+=step){
      if(SIM.simTime>=22*60) break;
      SIM.simTime+=step; SIM.tick(step);
    }
    window.SIMUI.refresh();
  }
};

/* =====================================================================
   INIT
   ===================================================================== */
SIM.loadCfg();
SIM.reset();
SIM2D.init($("sim2d"));
syncInputsFromCfg();
renderOpAssign();
renderMenuPanel();
renderCapPanel();
renderClientePanel();
syncPadariaInputs();
updateSceneStamp();
updatePanels();
if(/[?&]view=3d/.test(window.location.search)) switchView("3d");
})();
