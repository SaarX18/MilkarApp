import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const translations = {
  en: { logo: 'MILKAR', join: 'Join', create: 'Host', per: 'Each', note: 'Fun note?', close: 'Settle & Archive', logout: 'Logout', history: 'Settled Parties', leaderboard: 'Speed Leaderboard', summary: 'WhatsApp Summary', payNow: 'Pay via UPI App', edit: 'Edit Event', verify: 'Verify' },
  hi: { logo: 'मिलकर', join: 'जुड़ें', create: 'होस्ट', per: 'प्रति व्यक्ति', note: 'संदेश', close: 'सेटल करें', logout: 'लॉग आउट', history: 'पुराने हिसाब', leaderboard: 'सबसे तेज़', summary: 'व्हाट्सएप समरी', payNow: 'UPI ऐप से पे करें', edit: 'बदलाव करें', verify: 'पुष्टि करें' },
  hr: { logo: 'मिलकर', join: 'आजा', create: 'जोड़', per: 'एक के', note: 'मजाक', close: 'मेट दयो', logout: 'बाहर', history: 'पुराने', leaderboard: 'सबसे पहले', summary: 'व्हाट्सएप समरी', payNow: 'सीधा पे कर', edit: 'बदलो', verify: 'चेक कर' }
};

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('milkar_user')) || null);
  const [tempUser, setTempUser] = useState({ name: '', upi: '' });
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [events, setEvents] = useState([]);
  const [archive, setArchive] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(null); 
  const [form, setForm] = useState({ title: '', totalAmount: '', memberCount: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState(JSON.parse(localStorage.getItem('unlocked_rooms')) || []);
  const [hasClickedPay, setHasClickedPay] = useState({});

  const t = translations[lang];

  const templates = [
    { name: 'Birthday', icon: '🎂' },
    { name: 'Farewell', icon: '💐' },
    { name: 'Diwali', icon: '🪔' },
    { name: 'Pooja', icon: '🙏' },
    { name: 'Lunch/Dinner', icon: '🍽️' },
    { name: 'Cab/Travel', icon: '🚗' },
    { name: 'Kitty Party', icon: '💃' }
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
    if (!tempUser.name || !tempUser.upi.includes('@')) return alert("Enter valid Name and UPI ID");
    const uniqueUser = { ...tempUser, id: `${tempUser.name}#${Math.floor(1000 + Math.random() * 9000)}` };
    localStorage.setItem('milkar_user', JSON.stringify(uniqueUser));
    setUser(uniqueUser);
  };

  const createOrUpdateEvent = async () => {
    if (!form.title || !form.totalAmount || !form.memberCount) return alert("Fill all fields");
    try {
        const perPerson = (parseFloat(form.totalAmount) / parseInt(form.memberCount)).toFixed(2);
        if (isEditing) {
          await updateDoc(doc(db, "events", isEditing), { ...form, perPerson });
          setIsEditing(null);
        } else {
          const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
          await addDoc(collection(db, "events"), { 
            ...form, perPerson, roomCode, 
            creator: user.name, creatorUpi: user.upi, creatorId: user.id, 
            contributions: [], createdAt: serverTimestamp() 
          });
          const updated = [...unlockedRooms, roomCode];
          setUnlockedRooms(updated);
          localStorage.setItem('unlocked_rooms', JSON.stringify(updated));
        }
        setForm({ title: '', totalAmount: '', memberCount: '' });
        setShowModal(false);
    } catch (e) { alert("Error!"); }
  };

  const handlePaidRequest = async (ev) => {
    const utr = prompt("Enter Last 4 digits of Ref/UTR No from your Bank app:");
    if (!utr || utr.length < 4) return alert("Required to prevent fake clicks.");
    const note = prompt(t.note) || "Paid!";
    
    await updateDoc(doc(db, "events", ev.id), { 
      contributions: arrayUnion({ 
        name: user.name, userId: user.id, note, utr, verified: false, time: Date.now() 
      }) 
    });
    alert("Sent! Host will verify and then you'll appear on leaderboard.");
    setHasClickedPay(prev => ({...prev, [ev.id]: false}));
  };

  const shareSummary = (ev) => {
    const vContribs = (ev.contributions || []).filter(c => c.verified).sort((a, b) => a.time - b.time);
    let text = `*MILKAR: ${ev.title}* 📢\n✅ Paid: ${vContribs.length}/${ev.memberCount}\n💰 Per Head: ₹${ev.perPerson}\nCode: *${ev.roomCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getUpiUrl = (ev) => `upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`;

  if (!user) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-slate-50 text-black'} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-sm p-10 rounded-[2.5rem] ${dark ? 'bg-zinc-900' : 'bg-white shadow-xl'} text-center`}>
          <h1 className="text-4xl font-black text-blue-500 italic mb-8 uppercase tracking-tighter">Milkar</h1>
          <input type="text" placeholder="Name" className="w-full p-5 mb-4 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setTempUser({...tempUser, name: e.target.value})} />
          <input type="text" placeholder="UPI ID" className="w-full p-5 mb-8 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setTempUser({...tempUser, upi: e.target.value})} />
          <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white uppercase tracking-widest">Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-black'} font-sans transition-all`}>
      <nav className="p-6 flex justify-between items-center sticky top-0 z-50 bg-inherit border-b border-white/5">
        <h1 className="text-2xl font-black italic text-blue-500 uppercase tracking-tighter">Milkar</h1>
        <div className="flex gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : lang === 'hi' ? 'hr' : 'en')} className="text-[10px] font-black px-4 py-2 bg-zinc-500/10 rounded-full">{lang.toUpperCase()}</button>
          <button onClick={() => setDark(!dark)} className="p-2 bg-zinc-500/10 rounded-full">{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-6 pb-32">
        <div className="mb-10 text-center opacity-40 italic text-[11px]">
          "Money is a sensitive matter, but friendships are more. Milkar keeps both safe."
        </div>

        <div className="flex gap-2 mb-10">
          <input type="text" placeholder="Room Code" className="flex-1 bg-zinc-500/10 p-5 rounded-2xl outline-none" value={inputCode} onChange={e => setInputCode(e.target.value)} />
          <button onClick={() => {
            if(events.some(e => e.roomCode === inputCode)) {
              setUnlockedRooms(prev => [...prev, inputCode]);
              localStorage.setItem('unlocked_rooms', JSON.stringify([...unlockedRooms, inputCode]));
              setInputCode('');
            } else alert("Invalid Code");
          }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">Join</button>
        </div>

        <button onClick={() => { setIsEditing(null); setForm({title:'', totalAmount:'', memberCount:''}); setShowModal(true); }} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg shadow-blue-500/20 uppercase tracking-widest">+ Host Event</button>

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
                    <h2 className="text-5xl font-black tracking-tighter">₹{ev.perPerson}</h2>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {ev.creatorId === user.id && (
                      <div className="flex gap-2">
                        <button onClick={() => { setForm(ev); setIsEditing(ev.id); setShowModal(true); }} className="p-2 bg-blue-500/10 rounded-full">✏️</button>
                        <button onClick={() => shareSummary(ev)} className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-full uppercase">📱 {t.summary}</button>
                      </div>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(ev.roomCode); alert("Code Copied!"); }} className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase">#{ev.roomCode}</button>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-zinc-500/10 rounded-full overflow-hidden mb-8">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(verifiedCount / ev.memberCount) * 100}%` }}></div>
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 rounded-[2.5rem] bg-white mb-6">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUpiUrl(ev))}`} className="w-24 h-24" alt="QR" />
                    </div>
                    <a href={getUpiUrl(ev)} onClick={() => setTimeout(() => setHasClickedPay(prev => ({...prev, [ev.id]: true})), 2000)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase text-center mb-3">🚀 {t.payNow}</a>
                    {hasClickedPay[ev.id] && !isFull && (
                      <button onClick={() => handlePaidRequest(ev)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase animate-bounce">I'VE PAID (CONFIRM)</button>
                    )}
                </div>

                {/* LEADERBOARD & STATUS SECTION */}
                {contributions.length > 0 && (
                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <h4 className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] text-center mb-2">{t.leaderboard}</h4>
                    {contributions.map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border ${c.verified ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-orange-500/5 border-orange-500/20'}`}>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase">{c.name} {c.verified ? (i < 3 ? ['🥇','🥈','🥉'][i] : '✅') : '⏳'}</span>
                           <p className="text-[9px] italic opacity-30">"{c.note}"</p>
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
                  <div className="mt-8 flex justify-between border-t border-white/5 pt-6">
                    <button onClick={async () => confirm("End Room?") && await deleteDoc(doc(db, "events", ev.id))} className="text-[8px] font-black text-red-500 uppercase opacity-40 hover:opacity-100">End Room</button>
                    {isFull && <button onClick={async () => { if(confirm("Archive?")) { await setDoc(doc(db, "archive", ev.id), { ...ev, archivedAt: Date.now() }); await deleteDoc(doc(db, "events", ev.id)); confetti(); } }} className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-4 py-2 rounded-full">{t.close}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SETTLED PARTIES (HISTORY) */}
        {archive.length > 0 && (
          <section className="mt-20">
            <h3 className="text-[9px] font-black opacity-30 uppercase tracking-[0.4em] mb-6">{t.history}</h3>
            <div className="space-y-3">
              {archive.map(ev => (
                <div key={ev.id} className={`p-6 rounded-[2rem] border ${dark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-100 border-slate-200'} flex justify-between items-center`}>
                  <div><p className="text-[9px] font-black opacity-40 uppercase mb-1">{ev.title}</p><p className="text-xl font-black">₹{ev.perPerson}</p></div>
                  <span className="text-[9px] font-black text-emerald-500 uppercase">Settled</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CREATOR SECTION */}
        <section className="mt-32 p-8 rounded-[3rem] border border-white/5 bg-zinc-900/40">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black uppercase">{user.name}</h4>
              <button onClick={() => { localStorage.removeItem('milkar_user'); setUser(null); }} className="text-[10px] font-black px-6 py-2 bg-red-500/10 text-red-500 rounded-full border border-red-500/10 uppercase">Logout</button>
            </div>
            <div className="pt-8 border-t border-white/10">
              <h4 className="text-lg font-black uppercase mb-1">Sarthak Gupta</h4>
              <p className="text-[11px] font-medium italic opacity-40 leading-relaxed max-w-[280px]">A lefty creating productive applications so that you could be lazy</p>
            </div>
        </section>
      </main>

      {/* HOST/EDIT MODAL WITH TEMPLATES */}
      {showModal && (
        <div className="fixed inset-0 bg-black/98 z-[60] flex items-center justify-center p-6">
          <div className="w-full max-w-sm p-10 rounded-[3rem] border border-white/10 bg-zinc-900 shadow-2xl">
            <h3 className="text-xl font-black mb-6 text-blue-500 italic uppercase tracking-tighter">{isEditing ? 'Badlo' : 'Milkar Setup'}</h3>
            {!isEditing && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {templates.map(temp => (
                  <button key={temp.name} onClick={() => setForm({...form, title: temp.name})} className="px-4 py-2 bg-zinc-500/10 rounded-xl text-[10px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all">
                    {temp.icon} {temp.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-4">
              <input type="text" placeholder="Activity" value={form.title} className="w-full p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-3">
                <input type="number" placeholder="₹ Total" value={form.totalAmount} className="w-1/2 p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, totalAmount: e.target.value})} />
                <input type="number" placeholder="People" value={form.memberCount} className="w-1/2 p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              <button onClick={createOrUpdateEvent} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">{isEditing ? 'Update' : 'Launch'}</button>
              <button onClick={() => setShowModal(false)} className="w-full text-[10px] font-black opacity-30 uppercase mt-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}