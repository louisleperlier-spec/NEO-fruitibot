import { useState } from "react";

const BG = "linear-gradient(145deg,#2de8ff 0%,#7b5cfa 40%,#c084fc 70%,#f472b6 100%)";
const DARK = "#1a0a2e";
const card = {
  background:"rgba(255,255,255,0.22)",backdropFilter:"blur(18px)",
  WebkitBackdropFilter:"blur(18px)",border:"1.5px solid rgba(255,255,255,0.6)",
  boxShadow:"0 8px 32px rgba(80,40,180,0.15)",borderRadius:20,
};
const LEVELS = [
  {lvl:1,name:"Banana Seedling 🌱",xpNeeded:0,color:"#64c8ff"},
  {lvl:2,name:"Banana Sprout 🍃",xpNeeded:50,color:"#4ade80"},
  {lvl:3,name:"Banana Seller 🍌",xpNeeded:150,color:"#fbbf24"},
  {lvl:4,name:"Etsy Explorer 🔍",xpNeeded:300,color:"#f97316"},
  {lvl:5,name:"SEO Wizard 🧙",xpNeeded:500,color:"#a78bfa"},
  {lvl:6,name:"Shop Master 👑",xpNeeded:800,color:"#f472b6"},
  {lvl:7,name:"Banana Legend 🏆",xpNeeded:1200,color:"#ffd700"},
];
const getLevel=(xp)=>{let c=LEVELS[0];for(const l of LEVELS){if(xp>=l.xpNeeded)c=l;}return c;};
const getNextLevel=(xp)=>{for(const l of LEVELS){if(xp<l.xpNeeded)return l;}return null;};
const getLevelProgress=(xp)=>{const c=getLevel(xp);const n=getNextLevel(xp);if(!n)return 100;return Math.round(((xp-c.xpNeeded)/(n.xpNeeded-c.xpNeeded))*100);};
const ALL_ACHIEVEMENTS = [
  {id:"first",emoji:"🍌",name:"Premier Pas",desc:"Optimise ton premier listing",xp:20,check:(s)=>s.totalOptimized>=1},
  {id:"streak3",emoji:"🔥",name:"En Feu",desc:"3 jours de suite",xp:50,check:(s)=>s.streak>=3},
  {id:"score90",emoji:"⭐",name:"Perfectionniste",desc:"Obtiens un score SEO de 90+",xp:30,check:(s)=>s.bestScore>=90},
  {id:"opt5",emoji:"✨",name:"Productif",desc:"5 listings optimisés",xp:40,check:(s)=>s.totalOptimized>=5},
  {id:"opt10",emoji:"🚀",name:"En Orbite",desc:"10 listings optimisés",xp:80,check:(s)=>s.totalOptimized>=10},
  {id:"copy10",emoji:"📋",name:"Copy Paste King",desc:"Copie 10 éléments",xp:25,check:(s)=>s.totalCopied>=10},
  {id:"streak7",emoji:"💎",name:"Semaine Parfaite",desc:"7 jours de streak",xp:100,check:(s)=>s.streak>=7},
  {id:"tags",emoji:"🏷️",name:"Tag Master",desc:"Copie tous les tags d'un listing",xp:35,check:(s)=>s.copiedAllTags>=1},
];
const DAILY = [
  {id:"d1",emoji:"⚡",name:"Optimise 3 listings aujourd'hui",xp:60,target:3,stat:"todayOptimized"},
  {id:"d2",emoji:"📋",name:"Copie 5 éléments",xp:30,target:5,stat:"todayCopied"},
  {id:"d3",emoji:"🎯",name:"Atteins un score de 90+",xp:45,target:1,stat:"todayScore90"},
];
const MOCK_RESULT = {
  score:94,
  title:"Minimalist Gold Leaf Earrings • Dainty Botanical Jewelry • Gift for Her • 14k Gold Filled",
  tags:["gold leaf earrings","botanical jewelry","dainty earrings","gift for her","minimalist studs","nature earrings","gold filled jewelry","leaf studs","delicate earrings","handmade earrings","boho jewelry","everyday earrings","gold stud earrings"],
  desc:"✨ Handcrafted with love, these minimalist gold leaf earrings bring a touch of nature to your everyday look.\n\n🌿 High-quality 14k gold-filled — hypoallergenic and tarnish-resistant.\n\n📦 Ships in 2–3 business days in a gift-ready box.",
};
const initStats = {
  xp:0,streak:1,totalOptimized:0,bestScore:0,
  totalCopied:0,copiedAllTags:0,
  todayOptimized:0,todayCopied:0,todayScore90:0,
  unlockedAchievements:[],
};

export default function App() {
  const [tab,setTab]=useState("optimizer");
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [copied,setCopied]=useState(null);
  const [stats,setStats]=useState(initStats);
  const [toast,setToast]=useState(null);
  const [xpAnim,setXpAnim]=useState(null);
  const [levelUp,setLevelUp]=useState(null);

  const showToast=(emoji,msg,xp=0)=>{setToast({emoji,msg,xp});setTimeout(()=>setToast(null),2800);};
  const addXP=(amount,_,newStats)=>{
    const oldLvl=getLevel(newStats.xp-amount);const newLvl=getLevel(newStats.xp);
    if(newLvl.lvl>oldLvl.lvl){setTimeout(()=>{setLevelUp(newLvl);setTimeout(()=>setLevelUp(null),3000);},400);}
    setXpAnim(`+${amount} XP`);setTimeout(()=>setXpAnim(null),1200);
  };
  const checkAchievements=(newStats)=>{
    const newUnlocked=[];
    for(const ach of ALL_ACHIEVEMENTS){if(!newStats.unlockedAchievements.includes(ach.id)&&ach.check(newStats))newUnlocked.push(ach.id);}
    if(newUnlocked.length>0){
      const ach=ALL_ACHIEVEMENTS.find(a=>a.id===newUnlocked[0]);
      setTimeout(()=>showToast(ach.emoji,`Succès : ${ach.name}`,ach.xp),600);
      return{...newStats,xp:newStats.xp+newUnlocked.reduce((s,id)=>s+(ALL_ACHIEVEMENTS.find(a=>a.id===id)?.xp||0),0),unlockedAchievements:[...newStats.unlockedAchievements,...newUnlocked]};
    }
    return newStats;
  };
  const doOptimize=async()=>{
    if(!input.trim())return;
    setLoading(true);setResult(null);
    await new Promise(r=>setTimeout(r,1800));
    setResult(MOCK_RESULT);setLoading(false);
    setStats(prev=>{
      let s={...prev,totalOptimized:prev.totalOptimized+1,todayOptimized:prev.todayOptimized+1,
        bestScore:Math.max(prev.bestScore,MOCK_RESULT.score),
        todayScore90:MOCK_RESULT.score>=90?prev.todayScore90+1:prev.todayScore90,xp:prev.xp+25};
      s=checkAchievements(s);addXP(25,"",s);showToast("✨","Listing optimisé !",25);return s;
    });
  };
  const doCopy=(text,key,isAllTags=false)=>{
    try{navigator.clipboard.writeText(text);}catch(e){}
    setCopied(key);setTimeout(()=>setCopied(null),1500);
    setStats(prev=>{
      let s={...prev,totalCopied:prev.totalCopied+1,todayCopied:prev.todayCopied+1,xp:prev.xp+5};
      if(isAllTags)s.copiedAllTags=prev.copiedAllTags+1;
      s=checkAchievements(s);addXP(5,"",s);return s;
    });
  };

  const lvl=getLevel(stats.xp);const nextLvl=getNextLevel(stats.xp);const prog=getLevelProgress(stats.xp);
  const btn=(bg,color,extra={})=>({border:"none",cursor:"pointer",fontWeight:800,fontSize:14,padding:"14px 20px",borderRadius:14,background:bg,color,width:"100%",...extra});
  const TABS=[["optimizer","✨","Optimizer"],["quests","⚔️","Quêtes"],["achievements","🏆","Succès"],["profile","👤","Profil"]];

  return (
    <div style={{minHeight:"100vh",background:BG,fontFamily:"system-ui,sans-serif",paddingBottom:80}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* HEADER */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(80,40,200,0.35)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.3)",padding:"10px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{color:"#fff",fontWeight:800,fontSize:15}}>🍌 NanoBanana</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {xpAnim&&<div style={{color:"#fbbf24",fontWeight:900,fontSize:13,animation:"fadeUp .5s ease"}}>{xpAnim}</div>}
            <div style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:800,color:"#fff"}}>⚡ {stats.xp} XP</div>
            <div style={{background:"linear-gradient(135deg,#fbbf24,#f97316)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:800,color:"#fff"}}>🔥 {stats.streak}j</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:700,whiteSpace:"nowrap"}}>{lvl.name}</div>
          <div style={{flex:1,height:6,background:"rgba(255,255,255,0.2)",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${prog}%`,background:`linear-gradient(90deg,${lvl.color},#fff)`,borderRadius:4,transition:"width .5s ease"}}/>
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",whiteSpace:"nowrap"}}>{nextLvl?`${nextLvl.xpNeeded-stats.xp} XP`:"MAX"}</div>
        </div>
      </div>

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",top:90,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"rgba(255,255,255,0.95)",borderRadius:16,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(80,40,180,0.3)",whiteSpace:"nowrap",animation:"slideDown .3s ease"}}>
          <span style={{fontSize:22}}>{toast.emoji}</span>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:DARK}}>{toast.msg}</div>
            {toast.xp>0&&<div style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>+{toast.xp} XP</div>}
          </div>
        </div>
      )}

      {/* LEVEL UP */}
      {levelUp&&(
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{...card,padding:"36px 28px",textAlign:"center",maxWidth:320,width:"100%",animation:"popIn .4s ease"}}>
            <div style={{fontSize:60,marginBottom:12}}>🎉</div>
            <div style={{fontWeight:900,fontSize:22,color:DARK,marginBottom:6}}>NIVEAU SUPÉRIEUR !</div>
            <div style={{fontSize:16,color:levelUp.color,fontWeight:800,marginBottom:20}}>{levelUp.name}</div>
            <button onClick={()=>setLevelUp(null)} style={btn("linear-gradient(135deg,#7b5cfa,#c084fc)","#fff")}>Continuer 🚀</button>
          </div>
        </div>
      )}

      <div style={{maxWidth:520,margin:"0 auto",padding:"16px 16px"}}>

        {/* OPTIMIZER */}
        {tab==="optimizer"&&(
          <div>
            <div style={{...card,padding:"20px",marginBottom:14}}>
              <div style={{fontSize:18,fontWeight:800,color:DARK,marginBottom:4}}>✨ Optimiser un listing</div>
              <div style={{fontSize:12,color:"rgba(26,10,46,0.5)",marginBottom:12}}>+25 XP par optimisation 🍌</div>
              <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Colle ton titre ou description Etsy ici..." rows={4}
                style={{width:"100%",background:"rgba(255,255,255,0.55)",border:"1.5px solid rgba(255,255,255,0.65)",borderRadius:12,padding:"12px 14px",fontSize:14,color:DARK,marginBottom:12,outline:"none",resize:"none",fontFamily:"inherit"}}/>
              <button onClick={doOptimize} disabled={loading||!input.trim()} style={{...btn(loading||!input.trim()?"rgba(255,255,255,0.3)":"linear-gradient(135deg,#7b5cfa,#c084fc)",loading||!input.trim()?"rgba(26,10,46,0.3)":"#fff"),boxShadow:loading||!input.trim()?"none":"0 6px 22px rgba(123,92,250,0.4)"}}>
                {loading?"⏳ Analyse...":"🍌 Optimiser (+25 XP)"}
              </button>
            </div>
            {result&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{...card,padding:"16px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{position:"relative",width:60,height:60,flexShrink:0}}>
                    <svg viewBox="0 0 100 100" width="60" height="60" style={{transform:"rotate(-90deg)"}}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="12"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#a78bfa" strokeWidth="12" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={264-(result.score/100)*264} style={{transition:"stroke-dashoffset 1s ease"}}/>
                    </svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:DARK}}>{result.score}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:900,fontSize:15,color:DARK}}>Score SEO Etsy</div>
                    <div style={{fontSize:12,color:"rgba(26,10,46,0.55)"}}>Top 5% des listings 🏆</div>
                    <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginTop:2}}>+25 XP gagné !</div>
                  </div>
                </div>
                {[{k:"title",l:"Titre optimisé",v:result.title},{k:"desc",l:"Description",v:result.desc}].map(({k,l,v})=>(
                  <div key={k} style={{...card,padding:"14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontWeight:800,fontSize:11,color:"rgba(26,10,46,0.5)",textTransform:"uppercase",letterSpacing:1}}>{l}</span>
                      <button onClick={()=>doCopy(v,k)} style={{fontSize:11,padding:"4px 12px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:copied===k?"#a78bfa":"rgba(255,255,255,0.6)",color:copied===k?"#fff":DARK}}>
                        {copied===k?"✓ Copié (+5XP)":"Copier"}
                      </button>
                    </div>
                    <p style={{fontSize:13,color:DARK,lineHeight:1.6,whiteSpace:"pre-line"}}>{v}</p>
                  </div>
                ))}
                <div style={{...card,padding:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontWeight:800,fontSize:11,color:"rgba(26,10,46,0.5)",textTransform:"uppercase",letterSpacing:1}}>13 Tags SEO</span>
                    <button onClick={()=>doCopy(result.tags.join(", "),"tags",true)} style={{fontSize:11,padding:"4px 12px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:copied==="tags"?"#a78bfa":"rgba(255,255,255,0.6)",color:copied==="tags"?"#fff":DARK}}>
                      {copied==="tags"?"✓ Copié":"Tout copier (+5XP)"}
                    </button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {result.tags.map(t=>(
                      <button key={t} onClick={()=>doCopy(t,t)} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:700,background:copied===t?"linear-gradient(135deg,#7b5cfa,#c084fc)":"rgba(255,255,255,0.6)",color:copied===t?"#fff":DARK}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QUÊTES */}
        {tab==="quests"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:4}}>⚔️ Quêtes du jour</div>
            {DAILY.map(q=>{
              const current=Math.min(stats[q.stat]||0,q.target);const done=current>=q.target;
              return(
                <div key={q.id} style={{...card,padding:"16px 18px",opacity:done?0.75:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:32,flexShrink:0}}>{done?"✅":q.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:14,color:DARK,marginBottom:2,textDecoration:done?"line-through":"none"}}>{q.name}</div>
                      <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginBottom:8}}>+{q.xp} XP</div>
                      <div style={{height:8,background:"rgba(255,255,255,0.3)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.round((current/q.target)*100)}%`,background:done?"#4ade80":"linear-gradient(90deg,#7b5cfa,#c084fc)",borderRadius:4,transition:"width .5s ease"}}/>
                      </div>
                      <div style={{fontSize:10,color:"rgba(26,10,46,0.5)",marginTop:4}}>{current}/{q.target}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{...card,padding:"16px 18px",background:"rgba(251,191,36,0.25)",border:"1.5px solid rgba(251,191,36,0.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:32}}>🔥</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14,color:DARK}}>Streak : {stats.streak} jour{stats.streak>1?"s":""}</div>
                  <div style={{fontSize:11,color:"#f97316",fontWeight:700}}>Reviens demain pour maintenir ton streak !</div>
                  <div style={{display:"flex",gap:4,marginTop:8}}>
                    {[1,2,3,4,5,6,7].map(d=>(
                      <div key={d} style={{width:28,height:28,borderRadius:8,background:d<=stats.streak?"linear-gradient(135deg,#fbbf24,#f97316)":"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>
                        {d<=stats.streak?"🔥":""}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff",marginTop:4}}>🏅 Défi hebdo</div>
            <div style={{...card,padding:"16px 18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:36}}>🧙</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14,color:DARK,marginBottom:2}}>Optimise 20 listings cette semaine</div>
                  <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginBottom:8}}>+200 XP + Badge exclusif</div>
                  <div style={{height:8,background:"rgba(255,255,255,0.3)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,(stats.totalOptimized/20)*100)}%`,background:"linear-gradient(90deg,#a78bfa,#f472b6)",borderRadius:4,transition:"width .5s ease"}}/>
                  </div>
                  <div style={{fontSize:10,color:"rgba(26,10,46,0.5)",marginTop:4}}>{Math.min(stats.totalOptimized,20)}/20</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUCCÈS */}
        {tab==="achievements"&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:4}}>🏆 Succès</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:14}}>{stats.unlockedAchievements.length}/{ALL_ACHIEVEMENTS.length} débloqués</div>
            <div style={{...card,padding:"20px",display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
              <div style={{position:"relative",width:64,height:64,flexShrink:0}}>
                <svg viewBox="0 0 100 100" width="64" height="64" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="12"/>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#fbbf24" strokeWidth="12" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={264-(stats.unlockedAchievements.length/ALL_ACHIEVEMENTS.length)*264} style={{transition:"stroke-dashoffset 1s ease"}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:DARK}}>{Math.round((stats.unlockedAchievements.length/ALL_ACHIEVEMENTS.length)*100)}%</div>
              </div>
              <div>
                <div style={{fontWeight:900,fontSize:15,color:DARK}}>Progression globale</div>
                <div style={{fontSize:12,color:"rgba(26,10,46,0.55)"}}>{stats.unlockedAchievements.length} succès débloqués</div>
                <div style={{fontSize:11,color:"#fbbf24",fontWeight:700}}>Continue pour tout débloquer !</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {ALL_ACHIEVEMENTS.map(a=>{
                const unlocked=stats.unlockedAchievements.includes(a.id);
                return(
                  <div key={a.id} style={{...card,padding:"14px 16px",opacity:unlocked?1:0.55,border:unlocked?"1.5px solid rgba(251,191,36,0.5)":"1.5px solid rgba(255,255,255,0.4)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontSize:30,filter:unlocked?"none":"grayscale(1)"}}>{a.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,fontSize:14,color:DARK}}>{a.name}</div>
                        <div style={{fontSize:12,color:"rgba(26,10,46,0.55)"}}>{a.desc}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:11,fontWeight:800,color:unlocked?"#fbbf24":"rgba(26,10,46,0.3)"}}>+{a.xp} XP</div>
                        <div style={{fontSize:10,color:unlocked?"#4ade80":"rgba(26,10,46,0.3)",marginTop:2}}>{unlocked?"✓ Débloqué":"🔒 Verrouillé"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROFIL */}
        {tab==="profile"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{...card,padding:"24px",textAlign:"center",background:`linear-gradient(135deg,${lvl.color}22,rgba(255,255,255,0.2))`,border:`1.5px solid ${lvl.color}55`}}>
              <div style={{fontSize:56,marginBottom:8}}>🍌</div>
              <div style={{fontWeight:900,fontSize:18,color:DARK,marginBottom:4}}>{lvl.name}</div>
              <div style={{fontSize:13,color:"rgba(26,10,46,0.55)",marginBottom:12}}>Niveau {lvl.lvl}</div>
              <div style={{height:10,background:"rgba(255,255,255,0.3)",borderRadius:6,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:`${prog}%`,background:`linear-gradient(90deg,${lvl.color},#fff)`,borderRadius:6,transition:"width .6s ease"}}/>
              </div>
              <div style={{fontSize:11,color:"rgba(26,10,46,0.5)"}}>
                {nextLvl?`${stats.xp-getLevel(stats.xp).xpNeeded} / ${nextLvl.xpNeeded-getLevel(stats.xp).xpNeeded} XP pour ${nextLvl.name}`:"🏆 Niveau maximum atteint !"}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["⚡","XP Total",stats.xp,"#a78bfa"],["🔥","Streak",`${stats.streak}j`,"#f97316"],["✨","Optimisés",stats.totalOptimized,"#4ade80"],["🏆","Succès",`${stats.unlockedAchievements.length}/${ALL_ACHIEVEMENTS.length}`,"#fbbf24"],["⭐","Meilleur score",stats.bestScore||"—","#64c8ff"],["📋","Copies",stats.totalCopied,"#f472b6"]].map(([e,l,v,c])=>(
                <div key={l} style={{...card,padding:"14px",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{e}</div>
                  <div style={{fontWeight:900,fontSize:18,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:"rgba(26,10,46,0.5)",textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{...card,padding:"16px"}}>
              <div style={{fontWeight:800,fontSize:13,color:DARK,marginBottom:12}}>🗺️ Feuille de route</div>
              {LEVELS.map(l=>{
                const reached=stats.xp>=l.xpNeeded;const isCur=lvl.lvl===l.lvl;
                return(
                  <div key={l.lvl} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:reached?`linear-gradient(135deg,${l.color},${l.color}88)`:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,border:isCur?`2px solid ${l.color}`:"none",flexShrink:0}}>
                      {reached?"✓":l.lvl}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:reached?DARK:"rgba(26,10,46,0.4)"}}>{l.name}</div>
                      <div style={{fontSize:10,color:"rgba(26,10,46,0.4)"}}>{l.xpNeeded} XP requis</div>
                    </div>
                    {isCur&&<div style={{fontSize:10,background:l.color,color:"#fff",borderRadius:8,padding:"2px 8px",fontWeight:700}}>Actuel</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:"rgba(80,40,200,0.4)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:"1px solid rgba(255,255,255,0.3)",display:"flex"}}>
        {TABS.map(([id,emoji,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"11px 6px",background:"none",border:"none",borderTop:tab===id?"2px solid #c084fc":"2px solid transparent",color:tab===id?"#fff":"rgba(255,255,255,0.4)",fontSize:10,fontWeight:tab===id?900:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:17}}>{emoji}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
