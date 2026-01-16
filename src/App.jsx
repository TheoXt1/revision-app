import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Calendar as CalendarIcon, User, Award, BarChart2, TrendingUp, Cloud, CloudOff, Edit2, Save, Trash2, LogIn, LogOut, Lock, Users, UserPlus, X, Trophy, Plus, ArrowRight, Copy, LogIn as EnterIcon, AlertTriangle, Settings, Volume2, VolumeX, Bell, BellOff, Palette, ChevronLeft, Info } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

// --- CONFIGURATION ---
let firebaseConfig;
let isCanvasMode = false;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
    isCanvasMode = true; 
  }
  if (typeof __app_id !== 'undefined') {
    appId = __app_id;
  }
} catch (e) {
  console.log("Mode APK/Local détecté");
}

const sanitizedAppId = appId.replace(/[\/.]/g, '_');

if (!firebaseConfig) {
  // 👇👇👇 TES CLÉS ICI 👇👇👇
  firebaseConfig = {
  apiKey: "AIzaSyAQa4MghH9-68bAe7_nE9rJ9sEuzYFUMF0",
  authDomain: "revision-78bbd.firebaseapp.com",
  projectId: "revision-78bbd",
  storageBucket: "revision-78bbd.firebasestorage.app",
  messagingSenderId: "133630600887",
  appId: "1:133630600887:web:5fb2749f5956e908c7cf32",
  measurementId: "G-ZQPGR5SPRZ"
};
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CHEMINS ---
const getPathSegments = (type, ...args) => {
  if (isCanvasMode) {
    const root = ['artifacts', sanitizedAppId];
    switch (type) {
      case 'user_data': return [...root, 'users', args[0], 'revision_data', 'year_2026'];
      case 'user_profile': return [...root, 'users', args[0], 'profile', 'info'];
      case 'user_rooms_col': return [...root, 'users', args[0], 'rooms'];
      case 'user_room_doc': return [...root, 'users', args[0], 'rooms', args[1]];
      case 'public_room': return [...root, 'public', 'data', 'rooms', args[0]];
      case 'public_profile': return [...root, 'public', 'data', 'profiles', args[0]];
      case 'public_profiles_col': return [...root, 'public', 'data', 'profiles'];
      default: return [];
    }
  } else {
    switch (type) {
      case 'user_data': return ['users', args[0], 'data', 'year_2026'];
      case 'user_profile': return ['users', args[0], 'profile', 'info'];
      case 'user_rooms_col': return ['users', args[0], 'rooms'];
      case 'user_room_doc': return ['users', args[0], 'rooms', args[1]];
      case 'public_room': return ['rooms', args[0]];
      case 'public_profile': return ['profiles', args[0]];
      case 'public_profiles_col': return ['profiles'];
      default: return [];
    }
  }
};

const getDocRef = (type, ...args) => doc(db, ...getPathSegments(type, ...args));
const getColRef = (type, ...args) => collection(db, ...getPathSegments(type, ...args));

// --- THÈMES ---
const THEMES = {
  indigo: { id: 'indigo', name: "Focus (Bleu)", gradient: "from-blue-600 to-indigo-700", bgPrimary: "bg-indigo-600", bgLight: "bg-indigo-50", textPrimary: "text-indigo-600", textDark: "text-indigo-800", border: "border-indigo-200", icon: "text-indigo-500", button: "bg-indigo-600 hover:bg-indigo-700", bar: "bg-indigo-500", ring: "focus:border-indigo-500" },
  rose: { id: 'rose', name: "Énergie (Rouge)", gradient: "from-orange-500 to-rose-600", bgPrimary: "bg-rose-600", bgLight: "bg-rose-50", textPrimary: "text-rose-600", textDark: "text-rose-800", border: "border-rose-200", icon: "text-rose-500", button: "bg-rose-600 hover:bg-rose-700", bar: "bg-rose-500", ring: "focus:border-rose-500" },
  emerald: { id: 'emerald', name: "Nature (Vert)", gradient: "from-teal-500 to-emerald-600", bgPrimary: "bg-emerald-600", bgLight: "bg-emerald-50", textPrimary: "text-emerald-600", textDark: "text-emerald-800", border: "border-emerald-200", icon: "text-emerald-500", button: "bg-emerald-600 hover:bg-emerald-700", bar: "bg-emerald-500", ring: "focus:border-emerald-500" },
  violet: { id: 'violet', name: "Mystique (Violet)", gradient: "from-fuchsia-600 to-violet-700", bgPrimary: "bg-violet-600", bgLight: "bg-violet-50", textPrimary: "text-violet-600", textDark: "text-violet-800", border: "border-violet-200", icon: "text-violet-500", button: "bg-violet-600 hover:bg-violet-700", bar: "bg-violet-500", ring: "focus:border-violet-500" }
};

const RevisionTracker = () => {
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0); 
  const [revisionData, setRevisionData] = useState({}); 
  const [activeTab, setActiveTab] = useState('timer');
  const [isSyncing, setIsSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  
  // Profil & Auth
  const [pseudo, setPseudo] = useState("Étudiant");
  const [isEditingPseudo, setIsEditingPseudo] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState('login'); 
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('indigo');
  const [settings, setSettings] = useState({ sound: true, notifications: true });

  // Amis & Salons
  const [myRooms, setMyRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMembersData, setRoomMembersData] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const t = THEMES[currentTheme];

  // --- INIT ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme && THEMES[savedTheme]) setCurrentTheme(savedTheme);
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  const changeTheme = (id) => { setCurrentTheme(id); localStorage.setItem('app_theme', id); };
  const toggleSetting = (k) => { 
    const ns = { ...settings, [k]: !settings[k] }; 
    setSettings(ns); 
    localStorage.setItem('app_settings', JSON.stringify(ns)); 
  };

  useEffect(() => {
    const initAuth = async () => { if (!auth.currentUser) await signInAnonymously(auth).catch(console.error); };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) { setRevisionData({}); setPseudo("Étudiant"); setMyRooms([]); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setPermissionError(false);
    const unsubData = onSnapshot(getDocRef('user_data', user.uid), (s) => setRevisionData(s.exists() ? s.data().days : {}), (e) => { if(e.code==='permission-denied') setPermissionError(true); });
    const unsubProf = onSnapshot(getDocRef('user_profile', user.uid), (s) => { if(s.exists() && s.data().pseudo) setPseudo(s.data().pseudo); });
    const unsubRooms = onSnapshot(getColRef('user_rooms_col', user.uid), async (s) => {
      const list = [];
      for (const d of s.docs) {
        try { const rs = await getDoc(getDocRef('public_room', d.id)); if(rs.exists()) list.push({ id: d.id, ...rs.data() }); } catch {}
      }
      setMyRooms(list);
    });
    return () => { unsubData(); unsubProf(); unsubRooms(); };
  }, [user]);

  // --- LOGIC ---
  const toggleTimer = () => {
    if (isRunning) {
      clearInterval(timerRef.current);
      saveSession(Math.floor((Date.now() - startTimeRef.current)/1000));
      setIsRunning(false); setTimer(0);
    } else {
      startTimeRef.current = Date.now() - (timer * 1000);
      timerRef.current = setInterval(() => setTimer(Math.floor((Date.now() - startTimeRef.current)/1000)), 1000);
      setIsRunning(true);
    }
  };

  const saveSession = async (manualTime) => {
    const timeToSave = typeof manualTime === 'number' ? manualTime : timer;
    if (timeToSave <= 0 || !user) return;
    const today = new Date().toISOString().split('T')[0];
    const newData = { ...revisionData, [today]: (revisionData[today] || 0) + timeToSave };
    setRevisionData(newData); setIsSyncing(true);
    try {
      await setDoc(getDocRef('user_data', user.uid), { days: newData }, { merge: true });
      await updatePublicProfile(newData, pseudo);
    } catch (e) { if(e.code==='permission-denied') setPermissionError(true); } 
    finally { setIsSyncing(false); }
  };

  const updatePublicProfile = async (data, name) => {
    if (!user) return;
    const total = Object.values(data).reduce((a,b)=>(Number(a)||0)+(Number(b)||0), 0);
    try { await setDoc(getDocRef('public_profile', user.uid), { pseudo: name, totalSeconds: total, days: data, email: user.email||"", lastUpdate: new Date().toISOString() }, { merge: true }); } catch {}
  };

  const savePseudo = async () => {
    if (!user) return;
    setIsEditingPseudo(false);
    try { await setDoc(getDocRef('user_profile', user.uid), { pseudo }, { merge: true }); await updatePublicProfile(revisionData, pseudo); } catch {}
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;
    const rid = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(getDocRef('public_room', rid), { name: newRoomName, startDate: new Date().toISOString().split('T')[0], createdBy: user.uid, members: [user.uid] });
      await setDoc(getDocRef('user_room_doc', user.uid, rid), { joinedAt: new Date().toISOString() });
      setNewRoomName(""); setIsCreatingRoom(false); alert(`Salon créé : ${rid}`);
    } catch (e) { if(e.code==='permission-denied') setPermissionError(true); }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinRoomId.trim() || !user) return;
    const rid = joinRoomId.toUpperCase().trim();
    try {
      const snap = await getDoc(getDocRef('public_room', rid));
      if (!snap.exists()) { alert("Introuvable"); return; }
      await updateDoc(getDocRef('public_room', rid), { members: arrayUnion(user.uid) });
      await setDoc(getDocRef('user_room_doc', user.uid, rid), { joinedAt: new Date().toISOString() });
      setJoinRoomId(""); setIsJoiningRoom(false); alert("Rejoint !");
    } catch (e) { alert("Erreur accès"); }
  };

  const openRoom = async (room) => {
    setActiveRoom(room); setRoomMembersData([]);
    if (!room.members) return;
    const stats = [];
    for (const uid of room.members) {
      try {
        const s = await getDoc(getDocRef('public_profile', uid));
        if (s.exists()) {
          let rt = 0;
          if (s.data().days) Object.entries(s.data().days).forEach(([d, v]) => { if (d >= room.startDate) rt += (Number(v)||0); });
          stats.push({ uid, pseudo: s.data().pseudo||"?", roomTotal: rt });
        } else stats.push({ uid, pseudo: "?", roomTotal: 0 });
      } catch {}
    }
    setRoomMembersData(stats.sort((a,b) => b.roomTotal - a.roomTotal));
  };

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthError("");
    try {
      const uc = authMode === 'register' ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password);
      setEmail(""); setPassword("");
      if (uc.user) setTimeout(() => updatePublicProfile(revisionData, "Nouveau"), 2000);
    } catch (e) { setAuthError("Erreur: " + e.message); }
  };

  const handleLogout = async () => { await signOut(auth); };
  const clearAllData = async () => { if(user && window.confirm("Sûr ?")) { await setDoc(getDocRef('user_data', user.uid), { days: {} }); setRevisionData({}); updatePublicProfile({}, pseudo); }};

  // --- UI Helpers ---
  const fmtTime = (s) => { if(isNaN(s)) return "00:00"; const m=Math.floor((s%3600)/60), sec=s%60; return `${Math.floor(s/3600)>0?Math.floor(s/3600)+':':''}${m>0?String(m).padStart(2,'0'):m}:${String(sec).padStart(2,'0')}`; };
  const fmtHM = (s) => `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  const getStats = () => {
    const tot = Array(12).fill(0);
    Object.entries(revisionData).forEach(([d, s]) => { if(d.split('-')[1]) tot[parseInt(d.split('-')[1],10)-1] += (Number(s)||0); });
    const max = Math.max(...tot, 1);
    return tot.map((s, i) => ({ m: ['J','F','M','A','M','J','J','A','S','O','N','D'][i], s, h: (s/max)*100, l: s<60?s+'s':s<3600?Math.floor(s/60)+'m':(s/3600).toFixed(1)+'h' }));
  };

  return (
    // CONTAINER RESPONSIVE ULTIME
    <div className="h-[100dvh] w-full bg-gray-50 text-gray-800 font-sans flex justify-center items-center overflow-hidden">
      {/* WRAPPER APP : Plein écran sur mobile (w-full h-full), centré sur PC (max-w-md) */}
      <div className="w-full h-full md:max-w-md md:h-[95vh] md:rounded-3xl bg-white md:shadow-2xl overflow-hidden flex flex-col relative transition-all duration-300">
        
        {/* HEADER */}
        <header className={`flex-none bg-gradient-to-r ${t.gradient} text-white p-4 pt-safe-top shadow-md z-10 transition-colors duration-500`}>
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-2"><Award size={20} className="text-yellow-300" /><span className="font-bold text-lg tracking-tight">Focus 2026</span></div>
            <div className="flex items-center gap-2 text-white/80 text-xs">{user && !user.isAnonymous ? <Cloud size={14} className={isSyncing?"animate-pulse":""} /> : <CloudOff size={14} />}</div>
          </div>
        </header>

        {/* ERROR MSG */}
        {permissionError && (
          <div className="bg-red-50 p-4 border-b border-red-200 flex items-start gap-3 animate-in slide-in-from-top">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div className="text-xs text-red-700">
              <p className="font-bold">Erreur Permissions</p>
              <p>Firebase Console &gt; Firestore &gt; Règles : <code>allow read, write: if true;</code></p>
            </div>
            <button onClick={()=>setPermissionError(false)}><X size={16} className="text-red-400"/></button>
          </div>
        )}

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 scrollbar-hide bg-gray-50/50 relative">
          
          {/* TIMER */}
          {activeTab === 'timer' && (
            <div className="flex flex-col items-center justify-center min-h-full py-6 space-y-10">
              <div className="text-center space-y-1"><h2 className="text-gray-500 font-medium text-sm uppercase">Bonjour</h2><h1 className="text-3xl font-bold text-gray-800">{pseudo}</h1></div>
              <div className="relative group cursor-pointer" onClick={toggleTimer}>
                {isRunning && <div className={`absolute inset-0 rounded-full border-4 opacity-20 animate-ping ${t.border}`}></div>}
                <div className={`relative flex items-center justify-center w-64 h-64 rounded-full border-[8px] transition-all duration-300 shadow-xl ${isRunning ? `${t.border} ${t.bgLight} scale-105` : 'border-gray-100 bg-white'}`}>
                  <div className="text-center flex flex-col items-center z-10">
                    <span className={`block text-5xl font-mono font-bold tracking-tighter tabular-nums ${isRunning ? t.textPrimary : 'text-gray-300'}`}>{fmtTime(timer)}</span>
                    <span className="text-gray-400 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">{isRunning ? 'Enregistrement...' : 'Lancer'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full px-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center"><Clock size={20} className={`${t.icon} mb-2`} /><span className="text-2xl font-bold text-gray-800">{fmtHM(Object.values(revisionData).reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0))}</span><span className="text-[10px] text-gray-400 uppercase font-bold">Total</span></div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center"><CalendarIcon size={20} className="text-green-500 mb-2" /><span className="text-2xl font-bold text-gray-800">{new Date().getDate()}</span><span className="text-[10px] text-gray-400 uppercase font-bold">Jour</span></div>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 pb-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><BarChart2 size={16} className={t.icon} />Progression</h3></div>
                <div className="flex items-end justify-between h-32 gap-1">{getStats().map((st, i) => (
                  <div key={i} className="flex flex-col items-center justify-end h-full w-full group relative">
                     {st.s>0 && <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded z-10">{st.l}</div>}
                     <div className="w-full flex items-end justify-center h-full"><div className={`w-2/3 rounded-t-sm transition-all duration-500 ${st.s>0 ? t.bar : 'bg-gray-100'}`} style={{height:`${Math.max(st.h,5)}%`}}/></div>
                     <span className="text-[9px] text-gray-400 mt-1 font-medium">{st.m}</span>
                  </div>
                ))}</div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {/* Calendrier simplifié pour perf mobile */}
                 <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center text-gray-400 text-xs">Détail mensuel disponible sur tablette/PC</div>
              </div>
            </div>
          )}

          {/* ROOMS */}
          {activeTab === 'rooms' && (
            <div className="space-y-6 pb-4 pt-2 min-h-full">
              {!activeRoom ? (
                <>
                  <div className="px-1 flex justify-between items-center"><h2 className="text-xl font-bold text-gray-800">Salons</h2><div className="flex gap-2"><button onClick={()=>{setIsJoiningRoom(true);setIsCreatingRoom(false)}} className="bg-white border border-gray-200 text-gray-600 p-2 rounded-full"><LogIn size={20}/></button><button onClick={()=>{setIsCreatingRoom(true);setIsJoiningRoom(false)}} className={`${t.button} text-white p-2 rounded-full shadow-md`}><Plus size={20}/></button></div></div>
                  {(isCreatingRoom || isJoiningRoom) && (
                    <div className={`bg-white p-4 rounded-xl shadow-lg border ${t.border} mx-2 mb-4 animate-in fade-in`}>
                      <div className="flex justify-between mb-2"><h3 className={`font-bold text-sm ${t.textDark}`}>{isCreatingRoom?"Créer":"Rejoindre"}</h3><button onClick={()=>{setIsCreatingRoom(false);setIsJoiningRoom(false)}}><X size={16}/></button></div>
                      <form onSubmit={isCreatingRoom?handleCreateRoom:handleJoinRoom} className="flex gap-2">
                        <input type="text" placeholder={isCreatingRoom?"Nom":"Code"} className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none ${t.ring} ${isJoiningRoom?"uppercase":""}`} value={isCreatingRoom?newRoomName:joinRoomId} onChange={(e)=>isCreatingRoom?setNewRoomName(e.target.value):setJoinRoomId(e.target.value)} required />
                        <button type="submit" className={`${t.button} text-white px-4 rounded-lg font-bold text-sm`}>OK</button>
                      </form>
                    </div>
                  )}
                  <div className="space-y-3">{myRooms.length===0?<div className="text-center py-10 text-gray-400"><Trophy size={48} className="mx-auto mb-2 opacity-20"/><p className="text-sm">Lance un défi !</p></div>:myRooms.map(r=>(<div key={r.id} onClick={()=>openRoom(r)} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm mx-1 cursor-pointer"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full ${t.bgLight} ${t.textPrimary} flex items-center justify-center font-bold`}><Trophy size={20}/></div><div><div className="font-bold text-gray-800">{r.name}</div></div></div><ArrowRight size={20} className="text-gray-300"/></div>))}</div>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="px-2 flex items-center gap-2 mb-4"><button onClick={()=>setActiveRoom(null)} className="text-gray-500"><ArrowRight className="rotate-180"/></button><h2 className="text-xl font-bold text-gray-800 flex-1">{activeRoom.name}</h2><button onClick={()=>{navigator.clipboard.writeText(activeRoom.id);alert("Copié")}} className={`text-xs ${t.bgLight} ${t.textPrimary} px-2 py-1 rounded border ${t.border} flex items-center gap-1`}>{activeRoom.id}<Copy size={10}/></button></div>
                  <div className={`${t.bgPrimary} text-white p-4 rounded-xl mx-1 shadow-lg mb-4`}><p className="text-xs opacity-75 mb-1">Mon temps</p><div className="text-3xl font-mono font-bold">{fmtHM(roomMembersData.find(m=>m.uid===user.uid)?.roomTotal||0)}</div></div>
                  <div className="space-y-2 flex-1 overflow-y-auto">{roomMembersData.map((m,i)=>(<div key={m.uid} className={`p-3 rounded-lg flex items-center justify-between mx-1 border ${m.uid===user.uid?`${t.bgLight} ${t.border}`:'bg-white border-gray-100'}`}><div className="flex items-center gap-3"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i===0?'bg-yellow-400 text-yellow-900':'bg-gray-100 text-gray-500'}`}>{i+1}</div><span className="font-bold text-sm text-gray-700">{m.pseudo}</span></div><span className={`font-mono font-bold ${t.textPrimary} text-sm`}>{fmtHM(m.roomTotal)}</span></div>))}</div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS / PROFILE */}
          {activeTab === 'profile' && (
            <div className="flex flex-col min-h-full py-6 space-y-6 pb-8">
              {showSettings && (
                <div className="absolute inset-0 bg-gray-50 z-20 overflow-y-auto animate-in slide-in-from-right">
                  <div className="bg-white p-4 shadow-sm flex items-center gap-2 mb-4 border-b border-gray-100 sticky top-0 z-30 pt-safe-top"><button onClick={()=>setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft/></button><h2 className="text-lg font-bold text-gray-800">Paramètres</h2></div>
                  <div className="px-4 space-y-6">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Palette size={16}/> Thème</h3><div className="grid grid-cols-2 gap-3">{Object.values(THEMES).map(th=>(<button key={th.id} onClick={()=>changeTheme(th.id)} className={`p-3 rounded-xl border flex items-center gap-3 ${currentTheme===th.id?`border-${th.id}-500 bg-gray-50 ring-1 ring-${th.id}-500`:'border-gray-200'}`}><div className={`w-6 h-6 rounded-full bg-gradient-to-br ${th.gradient}`}></div><span className="text-xs font-medium text-gray-700">{th.name}</span></button>))}</div></div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4"><h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2"><Settings size={16}/> Options</h3><div className="flex items-center justify-between"><div className="flex items-center gap-3 text-sm text-gray-600">{settings.sound?<Volume2 size={18}/>:<VolumeX size={18}/>} Sons</div><button onClick={()=>toggleSetting('sound')} className={`w-10 h-6 rounded-full p-1 transition-colors ${settings.sound?t.bgPrimary:'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${settings.sound?'translate-x-4':''}`}/></button></div></div>
                  </div>
                </div>
              )}
              <div className="text-center relative">
                <button onClick={()=>setShowSettings(true)} className="absolute right-4 top-0 p-2 text-gray-400 hover:text-gray-600"><Settings size={20}/></button>
                <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner relative"><User size={48} className="text-white"/>{user&&user.isAnonymous&&<div className="absolute bottom-0 right-0 bg-gray-500 text-white rounded-full p-1 border-2 border-white"><Lock size={12}/></div>}</div>
                {isEditingPseudo ? <div className="flex items-center justify-center gap-2"><input type="text" value={pseudo} onChange={(e)=>setPseudo(e.target.value)} className={`border-b-2 text-center text-2xl font-bold text-gray-800 focus:outline-none bg-transparent w-40 ${t.ring}`} autoFocus /><button onClick={savePseudo} className={`${t.button} text-white p-1 rounded-md`}><Save size={18}/></button></div> : <div className="flex items-center justify-center gap-2 group"><h2 className="text-2xl font-bold text-gray-800">{pseudo}</h2><button onClick={()=>setIsEditingPseudo(true)} className={`text-gray-400 hover:${t.textPrimary}`}><Edit2 size={16}/></button></div>}
                <p className="text-xs text-gray-500 mt-1 bg-gray-100 inline-block px-2 py-1 rounded-full">{user&&user.email?user.email:"Mode Anonyme"}</p>
              </div>
              <div className={`${t.bgPrimary} rounded-2xl p-6 text-white shadow-lg mx-2 transition-colors duration-500`}><div className="flex items-center gap-3 mb-2 opacity-80"><Clock size={20}/><span className="font-bold text-sm uppercase tracking-wide">Total</span></div><div className="text-4xl font-bold font-mono tracking-tight">{fmtHM(Object.values(revisionData).reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0))}</div></div>
              <div className="mx-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Cloud size={18} className={t.icon}/>Compte</h3>
                {user&&!user.isAnonymous?(<div className="space-y-3"><div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2"><Cloud size={16}/> Connecté.</div><button onClick={handleLogout} className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-200"><LogOut size={16}/> Se déconnecter</button></div>):(<div className="space-y-3"><div className="flex gap-2 bg-gray-100 p-1 rounded-lg mb-3"><button onClick={()=>{setAuthMode('login');setAuthError("")}} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${authMode==='login'?`bg-white shadow ${t.textPrimary}`:'text-gray-500'}`}>Connexion</button><button onClick={()=>{setAuthMode('register');setAuthError("")}} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${authMode==='register'?`bg-white shadow ${t.textPrimary}`:'text-gray-500'}`}>Inscription</button></div><form onSubmit={handleAuth} className="space-y-2"><input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg text-sm outline-none ${t.ring}`} required /><input type="password" placeholder="Mot de passe" value={password} onChange={(e)=>setPassword(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg text-sm outline-none ${t.ring}`} required />{authError&&<p className="text-xs text-red-500">{authError}</p>}<button type="submit" className={`w-full py-2.5 ${t.button} text-white rounded-xl text-sm font-bold transition-colors`}>{authMode==='login'?"Go":"Créer"}</button></form></div>)}
              </div>
              <div className="mx-2"><button onClick={clearAllData} className="w-full py-3 text-red-400 text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={14}/> Reset Données</button></div>
            </div>
          )}
        </main>

        {/* BOTTOM NAV */}
        <nav className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-2 flex justify-between items-center z-20 md:rounded-b-3xl pb-safe">
          <button onClick={()=>setActiveTab('timer')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab==='timer'?t.textPrimary:'text-gray-400'}`}><Clock size={22} strokeWidth={activeTab==='timer'?2.5:2}/><span className="text-[9px] font-medium">Chrono</span></button>
          <button onClick={()=>setActiveTab('calendar')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab==='calendar'?t.textPrimary:'text-gray-400'}`}><CalendarIcon size={22} strokeWidth={activeTab==='calendar'?2.5:2}/><span className="text-[9px] font-medium">Hist.</span></button>
          <button onClick={()=>setActiveTab('rooms')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab==='rooms'?t.textPrimary:'text-gray-400'}`}><Trophy size={22} strokeWidth={activeTab==='rooms'?2.5:2}/><span className="text-[9px] font-medium">Salons</span></button>
          <button onClick={()=>setActiveTab('profile')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab==='profile'?t.textPrimary:'text-gray-400'}`}><User size={22} strokeWidth={activeTab==='profile'?2.5:2}/><span className="text-[9px] font-medium">Profil</span></button>
        </nav>
      </div>
    </div>
  );
};

export default RevisionTracker;
