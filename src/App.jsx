import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const translations = {
  en: { logo: 'MILKAR', join: 'Join', create: 'Host', per: 'Each', note: 'Fun note?', close: 'Settle & Archive', logout: 'Logout', history: 'Settled Parties', leaderboard: 'Speed Leaderboard', summary: 'WhatsApp Summary' },
  hi: { logo: 'मिलकर', join: 'जुड़ें', create: 'होस्ट', per: 'प्रति व्यक्ति', note: 'संदेश', close: 'सेटल करें', logout: 'लॉग आउट', history: 'पुराने हिसाब', leaderboard: 'सबसे तेज़', summary: 'व्हाट्सएप समरी' },
  hr: { logo: 'मिलकर', join: 'आजा', create: 'जोड़', per: 'एक के', note: 'मजाक', close: 'मेट दयो', logout: 'बाहर', history: 'पुराने', leaderboard: 'सबसे पहले', summary: 'व्हाट्सएप समरी' }
};

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('milkar_user')) || null);
  const [tempUser, setTempUser] = useState({ name: '', upi: '' });
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [events, setEvents] = useState([]);
  const [archive, setArchive] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', totalAmount: '', memberCount: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState(JSON.parse(localStorage.getItem('unlocked_rooms')) || []);

  const t = translations[lang];

  const templates = [
    { name: 'Birthday', icon: '🎂' },
    { name: 'Farewell', icon: '💐' },
    { name: 'Holi', icon: '🔫' },
    { name: 'Diwali', icon: '🪔' },
    { name: 'Pooja', icon: '🙏' },
    { name: 'Lunch/Dinner', icon: '🍽️' },
    { name: 'Cab/Travel', icon: '🚗' },
    { name: 'Kitty Party', icon: '💃' }
  ];

  // Automated Cleanup: Archives rooms older than 48h or fully paid
  const autoArchiveCheck = async (allEvents) => {
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    for (const ev of allEvents) {
      const isFull = (ev.contributions?.length || 0) >= ev.memberCount;
      const createdAtMs = ev.createdAt?.seconds ? ev.createdAt.seconds * 1000 : Date.now();
      
      if (isFull || createdAtMs < fortyEightHoursAgo) {
        try {
          await setDoc(doc(db, "archive", ev.id), { ...ev, archivedAt: Date.now(), autoArchived: true });
          await deleteDoc(doc(db, "events", ev.id));
        } catch (e) { console.error("Auto-archive error", e); }
      }
    }
  };

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEvents(fetched);
      autoArchiveCheck(fetched);
    });
    const qA = query(collection(db, "archive"), orderBy("archivedAt", "desc"));
    const unsubscribeA = onSnapshot(qA, (snapshot) => {
      setArchive(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => { unsubscribe(); unsubscribeA(); };
  }, []);

  const handleLogin = () => {
    if (!tempUser.name || !tempUser.upi.includes('@')) return alert("Enter valid Name and UPI ID");
    localStorage.setItem('milkar_user', JSON.stringify(tempUser));
    setUser(tempUser);
  };

  const handleLogout = () => { if(confirm("Logout?")) { localStorage.removeItem('milkar_user'); setUser(null); } };

  const createEvent = async () => {
    if (!form.title || !form.totalAmount || !form.memberCount) return alert("Fill all fields");
    const perPerson = (parseFloat(form.totalAmount) / parseInt(form.memberCount)).toFixed(2);
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    await addDoc(collection(db, "events"), { ...form, perPerson, roomCode, creator: user.name, creatorUpi: user.upi, contributions: [], createdAt: serverTimestamp() });
    const updated = [...unlockedRooms, roomCode];
    setUnlockedRooms(updated);
    localStorage.setItem('unlocked_rooms', JSON.stringify(updated));
    setShowModal(false);
    setForm({ title: '', totalAmount: '', memberCount: '' });
  };

  const shareSummary = (ev) => {
    const contributions = [...(ev.contributions || [])].sort((a, b) => a.time - b.time);
    const paidCount = contributions.length;
    let text = `*MILKAR UPDATE: ${ev.title}* 📢\n\n✅ *Paid:* ${paidCount}/${ev.memberCount}\n⏳ *Pending:* ${ev.memberCount - paidCount}\n\n`;
    if (paidCount > 0) {
      text += `*Speed Leaderboard:* 🏆\n`;
      contributions.slice(0, 5).forEach((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
        text += `${medal} ${c.name}\n`;
      });
    }
    text += `\nPay & Join here: ${window.location.origin}\nCode: *${ev.roomCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePaid = async (ev) => {
    if (ev.contributions?.some(c => c.name === user.name)) return alert("Already paid!");
    const note = prompt(t.note) || "Paid!";
    const newCount = (ev.contributions?.length || 0) + 1;
    await updateDoc(doc(db, "events", ev.id), { contributions: arrayUnion({ name: user.name, note, time: Date.now() }) });
    confetti({ particleCount: newCount >= ev.memberCount ? 400 : 150, spread: 100 });
  };

  const formatTime = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    return sec < 60 ? 'Just now' : `${Math.floor(sec/60)}m ago`;
  };

  if (!user) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-slate-50 text-black'} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-sm p-10 rounded-[2.5rem] ${dark ? 'bg-zinc-900' : 'bg-white shadow-xl'} text-center`}>
          <h1 className="text-4xl font-black text-blue-500 italic mb-12 uppercase tracking-tighter">Milkar</h1>
          <input type="text" placeholder="Name" className="w-full p-5 mb-4 rounded-2xl bg-zinc-500/10 outline-none focus:border-blue-500 border border-transparent" onChange={e => setTempUser({...tempUser, name: e.target.value})} />
          <input type="text" placeholder="UPI ID" className="w-full p-5 mb-8 rounded-2xl bg-zinc-500/10 outline-none focus:border-blue-500 border border-transparent" onChange={e => setTempUser({...tempUser, upi: e.target.value})} />
          <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white uppercase tracking-widest">Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-black'} font-sans transition-colors duration-500`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 z-50 ${dark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'} border-b ${dark ? 'border-white/5' : 'border-slate-100'}`}>
        <h1 className="text-2xl font-black italic text-blue-500 uppercase tracking-tighter">Milkar</h1>
        <div className="flex gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : lang === 'hi' ? 'hr' : 'en')} className="text-[10px] font-black px-4 py-2 bg-zinc-500/10 rounded-full">{lang.toUpperCase()}</button>
          <button onClick={() => setDark(!dark)} className="p-2 bg-zinc-500/10 rounded-full">{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-6 pb-32">
        <div className="flex gap-2 mb-10">
          <input type="text" placeholder="Room Code" className="flex-1 bg-zinc-500/10 p-5 rounded-2xl outline-none" value={inputCode} onChange={e => setInputCode(e.target.value)} />
          <button onClick={() => {
            if(events.some(e => e.roomCode === inputCode)) {
              const updated = [...unlockedRooms, inputCode];
              setUnlockedRooms(updated);
              localStorage.setItem('unlocked_rooms', JSON.stringify(updated));
              setInputCode('');
            } else { alert("Invalid Room Code"); }
          }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">Join</button>
        </div>

        <button onClick={() => setShowModal(true)} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg shadow-blue-500/20 uppercase tracking-widest">+ Host Event</button>

        <div className="space-y-12">
          {events.filter(ev => unlockedRooms.includes(ev.roomCode)).map(ev => {
            const contributions = [...(ev.contributions || [])].sort((a, b) => a.time - b.time);
            const paid = contributions.length;
            const isFull = paid >= ev.memberCount;

            return (
              <div key={ev.id} className={`p-8 rounded-[3.5rem] border ${dark ? 'bg-zinc-900/40 border-white/5 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-widest">{ev.title}</p>
                    <h2 className="text-5xl font-black tracking-tighter">₹{ev.perPerson}</h2>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {ev.creator === user.name && (
                      <button onClick={() => shareSummary(ev)} className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10 uppercase flex items-center gap-1">
                        <span>📱</span> {t.summary}
                      </button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(ev.roomCode); alert("Code Copied!"); }} className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/10 uppercase">#{ev.roomCode}</button>
                  </div>
                </div>

                <div className="mb-8">
                    <div className="h-1.5 w-full bg-zinc-500/10 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(paid / ev.memberCount) * 100}%` }}></div>
                    </div>
                    <p className="text-[9px] font-black opacity-30 mt-3 uppercase tracking-widest">{paid} / {ev.memberCount} PAID</p>
                </div>

                <div className="flex flex-col items-center mb-10">
                    <div className="p-4 rounded-[2.5rem] bg-white shadow-lg">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${ev.perPerson}&cu=INR`} className="w-24 h-24" alt="QR" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  <button onClick={() => window.open(`https://wa.me/?text=Reminder: Pay ₹${ev.perPerson} for ${ev.title}. Code: ${ev.roomCode}`, '_blank')} className="py-4 bg-zinc-500/10 rounded-2xl font-black text-[10px] uppercase">Nudge</button>
                  <button disabled={isFull} onClick={() => handlePaid(ev)} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${isFull ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-600 text-white'}`}>
                    {isFull ? "CLOSED" : "I'VE PAID"}
                  </button>
                </div>

                {paid > 0 && (
                  <div className="pt-6 border-t border-white/5">
                    <h4 className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-4 text-center">{t.leaderboard}</h4>
                    <div className="space-y-2">
                      {contributions.map((c, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black opacity-40">{i + 1}</span>
                            <span className="text-[10px] font-black tracking-wide uppercase">{c.name} {i === 0 && '🥇'} {i === 1 && '🥈'} {i === 2 && '🥉'}</span>
                          </div>
                          <div className="text-right">
                              <p className="text-[8px] font-black text-blue-500 opacity-60">{formatTime(c.time)}</p>
                              <p className="text-[9px] italic opacity-30">"{c.note}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {ev.creator === user.name && (
                  <div className="mt-6 flex justify-between items-center opacity-30 hover:opacity-100 transition-opacity">
                    <button onClick={async () => confirm("End Room?") && await deleteDoc(doc(db, "events", ev.id))} className="text-[8px] font-black text-red-500 uppercase">End Room</button>
                    {isFull && <button onClick={() => { if(confirm("Archive?")) { setDoc(doc(db, "archive", ev.id), { ...ev, archivedAt: Date.now() }); deleteDoc(doc(db, "events", ev.id)); confetti(); } }} className="text-[8px] font-black text-emerald-500 uppercase">{t.close}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {archive.length > 0 && (
          <section className="mt-24 border-t border-white/5 pt-12">
            <h3 className="text-[9px] font-black opacity-30 uppercase tracking-[0.4em] mb-8 px-2">{t.history}</h3>
            <div className="space-y-4">
              {archive.map(ev => (
                <div key={ev.id} className={`p-6 rounded-[2rem] border flex justify-between items-center ${dark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-100/50 border-slate-200 opacity-60'}`}>
                  <div><p className="text-[9px] font-black opacity-40 uppercase mb-1">{ev.title}</p><p className="text-xl font-black tracking-tighter">₹{ev.perPerson}</p></div>
                  <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full uppercase">Settled</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-32">
          <div className={`p-8 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black tracking-tighter uppercase">{user.name}</h4>
              <button onClick={handleLogout} className="text-[10px] font-black px-6 py-2 bg-red-500/10 text-red-500 rounded-full border border-red-500/10 uppercase tracking-widest">{t.logout}</button>
            </div>
            <div className="pt-8 border-t border-white/10">
              <h4 className="text-lg font-black tracking-tighter uppercase mb-1">Sarthak Gupta</h4>
              <p className="text-[11px] font-medium italic opacity-40 leading-relaxed max-w-[280px]">A lefty creating productive applications so that you could be lazy</p>
            </div>
          </div>
        </section>
      </main>

      {showModal && (
        <div className={`fixed inset-0 ${dark ? 'bg-black/98' : 'bg-white/98'} z-[60] flex items-center justify-center p-6`}>
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'}`}>
            <h3 className="text-xl font-black mb-6 text-blue-500 italic uppercase">Setup Event</h3>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
              {templates.map(temp => (
                <button key={temp.name} onClick={() => setForm({...form, title: temp.name})} className="px-4 py-2 bg-zinc-500/10 rounded-xl text-[10px] font-bold whitespace-nowrap border border-white/5 active:scale-95 transition-all">
                  {temp.icon} {temp.name}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Activity" value={form.title} className="w-full p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-3">
                <input type="number" placeholder="₹ Total" value={form.totalAmount} className="w-1/2 p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, totalAmount: e.target.value})} />
                <input type="number" placeholder="People" value={form.memberCount} className="w-1/2 p-5 rounded-2xl bg-zinc-500/10 outline-none" onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              <button onClick={createEvent} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black mt-4 uppercase tracking-[0.2em]">Launch</button>
              <button onClick={() => setShowModal(false)} className="w-full text-[10px] font-black opacity-30 uppercase mt-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}