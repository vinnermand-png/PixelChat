import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { GRID, TH, TW, VIEW_H, VIEW_W, drawTorvetGround, iso, unIso } from "@/components/pixel/world";

type Tool = "place" | "select" | "erase";
type StartMode = "empty" | "grass" | "test";
type Category = "nature" | "building" | "furniture" | "character" | "effect";
type Settings = { tileW:number; tileH:number; grid:number; startMode:StartMode; pixelScale:number; smoothing:boolean; snap:boolean };
type Obj = { id:string; assetId:string; gx:number; gy:number };
type Spec = { key:string; label:string; cat:Category; prompt:string; w:number; h:number };
type Draft = { id:string; variant:number; spec:Spec; title:string; note:string; prompt:string; preview:string };
type Asset = { id:string; title:string; image:string; spec:Spec };
type Check = { name:string; ok:boolean; detail:string };
type Validation = { checks:Check[]; ok:boolean; normalized?:string };

const SETTINGS_KEY = "pixelchat-platform-settings-v1";
const PROJECT_KEY = "pixelchat-game-maker-project-v2";
const LIB_KEY = "pixelchat-game-maker-ai-library-v4";
const CACHE_KEY = "pixelchat-game-maker-ai-cache-v3";
const DEFAULT_SETTINGS:Settings = { tileW:32, tileH:16, grid:14, startMode:"empty", pixelScale:1, smoothing:false, snap:true };

const specs:Spec[] = [
  {cat:"nature",key:"tree",label:"TREE",prompt:"A natural forest tree",w:64,h:96},{cat:"nature",key:"pine",label:"PINE TREE",prompt:"A tall compact pine tree",w:56,h:96},{cat:"nature",key:"bush",label:"BUSH",prompt:"A compact green forest bush",w:48,h:40},{cat:"nature",key:"plant",label:"PLANT",prompt:"A small green forest plant",w:28,h:36},{cat:"nature",key:"flower",label:"FLOWER",prompt:"A small colorful wild flower",w:22,h:28},{cat:"nature",key:"mushroom",label:"MUSHROOM",prompt:"A small forest mushroom",w:24,h:24},{cat:"nature",key:"rock",label:"ROCK",prompt:"A compact natural grey rock",w:36,h:28},{cat:"nature",key:"boulder",label:"BOULDER",prompt:"A rounded natural boulder",w:48,h:36},{cat:"nature",key:"log",label:"LOG",prompt:"A fallen forest log",w:48,h:24},{cat:"nature",key:"stump",label:"TREE STUMP",prompt:"A small cut tree stump",w:34,h:30},{cat:"nature",key:"crystal",label:"CRYSTAL",prompt:"A small magical crystal formation",w:34,h:42},{cat:"nature",key:"water",label:"WATER DETAIL",prompt:"A small pixel water detail",w:48,h:24},
  {cat:"building",key:"house",label:"HOUSE",prompt:"A small cozy game house",w:96,h:96},{cat:"building",key:"cabin",label:"CABIN",prompt:"A rustic wooden forest cabin",w:96,h:96},{cat:"building",key:"shop",label:"SHOP",prompt:"A small fantasy game shop",w:96,h:96},{cat:"building",key:"tavern",label:"TAVERN",prompt:"A warm fantasy tavern",w:104,h:104},{cat:"building",key:"bridge",label:"BRIDGE",prompt:"A small wooden bridge",w:80,h:52},{cat:"building",key:"tower",label:"TOWER",prompt:"A compact stone tower",w:72,h:112},
  {cat:"furniture",key:"table",label:"TABLE",prompt:"A simple wooden table",w:44,h:40},{cat:"furniture",key:"chair",label:"CHAIR",prompt:"A simple wooden chair",w:32,h:46},{cat:"furniture",key:"bed",label:"BED",prompt:"A simple cozy bed",w:56,h:40},{cat:"furniture",key:"chest",label:"CHEST",prompt:"A small treasure chest",w:34,h:28},{cat:"furniture",key:"barrel",label:"BARREL",prompt:"A small wooden barrel",w:28,h:34},{cat:"furniture",key:"bench",label:"BENCH",prompt:"A simple wooden bench",w:56,h:34},
  {cat:"character",key:"player",label:"PLAYER",prompt:"A friendly game player character",w:32,h:48},{cat:"character",key:"npc",label:"NPC",prompt:"A friendly fantasy town NPC",w:32,h:48},{cat:"character",key:"merchant",label:"MERCHANT",prompt:"A fantasy merchant",w:32,h:48},{cat:"character",key:"farmer",label:"FARMER",prompt:"A friendly farmer",w:32,h:48},{cat:"character",key:"guard",label:"GUARD",prompt:"A fantasy town guard",w:32,h:48},
  {cat:"effect",key:"fire",label:"FIRE",prompt:"A small magical fire effect",w:32,h:44},{cat:"effect",key:"smoke",label:"SMOKE",prompt:"A small pixel smoke effect",w:32,h:44},{cat:"effect",key:"sparkles",label:"SPARKLES",prompt:"A small magical sparkle effect",w:34,h:34},{cat:"effect",key:"splash",label:"WATER SPLASH",prompt:"A small water splash effect",w:40,h:34},{cat:"effect",key:"dust",label:"DUST",prompt:"A small dust puff effect",w:40,h:28}
];

const categories:Category[] = ["nature","building","furniture","character","effect"];
const labels:Record<Category,string> = {nature:"NATURE",building:"BUILDING",furniture:"FURNITURE",character:"CHARACTER",effect:"EFFECT"};
const first = specs[0];
const variants = ["compact readable silhouette","balanced proportions and clean shape","more organic asymmetrical shape","strongest game-readable silhouette"];

function makePreview(s:Spec,v:number){
  const n=v-1;
  let shape="";
  if(s.key==="rock"||s.key==="boulder"){
    const pts=["42,92 60,48 92,32 132,48 152,90 118,108 64,108","34,92 62,52 100,26 138,48 158,88 120,110 58,108","44,94 58,42 88,22 128,44 154,86 134,110 70,110","30,92 64,48 102,18 142,46 164,86 118,112 54,108"][n];
    shape=`<polygon points="${pts}" fill="#66717a" stroke="#1f2933" stroke-width="6"/><polygon points="58,60 94,40 124,54 90,70" fill="#c6c9c7"/><polygon points="70,80 104,72 132,88 80,100" fill="#46515b"/>`;
  } else if(s.cat==="nature") shape=`<rect x="88" y="76" width="20" height="42" fill="#7a4b31"/><circle cx="96" cy="52" r="${34+n*3}" fill="#4f9137" stroke="#173b2a" stroke-width="6"/><circle cx="68" cy="68" r="25" fill="#67ad46"/><circle cx="124" cy="66" r="27" fill="#5b9c3c"/>`;
  else if(s.cat==="building") shape=`<rect x="48" y="64" width="98" height="54" fill="#a86b3d" stroke="#2b1b18" stroke-width="6"/><polygon points="38,66 96,24 156,66" fill="#6b3b32" stroke="#2b1b18" stroke-width="6"/>`;
  else if(s.cat==="character") shape=`<circle cx="96" cy="42" r="22" fill="#e2b08b" stroke="#33231f" stroke-width="6"/><rect x="70" y="66" width="52" height="46" fill="#4f7da8" stroke="#1f2933" stroke-width="6"/><rect x="64" y="108" width="26" height="24" fill="#263a4f"/><rect x="102" y="108" width="26" height="24" fill="#263a4f"/>`;
  else if(s.cat==="effect") shape=`<polygon points="96,14 118,60 106,60 136,118 96,98 56,118 86,60 74,60" fill="#f0c14b" stroke="#8f3f25" stroke-width="6"/><polygon points="96,44 110,78 96,72 80,96 90,66 78,66" fill="#ff7b38"/>`;
  else shape=`<ellipse cx="96" cy="78" rx="58" ry="32" fill="#8b5a3c" stroke="#2b1b18" stroke-width="6"/>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 140" shape-rendering="crispEdges"><rect width="192" height="140" fill="#101827"/>${shape}<text x="8" y="14" fill="#7dd3fc" font-family="monospace" font-size="9">${s.w}×${s.h} PX · VARIANT ${v}</text></svg>`)}`;
}

const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("IMAGE LOAD FAILED"));image.src=src});
async function validateAndNormalize(src:string,s:Spec):Promise<Validation>{
  const image=await loadImage(src);
  const source=document.createElement("canvas"); source.width=image.naturalWidth; source.height=image.naturalHeight;
  const ctx=source.getContext("2d",{willReadFrequently:true}); if(!ctx) throw new Error("CANVAS VALIDATOR UNAVAILABLE");
  ctx.imageSmoothingEnabled=false; ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,source.width,source.height).data;
  let minX=source.width,minY=source.height,maxX=-1,maxY=-1,opaque=0,edgeOpaque=0;
  for(let y=0;y<source.height;y++) for(let x=0;x<source.width;x++){ const a=data[(y*source.width+x)*4+3]; if(a>16){opaque++; if(x<2||y<2||x>source.width-3||y>source.height-3) edgeOpaque++; minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);} }
  const has=maxX>=minX&&maxY>=minY, contentW=has?maxX-minX+1:0, contentH=has?maxY-minY+1:0;
  const transparent=has&&edgeOpaque/Math.max(1,opaque)<0.03;
  const checks:Check[]=[
    {name:"PNG READ",ok:image.naturalWidth>0&&image.naturalHeight>0,detail:`SOURCE ${image.naturalWidth} × ${image.naturalHeight}`},
    {name:"TRANSPARENT BACKGROUND",ok:transparent,detail:transparent?"CLEAN EDGE DETECTED":"OPAQUE BACKGROUND TOUCHES EDGE"},
    {name:"SINGLE ASSET BOUNDS",ok:has&&contentW>2&&contentH>2,detail:has?`CROPPED CONTENT ${contentW} × ${contentH}`:"NO VISIBLE ASSET"},
    {name:"PLATFORM SIZE CONTRACT",ok:true,detail:`NORMALIZED TO ${s.w} × ${s.h}`},
    {name:"BOTTOM-CENTER ANCHOR",ok:true,detail:"APPLIED"},
    {name:"PIXEL PERFECT IMPORT",ok:true,detail:"SMOOTHING OFF"}
  ];
  if(!has||!transparent) return {checks,ok:false};
  const target=document.createElement("canvas"); target.width=s.w; target.height=s.h;
  const out=target.getContext("2d"); if(!out) throw new Error("NORMALIZER UNAVAILABLE");
  out.imageSmoothingEnabled=false; out.clearRect(0,0,s.w,s.h);
  const scale=Math.min((s.w-2)/contentW,(s.h-2)/contentH),dw=Math.max(1,Math.round(contentW*scale)),dh=Math.max(1,Math.round(contentH*scale));
  out.drawImage(source,minX,minY,contentW,contentH,Math.round((s.w-dw)/2),s.h-dh,dw,dh);
  return {checks,ok:true,normalized:target.toDataURL("image/png")};
}

export const Route=createFileRoute("/game-maker")({component:GameMaker});

function GameMaker(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const imageCache=useRef<Record<string,HTMLImageElement>>({});
  const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated,setHydrated]=useState(false);
  const [tool,setTool]=useState<Tool>("place");
  const [selected,setSelected]=useState("tree");
  const [objects,setObjects]=useState<Obj[]>([]);
  const [library,setLibrary]=useState<Asset[]>([]);
  const [hover,setHover]=useState<{gx:number;gy:number}|null>(null);
  const [status,setStatus]=useState("READY · CLEAN PROJECT · OBJECTS 0 · ASSETS 0");
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [factoryOpen,setFactoryOpen]=useState(false);
  const [cat,setCat]=useState<Category>("nature");
  const [specKey,setSpecKey]=useState(first.key);
  const [search,setSearch]=useState("");
  const [prompt,setPrompt]=useState(first.prompt);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [selectedDraft,setSelectedDraft]=useState<string|null>(null);
  const [image,setImage]=useState<string|null>(null);
  const [validation,setValidation]=useState<Validation|null>(null);
  const [generatedId,setGeneratedId]=useState<string|null>(null);
  const [generating,setGenerating]=useState(false);
  const [error,setError]=useState("");

  const spec=specs.find(s=>s.key===specKey)||first;
  const visible=useMemo(()=>specs.filter(s=>s.cat===cat&&s.label.toLowerCase().includes(search.toLowerCase())),[cat,search]);
  const draft=drafts.find(d=>d.id===selectedDraft)||null;
  const ready=generatedId===selectedDraft&&!!image&&validation?.ok;

  const cacheImage=(id:string,src:string)=>{const img=new Image();img.onload=()=>{imageCache.current[id]=img;draw();};img.src=src;imageCache.current[id]=img;};

  useEffect(()=>{
    try{
      const savedSettings=localStorage.getItem(SETTINGS_KEY);
      if(savedSettings){ const parsed=JSON.parse(savedSettings); setSettings({...DEFAULT_SETTINGS,...parsed}); }
      else {
        localStorage.setItem(SETTINGS_KEY,JSON.stringify(DEFAULT_SETTINGS));
        localStorage.removeItem(PROJECT_KEY);
        localStorage.removeItem(LIB_KEY);
        localStorage.removeItem("pixelchat-game-maker-v1");
        localStorage.removeItem("pixelchat-game-maker-ai-library-v3");
        setStatus("READY · FIRST RUN · CLEAN PROJECT");
      }
      const savedProject=JSON.parse(localStorage.getItem(PROJECT_KEY)||"null");
      if(savedProject?.objects&&Array.isArray(savedProject.objects)) setObjects(savedProject.objects);
      const savedLibrary=JSON.parse(localStorage.getItem(LIB_KEY)||"[]");
      if(Array.isArray(savedLibrary)){ setLibrary(savedLibrary); savedLibrary.forEach((a:Asset)=>cacheImage(a.id,a.image)); }
    }catch{ setStatus("READY · CLEAN PROJECT"); }
    setHydrated(true);
  },[]);

  useEffect(()=>{ if(hydrated) localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); },[settings,hydrated]);
  useEffect(()=>{ if(hydrated) localStorage.setItem(PROJECT_KEY,JSON.stringify({objects})); },[objects,hydrated]);
  useEffect(()=>{ if(hydrated) localStorage.setItem(LIB_KEY,JSON.stringify(library)); },[library,hydrated]);

  const draw=()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,VIEW_W,VIEW_H); ctx.fillStyle="#101827";ctx.fillRect(0,0,VIEW_W,VIEW_H);
    if(settings.startMode!=="empty") drawTorvetGround(ctx);
    else {
      ctx.strokeStyle="#26354a";ctx.lineWidth=1;
      for(let x=0;x<=settings.grid;x++) for(let y=0;y<=settings.grid;y++){
        if(x===settings.grid||y===settings.grid) continue;
        const p=iso(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+TW/2,p.y+TH/2);ctx.lineTo(p.x,p.y+TH);ctx.lineTo(p.x-TW/2,p.y+TH/2);ctx.closePath();ctx.stroke();
      }
    }
    [...objects].sort((a,b)=>a.gx+a.gy-b.gx-b.gy).forEach(o=>{const asset=library.find(a=>a.id===o.assetId);const img=imageCache.current[o.assetId];if(asset&&img?.complete&&img.naturalWidth){const p=iso(o.gx,o.gy);ctx.drawImage(img,Math.round(p.x-asset.spec.w/2),Math.round(p.y+TH-asset.spec.h),asset.spec.w,asset.spec.h);}});
    if(hover){const p=iso(hover.gx,hover.gy);ctx.strokeStyle="#f0c14b";ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+TW/2,p.y+TH/2);ctx.lineTo(p.x,p.y+TH);ctx.lineTo(p.x-TW/2,p.y+TH/2);ctx.closePath();ctx.stroke();}
  };
  useEffect(()=>{draw();},[objects,library,hover,settings]);

  const resetFactory=()=>{setDrafts([]);setSelectedDraft(null);setImage(null);setValidation(null);setGeneratedId(null);setError("");};
  const chooseCat=(next:Category)=>{const nextSpec=specs.find(s=>s.cat===next)||first;setCat(next);setSpecKey(nextSpec.key);setPrompt(nextSpec.prompt);setSearch("");resetFactory();};
  const chooseSpec=(next:Spec)=>{setSpecKey(next.key);setPrompt(next.prompt);resetFactory();};
  const generateBlueprints=()=>{const base=prompt.trim()||spec.prompt;const next=variants.map((note,index)=>({id:`draft-${Date.now()}-${index}`,variant:index+1,spec,title:`${spec.label} VARIANT ${String(index+1).padStart(2,"0")}`,note,prompt:`${base}. ${note}.`,preview:makePreview(spec,index+1)}));setDrafts(next);setSelectedDraft(next[0].id);setImage(null);setValidation(null);setGeneratedId(null);setError("");};

  const generateReal=async()=>{
    if(!draft) return;
    setGenerating(true);setError("");setImage(null);setValidation(null);setGeneratedId(null);
    const cacheKey=`${draft.spec.key}|${draft.prompt}`;
    try{
      const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||"{}");
      if(saved[cacheKey]?.image){ const result=await validateAndNormalize(saved[cacheKey].image,draft.spec);setImage(result.normalized||saved[cacheKey].image);setValidation(result);setGeneratedId(draft.id);setGenerating(false);return; }
      const response=await fetch("/api/generate-asset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:draft.prompt})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"GENERATION FAILED");
      const src=`data:image/png;base64,${data.imageBase64}`;
      const result=await validateAndNormalize(src,draft.spec);
      setImage(result.normalized||src);setValidation(result);setGeneratedId(draft.id);
      if(result.ok){ saved[cacheKey]={image:result.normalized||src,savedAt:Date.now()};localStorage.setItem(CACHE_KEY,JSON.stringify(saved)); }
    }catch(e){setError(e instanceof Error?e.message:"GENERATION FAILED");}finally{setGenerating(false);}
  };

  const acceptToLibrary=()=>{
    if(!draft||!ready||!image) return;
    const id=`ai-${Date.now()}`;const asset:Asset={id,title:draft.title,image,spec:draft.spec};setLibrary(prev=>[asset,...prev]);cacheImage(id,image);setSelected(id);setStatus(`IMPORTED ${draft.title} · VALIDATED ${draft.spec.w} × ${draft.spec.h}`);setFactoryOpen(false);resetFactory();
  };

  const newProject=()=>{
    if(!window.confirm("Start a new clean project? Current placed objects and AI library will be cleared.")) return;
    setObjects([]);setLibrary([]);imageCache.current={};setSelected("tree");setTool("place");setHover(null);setStatus("READY · NEW CLEAN PROJECT · OBJECTS 0 · ASSETS 0");
  };
  const clearWorld=()=>{setObjects([]);setStatus("WORLD CLEARED · OBJECTS 0");};
  const saveProject=()=>{localStorage.setItem(PROJECT_KEY,JSON.stringify({objects}));localStorage.setItem(LIB_KEY,JSON.stringify(library));setStatus(`PROJECT SAVED · OBJECTS ${objects.length} · ASSETS ${library.length}`);};
  const cell=(e:React.PointerEvent<HTMLCanvasElement>)=>{const canvas=canvasRef.current;if(!canvas)return null;const rect=canvas.getBoundingClientRect();const u=unIso(((e.clientX-rect.left)/rect.width)*VIEW_W,((e.clientY-rect.top)/rect.height)*VIEW_H);const gx=Math.round(u.gx),gy=Math.round(u.gy);return gx<0||gy<0||gx>=settings.grid||gy>=settings.grid?null:{gx,gy};};
  const pointer=(e:React.PointerEvent<HTMLCanvasElement>,click=false)=>{const p=cell(e);setHover(p);if(!click||!p)return;if(tool==="place"){if(!library.some(a=>a.id===selected)){setStatus("SELECT A VALIDATED ASSET FROM LIBRARY FIRST");return;}setObjects(prev=>[...prev,{id:`obj-${Date.now()}`,assetId:selected,gx:p.gx,gy:p.gy}]);setStatus(`PLACED · GRID ${p.gx}, ${p.gy}`);}else if(tool==="erase"){setObjects(prev=>prev.filter(o=>!(o.gx===p.gx&&o.gy===p.gy)));setStatus(`ERASED CELL · GRID ${p.gx}, ${p.gy}`);}else setStatus(`SELECT · GRID ${p.gx}, ${p.gy}`);};

  return <div style={{minHeight:"100vh",background:"#0b1320",color:"#d7e0ec",fontFamily:"monospace",padding:8}}>
    <div style={panel({display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"14px 16px"})}>
      <div><div style={{fontSize:30,fontWeight:900,color:"#f0c14b"}}>PIXEL<span style={{color:"#46b9d1"}}>GAME</span> MAKER</div><div style={{color:"#8fa0b8"}}>PIXELCHAT PLATFORM V1 · PRECISION EDITOR · ASSET CONTRACT SYSTEM</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Button onClick={newProject}>NEW</Button><Button onClick={()=>setSettingsOpen(true)}>SETTINGS</Button><Button onClick={()=>setFactoryOpen(true)}>AI FACTORY</Button><Button onClick={saveProject}>SAVE</Button><Button onClick={clearWorld}>CLEAR</Button><Button>PLAY CHAT</Button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr 280px",gap:10}}>
      <div style={panel({padding:10})}>
        <h2 style={heading}>ASSET LIBRARY <button onClick={()=>setFactoryOpen(true)} style={smallButton}>+ AI</button></h2>
        {library.length===0?<div style={empty}>NO ASSETS YET<br/>Start clean. Generate only what you need.</div>:library.map(a=><button key={a.id} onClick={()=>setSelected(a.id)} style={{...assetButton,borderColor:selected===a.id?"#f0c14b":"#42536c"}}><img src={a.image} style={{width:42,height:42,objectFit:"contain",imageRendering:"pixelated"}}/><span>{a.title}<small>{a.spec.w} × {a.spec.h} PX · VALIDATED</small></span></button>)}
        <hr style={hr}/><h3 style={heading}>TOOLS</h3>
        {(["place","select","erase"] as Tool[]).map(t=><button key={t} onClick={()=>setTool(t)} style={{...toolButton,outline:tool===t?"2px solid #f0c14b":"none"}}>{t.toUpperCase()}</button>)}
      </div>
      <div style={panel({padding:10})}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"0 0 8px",color:"#9aabc0"}}><b>LIVE ISO WORLD · {settings.startMode.toUpperCase()}</b><b>MOVE OVER MAP</b></div>
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} onPointerMove={e=>pointer(e)} onPointerLeave={()=>setHover(null)} onPointerDown={e=>pointer(e,true)} style={{width:"100%",height:"auto",border:"2px solid #35455c",imageRendering:"pixelated",touchAction:"none",cursor:"crosshair"}}/>
        <div style={{paddingTop:8,color:"#91a0b4"}}>{status}</div>
      </div>
      <div style={panel({padding:14})}><h2 style={heading}>PLATFORM INSPECTOR</h2><Info label="TILE" value={`${settings.tileW} × ${settings.tileH} PX`}/><Info label="GRID" value={`${settings.grid} × ${settings.grid}`}/><Info label="WORLD" value={settings.startMode.toUpperCase()}/><Info label="RENDERING" value="PIXEL PERFECT"/><Info label="SMOOTHING" value={settings.smoothing?"ON":"OFF"}/><Info label="SNAP" value={settings.snap?"ON":"OFF"}/><hr style={hr}/><Info label="SELECTED" value={selected}/><Info label="OBJECTS" value={String(objects.length)}/><Info label="AI LIBRARY" value={String(library.length)}/></div>
    </div>

    {settingsOpen&&<div style={overlay}><div style={{...panel({width:"min(900px,96vw)",padding:20}),maxHeight:"90vh",overflow:"auto"}}><div style={modalHead}><h1 style={{...heading,fontSize:24}}>PLATFORM SETTINGS</h1><Button onClick={()=>setSettingsOpen(false)}>CLOSE</Button></div><p style={{color:"#9aabc0"}}>These are the global rules for your whole game project. AI generation reads the asset contracts automatically.</p><div style={settingsGrid}>
      <section style={section}><h3 style={heading}>WORLD SETTINGS</h3><Select label="WORLD START" value={settings.startMode} options={["empty","grass","test"]} onChange={v=>setSettings(s=>({...s,startMode:v as StartMode}))}/><NumberInput label="GRID SIZE" value={settings.grid} min={6} max={40} onChange={v=>setSettings(s=>({...s,grid:v}))}/><div style={hint}>EMPTY = completely clean platform. GRASS = current test terrain.</div></section>
      <section style={section}><h3 style={heading}>PIXEL SETTINGS</h3><NumberInput label="PIXEL SCALE" value={settings.pixelScale} min={1} max={4} onChange={v=>setSettings(s=>({...s,pixelScale:v}))}/><Toggle label="PIXEL PERFECT" value={!settings.smoothing} onChange={v=>setSettings(s=>({...s,smoothing:!v}))}/><Toggle label="GRID SNAP" value={settings.snap} onChange={v=>setSettings(s=>({...s,snap:v}))}/><div style={hint}>Recommended: Pixel Perfect ON · Smoothing OFF · Snap ON.</div></section>
      <section style={section}><h3 style={heading}>ASSET CONTRACTS</h3><div style={contracts}>{specs.map(s=><div key={s.key}><b>{s.label}</b><span>{s.w} × {s.h} PX · BOTTOM CENTER</span></div>)}</div></section>
    </div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><Button onClick={newProject}>NEW CLEAN PROJECT</Button><Button onClick={()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setStatus("SETTINGS SAVED");setSettingsOpen(false)}}>SAVE SETTINGS</Button></div></div></div>}

    {factoryOpen&&<div style={overlay}><div style={{...panel({width:"min(1400px,98vw)",padding:16}),maxHeight:"94vh",overflow:"auto"}}><div style={modalHead}><div><h1 style={{...heading,fontSize:28}}>AI ASSET FACTORY</h1><div style={{color:"#9aabc0"}}>GENERATE BLUEPRINTS FIRST · ONLY CREATE A REAL IMAGE WHEN YOU APPROVE</div></div><Button onClick={()=>setFactoryOpen(false)}>CLOSE</Button></div><div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:12}}><aside style={panel({padding:12})}><h3 style={heading}>1. ASSET TYPE</h3>{categories.map(c=><button key={c} onClick={()=>chooseCat(c)} style={cat===c?activeChoice:choice}>{labels[c]}</button>)}<hr style={hr}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SEARCH..." style={input}/><h3 style={heading}>2. PICK BASE ASSET</h3><div style={{maxHeight:420,overflow:"auto"}}>{visible.map(s=><button key={s.key} onClick={()=>chooseSpec(s)} style={specKey===s.key?activeChoice:choice}>{s.label}</button>)}</div></aside><main><div style={panel({padding:12})}><h3 style={heading}>DESCRIBE THE ASSET</h3><textarea value={prompt} onChange={e=>{setPrompt(e.target.value);resetFactory();}} style={{...input,minHeight:110,resize:"vertical"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"10px 0"}}><div style={section}><b style={{color:"#f0c14b"}}>AUTOMATIC PLATFORM RULES</b><div>OUTPUT: {spec.w} × {spec.h} PX</div><div>ANCHOR: BOTTOM CENTER</div><div>BACKGROUND: TRANSPARENT</div><div>PIXEL STYLE: HARD / NO AA</div></div><div style={section}><b style={{color:"#f0c14b"}}>CREDIT SAVER</b><div>Blueprint previews are free.</div><div>Only the approved variant calls the image API.</div><div>Matching validated prompts are cached locally.</div></div></div><Button onClick={generateBlueprints} style={{width:"100%"}}>GENERATE 4 {spec.label} VARIANTS</Button></div>
      {drafts.length>0&&<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><h2 style={heading}>GENERATED BLUEPRINTS</h2><Button onClick={generateReal} disabled={!draft||generating}>{generating?"GENERATING...":"APPROVE SELECTED"}</Button></div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>{drafts.map(d=><button key={d.id} onClick={()=>{setSelectedDraft(d.id);setImage(null);setValidation(null);setGeneratedId(null);setError("");}} style={{...draft.id===selectedDraft?activeDraft:draftCard,textAlign:"left"}}><img src={d.preview} style={{width:"100%",height:120,objectFit:"contain",imageRendering:"pixelated"}}/><b>{d.title}</b><div style={{color:"#9aabc0",fontSize:12}}>{d.note}</div><div style={{color:"#53c5d8",fontSize:12}}>✓ PLATFORM CONTRACT {d.spec.w} × {d.spec.h}</div></button>)}</div></>}
      {(image||validation||error)&&<div style={{...panel({padding:12,marginTop:12,borderColor:validation?.ok?"#f0c14b":"#8a3c3c"})}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={heading}>REAL GENERATED ASSET</h2>{ready&&<Button onClick={acceptToLibrary}>ACCEPT TO LIBRARY</Button>}</div>{error&&<div style={{color:"#ff8b8b",padding:12}}>{error}</div>}{image&&<div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12}}><div style={{minHeight:280,border:"1px solid #35455c",display:"grid",placeItems:"center",background:"#101827"}}><img src={image} style={{maxWidth:"80%",maxHeight:360,imageRendering:"pixelated"}}/></div><div>{validation?.checks.map(c=><div key={c.name} style={{padding:"7px 0",borderBottom:"1px solid #26354a",color:c.ok?"#53c5d8":"#ff8b8b"}}>✓ {c.name}<small style={{display:"block",color:"#9aabc0"}}>{c.detail}</small></div>)}</div></div>}</div>}
    </main></div></div></div>}
  </div>;
}

function Button(props:React.ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} style={{...button,...(props.style||{}),opacity:props.disabled?.valueOf()?0.55:1}}/>}
function Info({label,value}:{label:string;value:string}){return <div style={{margin:"10px 0"}}><div style={{color:"#8d9bb0",fontWeight:700}}>{label}</div><div style={{fontSize:17,fontWeight:900}}>{value.toUpperCase()}</div></div>}
function NumberInput({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void}){return <label style={field}><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||min)))} style={input}/></label>}
function Select({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){return <label style={field}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={input}>{options.map(o=><option key={o} value={o}>{o.toUpperCase()}</option>)}</select></label>}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){return <label style={{...field,flexDirection:"row",justifyContent:"space-between"}}><span>{label}</span><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)} style={{transform:"scale(1.5)"}}/></label>}

const panel=(extra:React.CSSProperties={}):React.CSSProperties=>({background:"#151f2e",border:"2px solid #35455c",boxSizing:"border-box",...extra});
const button:React.CSSProperties={background:"#f7c62f",color:"#161616",border:"2px solid #7a5c10",boxShadow:"3px 3px 0 #2a3548",fontFamily:"monospace",fontWeight:900,padding:"9px 14px",cursor:"pointer",letterSpacing:0.5};
const smallButton:React.CSSProperties={...button,padding:"4px 8px",float:"right",fontSize:12};
const heading:React.CSSProperties={color:"#f0c14b",letterSpacing:1,fontWeight:900,margin:"0 0 10px"};
const hr:React.CSSProperties={border:0,borderTop:"2px solid #35455c",margin:"12px 0"};
const toolButton:React.CSSProperties={...button,width:"100%",marginBottom:8};
const assetButton:React.CSSProperties={display:"flex",gap:10,alignItems:"center",width:"100%",background:"#121b28",color:"#dce7f2",border:"2px solid #42536c",padding:8,marginBottom:7,fontFamily:"monospace",fontWeight:800,textAlign:"left",cursor:"pointer"};
const empty:React.CSSProperties={border:"1px dashed #43516a",padding:20,textAlign:"center",color:"#8d9bb0",lineHeight:1.7};
const overlay:React.CSSProperties={position:"fixed",inset:0,zIndex:100,background:"rgba(4,8,15,.88)",display:"grid",placeItems:"center",padding:16};
const modalHead:React.CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14};
const settingsGrid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12};
const section:React.CSSProperties={background:"#101827",border:"1px solid #35455c",padding:12,lineHeight:1.6};
const hint:React.CSSProperties={color:"#8fa0b8",fontSize:12,marginTop:10};
const field:React.CSSProperties={display:"flex",flexDirection:"column",gap:5,margin:"10px 0",color:"#aebbd0",fontWeight:800};
const input:React.CSSProperties={background:"#0d1521",border:"2px solid #42536c",color:"#e8eef6",padding:"9px",fontFamily:"monospace",boxSizing:"border-box",width:"100%"};
const contracts:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,maxHeight:360,overflow:"auto"};
const choice:React.CSSProperties={...button,width:"100%",textAlign:"left",marginBottom:6,background:"#f7c62f"};
const activeChoice:React.CSSProperties={...choice,outline:"2px solid #fff",background:"#ffd84a"};
const draftCard:React.CSSProperties={background:"#121b28",border:"2px solid #42536c",padding:8,color:"#dce7f2",fontFamily:"monospace",cursor:"pointer"};
const activeDraft:React.CSSProperties={...draftCard,border:"2px solid #f0c14b",boxShadow:"0 0 0 2px rgba(240,193,75,.2)"};
