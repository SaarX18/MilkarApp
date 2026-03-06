import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const translations = {
  en: { 
    logo: 'MILKAR', join: 'Join Room', create: 'Host Event', per: 'Each', note: 'Add a fun note?', 
    close: 'Settle & Archive', logout: 'Logout', history: 'Settled Parties', leaderboard: 'Speed Leaderboard', 
    summary: 'WhatsApp Summary', payNow: 'Pay via UPI App', edit: 'Edit Event', verify: 'Verify',
    loginTitle: 'Welcome to Milkar', loginSub: 'Privacy Priority: No UPI needed to join.', 
    enterName: 'Enter your name', loginBtn: 'Start Splitting', hostTitle: 'Setup your Party',
    activity: 'What is the activity?', total: 'Total Amount', people: 'No. of People', 
    upiLabel: 'Your UPI ID (To receive payments)', upiNote: 'Stored locally for this event only.',
    launch: 'Launch Event', cancel: 'Cancel', end: 'End Room', roomCode: 'Room Code',
    copy: 'Code Copied!', joinBtn: 'Join', pending: 'Pending Verification', 
    quote: 'Money is sensitive, friendships are more. Milkar keeps both safe.',
    enterCode: 'Enter 6-digit code'
  },
  hi: { 
    logo: 'मिलकर', join: 'कमरे में जुड़ें', create: 'होस्ट करें', per: 'प्रति व्यक्ति', note: 'कोई संदेश लिखें', 
    close: 'हिसाब खत्म करें', logout: 'लॉग आउट', history: 'पुराने हिसाब', leaderboard: 'सबसे तेज़ पेमेंट', 
    summary: 'व्हाट्सएप समरी', payNow: 'UPI ऐप से पे करें', edit: 'बदलाव करें', verify: 'पुष्टि करें',
    loginTitle: 'मिलकर में आपका स्वागत है', loginSub: 'गोपनीयता: जुड़ने के लिए UPI की ज़रूरत नहीं।',
    enterName: 'अपना नाम लिखें', loginBtn: 'आगे बढ़ें', hostTitle: 'पार्टी सेटअप करें',
    activity: 'कार्यक्रम का नाम?', total: 'कुल राशि', people: 'कुल लोग',
    upiLabel: 'आपका UPI ID (पैसे पाने के लिए)', upiNote: 'यह केवल इसी इवेंट के लिए इस्तेमाल होगा।',
    launch: 'इवेंट शुरू करें', cancel: 'वापस जाएं', end: 'कमरा बंद करें', roomCode: 'रूम कोड',
    copy: 'कोड कॉपी हुआ!', joinBtn: 'जुड़ें', pending: 'पुष्टि बाकी है', 
    quote: 'पैसे अपनी जगह, दोस्ती अपनी जगह। मिलकर रखे दोनों सुरक्षित।',
    enterCode: '6-अंकों का कोड लिखें'
  }
};

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('milkar_user')) || null);
  const [tempName, setTempName] = useState('');
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [events, setEvents] = useState([]);
  const [archive, setArchive] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', totalAmount: '', memberCount: '', upi: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState(JSON.parse(localStorage.getItem('unlocked_rooms')) || []);
  const [hasClickedPay, setHasClickedPay] = useState({});

  const t = translations[lang];

  const templates = [
    { name: 'Birthday', icon: '🎂' }, { name: 'Farewell', icon: '💐' },
    { name: 'Diwali', icon: '🪔' }, { name: 'Pooja', icon: '🙏' },
    { name: 'Lunch', icon: '🍽️' }, { name: 'Travel', icon: '🚗' }
  ];

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const qA = query(collection(db, "archive"), orderBy("archivedAt", "desc"));
    const unsubscribeA = onSnapshot(qA, (snapshot) => {
      setArchive(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => { unsubscribe(); unsubscribeA(); };
  }, []);

  const handleLogin = () => {
    if (!tempName) return alert(t.enterName);
    const uniqueUser = { name: tempName, id: `${tempName}#${Math.floor(1000 + Math.random() * 9000)}` };
    localStorage.setItem('milkar_user', JSON.stringify(uniqueUser));
    setUser(uniqueUser);
  };

  const createEvent = async () => {
    if (!form.title || !form.totalAmount || !form.memberCount || !form.upi) return alert("Fill all fields");
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const perPerson = (parseFloat(form.totalAmount) / parseInt(form.memberCount)).toFixed(2);
    await addDoc(collection(db, "events"), { 
      ...form, perPerson, roomCode, creator: user.name, creatorUpi: form.upi, creatorId: user.id, 
      contributions: [], createdAt: serverTimestamp() 
    });
    setUnlockedRooms(prev => [...prev, roomCode]);
    localStorage.setItem('unlocked_rooms', JSON.stringify([...unlockedRooms, roomCode]));
    setShowModal(false);
    setForm({ title: '', totalAmount: '', memberCount: '', upi: '' });
  };

  if (!user) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-sm p-10 rounded-[3rem] ${dark ? 'bg-zinc-900 border-white/5' : 'bg-white shadow-2xl border-slate-100'} border text-center`}>
          <h1 className="text-4xl font-black text-blue-500 italic mb-2 uppercase tracking-tighter">{t.logo}</h1>
          <p className="text-[11px] opacity-60 mb-8">{t.loginSub}</p>
          <input type="text" placeholder={t.enterName} className={`w-full p-5 mb-8 rounded-2xl outline-none ${dark ? 'bg-white/5' : 'bg-slate-100 border border-slate-200'}`} onChange={e => setTempName(e.target.value)} />
          <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white uppercase tracking-widest active:scale-95 transition-all">{t.loginBtn}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-slate-900'} transition-colors`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 z-50 border-b ${dark ? 'bg-black/80 border-white/5' : 'bg-white/80 border-slate-100'} backdrop-blur-md`}>
        <h1 className="text-2xl font-black italic text-blue-500 uppercase tracking-tighter">{t.logo}</h1>
        <div className="flex gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className={`text-[10px] font-black px-4 py-2 rounded-full border ${dark ? 'bg-zinc-800 border-white/10' : 'bg-slate-100 border-slate-200'}`}>{lang.toUpperCase()}</button>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-6 pb-32">
        <p className="mb-10 text-center opacity-40 italic text-[11px]">"{t.quote}"</p>

        <div className="flex gap-2 mb-10">
          <input type="text" placeholder={t.enterCode} className={`flex-1 p-5 rounded-2xl outline-none ${dark ? 'bg-zinc-900' : 'bg-slate-100 border border-slate-200'}`} value={inputCode} onChange={e => setInputCode(e.target.value)} />
          <button onClick={() => {
            if(events.some(e => e.roomCode === inputCode)) {
              setUnlockedRooms(prev => [...prev, inputCode]);
              localStorage.setItem('unlocked_rooms', JSON.stringify([...unlockedRooms, inputCode]));
              setInputCode('');
            } else alert("Invalid Code");
          }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">{t.joinBtn}</button>
        </div>

        <button onClick={() => setShowModal(true)} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg shadow-blue-500/20 uppercase tracking-widest">+ {t.create}</button>

        <div className="space-y-12">
          {events.filter(ev => unlockedRooms.includes(ev.roomCode)).map(ev => {
            const vCount = (ev.contributions || []).filter(c => c.verified).length;
            const isFull = vCount >= ev.memberCount;

            return (
              <div key={ev.id} className={`p-8 rounded-[3.5rem] border ${dark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase mb-1">{ev.title}</p>
                    <h2 className="text-5xl font-black tracking-tighter">₹{ev.perPerson}</h2>
                  </div>
                  <button className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase">#{ev.roomCode}</button>
                </div>

                <div className="h-1.5 w-full bg-zinc-500/10 rounded-full overflow-hidden mb-8">
                    <div className="h-full bg-blue-50 transition-all duration-1000" style={{ width: `${(vCount / ev.memberCount) * 100}%` }}></div>
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 rounded-[2.5rem] bg-white mb-6 border border-slate-100 shadow-inner">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`)}`} className="w-24 h-24" alt="QR" />
                    </div>
                    <a href={`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`} 
                       onClick={() => setTimeout(() => setHasClickedPay(prev => ({...prev, [ev.id]: true})), 2000)}
                       className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase text-center mb-3">{t.payNow}</a>
                    {hasClickedPay[ev.id] && !isFull && (
                      <button onClick={async () => {
                        const utr = prompt("Last 4 digits of UTR:");
                        if(!utr) return;
                        await updateDoc(doc(db, "events", ev.id), { contributions: arrayUnion({ name: user.name, userId: user.id, note: "Paid", utr, verified: false, time: Date.now() })});
                        setHasClickedPay(prev => ({...prev, [ev.id]: false}));
                      }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase animate-bounce">CONFIRM PAYMENT</button>
                    )}
                </div>

                {(ev.contributions || []).length > 0 && (
                  <div className="pt-6 border-t border-white/5 space-y-2">
                    {ev.contributions.map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${c.verified ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-orange-500/5 border-orange-500/10'}`}>
                        <span className="text-[10px] font-black uppercase">{c.name} {c.verified ? '✅' : '⏳'}</span>
                        {ev.creatorId === user.id && !c.verified && (
                          <button onClick={async () => {
                            const updated = ev.contributions.map(item => item.userId === c.userId ? {...item, verified: true} : item);
                            await updateDoc(doc(db, "events", ev.id), { contributions: updated });
                            confetti();
                          }} className="bg-emerald-600 text-white text-[8px] font-black px-3 py-1 rounded-full">{t.verify}</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {ev.creatorId === user.id && (
                  <div className="mt-8 flex justify-between">
                    <button onClick={async () => confirm("End?") && await deleteDoc(doc(db, "events", ev.id))} className="text-[8px] font-black text-red-500 uppercase opacity-40">{t.end}</button>
                    {isFull && <button onClick={async () => { await setDoc(doc(db, "archive", ev.id), { ...ev, archivedAt: Date.now() }); await deleteDoc(doc(db, "events", ev.id)); confetti(); }} className="text-[8px] font-black text-emerald-500 uppercase">{t.close}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
            <h3 className="text-xl font-black mb-6 text-blue-500 italic uppercase">{t.hostTitle}</h3>
            
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
              {templates.map(temp => (
                <button key={temp.name} onClick={() => setForm({...form, title: temp.name})} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${dark ? 'bg-zinc-800 border-white/5' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  {temp.icon} {temp.name}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <input type="text" placeholder={t.activity} value={form.title} className={`w-full p-5 rounded-2xl outline-none ${dark ? 'bg-white/5' : 'bg-slate-100 border border-slate-200'}`} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-3">
                <input type="number" placeholder={t.total} value={form.totalAmount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/5' : 'bg-slate-100 border border-slate-200'}`} onChange={e => setForm({...form, totalAmount: e.target.value})} />
                <input type="number" placeholder={t.people} value={form.memberCount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/5' : 'bg-slate-100 border border-slate-200'}`} onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              
              <div className="pt-4 border-t border-zinc-500/20">
                <p className="text-[10px] font-bold uppercase mb-2 text-blue-500">{t.upiLabel}</p>
                <input type="text" placeholder="example@upi" className={`w-full p-5 rounded-2xl outline-none ${dark ? 'bg-white/5' : 'bg-slate-100 border border-slate-200'}`} onChange={e => setForm({...form, upi: e.target.value})} />
                <p className="text-[8px] opacity-40 mt-2 italic">{t.upiNote}</p>
              </div>

              <button onClick={createEvent} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">{t.launch}</button>
              <button onClick={() => setShowModal(false)} className={`w-full py-3 text-[10px] font-black uppercase mt-2 ${dark ? 'text-white/30 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}