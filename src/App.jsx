import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Calendar as CalendarIcon, User, Award, BarChart2, TrendingUp, Cloud, CloudOff, Edit2, Save, Trash2, LogIn, LogOut, Lock } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// --- GESTION INTELLIGENTE DE LA CONFIGURATION ---
let firebaseConfig;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  if (typeof __app_id !== 'undefined') {
    appId = __app_id;
  }
} catch (e) {
  console.log("Mode hors environnement Canvas détecté");
}

// Nettoyage de l'ID de l'application pour éviter les erreurs de chemin
const sanitizedAppId = appId.replace(/[\/.]/g, '_');

// 2. Configuration manuelle (Fallback)
if (!firebaseConfig) {
  // 👇👇👇 COLLE TES CLÉS FIREBASE ICI 👇👇👇
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

const RevisionTracker = () => {
  // --- États ---
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0); 
  const [revisionData, setRevisionData] = useState({}); 
  const [activeTab, setActiveTab] = useState('timer');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // États du Profil & Auth
  const [pseudo, setPseudo] = useState("Étudiant");
  const [isEditingPseudo, setIsEditingPseudo] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState('login'); // 'login' ou 'register'
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // --- 1. Authentification ---
  useEffect(() => {
    const initAuth = async () => {
      // Si on a déjà un utilisateur (ex: persistance locale), on ne fait rien
      if (auth.currentUser) return;

      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // On ne force pas l'anonyme si l'utilisateur s'est déconnecté volontairement,
          // mais au premier chargement, c'est utile.
           await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erreur Auth:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setRevisionData({}); // Reset des données si déconnexion
        setPseudo("Étudiant");
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Synchronisation Données & Profil ---
  useEffect(() => {
    if (!user) return;

    // A. Écouter les données de révision
    const dataRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
    const unsubscribeData = onSnapshot(dataRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRevisionData(data.days || {});
      } else {
        setRevisionData({});
      }
    });

    // B. Écouter le profil (Pseudo)
    const profileRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'profile', 'info');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pseudo) setPseudo(data.pseudo);
      }
    });

    return () => {
      unsubscribeData();
      unsubscribeProfile();
    };
  }, [user]);

  // --- Gestion du Chronomètre ---
  const toggleTimer = () => {
    if (isRunning) {
      clearInterval(timerRef.current);
      
      const endTime = Date.now();
      const elapsed = Math.floor((endTime - startTimeRef.current) / 1000);
      
      saveSession(elapsed);
      
      setIsRunning(false);
      setTimer(0);
    } else {
      startTimeRef.current = Date.now() - (timer * 1000);
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      setIsRunning(true);
    }
  };

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const saveSession = async (manualTime) => {
    const timeToSave = typeof manualTime === 'number' ? manualTime : timer;

    if (timeToSave <= 0 || !user) return;

    const today = getLocalDateString();
    const currentTotal = revisionData[today] || 0;
    const newTotal = currentTotal + timeToSave;
    
    const newData = {
      ...revisionData,
      [today]: newTotal
    };

    setRevisionData(newData);
    setIsSyncing(true);

    try {
      const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
      await setDoc(docRef, { days: newData }, { merge: true });
    } catch (e) {
      console.error("Erreur de sauvegarde:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Gestion du Profil & Auth ---
  const savePseudo = async () => {
    if (!user) return;
    setIsEditingPseudo(false);
    try {
      const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'profile', 'info');
      await setDoc(docRef, { pseudo: pseudo }, { merge: true });
    } catch (e) {
      console.error("Erreur sauvegarde profil:", e);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
        // On sauvegarde le pseudo par défaut pour le nouveau compte
        // Note: l'UID change, donc le useEffect va se relancer et charger les données (vides) du nouveau compte
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError("Cet e-mail existe déjà.");
      else if (error.code === 'auth/invalid-email') setAuthError("E-mail invalide.");
      else if (error.code === 'auth/weak-password') setAuthError("Mot de passe trop court (6 car. min).");
      else if (error.code === 'auth/wrong-password') setAuthError("Mauvais mot de passe.");
      else if (error.code === 'auth/user-not-found') setAuthError("Compte introuvable.");
      else setAuthError("Erreur : " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    // Optionnel : Reconnecter en anonyme automatiquement après déconnexion
    // await signInAnonymously(auth); 
  };

  const clearAllData = async () => {
    if (!user) return;
    if (window.confirm("Es-tu sûr de vouloir TOUT effacer (temps et historique) ?")) {
      try {
        const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
        await setDoc(docRef, { days: {} });
        setRevisionData({});
      } catch (e) {
        console.error("Erreur effacement:", e);
      }
    }
  };

  // --- Helpers ---
  const formatTimerDisplay = (totalSeconds) => {
    if (isNaN(totalSeconds)) return "00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const hDisplay = hours > 0 ? `${hours}:` : '';
    const mDisplay = hours > 0 ? String(minutes).padStart(2, '0') : minutes;
    const sDisplay = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hDisplay}${mDisplay}:${sDisplay}` : `${mDisplay}:${sDisplay}`;
  };

  const getTotalSeconds = () => {
    return Object.values(revisionData).reduce((a, b) => (Number(a)||0) + (Number(b)||0), 0);
  };

  const getTotalRevisionTime = () => {
    const totalSeconds = getTotalSeconds();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // --- Stats Data ---
  const getMonthlyStats = () => {
    const monthlyTotals = Array(12).fill(0);
    const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    
    Object.entries(revisionData).forEach(([dateStr, seconds]) => {
      if (!dateStr || typeof seconds !== 'number') return;
      const parts = dateStr.split('-');
      if (parts.length < 2) return;
      
      const monthIndex = parseInt(parts[1], 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyTotals[monthIndex] += seconds;
      }
    });

    const maxSeconds = Math.max(...monthlyTotals, 1);
    
    return monthlyTotals.map((seconds, index) => {
      let label = (seconds / 3600).toFixed(1) + 'h';
      if (seconds > 0 && seconds < 60) label = seconds + 's';
      else if (seconds > 0 && seconds < 3600) label = Math.floor(seconds/60) + 'm';

      return {
        month: monthNames[index],
        seconds: seconds,
        heightPercentage: (seconds / maxSeconds) * 100,
        label: label
      };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex justify-center items-start pt-0 md:pt-10">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden min-h-screen md:min-h-[800px] md:h-auto md:rounded-3xl flex flex-col relative">
        
        {/* Header Compact */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-yellow-300" />
              <span className="font-bold text-lg tracking-tight">Focus 2026</span>
            </div>
            <div className="flex items-center gap-2 text-blue-200 text-xs">
              {user && !user.isAnonymous ? (
                 <Cloud size={14} className={isSyncing ? "animate-pulse text-green-300" : "text-green-300"} />
              ) : (
                 <CloudOff size={14} className="text-gray-400" />
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 scrollbar-hide">
          
          {/* VUE 1 : CHRONO */}
          {activeTab === 'timer' && (
            <div className="flex flex-col items-center justify-center h-full py-6 space-y-10">
              <div className="text-center space-y-1">
                <h2 className="text-gray-500 font-medium text-sm uppercase tracking-widest">Bonjour</h2>
                <h1 className="text-3xl font-bold text-gray-800">{pseudo}</h1>
              </div>

              <div className="relative group cursor-pointer" onClick={toggleTimer}>
                {isRunning && (
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-400 opacity-20 animate-ping"></div>
                )}
                <div className={`relative flex items-center justify-center w-64 h-64 rounded-full border-[8px] transition-all duration-300 shadow-xl ${isRunning ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-gray-100 bg-white'}`}>
                  <div className="text-center flex flex-col items-center z-10">
                    <span className={`block text-5xl font-mono font-bold tracking-tighter tabular-nums ${isRunning ? 'text-indigo-600' : 'text-gray-300'}`}>
                      {formatTimerDisplay(timer)}
                    </span>
                    <span className="text-gray-400 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">
                      {isRunning ? 'Enregistrement...' : 'Appuyer pour lancer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full px-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
                   <Clock size={20} className="text-indigo-500 mb-2" />
                   <span className="text-2xl font-bold text-gray-800">{getTotalRevisionTime()}</span>
                   <span className="text-[10px] text-gray-400 uppercase font-bold">Total Révisé</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
                   <CalendarIcon size={20} className="text-green-500 mb-2" />
                   <span className="text-2xl font-bold text-gray-800">{getLocalDateString().split('-')[2]}</span>
                   <span className="text-[10px] text-gray-400 uppercase font-bold">Date du jour</span>
                </div>
              </div>
            </div>
          )}

          {/* VUE 2 : CALENDRIER & STATS */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 pb-4">
              <div className="px-1">
                <h2 className="text-xl font-bold text-gray-800">Historique</h2>
              </div>

              {/* 1. Graphique intégré */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                    <BarChart2 size={16} className="text-indigo-500" />
                    Progression
                  </h3>
                </div>
                
                <div className="flex items-end justify-between h-32 gap-1">
                  {getMonthlyStats().map((stat, index) => (
                    <div key={index} className="flex flex-col items-center justify-end h-full w-full group relative">
                       {/* Tooltip Intelligent */}
                       {stat.seconds > 0 && (
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded transition-opacity">
                            {stat.label}
                          </div>
                       )}
                       <div className="w-full flex items-end justify-center h-full">
                         <div 
                          className={`w-2/3 rounded-t-sm transition-all duration-500 ${stat.seconds > 0 ? 'bg-indigo-500' : 'bg-gray-100'}`}
                          style={{ height: `${Math.max(stat.heightPercentage, 5)}%` }} 
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 mt-1 font-medium">{stat.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Calendrier détaillé */}
              <div className="flex flex-col gap-4">
                {Array.from({ length: 12 }).map((_, monthIndex) => {
                  const date = new Date(2026, monthIndex, 1);
                  const monthName = date.toLocaleString('fr-FR', { month: 'long' });
                  const daysInMonth = new Date(2026, monthIndex + 1, 0).getDate();
                  const startDay = date.getDay() === 0 ? 6 : date.getDay() - 1;

                  return (
                    <div key={monthIndex} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <h3 className="capitalize font-bold text-indigo-900 mb-2 text-sm">
                        {monthName}
                      </h3>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                          <div key={i} className="text-[9px] text-gray-300 font-bold">{day}</div>
                        ))}
                        {Array.from({ length: startDay }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const dateStr = `2026-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const seconds = revisionData[dateStr] || 0;
                          const hasData = seconds > 0;
                          
                          const intensity = Math.min(Math.floor(seconds / 3600), 3);
                          const bgColors = ['bg-indigo-100', 'bg-indigo-300', 'bg-indigo-500', 'bg-indigo-700'];
                          const txtColors = ['text-indigo-700', 'text-white', 'text-white', 'text-white'];

                          return (
                            <div key={dayNum} className="flex flex-col items-center h-7 justify-center">
                              <div className={`
                                w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-medium transition-all
                                ${hasData 
                                  ? `${bgColors[intensity] || 'bg-indigo-500'} ${txtColors[intensity] || 'text-white'}` 
                                  : 'text-gray-300 bg-gray-50'
                                }
                              `}>
                                {dayNum}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VUE 3 : PROFIL & AUTH */}
          {activeTab === 'profile' && (
            <div className="flex flex-col h-full py-6 space-y-6">
              
              {/* Carte Profil */}
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-200 to-blue-300 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner relative">
                  <User size={48} className="text-white" />
                  {user && user.isAnonymous && (
                    <div className="absolute bottom-0 right-0 bg-gray-500 text-white rounded-full p-1 border-2 border-white" title="Compte Anonyme">
                      <Lock size={12} />
                    </div>
                  )}
                </div>
                
                {isEditingPseudo ? (
                  <div className="flex items-center justify-center gap-2">
                    <input 
                      type="text" 
                      value={pseudo} 
                      onChange={(e) => setPseudo(e.target.value)}
                      className="border-b-2 border-indigo-500 text-center text-2xl font-bold text-gray-800 focus:outline-none bg-transparent w-40"
                      autoFocus
                    />
                    <button onClick={savePseudo} className="bg-indigo-600 text-white p-1 rounded-md">
                      <Save size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 group">
                    <h2 className="text-2xl font-bold text-gray-800">{pseudo}</h2>
                    <button onClick={() => setIsEditingPseudo(true)} className="text-gray-400 hover:text-indigo-500">
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-1 bg-gray-100 inline-block px-2 py-1 rounded-full">
                  {user && user.email ? user.email : "Mode Anonyme (local)"}
                </p>
              </div>

              {/* Carte Temps Total */}
              <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg mx-2">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <Clock size={20} />
                  <span className="font-bold text-sm uppercase tracking-wide">Temps Total</span>
                </div>
                <div className="text-4xl font-bold font-mono tracking-tight">{getTotalRevisionTime()}</div>
              </div>

              {/* Section Connexion / Inscription */}
              <div className="mx-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Cloud size={18} className="text-indigo-500" />
                  Compte & Sauvegarde
                </h3>

                {user && !user.isAnonymous ? (
                  <div className="space-y-3">
                    <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2">
                       <Cloud size={16} /> Compte connecté et synchronisé.
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-200"
                    >
                      <LogOut size={16} /> Se déconnecter
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                     <p className="text-xs text-gray-500 mb-2">
                       Connecte-toi pour sauvegarder tes données et y accéder depuis un autre appareil.
                     </p>
                     
                     <div className="flex gap-2 bg-gray-100 p-1 rounded-lg mb-3">
                       <button 
                         onClick={() => {setAuthMode('login'); setAuthError("");}}
                         className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${authMode === 'login' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                       >
                         Connexion
                       </button>
                       <button 
                         onClick={() => {setAuthMode('register'); setAuthError("");}}
                         className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${authMode === 'register' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                       >
                         Inscription
                       </button>
                     </div>

                     <form onSubmit={handleAuth} className="space-y-2">
                       <input 
                         type="email" 
                         placeholder="E-mail"
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
                         required
                       />
                       <input 
                         type="password" 
                         placeholder="Mot de passe (6+ caractères)"
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
                         required
                       />
                       
                       {authError && <p className="text-xs text-red-500">{authError}</p>}

                       <button 
                         type="submit"
                         className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2"
                       >
                         {authMode === 'login' ? <LogIn size={16} /> : <User size={16} />}
                         {authMode === 'login' ? "Se connecter" : "Créer un compte"}
                       </button>
                     </form>
                  </div>
                )}
              </div>

              {/* Zone Danger */}
              <div className="mx-2">
                <button 
                  onClick={clearAllData}
                  className="w-full py-3 text-red-400 text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  Réinitialiser les données
                </button>
              </div>
            </div>
          )}

        </main>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 px-6 py-2 flex justify-between items-center z-20 md:rounded-b-3xl pb-safe">
          <button 
            onClick={() => setActiveTab('timer')}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'timer' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Clock size={22} strokeWidth={activeTab === 'timer' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Chrono</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <CalendarIcon size={22} strokeWidth={activeTab === 'calendar' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Calendrier</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'profile' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Profil</span>
          </button>
        </nav>

      </div>
    </div>
  );
};

export default RevisionTracker;
