import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Calendar as CalendarIcon, Trash2, Award, BarChart2, TrendingUp, Cloud, CloudOff } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "firebase/auth";
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

// ⚠️ CORRECTION CRITIQUE : Nettoyage de l'ID de l'application
// Remplace les '/' et '.' par des '_' pour éviter de casser le chemin Firestore
const sanitizedAppId = appId.replace(/[\/.]/g, '_');

// 2. Configuration manuelle (Fallback)
if (!firebaseConfig) {
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
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // --- 1. Authentification ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erreur Auth:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Synchronisation Firestore ---
  useEffect(() => {
    if (!user) return;

    // Utilisation de sanitizedAppId ici
    const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
    
    setIsSyncing(true);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRevisionData(data.days || {});
      }
      setIsSyncing(false);
    }, (error) => {
      console.error("Erreur Firestore (Lecture):", error);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Gestion du Chronomètre ---
  const toggleTimer = () => {
    if (isRunning) {
      clearInterval(timerRef.current);
      saveSession();
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

  const saveSession = async () => {
    if (timer === 0 || !user) return;

    const today = getLocalDateString();
    const currentTotal = revisionData[today] || 0;
    const newTotal = currentTotal + timer;
    
    const newData = {
      ...revisionData,
      [today]: newTotal
    };

    setRevisionData(newData);
    setIsSyncing(true);

    try {
      // Utilisation de sanitizedAppId ici aussi
      const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
      await setDoc(docRef, { days: newData }, { merge: true });
    } catch (e) {
      console.error("Erreur de sauvegarde:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

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

  const formatCalendarTime = (totalSeconds) => {
    if (isNaN(totalSeconds)) return "0s";
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return minutes > 0 ? `${hours}h${minutes}` : `${hours}h`;
    return `${minutes}m`;
  };

  const getTotalRevisionTime = () => {
    const totalSeconds = Object.values(revisionData).reduce((a, b) => {
      // Sécurité : on s'assure que a et b sont des nombres
      return (Number(a) || 0) + (Number(b) || 0);
    }, 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const clearAllData = async () => {
    if (!user) return;
    if (window.confirm("Attention : Cela effacera définitivement l'historique sur TOUS vos appareils. Continuer ?")) {
      try {
        const docRef = doc(db, 'artifacts', sanitizedAppId, 'users', user.uid, 'revision_data', 'year_2026');
        await setDoc(docRef, { days: {} });
        setRevisionData({});
      } catch (e) {
        console.error("Erreur effacement:", e);
      }
    }
  };

  // --- Stats Data ---
  const getMonthlyStats = () => {
    const monthlyTotals = Array(12).fill(0);
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
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
    
    return monthlyTotals.map((seconds, index) => ({
      month: monthNames[index],
      seconds: seconds,
      heightPercentage: (seconds / maxSeconds) * 100,
      hours: (seconds / 3600).toFixed(1)
    }));
  };

  const getBestDay = () => {
    let maxSeconds = 0;
    let bestDate = '-';
    Object.entries(revisionData).forEach(([date, seconds]) => {
      if (typeof seconds === 'number' && seconds > maxSeconds) {
        maxSeconds = seconds;
        bestDate = date;
      }
    });
    if (maxSeconds === 0) return { date: 'Aucun', time: '-' };
    const parts = bestDate.split('-');
    if (parts.length < 3) return { date: bestDate, time: formatCalendarTime(maxSeconds) };
    
    const [y, m, d] = parts;
    return { date: `${d}/${m}`, time: formatCalendarTime(maxSeconds) };
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex justify-center items-start pt-0 md:pt-10">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden min-h-screen md:min-h-[800px] md:h-auto md:rounded-3xl flex flex-col relative">
        
        {/* Header */}
        <header className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 shadow-lg z-10 rounded-b-[2rem]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Révisions 2026</h1>
              <div className="flex items-center gap-2 text-indigo-200 text-xs mt-1">
                {user ? (
                  <>
                    <Cloud size={12} />
                    <span>Synchronisé {isSyncing ? '...' : ''}</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={12} />
                    <span>Mode hors ligne</span>
                  </>
                )}
              </div>
            </div>
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
              <Award size={24} className="text-yellow-300" />
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between backdrop-blur-sm border border-white/5">
            <span className="text-indigo-100 text-sm font-medium">Total accumulé</span>
            <span className="text-xl font-bold font-mono">{getTotalRevisionTime()}</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 scrollbar-hide">
          
          {/* VUE TIMER */}
          {activeTab === 'timer' && (
            <div className="flex flex-col items-center justify-center h-full py-6 space-y-12">
              
              <div className="relative">
                {isRunning && (
                  <div className="absolute inset-0 rounded-full border-4 border-purple-400 opacity-20 animate-ping"></div>
                )}
                <div className={`relative flex items-center justify-center w-72 h-72 rounded-full border-[10px] transition-all duration-300 shadow-2xl ${isRunning ? 'border-purple-500 bg-purple-50' : 'border-gray-100 bg-white'}`}>
                  <div className="text-center flex flex-col items-center z-10">
                    <span className={`block text-6xl font-mono font-bold tracking-tighter tabular-nums ${isRunning ? 'text-purple-600' : 'text-gray-300'}`}>
                      {formatTimerDisplay(timer)}
                    </span>
                    <span className="text-gray-400 mt-4 font-bold uppercase text-xs tracking-[0.2em]">
                      {isRunning ? 'En cours...' : 'Prêt'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full px-8">
                <button
                  onClick={toggleTimer}
                  className={`w-full py-5 rounded-2xl shadow-xl text-xl font-bold tracking-wide transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 ${
                    isRunning 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Square size={24} fill="currentColor" /> STOP
                    </>
                  ) : (
                    <>
                      <Play size={28} fill="currentColor" /> GO
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* VUE CALENDRIER */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 pb-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xl font-bold text-gray-800">Calendrier</h2>
                <button 
                  onClick={clearAllData} 
                  className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {Array.from({ length: 12 }).map((_, monthIndex) => {
                  const date = new Date(2026, monthIndex, 1);
                  const monthName = date.toLocaleString('fr-FR', { month: 'long' });
                  const daysInMonth = new Date(2026, monthIndex + 1, 0).getDate();
                  const startDay = date.getDay() === 0 ? 6 : date.getDay() - 1;

                  return (
                    <div key={monthIndex} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <h3 className="capitalize font-bold text-indigo-900 mb-3 text-sm flex items-center gap-2">
                        {monthName}
                      </h3>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(day => (
                          <div key={day} className="text-[10px] text-gray-400 font-bold">{day}</div>
                        ))}
                        {Array.from({ length: startDay }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const dateStr = `2026-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const seconds = revisionData[dateStr] || 0;
                          const hasData = seconds > 0;

                          return (
                            <div key={dayNum} className="flex flex-col items-center h-8 justify-center">
                              <div className={`
                                w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-medium transition-all
                                ${hasData 
                                  ? 'bg-indigo-600 text-white shadow-sm' 
                                  : 'text-gray-300'
                                }
                              `}>
                                {dayNum}
                              </div>
                              {hasData && (
                                <div className="h-1 w-1 bg-green-400 rounded-full mt-0.5"></div>
                              )}
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

          {/* VUE STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-6 pb-4">
              <h2 className="text-xl font-bold text-gray-800 px-1">Progression</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-200">
                  <div className="flex items-center gap-1.5 mb-1 opacity-80">
                    <TrendingUp size={14} />
                    <span className="text-[10px] font-bold uppercase">Record Jour</span>
                  </div>
                  <div className="text-xl font-bold">{getBestDay().time}</div>
                  <div className="text-[10px] opacity-70">le {getBestDay().date}</div>
                </div>
                
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1 text-gray-400">
                    <Clock size={14} />
                    <span className="text-[10px] font-bold uppercase">Moyenne / mois</span>
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    {/* Moyenne simple sur les mois actifs ou 12 */}
                    {Math.floor(Object.values(revisionData).reduce((a, b) => (Number(a)||0) + (Number(b)||0), 0) / 12 / 3600)}h
                  </div>
                  <div className="text-[10px] text-gray-400">environ</div>
                </div>
              </div>

              {/* Graphique Mensuel */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-6 text-sm flex items-center gap-2">
                  <BarChart2 size={16} className="text-indigo-500" />
                  Heures par mois
                </h3>
                
                <div className="flex items-end justify-between h-40 gap-1">
                  {getMonthlyStats().map((stat, index) => (
                    <div key={index} className="flex flex-col items-center justify-end h-full w-full group cursor-pointer relative">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none">
                        {stat.hours} heures
                      </div>
                      
                      {/* Bar */}
                      <div className="w-full flex items-end justify-center h-full">
                         <div 
                          className={`w-3/4 rounded-t-md transition-all duration-700 ease-out ${stat.seconds > 0 ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-gray-100'}`}
                          style={{ height: `${Math.max(stat.heightPercentage, 4)}%` }} 
                        />
                      </div>
                      
                      {/* Label Month (FR) */}
                      <span className="text-[9px] text-gray-400 mt-2 font-medium tracking-tight">
                        {stat.month}
                      </span>
                    </div>
                  ))}
                </div>
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
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'stats' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <BarChart2 size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Stats</span>
          </button>
        </nav>

      </div>
    </div>
  );
};

export default RevisionTracker;
