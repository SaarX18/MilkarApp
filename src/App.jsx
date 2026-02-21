import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy } from 'firebase/firestore';

const translations = {
  en: { logo: 'MILKAR', join: 'Join Event', create: 'Host Event', code: 'Room Code', setup: 'Profile Setup', per: 'Per Head', note: 'Add a fun note', remind: 'Nudge Friends', theme: 'Mode' },
  hi: { logo: 'मिलकर', join: 'इवेंट में जुड़ें', create: 'नया होस्ट करें', code: 'कोड डालें', setup: 'प्रोफ़ाइल', per: 'प्रति व्यक्ति', note: 'संदेश लिखें', remind: 'याद दिलाएं', theme: 'थीम' },
  hr: { logo: 'मिलकर', join: 'पार्टी में आओ', create: 'खर्चा जोड़ो', code: 'कोड भरो', setup: 'नाम पता', per: 'एक जने के', note: 'गाली मत लिखना', remind: 'उगाही करो', theme: 'रंग' }
};

const quotes = [
  "Money can't buy happiness, but it can buy Pizza. Split it!",
  "Friends who pay on time stay together.",
  "Be the friend who pays, not the one who 'forgot' their wallet.",
  "Scanning this is cheaper than a therapy session.",
  "A lefty created this so you could be lazy. Respect!",
  "Don't let the bill be the end of your friendship.",
  "Calculating... please don't be a miser today!"
];

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('milkar_user')) || null);
  const [tempUser, setTempUser] = useState({ name: '', upi: '' });
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [quote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', totalAmount: '', memberCount: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState(JSON.parse(localStorage.getItem('unlocked_rooms')) || []);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    if (!tempUser.name || !tempUser.upi.includes('@')) return alert("UPI correctly fill kar bhai!");
    localStorage.setItem('milkar_user', JSON.stringify(tempUser));
    setUser(tempUser);
  };

  const createEvent = async () => {
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const perPerson = (parseFloat(form.totalAmount) / parseInt(form.memberCount)).toFixed(2);
    
    await addDoc(collection(db, "events"), { 
      ...form, 
      roomCode,
      creator: user.name,
      creatorUpi: user.upi,
      perPerson,
      createdAt: Date.now(), 
      contributions: [] 
    });
    
    setUnlockedRooms([...unlockedRooms, roomCode]);
    localStorage.setItem('unlocked_rooms', JSON.stringify([...unlockedRooms, roomCode]));
    setShowModal(false);
  };

  const t = translations[lang];

  if (!user) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex items-center justify-center p-6 transition-colors`}>
        <div className={`w-full max-w-md p-10 rounded-[3rem] shadow-2xl ${dark ? 'bg-slate-900 border border-white/5' : 'bg-white border border-slate-200'}`}>
          <h1 className="text-4xl font-black text-blue-500 italic mb-2">MILKAR</h1>
          <p className="text-[11px] font-bold opacity-50 mb-8 uppercase tracking-widest italic">"{quote}"</p>
          <input type="text" placeholder="Name" className="w-full p-5 mb-4 rounded-2xl bg-slate-500/10 border border-white/10" onChange={e => setTempUser({...tempUser, name: e.target.value})} />
          <input type="text" placeholder="UPI ID (name@upi)" className="w-full p-5 mb-6 rounded-2xl bg-slate-500/10 border border-white/10" onChange={e => setTempUser({...tempUser, upi: e.target.value})} />
          <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white">LET'S SPLIT</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} transition-all pb-24`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 backdrop-blur-md z-50 border-b ${dark ? 'bg-slate-950/80 border-white/5' : 'bg-white/80 border-slate-200'}`}>
        <h1 className="text-2xl font-black italic text-blue-500">MILKAR</h1>
        <div className="flex gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : lang === 'hi' ? 'hr' : 'en')} className="text-xs font-bold px-3 py-2 bg-blue-500/10 rounded-xl">🌐 {lang.toUpperCase()}</button>
          <button onClick={() => setDark(!dark)} className="p-2 bg-blue-500/10 rounded-xl">{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-6">
        <p className="text-center text-[11px] font-bold opacity-40 uppercase tracking-[0.2em] mb-10">"{quote}"</p>

        {/* Join Room */}
        <div className={`mb-10 p-8 rounded-[2.5rem] ${dark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'} border shadow-xl`}>
          <div className="flex gap-2">
            <input type="text" placeholder={t.code} className="flex-1 bg-slate-500/10 p-4 rounded-2xl outline-none" value={inputCode} onChange={e => setInputCode(e.target.value)} />
            <button onClick={() => {
              if (events.some(e => e.roomCode === inputCode)) {
                setUnlockedRooms([...unlockedRooms, inputCode]);
                localStorage.setItem('unlocked_rooms', JSON.stringify([...unlockedRooms, inputCode]));
                setInputCode('');
              }
            }} className="px-8 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs">Join</button>
          </div>
        </div>

        <button onClick={() => setShowModal(true)} className={`w-full py-5 rounded-3xl font-black mb-12 shadow-2xl transition-transform active:scale-95 ${dark ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}>
          + {t.create.toUpperCase()}
        </button>

        {/* Event Cards */}
        <div className="space-y-12">
          {events.filter(ev => unlockedRooms.includes(ev.roomCode)).map(ev => (
            <div key={ev.id} className={`p-8 rounded-[3.5rem] border relative overflow-hidden ${dark ? 'bg-slate-900 border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ev.title}</span>
                  <h2 className="text-5xl font-black mt-1">₹{ev.perPerson}</h2>
                </div>
                <div className="text-right">
                    <p className="text-[10px] opacity-40 font-bold uppercase">Code</p>
                    <p className="font-black text-blue-500">{ev.roomCode}</p>
                </div>
              </div>

              {/* Unique Feature: Locked Amount QR */}
              <div className="flex flex-col items-center p-8 bg-slate-500/5 rounded-[2.5rem] mb-8 border border-white/5">
                <div className="bg-white p-4 rounded-3xl shadow-2xl">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`} className="w-36 h-36" alt="QR" />
                </div>
                <p className="mt-4 text-[10px] font-black opacity-30 uppercase">Scan to auto-fill ₹{ev.perPerson}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => window.open(`https://wa.me/?text=Pay ₹${ev.perPerson} for ${ev.title}. Code: ${ev.roomCode}`, '_blank')} className="py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl font-black text-[10px] uppercase">{t.remind}</button>
                <button onClick={async () => {
                  const n = prompt(t.note);
                  if (n !== null) await updateDoc(doc(db, "events", ev.id), { contributions: arrayUnion({ name: user.name, note: n || "Paid!", time: Date.now() }) });
                }} className={`py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg ${dark ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}>I've Paid</button>
              </div>
              
              {/* Activity Feed */}
              <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                 {ev.contributions?.map((c, i) => (
                   <div key={i} className="flex justify-between items-center text-[11px] font-bold opacity-60">
                     <span>{c.name} ✓</span>
                     <span className="italic">"{c.note}"</span>
                   </div>
                 ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[60] flex items-center justify-center p-6">
          <div className={`w-full max-w-md p-10 rounded-[4rem] border ${dark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
            <h3 className="text-3xl font-black mb-8 text-blue-500 italic">Plan Activity</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Activity Name" className="w-full p-5 rounded-2xl bg-slate-500/10 outline-none" onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-4">
                <input type="number" placeholder="Total ₹" className="w-1/2 p-5 rounded-2xl bg-slate-500/10 outline-none" onChange={e => setForm({...form, totalAmount: e.target.value})} />
                <input type="number" placeholder="Friends" className="w-1/2 p-5 rounded-2xl bg-slate-500/10 outline-none" onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              <button onClick={createEvent} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black mt-6">LAUNCH ROOM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}