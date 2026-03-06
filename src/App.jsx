import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const translations = {
  en: { 
    logo: 'MILKAR', join: 'Join Room', create: 'New Collection', per: 'Per Person', note: 'Message/ID (Optional)', 
    close: 'Settle & Archive', logout: 'Logout', history: 'Past Collections', leaderboard: 'Paid List', 
    summary: 'Share Summary', payNow: 'Pay via UPI', edit: 'Edit', verify: 'Verify Payment',
    loginTitle: 'Welcome', loginSub: 'Fair splitting for everyone, everywhere.', 
    enterName: 'Enter your Name', loginBtn: 'Enter App', hostTitle: 'Start a Collection',
    activity: 'What is this for?', total: 'Total Amount', people: 'Total People', 
    upiLabel: 'Receive Funds at (UPI ID)', upiNote: 'Payments go directly to your account.',
    launch: 'Create Room', cancel: 'Go Back', end: 'Delete', roomCode: 'Room Code',
    copy: 'Code Copied!', joinBtn: 'Join', pending: 'Awaiting Verification', 
    quote: 'Easy tracking for any group. No more manual lists.',
    nudge: 'Send Reminder'
  },
  hi: { 
    logo: 'मिलकर', join: 'जुड़ें', create: 'नया कलेक्शन', per: 'प्रति व्यक्ति', note: 'संदेश/नाम (वैकल्पिक)', 
    close: 'हिसाब बंद करें', logout: 'लॉग आउट', history: 'पुराने हिसाब', leaderboard: 'पेमेंट लिस्ट', 
    summary: 'व्हाट्सएप समरी', payNow: 'UPI से पे करें', edit: 'बदलें', verify: 'पुष्टि करें',
    loginTitle: 'स्वागत है', loginSub: 'सबके लिए, हर जगह, सही और साफ हिसाब।',
    enterName: 'अपना नाम लिखें', loginBtn: 'ऐप खोलें', hostTitle: 'नया हिसाब शुरू करें',
    activity: 'किस लिए है?', total: 'कुल राशि', people: 'कुल लोग',
    upiLabel: 'UPI ID लिखें', upiNote: 'पैसे सीधे आपके बैंक में आएंगे।',
    launch: 'शुरू करें', cancel: 'वापस', end: 'हटाएं', roomCode: 'कोड',
    copy: 'कोड कॉपी हुआ!', joinBtn: 'जुड़ें', pending: 'पुष्टि का इंतज़ार है', 
    quote: 'ग्रुप का हिसाब अब आसान। मिलकर चुनें।',
    nudge: 'याद दिलाएं'
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tempName, setTempName] = useState('');
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [events, setEvents] = useState([]);
  const [archive, setArchive] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(null); 
  const [form, setForm] = useState({ title: '', totalAmount: '', memberCount: '', upi: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState([]);
  const [hasClickedPay, setHasClickedPay] = useState({});

  const t = translations[lang] || translations.en;

  const templates = [
    { name: 'Dinner', icon: '🍽️' }, { name: 'Gift', icon: '🎁' },
    { name: 'Trip', icon: '✈️' }, { name: 'Party', icon: '🎉' },
    { name: 'Rent/Bills', icon: '💵' }, { name: 'Other', icon: '✨' }
  ];

  useEffect(() => {
    const savedUser = localStorage.getItem('milkar_user');
    const savedRooms = localStorage.getItem('unlocked_rooms');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedRooms) setUnlockedRooms(JSON.parse(savedRooms));
    setLoading(false);
  }, []);

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
    if (!tempName) return alert("Please enter your name");
    const uniqueUser = { name: tempName, id: `${tempName}#${Math.floor(1000 + Math.random() * 9000)}` };
    localStorage.setItem('milkar_user', JSON.stringify(uniqueUser));
    setUser(uniqueUser);
  };

  const createOrUpdateEvent = async () => {
    if (!form.title || !form.totalAmount || !form.memberCount || (!isEditing && !form.upi)) return alert("Fill all details");
    try {
        const perPerson = (parseFloat(form.totalAmount) / parseInt(form.memberCount)).toFixed(2);
        if (isEditing) {
          await updateDoc(doc(db, "events", isEditing), { ...form, perPerson });
          setIsEditing(null);
        } else {
          const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
          await addDoc(collection(db, "events"), { 
            ...form, perPerson, roomCode, 
            creator: user.name, creatorUpi: form.upi, creatorId: user.id, 
            contributions: [], createdAt: serverTimestamp() 
          });
          const updatedUnlocked = [...unlockedRooms, roomCode];
          setUnlockedRooms(updatedUnlocked);
          localStorage.setItem('unlocked_rooms', JSON.stringify(updatedUnlocked));
        }
        setForm({ title: '', totalAmount: '', memberCount: '', upi: '' });
        setShowModal(false);
    } catch (e) { alert("Error connecting to database."); }
  };

  const shareSummary = (ev) => {
    const vContribs = (ev.contributions || []).filter(c => c.verified);
    let text = `*MILKAR: ${ev.title}* 📊\n\n✅ *Paid (${vContribs.length}/${ev.memberCount}):*\n`;
    vContribs.forEach((c, i) => { text += `• ${c.name}\n`; });
    text += `\n💰 *Per Head:* ₹${ev.perPerson}\nCode: *${ev.roomCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const sendNudge = (ev) => {
    const text = `*Reminder from Milkar* 🔔\n\nRegarding: *${ev.title}*\nPlease complete your contribution of *₹${ev.perPerson}*.\nUse Code: *${ev.roomCode}* at [YourLinkHere]`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic text-4xl tracking-tighter animate-pulse">MILKAR</div>;

  if (!user) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-slate-50 text-black'} flex items-center justify-center p-6 transition-colors duration-500`}>
        <div className={`w-full max-w-sm p-10 rounded-[3rem] ${dark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white shadow-2xl border-slate-100'} border text-center`}>
          <h1 className="text-5xl font-black text-blue-500 italic mb-2 uppercase tracking-tighter">{t.logo}</h1>
          <p className="text-[11px] opacity-60 mb-8 font-medium">{t.loginSub}</p>
          <input type="text" placeholder={t.enterName} className={`w-full p-5 mb-8 rounded-2xl outline-none transition-all ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black'}`} onChange={e => setTempName(e.target.value)} />
          <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white uppercase tracking-widest active:scale-95 transition-transform">{t.loginBtn}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-slate-900'} font-sans transition-colors duration-500`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md border-b ${dark ? 'bg-black/50 border-white/5' : 'bg-white/70 border-slate-100'}`}>
        <h1 className="text-2xl font-black italic text-blue-500 uppercase tracking-tighter">{t.logo}</h1>
        <div className="flex gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className={`text-[10px] font-black px-4 py-2 rounded-full border ${dark ? 'bg-zinc-800 border-white/10' : 'bg-slate-100 border-slate-200'}`}>{lang.toUpperCase()}</button>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-6 pb-32">
        <p className="mb-10 text-center opacity-40 italic text-[11px]">"{t.quote}"</p>

        <div className="flex gap-2 mb-10">
          <input type="text" placeholder={t.roomCode} className={`flex-1 p-5 rounded-2xl outline-none ${dark ? 'bg-zinc-900 text-white' : 'bg-slate-100 border border-slate-200 text-black'}`} value={inputCode} onChange={e => setInputCode(e.target.value)} />
          <button onClick={() => {
             if(events.some(e => e.roomCode === inputCode)) {
                const updated = [...unlockedRooms, inputCode];
                setUnlockedRooms(updated);
                localStorage.setItem('unlocked_rooms', JSON.stringify(updated));
                setInputCode('');
             } else alert("Invalid Code");
          }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">{t.joinBtn}</button>
        </div>

        <button onClick={() => { setIsEditing(null); setShowModal(true); }} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg shadow-blue-500/20 uppercase tracking-widest">+ {t.create}</button>

        <div className="space-y-12">
          {events.filter(ev => unlockedRooms.includes(ev.roomCode)).map(ev => {
            const contributions = [...(ev.contributions || [])].sort((a, b) => a.time - b.time);
            const verifiedCount = contributions.filter(c => c.verified).length;
            const isFull = verifiedCount >= ev.memberCount;

            return (
              <div key={ev.id} className={`p-8 rounded-[3.5rem] border ${dark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-widest">{ev.title}</p>
                    <h2 className={`text-5xl font-black tracking-tighter ${!dark && 'text-slate-900'}`}>₹{ev.perPerson}</h2>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(ev.roomCode); alert(t.copy); }} className={`text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase`}>#{ev.roomCode}</button>
                    {ev.creatorId === user.id && (
                      <div className="flex gap-2">
                        <button onClick={() => sendNudge(ev)} className="text-[8px] font-black text-orange-500 bg-orange-500/10 px-3 py-2 rounded-full uppercase">{t.nudge}</button>
                        <button onClick={() => shareSummary(ev)} className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-full uppercase">{t.summary}</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 rounded-[2.5rem] bg-white mb-6 border border-slate-100">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`)}`} className="w-24 h-24" alt="QR" />
                    </div>
                    <a href={`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`} 
                       onClick={() => setTimeout(() => setHasClickedPay(prev => ({...prev, [ev.id]: true})), 2000)}
                       className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase text-center mb-3">🚀 {t.payNow}</a>
                    {hasClickedPay[ev.id] && (
                      <button onClick={async () => {
                        const note = prompt(t.note) || "Paid";
                        await updateDoc(doc(db, "events", ev.id), { contributions: arrayUnion({ name: user.name, userId: user.id, note, verified: false, time: Date.now() }) });
                        setHasClickedPay(prev => ({...prev, [ev.id]: false}));
                      }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase animate-pulse">I'VE PAID (CLICK HERE)</button>
                    )}
                </div>

                {contributions.length > 0 && (
                  <div className={`pt-6 border-t ${dark ? 'border-white/5' : 'border-slate-200'} space-y-3`}>
                    <h4 className="text-[9px] font-black opacity-30 uppercase text-center mb-2">{t.leaderboard}</h4>
                    {contributions.map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border ${c.verified ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-orange-500/5 border-orange-500/20'}`}>
                        <div className="flex flex-col">
                           <span className={`text-[10px] font-black uppercase ${!dark && 'text-slate-700'}`}>{c.name} {c.verified ? '✅' : '⏳'}</span>
                           <p className="text-[9px] italic opacity-40">"{c.note}"</p>
                        </div>
                        {ev.creatorId === user.id && !c.verified && (
                          <button onClick={async () => {
                             const updated = ev.contributions.map(item => item.userId === c.userId ? {...item, verified: true} : item);
                             await updateDoc(doc(db, "events", ev.id), { contributions: updated });
                             confetti();
                          }} className="bg-emerald-600 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase">{t.verify}</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {ev.creatorId === user.id && (
                  <div className={`mt-8 flex justify-between border-t ${dark ? 'border-white/5' : 'border-slate-200'} pt-6`}>
                    <button onClick={async () => confirm("Delete Collection?") && await deleteDoc(doc(db, "events", ev.id))} className="text-[8px] font-black text-red-500 uppercase opacity-40 hover:opacity-100">{t.end}</button>
                    {isFull && <button onClick={async () => { await setDoc(doc(db, "archive", ev.id), { ...ev, archivedAt: Date.now() }); await deleteDoc(doc(db, "events", ev.id)); confetti(); }} className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-4 py-2 rounded-full">{t.close}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className={`mt-32 p-8 rounded-[3rem] border ${dark ? 'bg-zinc-900/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-10">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">My Profile</p>
                <h4 className={`text-xl font-black uppercase ${!dark && 'text-slate-900'}`}>{user.name}</h4>
              </div>
              <button onClick={() => { localStorage.removeItem('milkar_user'); setUser(null); }} className="text-[10px] font-black px-6 py-2 bg-red-500/10 text-red-500 rounded-full border border-red-500/10 uppercase">{t.logout}</button>
            </div>
            <div className="pt-8 border-t border-black/5 dark:border-white/10 opacity-40">
              <h4 className={`text-lg font-black uppercase mb-1 ${!dark && 'text-slate-900'}`}>Sarthak Gupta</h4>
              <p className="text-[11px] font-medium italic leading-relaxed max-w-[280px]">A lefty creating productive apps so that you can be lazy.</p>
            </div>
        </section>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
            <h3 className={`text-xl font-black mb-6 text-blue-500 italic uppercase`}>{t.hostTitle}</h3>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
              {templates.map(temp => (
                <button key={temp.name} onClick={() => setForm({...form, title: temp.name})} className={`px-4 py-2 rounded-xl text-[10px] font-bold border active:scale-95 transition-all whitespace-nowrap ${dark ? 'bg-zinc-800 border-white/5' : 'bg-slate-50 border-slate-200'}`}>{temp.icon} {temp.name}</button>
              ))}
            </div>
            <div className="space-y-4">
              <input type="text" placeholder={t.activity} value={form.title} className={`w-full p-5 rounded-2xl outline-none ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black'}`} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-3">
                <input type="number" placeholder={t.total} value={form.totalAmount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black'}`} onChange={e => setForm({...form, totalAmount: e.target.value})} />
                <input type="number" placeholder={t.people} value={form.memberCount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black'}`} onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              {!isEditing && (
                <div className="pt-4 border-t dark:border-white/5 border-black/5">
                  <p className="text-[10px] font-bold uppercase mb-2 text-blue-500">{t.upiLabel}</p>
                  <input type="text" placeholder="yourid@upi" value={form.upi} className={`w-full p-5 rounded-2xl outline-none mb-2 ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-black'}`} onChange={e => setForm({...form, upi: e.target.value})} />
                </div>
              )}
              <button onClick={createOrUpdateEvent} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em]">{isEditing ? t.edit : t.launch}</button>
              <button onClick={() => setShowModal(false)} className={`w-full py-3 text-[10px] font-black uppercase mt-2 opacity-50 ${!dark ? 'text-slate-900' : 'text-white'}`}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}