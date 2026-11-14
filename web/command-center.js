import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js";

const API_BASE=(window.VANRAKSHAK_API_BASE||"").replace(/\/$/,"");
const $=id=>document.getElementById(id), $$=s=>Array.from(document.querySelectorAll(s));
const state={lat:12.3375,lon:75.8069,place:"Kodagu Forest Region",earth:null,map:null,layers:[],integrations:[],sourceHealth:null,events:[],mapMode:"true_color",currentPage:"overview"};
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const n=(v,d=1)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toFixed(d);
const iso=d=>d.toISOString().slice(0,10);
async function api(path){
 const r=await fetch(API_BASE+path,{headers:{Accept:"application/json"}});
 const t=await r.text();let data;try{data=t?JSON.parse(t):{}}catch{throw new Error("Non-JSON provider response")}
 if(!r.ok)throw new Error(typeof data.detail==="string"?data.detail:`HTTP ${r.status}`);
 return data;
}
function toast(message,type="info"){const el=document.createElement("div");el.className="toast"+(type==="error"?" error":"");el.textContent=message;$("toastStack").appendChild(el);setTimeout(()=>el.remove(),4200)}
function icons(){try{window.lucide?.createIcons?.({attrs:{"stroke-width":1.7}})}catch{}}
function envelope(x){return x?.data&&typeof x.data==="object"?x.data:x||{}}
function classify(s){s=String(s||"").toLowerCase();return /ok|live|ready|connected|success|working/.test(s)?"ok":/fallback|optional|auth|configured|partial|warning/.test(s)?"warn":/fail|offline|error|unavailable|down/.test(s)?"bad":""}
function statusLabel(s){return s||"STATUS UNKNOWN"}
function safeStatus(s){return classify(s)}
function setApiStatus(ok){const chip=$("apiChip");if(chip){chip.innerHTML=`<span class="${ok?"ok":"bad"}"></span>${ok?"API CONNECTED":"API UNAVAILABLE"}`};$("healthText").textContent=ok?"API responding":"API unavailable";$("healthOrb").className="health-orb "+(ok?"ok":"bad");$("footerApi").textContent=ok?"API: CONNECTED":"API: UNAVAILABLE"}
function renderJson(obj){return `<pre class="result-json">${esc(JSON.stringify(obj,null,2).slice(0,16000))}</pre>`}
function renderEmpty(text){return `<div class="empty">${esc(text)}</div>`}
function setLocation(lat,lon,place){
 lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){toast("Invalid latitude or longitude","error");return}
 state.lat=lat;state.lon=lon;state.place=place||"Selected study area";
 const c=`${Math.abs(lat).toFixed(4)}° ${lat>=0?"N":"S"} · ${Math.abs(lon).toFixed(4)}° ${lon>=0?"E":"W"}`;
 $("latRead").textContent=`${Math.abs(lat).toFixed(4)}° ${lat>=0?"N":"S"}`;$("lonRead").textContent=`${Math.abs(lon).toFixed(4)}° ${lon>=0?"E":"W"}`;
 $("focusName").textContent=state.place.toUpperCase();$("regionName").textContent=state.place;$("regionCoords").textContent=c+"   KARNATAKA / INDIA";
 ["mapCoordinateReadout","forestCoords"].forEach(id=>{if($(id))$(id).textContent=c});
 ["forestPlace","firePlace"].forEach(id=>{if($(id))$(id).textContent=state.place});
 $("mapLat")&&($("mapLat").value=lat);$("mapLon")&&($("mapLon").value=lon);
 if(state.map)state.map.flyTo({center:[lon,lat],zoom:6,duration:900});
}
function initEarth(){
 const canvas=$("earthCanvas");if(!canvas)return;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.1,250);camera.position.set(0,0,6.3);
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const ambient=new THREE.AmbientLight(0x9ebdce,1.35);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffefd9,3);sun.position.set(-5,2.8,5);scene.add(sun);
 const rim=new THREE.PointLight(0x48b8d1,1.2,24);rim.position.set(3,-1,-4);scene.add(rim);
 const starGeo=new THREE.BufferGeometry(),count=2200,pos=new Float32Array(count*3);
 for(let i=0;i<count;i++){const r=40+Math.random()*100,t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);pos[i*3]=r*Math.sin(p)*Math.cos(t);pos[i*3+1]=r*Math.cos(p);pos[i*3+2]=r*Math.sin(p)*Math.sin(t)}
 starGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xb8d6e1,size:.085,transparent:true,opacity:.78}));scene.add(stars);
 const group=new THREE.Group();scene.add(group);
 const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
 const earthMat=new THREE.MeshPhongMaterial({color:0xa9c7d1,shininess:14,specular:new THREE.Color(0x315d69)});
 const earth=new THREE.Mesh(new THREE.SphereGeometry(2,96,96),earthMat);group.add(earth);
 const nightMat=new THREE.MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.17,blending:THREE.AdditiveBlending,depthWrite:false});
 group.add(new THREE.Mesh(new THREE.SphereGeometry(2.003,96,96),nightMat));
 const cloudMat=new THREE.MeshPhongMaterial({color:0xcce0e4,transparent:true,opacity:.28,depthWrite:false});
 const clouds=new THREE.Mesh(new THREE.SphereGeometry(2.018,96,96),cloudMat);group.add(clouds);
 const glow=new THREE.Mesh(new THREE.SphereGeometry(2.12,64,64),new THREE.ShaderMaterial({
  transparent:true,side:THREE.BackSide,depthWrite:false,uniforms:{glowColor:{value:new THREE.Color(0x4dbbd7)}},
  vertexShader:"varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
  fragmentShader:"uniform vec3 glowColor;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-max(dot(normalize(vN),normalize(vV)),0.0),2.1);gl_FragColor=vec4(glowColor,f*.72);}"
 }));group.add(glow);
 const markers=new THREE.Group();group.add(markers);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=4.3;controls.maxDistance=8.5;controls.autoRotate=!reduced;controls.autoRotateSpeed=.28;controls.rotateSpeed=.42;controls.zoomSpeed=.65;
 const resize=()=>{const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return;camera.aspect=b.width/b.height;camera.updateProjectionMatrix();renderer.setSize(b.width,b.height,false);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6))};
 const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement);resize();
 const draw=()=>{if(!canvas.isConnected){ro.disconnect();renderer.dispose();return}controls.update();clouds.rotation.y+=.00012;stars.rotation.y-=.000009;renderer.render(scene,camera);requestAnimationFrame(draw)};requestAnimationFrame(draw);
 const base="https://unpkg.com/three-globe/example/img/";
 Promise.all(["earth-blue-marble.jpg","earth-night.jpg","earth-clouds.png"].map(name=>new Promise(resolve=>loader.load(base+name,tex=>{tex.colorSpace=THREE.SRGBColorSpace;resolve(tex)},undefined,()=>resolve(null)))))
 .then(([surface,night,cloud])=>{if(surface){earthMat.map=surface;earthMat.color.set(0xffffff);earthMat.needsUpdate=true}if(night){nightMat.map=night;nightMat.needsUpdate=true}if(cloud){cloudMat.map=cloud;cloudMat.needsUpdate=true;cloudMat.opacity=.32} $("textureStatus").textContent=surface?"SURFACE TEXTURE READY":"TEXTURE FALLBACK"});
 state.earth={scene,camera,renderer,controls,group,markers};
 $("autoRotate").addEventListener("click",()=>{controls.autoRotate=!controls.autoRotate;$("autoRotate").classList.toggle("active",controls.autoRotate)});
 $("resetGlobe").addEventListener("click",()=>{camera.position.set(0,0,6.3);controls.target.set(0,0,0);controls.autoRotate=true;$("autoRotate").classList.add("active")});
}
function addMarkers(events){
 if(!state.earth)return;const group=state.earth.markers;while(group.children.length){const x=group.children.pop();x.geometry?.dispose();x.material?.dispose()}
 let count=0;
 for(const e of (events||[]).slice(0,250)){
  let coords=e.geometry?.coordinates;
  if(Array.isArray(e.geometry)&&e.geometry[0])coords=e.geometry[0].coordinates;
  if(!coords&&Array.isArray(e.coordinates))coords=e.coordinates;
  if(!Array.isArray(coords)||coords.length<2)continue;
  const [lon,lat]=coords;if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180,r=2.03;
  const p=new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.018,9,9),new THREE.MeshBasicMaterial({color:0xf0aa70}));marker.position.copy(p);group.add(marker);count++;
 }
}
function initMap(){
 if(state.map||!window.maplibregl||!$("worldMap"))return;
 const style={version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]};
 state.map=new maplibregl.Map({container:"worldMap",style,center:[state.lon,state.lat],zoom:5.2,minZoom:2,maxZoom:16});
 state.map.addControl(new maplibregl.NavigationControl(),"top-right");
 state.map.on("click",e=>{setLocation(e.lngLat.lat,e.lngLat.lng,"Selected map location");toast("Study area updated")});
}
async function loadOverview(){
 const q=`?lat=${state.lat}&lon=${state.lon}`;
 const calls=await Promise.allSettled([api("/api/health"),api("/api/source-health"+q),api("/api/layers"),api("/api/eonet/events"+q+"&days=30&radius_deg=8"),api("/api/weather"+q),api("/api/fire"+q+"&days=1")]);
 const [health,sources,layers,events,weather,fire]=calls;
 const online=health.status==="fulfilled"&&health.value.ok!==false;setApiStatus(online);
 if(sources.status==="fulfilled"){state.sourceHealth=sources.value;renderProviders(sources.value)}else renderProviders(null);
 if(layers.status==="fulfilled"){state.layers=layers.value.groups||[];const count=state.layers.reduce((s,g)=>s+(g.layers||[]).length,0);$("layerCount").textContent=count||"—"}
 const ev=events.status==="fulfilled"?envelope(events.value):{};state.events=ev.events||ev.features||[];renderEvents(state.events);addMarkers(state.events);
 if(weather.status==="fulfilled")renderWeather(weather.value);else renderWeather(null);
 if(fire.status==="fulfilled")renderFireSignal(fire.value);else renderFireSignal(null);
 if(!online)toast("Dashboard is available; the backend API health check failed. No data is simulated.","error");
}
function renderProviders(payload){
 let list=payload?.sources||payload?.providers||payload?.checks||[];
 if(!Array.isArray(list)&&list&&typeof list==="object")list=Object.entries(list).map(([name,value])=>({name,...(typeof value==="object"?value:{status:value})}));
 if(!Array.isArray(list))list=[];
 const ready=list.filter(s=>classify(s.status||s.state||(s.ok?"connected":""))==="ok").length;
 $("providerCount").textContent=list.length?ready:"—";
 $("providerList").innerHTML=list.length?list.slice(0,6).map(s=>{const st=s.status||s.state||(s.ok?"connected":"unknown");return `<div class="provider-row"><i class="provider-dot ${classify(st)}"></i><b>${esc(s.name||s.source||s.provider||s.service||"Provider")}</b><small>${esc(st)}</small></div>`}).join(""):renderEmpty("Provider health unavailable; sources are not assumed online.");
}
function renderEvents(events){
 const root=$("eventFeed");if(!events.length){root.innerHTML=renderEmpty("No events were returned for this location and time window. This does not imply zero events elsewhere.");return}
 root.innerHTML=events.slice(0,5).map(e=>{const title=e.title||e.name||"Environmental event",cat=e.categories?.[0]?.title||"Natural event",date=e.geometry?.[0]?.date||e.updated||"Date not supplied";return `<div class="event-row"><span class="event-icon"><i data-lucide="activity"></i></span><div><b>${esc(title)}</b><small>${esc(cat)} · ${esc(String(date).slice(0,16))}</small></div><span class="event-meta">NASA EONET<br>EVENT CONTEXT</span></div>`}).join("");icons();
}
function renderWeather(result){
 if(!result){$("tempValue").textContent="—";$("rainValue").textContent="—";$("tempMeta").textContent="Unavailable";$("rainMeta").textContent="Unavailable";return}
 const d=envelope(result),cur=d.current||d,units=d.current_units||{};
 const temp=cur.temperature_2m??cur.temperature,rain=cur.precipitation??cur.rain,humidity=cur.relative_humidity_2m??cur.humidity,wind=cur.wind_speed_10m??cur.wind_speed;
 $("tempValue").textContent=temp==null?"—":n(temp)+"°";$("tempMeta").textContent=result.source||"Provider response";
 $("rainValue").textContent=rain==null?"—":n(rain)+" mm";$("rainMeta").textContent=units.precipitation||"Provider units";
 if($("climateTemp")){$("climateTemp").textContent=temp==null?"—":n(temp)+"°";$("climateHumidity").textContent=humidity==null?"—":n(humidity,0)+"%";$("climateRain").textContent=rain==null?"—":n(rain)+" mm";$("climateWind").textContent=wind==null?"—":n(wind)}
 if($("climateResult"))$("climateResult").innerHTML=renderJson(result);
}
function renderFireSignal(result){
 const d=result?envelope(result):{},rows=d.rows||d.features||d.events||[];
 $("fireValue").textContent=result?rows.length:"—";$("fireMeta").textContent=result?.source||d.source||(result?"Provider response":"Unavailable");
}
function navigate(page){
 state.currentPage=page;
 $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 $$(".page-view").forEach(v=>v.classList.toggle("active",v.dataset.view===page));
 const btn=document.querySelector(`.nav-btn[data-page="${page}"]`);$("crumb").textContent=btn?.querySelector("span")?.textContent||"Mission Control";
 $("scrollArea").scrollTo({top:0,behavior:reduced?"auto":"smooth"});
 if(window.gsap&&!reduced)gsap.fromTo(`[data-view="${page}"] .page-head`,{y:9,opacity:.4},{y:0,opacity:1,duration:.42,ease:"power2.out"});
 if(page==="observatory"||page==="layers")setTimeout(initMap,60);
 if(page==="satellites")loadSatellites();if(page==="layers")loadLayers();if(page==="forest")loadForest();if(page==="fire")loadFire();if(page==="climate")loadClimate();if(page==="systems")loadSystems();
 icons();
}
async function loadSatellites(){
 const root=$("missionGrid");root.innerHTML='<div class="loading">Checking connected mission and satellite data endpoints…</div>';
 const q=`?lat=${state.lat}&lon=${state.lon}`;
 const results=await Promise.allSettled([api("/api/satellite/latest"+q+"&days=45&cloud_lt=70"),api("/api/satellite/sentinel1"+q+"&days=45"),api("/api/satellite/landsat"+q+"&days=90&cloud_lt=70"),api("/api/gibs/catalog"),api("/api/earth-engine/catalog"),api("/api/integrations/open-source")]);
 const defs=[
  ["Sentinel-2 L2A","OPTICAL / MULTISPECTRAL","MSI · Copernicus STAC","High-resolution optical observation and spectral products",results[0]],
  ["Sentinel-1 SAR","RADAR / ALL-WEATHER","C-SAR · ASF / Copernicus","Radar scene discovery for cloud-independent observations",results[1]],
  ["Landsat Collection 2","OPTICAL / THERMAL","OLI / TIRS · USGS catalogue","Historical land observation and thermal archive",results[2]],
  ["NASA GIBS","BROWSE IMAGERY","NASA Earthdata · WMTS","Time-dependent satellite browse imagery layers",results[3]],
  ["Google Earth Engine","EARTH OBSERVATION CATALOGUE","Earth Engine · credential-gated","Configured scientific layer catalogue",results[4]],
  ["Open-source integration registry","DATA CONNECTOR REGISTER","Repository configuration","Runtime and vetted integration components",results[5]]
 ];
 root.innerHTML=defs.map(([name,category,sensor,desc,result])=>{
  const ok=result.status==="fulfilled"&&(result.value.ok!==false);
  const status=result.status==="rejected"?"UNAVAILABLE":result.value.status||result.value.freshness||(ok?"RESPONSE RECEIVED":"NO DATA");
  const cls=classify(status);
  const body=result.status==="fulfilled"?result.value:{error:result.reason?.message};
  return `<article class="mission-card" data-search="${esc((name+" "+category+" "+sensor).toLowerCase())}" data-category="${/sentinel-2|landsat|optical/.test(name.toLowerCase())?"optical":/sentinel-1|radar/.test(name.toLowerCase())?"radar":/gibs/.test(name.toLowerCase())?"thermal": "climate"}"><div class="mission-top"><span class="mission-tag">${esc(category)}</span><span class="state-tag ${cls}">${esc(status)}</span></div><h3>${esc(name)}</h3><p>${esc(desc)}. ${esc(body.source||body.error||"Provider metadata available when connected.")}</p><div class="mission-meta"><span>${esc(sensor)}</span><span>${result.status==="fulfilled"?"Endpoint responded":"Endpoint unavailable"}</span></div><button class="link-btn mission-detail" data-detail="${esc(name)}">VIEW SOURCE RESPONSE <i data-lucide="arrow-up-right"></i></button></article>`;
 }).join("");icons();
 root.querySelectorAll(".mission-detail").forEach(btn=>btn.addEventListener("click",()=>{const i=defs.find(x=>x[0]===btn.dataset.detail);const r=i?.[4];showResult("Mission source response",r?.status==="fulfilled"?r.value:{error:r?.reason?.message})}));
 $("missionStatus").textContent=results.some(r=>r.status==="fulfilled")?"ENDPOINT CHECK COMPLETE":"NO API RESPONSE";
 $("missionSearch").oninput=()=>{const q=$("missionSearch").value.toLowerCase();$$(".mission-card").forEach(c=>c.hidden=!c.dataset.search.includes(q))};
 $("missionFilters").onclick=e=>{const b=e.target.closest("[data-filter]");if(!b)return;$$("#missionFilters button").forEach(x=>x.classList.toggle("selected",x===b));$$(".mission-card").forEach(c=>c.hidden=b.dataset.filter!=="all"&&c.dataset.category!==b.dataset.filter)};
}
function renderResult(target,data){$(target).innerHTML=renderJson(data)}
async function loadLayers(){
 const root=$("layerGroups");root.innerHTML='<div class="loading">Loading connected layer catalogue…</div>';
 try{const data=await api("/api/layers");state.layers=data.groups||[];renderLayers();$("layersStatus").textContent=state.layers.reduce((n,g)=>n+(g.layers||[]).length,0)+" REGISTERED LAYERS"}
 catch(e){root.innerHTML=renderEmpty(e.message);$("layersStatus").textContent="REGISTRY UNAVAILABLE"}
}
function renderLayers(){
 const q=($("layerSearch")?.value||"").toLowerCase(),groups=state.layers||[];
 const filtered=groups.map(g=>({...g,layers:(g.layers||[]).filter(l=>((l.label||"")+" "+(l.source||"")+" "+(l.id||"")).toLowerCase().includes(q))})).filter(g=>g.layers.length);
 $("filterCount").textContent=filtered.reduce((n,g)=>n+g.layers.length,0)+" matching layers";
 $("layerGroups").innerHTML=filtered.length?filtered.map(g=>`<section class="layer-group"><div class="layer-group-head"><b>${esc(g.icon||"◈")} ${esc(g.label||g.name||"Data layers")}</b><small>${g.layers.length} LAYERS</small></div><div class="layer-list">${g.layers.map(l=>`<label class="layer-item"><input type="checkbox" data-layer="${esc(l.id)}"><span><b>${esc(l.label||l.id)}</b><small>${esc(l.source||"Source not supplied")} · ${l.resolution_m==null?"Resolution N/A":esc(l.resolution_m)+" m"}</small></span></label>`).join("")}</div></section>`).join(""):renderEmpty("No layer entries matched this filter.");
 $$("[data-layer]").forEach(input=>input.addEventListener("change",()=>{const l=groups.flatMap(g=>g.layers||[]).find(x=>x.id===input.dataset.layer);if(l){const mode=l.mode||"true_color";if(["true_color","false_color","ndvi","ndmi","nbr","ndwi"].includes(mode)){$("layerMode").value=mode;loadMapLayer()}else toast("Registered layer does not expose a compatible raster preview through the current map endpoint.","error")}input.checked=false}));
}
async function loadMapLayer(){
 initMap();if(!state.map)return toast("MapLibre is unavailable","error");
 const mode=$("layerMode").value,q=`?lat=${state.lat}&lon=${state.lon}&mode=${mode}&days=90&cloud_lt=70`;
 try{const data=await api("/api/map/satellite-layer"+q);if(!data.tile_url)throw new Error("No tile URL returned by the provider");const src="earthscope-overlay",lyr="earthscope-overlay-layer";if(state.map.getLayer(lyr))state.map.removeLayer(lyr);if(state.map.getSource(src))state.map.removeSource(src);state.map.addSource(src,{type:"raster",tiles:[data.tile_url],tileSize:256,attribution:data.attribution||data.source||"Data provider"});state.map.addLayer({id:lyr,type:"raster",source:src,paint:{"raster-opacity":.88}});state.map.flyTo({center:[state.lon,state.lat],zoom:7,duration:800});toast(mode.toUpperCase()+" layer loaded · "+(data.source||"provider"))}
 catch(e){toast(e.message,"error")}
}
async function loadForest(){
 $("forestResult").innerHTML='<div class="loading">Retrieving forest profile and investigation evidence…</div>';
 const q=`?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`;
 const res=await Promise.allSettled([api("/api/forest-profile"+q),api("/api/investigate"+q)]);
 $("forestResult").innerHTML=res.map((r,i)=>`<h3>${i?"Area investigation":"Forest digital profile"}</h3>${r.status==="fulfilled"?renderJson(r.value):`<p>${esc(r.reason.message)}</p>`}`).join("");
 $("forestResultStatus").textContent=res.some(r=>r.status==="fulfilled")?"DATA RECEIVED":"UNAVAILABLE";
}
async function loadFire(){
 $("fireResults").innerHTML='<div class="loading">Querying fire detections and NASA event context…</div>';
 const days=Number($("fireDays").value||1),q=`?lat=${state.lat}&lon=${state.lon}&days=${days}`;
 const res=await Promise.allSettled([api("/api/fire"+q),api("/api/eonet/events"+q+"&radius_deg=8")]);
 const fire=res[0].status==="fulfilled"?envelope(res[0].value):{},events=res[1].status==="fulfilled"?envelope(res[1].value):{};
 const f=fire.rows||fire.features||fire.events||[],ev=events.events||events.features||[];
 $("fireCount").textContent=res[0].status==="fulfilled"?f.length:"—";$("eventCount").textContent=res[1].status==="fulfilled"?ev.length:"—";$("fireProvider").textContent=res[0].status==="fulfilled"?res[0].value.source||res[0].value.freshness||"RESPONDED":"UNAVAILABLE";
 const rows=[...f.slice(0,18).map(x=>({name:x.properties?.acq_date||x.acq_date||"Thermal observation",type:"Satellite fire observation",source:res[0].value?.source||"Fire provider"})),...ev.slice(0,18).map(x=>({name:x.title||"Natural event",type:x.categories?.[0]?.title||"Natural event",source:"NASA EONET"}))];
 $("fireResults").innerHTML=rows.length?rows.map(x=>`<div class="event-row"><span class="event-icon"><i data-lucide="flame"></i></span><div><b>${esc(x.name)}</b><small>${esc(x.type)} · ${esc(x.source)}</small></div></div>`).join(""):renderEmpty("No records returned for this query. This is not proof of zero events.");
 icons();
}
async function loadClimate(){
 $("climateResult").innerHTML='<div class="loading">Retrieving environmental provider data…</div>';
 try{const data=await api(`/api/weather?lat=${state.lat}&lon=${state.lon}`);const d=envelope(data),c=d.current||d;
 $("climateTemp").textContent=c.temperature_2m==null?"—":n(c.temperature_2m)+"°";$("climateHumidity").textContent=c.relative_humidity_2m==null?"—":n(c.relative_humidity_2m,0)+"%";$("climateRain").textContent=(c.precipitation??c.rain)==null?"—":n(c.precipitation??c.rain)+" mm";$("climateWind").textContent=c.wind_speed_10m==null?"—":n(c.wind_speed_10m);
 renderResult("climateResult",data)}
 catch(e){$("climateResult").innerHTML=renderEmpty(e.message)}
}
const actionMap={
 "forest-profile":()=>`/api/forest-profile?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "remote-change":()=>`/api/analysis/remote-change?lat=${state.lat}&lon=${state.lon}&before_date=${iso(new Date(Date.now()-365*86400000))}&after_date=${iso(new Date())}`,
 "vegetation-series":()=>`/api/analysis/vegetation-series?lat=${state.lat}&lon=${state.lon}&start=${iso(new Date(Date.now()-3*365*86400000))}&end=${iso(new Date())}&max_observations=12&cloud_lt=50`,
 "forest-doctor":()=>`/api/intelligence/forest-doctor?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "anomaly-radar":()=>`/api/intelligence/anomaly-radar?lat=${state.lat}&lon=${state.lon}`,
 "risk":()=>`/api/intelligence/risk?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "what-if":()=>`/api/intelligence/what-if-location?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "patrol":()=>`/api/patrol/live?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "intervention":()=>`/api/intelligence/intervention?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`,
 "recovery":()=>`/api/intelligence/recovery?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`
};
async function runAction(action){
 const path=actionMap[action];if(!path)return toast("Analysis route not registered","error");
 const target=["forest-profile","remote-change","vegetation-series"].includes(action)?"forestResult":["forest-doctor","anomaly-radar","risk","what-if"].includes(action)?"intelligenceResult":"operationsResult";
 if(target==="forestResult")navigate("forest");else if(target==="intelligenceResult")navigate("intelligence");else navigate("operations");
 $(target).innerHTML='<div class="loading">Running backend analysis…</div>';
 try{const data=await api(path());renderResult(target,data);toast("Analysis response received")}
 catch(e){$(target).innerHTML=renderEmpty(e.message);toast("Analysis unavailable: "+e.message,"error")}
}
async function loadSystems(){
 $("systemResults").innerHTML='<div class="loading">Checking backend and data-provider health…</div>';
 const q=`?lat=${state.lat}&lon=${state.lon}`;
 const r=await Promise.allSettled([api("/api/health"),api("/api/source-health"+q),api("/api/features/status"),api("/api/fallbacks/status")]);
 const health=r[0].status==="fulfilled"?r[0].value:null,sources=r[1].status==="fulfilled"?r[1].value:null,features=r[2].status==="fulfilled"?r[2].value:null;
 $("apiHealth").textContent=health?.ok?"RESPONDING":"UNAVAILABLE";$("apiHealthMeta").textContent=health?.service||"Health check failed";
 let arr=sources?.sources||sources?.providers||sources?.checks||[];if(!Array.isArray(arr)&&arr&&typeof arr==="object")arr=Object.entries(arr).map(([name,x])=>({name,...(typeof x==="object"?x:{status:x})}));
 $("sourceTotal").textContent=arr.length||"—";$("featureTotal").textContent=features?.count??features?.features?.length??"—";
 $("systemResults").innerHTML=arr.length?arr.map(x=>{const s=x.status||x.state||(x.ok?"connected":"unknown");return `<div class="system-row"><i class="provider-dot ${classify(s)}"></i><b>${esc(x.name||x.source||x.provider||x.service||"Provider")}</b><small>${esc(x.capabilities||x.detail||x.type||"Capability metadata not supplied")}</small><span class="state-tag ${classify(s)}">${esc(s)}</span></div>`}).join(""):renderEmpty("Provider health returned no records or is unavailable.");
 $("featureResults").innerHTML=features?.features?.length?features.features.map(x=>`<div class="feature-pill"><b>${esc(x.name||x.label||x.id||"Capability")}</b><small>${esc(x.status||x.runtime_status||"Status not supplied")}</small></div>`).join(""):renderEmpty("Feature capability registry unavailable.");
}
async function runTrend(){
 const start=$("trendStart").value,end=$("trendEnd").value;if(!start||!end||start>=end)return toast("Choose a valid start/end period","error");
 $("trendStatus").textContent="RUNNING";$("trendResult").innerHTML='<div class="loading">Requesting real vegetation observations…</div>';
 try{const data=await api(`/api/analysis/vegetation-series?lat=${state.lat}&lon=${state.lon}&start=${start}&end=${end}&max_observations=16&cloud_lt=${Number($("trendCloud").value)}`);renderResult("trendResult",data);$("trendStatus").textContent="RESPONSE RECEIVED"}
 catch(e){$("trendResult").innerHTML=renderEmpty(e.message);$("trendStatus").textContent="UNAVAILABLE"}
}
async function report(){
 $("reportResult").innerHTML='<div class="loading">Generating report from available evidence…</div>';
 try{const data=await api(`/api/report/investigation?lat=${state.lat}&lon=${state.lon}&place=${encodeURIComponent(state.place)}`);renderResult("reportResult",data);toast("Report response received")}
 catch(e){$("reportResult").innerHTML=renderEmpty(e.message);toast("Report generation failed","error")}
}
async function geocode(q){
 if(!q||q.trim().length<2)return;
 try{const d=await api("/api/geocode?q="+encodeURIComponent(q.trim()));const x=envelope(d),arr=Array.isArray(x)?x:x.features||x.results||x.items||[x],m=arr.find(z=>z.lat!=null&&z.lon!=null)||arr[0];const lat=Number(m?.lat??m?.geometry?.coordinates?.[1]),lon=Number(m?.lon??m?.geometry?.coordinates?.[0]);if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("Geocoder did not return valid coordinates");setLocation(lat,lon,m.display_name||m.name||q);toast("Study area updated from geocoder")}
 catch(e){toast(e.message,"error")}
}
function bind(){
 $$("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
 $$("[data-action]").forEach(b=>b.addEventListener("click",()=>runAction(b.dataset.action)));
 $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
 $("refreshHealth").addEventListener("click",()=>loadOverview().then(()=>toast("Source health refreshed")));
 $("aboutBtn").addEventListener("click",()=>$("aboutDialog").showModal());
 $("changeRegion").addEventListener("click",()=>{$("regionInputName").value=state.place;$("regionInputLat").value=state.lat;$("regionInputLon").value=state.lon;$("regionDialog").showModal()});
 $("saveRegion").addEventListener("click",e=>{e.preventDefault();setLocation(Number($("regionInputLat").value),Number($("regionInputLon").value),$("regionInputName").value);$("regionDialog").close();loadOverview()});
 $("applyMapCoords").addEventListener("click",()=>{setLocation(Number($("mapLat").value),Number($("mapLon").value),$("placeSearch").value||"Selected coordinates");if(state.map)state.map.flyTo({center:[state.lon,state.lat],zoom:7})});
 $("placeSearchBtn").addEventListener("click",()=>geocode($("placeSearch").value));
 $("mapReload").addEventListener("click",()=>{state.map?.resize();loadMapLayer()});
 $("applyLayerMode").addEventListener("click",loadMapLayer);
 $$("[data-mode]").forEach(b=>b.addEventListener("click",()=>{$("layerMode").value=b.dataset.mode;loadMapLayer()}));
 $("missionSearch").addEventListener("input",()=>{const q=$("missionSearch").value.toLowerCase();$$(".mission-card").forEach(c=>c.hidden=!c.dataset.search.includes(q))});
 $("missionFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;$$("#missionFilters button").forEach(x=>x.classList.toggle("selected",x===b));$$(".mission-card").forEach(c=>c.hidden=b.dataset.filter!=="all"&&c.dataset.category!==b.dataset.filter)});
 $("layerSearch").addEventListener("input",renderLayers);
 $("runInvestigation").addEventListener("click",loadForest);
 $("fireDays").addEventListener("change",loadFire);$("refreshFire").addEventListener("click",loadFire);
 $("refreshClimate").addEventListener("click",loadClimate);$("refreshSystems").addEventListener("click",loadSystems);
 $("runTrend").addEventListener("click",runTrend);$("generateReport").addEventListener("click",report);
 $("globalSearch").addEventListener("keydown",e=>{if(e.key==="Enter")geocode(e.target.value);if(e.key==="Escape")e.target.blur()});
 $("globalSearch").addEventListener("focus",()=>$("globalSearch").parentElement.classList.add("expanded"));
 $("globalSearch").addEventListener("blur",()=>setTimeout(()=>$("globalSearch").parentElement.classList.remove("expanded"),180));
 window.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("globalSearch").focus()}});
}
function clock(){const update=()=>{$("utcClock").textContent=new Date().toISOString().slice(11,19)+" UTC"};update();setInterval(update,1000)}
async function boot(){
 icons();clock();bind();setLocation(state.lat,state.lon,state.place);
 try{initEarth()}catch(e){$("textureStatus").textContent="3D RENDERER UNAVAILABLE";console.error(e)}
 if(!reduced&&window.gsap){gsap.from(".sidebar",{x:-12,opacity:0,duration:.6,ease:"power3.out"});gsap.from(".topbar",{y:-10,opacity:0,duration:.5,delay:.06});gsap.from(".globe-panel",{y:15,opacity:0,duration:.75,delay:.12,ease:"power3.out"});gsap.from(".hero-side .panel",{y:12,opacity:0,duration:.6,stagger:.1,delay:.22})}
 $("trendEnd").value=iso(new Date());$("trendStart").value=iso(new Date(Date.now()-3*365*86400000));
 await loadOverview();navigate("overview");
}
document.addEventListener("DOMContentLoaded",boot);
