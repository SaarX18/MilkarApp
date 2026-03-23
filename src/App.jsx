import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, arrayUnion, query, orderBy, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const translations = {
  en: { 
    logo: 'MILKAR', join: 'Join Room', create: 'New Collection', per: 'Per Person', 
    history: 'Activity History', payNow: 'Pay via UPI', verify: 'Verify Payment',
    loginSub: 'Fair splitting for everyone, everywhere.', 
    enterName: 'Enter your Name', loginBtn: 'Enter App',
    activity: 'What is this for?', total: 'Total Budget (₹)', people: 'Total People', 
    fixedAmt: 'Fixed Amount (₹)', modeFixed: 'Fixed Collection', modeSplit: 'Split Budget',
    upiLabel: 'UPI ID', launch: 'Create Room', end: 'Delete Event', roomCode: 'Room Code',
    copy: 'Code Copied!', joinBtn: 'Join', about: 'How it Works', 
    typeOneTime: 'One-Time Split', typeSub: 'Prepaid Wallet', deduct: 'Deduct Fee',
    edit: 'Edit Event', save: 'Save Changes', alreadyPaid: 'Already notified the host!',
    eventFull: 'This event is 100% funded!', collected: 'Collected', credit: 'Credit'
  },
  hi: { 
    logo: 'मिलकर', join: 'जुड़ें', create: 'नया कलेक्शन', per: 'प्रति व्यक्ति', 
    history: 'पुराने हिसाब', payNow: 'UPI से पे करें', verify: 'पुष्टि करें',
    loginSub: 'सबके लिए, हर जगह, सही और साफ हिसाब।',
    enterName: 'अपना नाम लिखें', loginBtn: 'ऐप खोलें',
    activity: 'किस लिए है?', total: 'कुल बजट (₹)', people: 'कुल लोग',
    fixedAmt: 'तय राशि (₹)', modeFixed: 'फिक्स्ड कलेक्शन', modeSplit: 'बजट बांटें',
    upiLabel: 'UPI ID लिखें', launch: 'शुरू करें', 
    end: 'हटाएं', roomCode: 'कोड', copy: 'कोड कॉपी हुआ!', 
    joinBtn: 'जुड़ें', about: 'यह कैसे काम करता है', typeOneTime: 'एक बार का हिसाब', 
    typeSub: 'प्रीपेड वॉलेट', deduct: 'फीस काटें',
    edit: 'बदलाव करें', save: 'सुरक्षित करें', alreadyPaid: 'सूचना दे दी गई है!',
    eventFull: 'हिसाब पूरा हो चुका है!', collected: 'जमा हुआ', credit: 'वापसी'
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [tempName, setTempName] = useState('');
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [view, setView] = useState('app'); 
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [isFixedMode, setIsFixedMode] = useState(false);
  const [form, setForm] = useState({ title: '', totalAmount: '', fixedAmount: '', memberCount: '', upi: '', type: 'one-time' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState([]);
  const [hasClickedPay, setHasClickedPay] = useState({});

  const t = translations[lang] || translations.en;
  const templates = [
    { name: 'Dinner', icon: '🍽️', type: 'one-time' }, { name: 'Staff Bus', icon: '🚌', type: 'subscription' },
    { name: 'Gift', icon: '🎁', type: 'one-time' }, { name: 'Milk/Maid', icon: '🥛', type: 'subscription' }
  ];

  useEffect(() => {
    const savedUser = localStorage.getItem('milkar_user');
    const savedRooms = localStorage.getItem('unlocked_rooms');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedRooms) setUnlockedRooms(JSON.parse(savedRooms) || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEvents(allEvents);
      
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      setHistory(allEvents.filter(ev => {
          const timestamp = ev.createdAt?.toMillis?.() || (ev.createdAt?.seconds ? ev.createdAt.seconds * 1000 : Date.now());
          const isCreator = ev.creatorId === user.id;
          const isParticipant = ev.contributions?.some(c => c.userId === user.id);
          return (isCreator || isParticipant) && timestamp > ninetyDaysAgo;
      }));
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = () => {
    if (!tempName) return alert("Enter name");
    const u = { name: tempName, id: `${tempName.replace(/\s+/g, '')}_${Math.floor(1000 + Math.random() * 9000)}` };
    localStorage.setItem('milkar_user', JSON.stringify(u));
    setUser(u);
  };

  const saveRoom = async () => {
    if (!form.title || (!form.totalAmount && !form.fixedAmount)) return alert("Fill details");
    
    let perPerson, totalAmount;
    if (isFixedMode) {
        perPerson = parseFloat(form.fixedAmount).toFixed(2);
        totalAmount = (parseFloat(form.fixedAmount) * parseInt(form.memberCount)).toFixed(2);
    } else {
        totalAmount = parseFloat(form.totalAmount).toFixed(2);
        perPerson = (totalAmount / (parseInt(form.memberCount) || 1)).toFixed(2);
    }
    
    const payload = { ...form, totalAmount, perPerson, isFixedMode };

    if (isEditing) {
      await updateDoc(doc(db, "events", isEditing), payload);
      setIsEditing(null);
    } else {
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      await addDoc(collection(db, "events"), { 
        ...payload, roomCode, creator: user.name, creatorUpi: form.upi, creatorId: user.id, 
        contributions: [], createdAt: serverTimestamp() 
      });
      const updatedCodes = [...unlockedRooms, roomCode];
      setUnlockedRooms(updatedCodes);
      localStorage.setItem('unlocked_rooms', JSON.stringify(updatedCodes));
    }
    setShowModal(false);
    setForm({ title: '', totalAmount: '', fixedAmount: '', memberCount: '', upi: '', type: 'one-time' });
  };

  const handlePaymentNotification = async (ev) => {
    const amt = ev.type === 'subscription' ? prompt("Recharge Amount? (₹)") : ev.perPerson;
    if (!amt) return;

    await updateDoc(doc(db, "events", ev.id), { 
      contributions: arrayUnion({ name: user.name, userId: user.id, verified: false, amountPaid: parseFloat(amt), balance: parseFloat(amt), time: Date.now() }) 
    });
    setHasClickedPay(p => ({...p, [ev.id]: false}));
  };

  const handleDeduction = async (ev, contributor) => {
    const newBal = (parseFloat(contributor.balance ?? contributor.amountPaid) - parseFloat(ev.perPerson)).toFixed(2);
    if (newBal < 0) return alert("Low balance!");
    const updated = ev.contributions.map(c => (c.userId === contributor.userId && c.time === contributor.time) ? { ...c, balance: newBal } : c);
    await updateDoc(doc(db, "events", ev.id), { contributions: updated });
    confetti({ particleCount: 30 });
  };

  if (!user) return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-slate-50 text-black'} flex items-center justify-center p-6`}>
      <div className={`w-full max-w-sm p-10 rounded-[3rem] ${dark ? 'bg-zinc-900 border-white/5' : 'bg-white shadow-2xl'} border text-center`}>
        <h1 className="text-5xl font-black text-blue-500 italic mb-2 tracking-tighter uppercase">{t.logo}</h1>
        <p className="text-[11px] opacity-60 mb-8">{t.loginSub}</p>
        <input type="text" placeholder={t.enterName} className={`w-full p-5 mb-8 rounded-2xl outline-none ${dark ? 'bg-white/10' : 'bg-slate-100'}`} onChange={e => setTempName(e.target.value)} />
        <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white uppercase">{t.loginBtn}</button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-slate-900'} font-sans pb-20`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md border-b ${dark ? 'bg-black/50 border-white/5' : 'bg-white/70 border-slate-100'}`}>
        <h1 onClick={() => setView('app')} className="text-2xl font-black italic text-blue-500 tracking-tighter uppercase cursor-pointer">{t.logo}</h1>
        <div className="flex gap-2">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className={`text-[9px] font-black px-3 py-1 rounded-full border ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{lang.toUpperCase()}</button>
          <button onClick={() => setView(view === 'app' ? 'about' : 'app')} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{view === 'app' ? '❓' : '📱'}</button>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      {view === 'about' ? (
        <main className="max-w-xl mx-auto p-6">
          <h2 className="text-4xl font-black mb-8 italic uppercase text-blue-500">{t.about}</h2>
          <div className="space-y-6">
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">✏️</span>
              <h3 className="text-xl font-black mb-2 uppercase italic">1. Create or Subscribe</h3>
              <p className="opacity-60 text-sm leading-relaxed">Choose One-Time for bills or Subscription for daily items like Milk/Buses.</p>
            </div>
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">📲</span>
              <h3 className="text-xl font-black mb-2 uppercase italic">2. UPI Payment</h3>
              <p className="opacity-60 text-sm leading-relaxed">Pay the host directly via QR. Notify them with one tap after paying.</p>
            </div>
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">📊</span>
              <h3 className="text-xl font-black mb-2 uppercase italic">3. Live Progress</h3>
              <p className="opacity-60 text-sm leading-relaxed">Watch the bar grow as the host verifies payments. Complete transparency.</p>
            </div>
          </div>
        </main>
      ) : view === 'history' ? (
        <main className="max-w-xl mx-auto p-6">
          <h2 className="text-3xl font-black mb-8 uppercase text-blue-500">{t.history}</h2>
          <div className="space-y-4">
            {history.map(ev => {
              const displayDate = ev.createdAt?.toDate?.() ? ev.createdAt.toDate().toDateString() : 'Just now';
              return (
                <div key={ev.id} className={`p-6 rounded-3xl border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-[11px]">{ev.title}</span>
                    <span className="text-blue-500 font-black">₹{ev.perPerson}</span>
                  </div>
                  <p className="text-[9px] opacity-40 mt-1 uppercase">{displayDate}</p>
                </div>
              )
            })}
            {history.length === 0 && <p className="text-center opacity-30 py-20 font-black uppercase text-[10px]">No recent activity</p>}
          </div>
          <button onClick={() => setView('app')} className="w-full mt-10 py-4 bg-zinc-800 rounded-2xl font-black text-[10px] uppercase">Back</button>
        </main>
      ) : (
        <main className="max-w-xl mx-auto p-6">
          <div className="flex gap-2 mb-10">
            <input type="text" placeholder={t.roomCode} className={`flex-1 p-5 rounded-2xl outline-none ${dark ? 'bg-zinc-900' : 'bg-slate-100 border'}`} value={inputCode} onChange={e => setInputCode(e.target.value)} />
            <button onClick={() => {
               if(events.some(e => e.roomCode === inputCode)) { 
                  const updated = [...unlockedRooms, inputCode];
                  setUnlockedRooms(updated); 
                  localStorage.setItem('unlocked_rooms', JSON.stringify(updated));
                  setInputCode(''); 
               } else alert("Invalid");
            }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">{t.joinBtn}</button>
          </div>

          <button onClick={() => { setIsEditing(null); setShowModal(true); }} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg uppercase tracking-widest">+ {t.create}</button>

          <div className="space-y-12">
            {events.filter(ev => unlockedRooms.includes(ev.roomCode) || ev.creatorId === user.id).map(ev => {
              const isSub = ev.type === 'subscription';
              const verifiedTotal = ev.contributions?.filter(c => c.verified).reduce((sum, c) => sum + parseFloat(c.amountPaid), 0) || 0;
              const progress = Math.min((verifiedTotal / parseFloat(ev.totalAmount)) * 100, 100);

              return (
                <div key={ev.id} className={`p-8 rounded-[3.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ev.title}</p>
                         {ev.creatorId === user.id && (
                           <button onClick={() => { setForm(ev); setIsEditing(ev.id); setIsFixedMode(ev.isFixedMode); setShowModal(true); }} className="text-[10px] opacity-30">✏️</button>
                         )}
                      </div>
                      <h2 className="text-5xl font-black tracking-tighter">₹{ev.perPerson}</h2>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(ev.roomCode); alert(t.copy); }} className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full italic">#{ev.roomCode}</button>
                  </div>

                  {!isSub && (
                    <div className="mb-8">
                      <div className="flex justify-between text-[9px] font-black uppercase mb-2 opacity-60">
                        <span>{t.collected}: ₹{verifiedTotal.toFixed(2)}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center mb-10">
                    <div className="p-4 bg-white rounded-3xl mb-4 border border-slate-100">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${isSub ? '' : ev.perPerson}&cu=INR`)}`} className="w-24 h-24" alt="QR" />
                    </div>
                    <a href={`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${isSub ? '' : ev.perPerson}&cu=INR`} onClick={() => setTimeout(() => setHasClickedPay(p => ({...p, [ev.id]: true})), 2000)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase text-center">{t.payNow}</a>
                    {hasClickedPay[ev.id] && (
                        <button onClick={() => handlePaymentNotification(ev)} className="w-full mt-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase animate-pulse">Notify Host as "{user.name}"</button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {ev.contributions?.map((c, i) => {
                      const overpaid = c.amountPaid > parseFloat(ev.perPerson);
                      const creditAmt = (c.amountPaid - parseFloat(ev.perPerson)).toFixed(2);

                      return (
                        <div key={i} className={`flex justify-between items-center p-4 rounded-2xl ${c.verified ? 'bg-emerald-500/5' : 'bg-orange-500/5'}`}>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase">{c.name} {c.verified ? '✅' : '⏳'}</span>
                            {isSub ? (
                                <span className="text-[9px] font-bold text-blue-500">Wallet: ₹{c.balance}</span>
                            ) : (
                                c.verified && overpaid && <span className="text-[8px] font-bold text-emerald-500 italic">{t.credit}: ₹{creditAmt}</span>
                            )}
                          </div>
                          {ev.creatorId === user.id && (
                            <div className="flex gap-2">
                              {!c.verified && <button onClick={async () => {
                                const up = ev.contributions.map((item, idx) => idx === i ? {...item, verified: true} : item);
                                await updateDoc(doc(db, "events", ev.id), { contributions: up });
                                confetti({ particleCount: 50 });
                              }} className="bg-emerald-600 text-white text-[8px] font-black px-4 py-2 rounded-full uppercase">{t.verify}</button>}
                              {isSub && c.verified && <button onClick={() => handleDeduction(ev, c)} className="bg-blue-600 text-white text-[8px] font-black px-4 py-2 rounded-full uppercase">{t.deduct}</button>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {ev.creatorId === user.id && (
                    <button onClick={async () => window.confirm("Delete?") && await deleteDoc(doc(db, "events", ev.id))} className="mt-8 text-[9px] font-black text-red-500 opacity-30 uppercase">🗑️ {t.end}</button>
                  )}
                </div>
              );
            })}
          </div>

          <section className={`mt-20 p-8 rounded-[3rem] border ${dark ? 'bg-zinc-900/40 border-white/5' : 'bg-slate-100'}`}>
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-xl font-black uppercase">{user.name}</h4>
              <div className="flex gap-2">
                <button onClick={() => setView('history')} className="text-[10px] font-black px-5 py-2 bg-blue-500/10 text-blue-500 rounded-full tracking-widest uppercase">History</button>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[10px] font-black px-5 py-2 bg-red-500/10 text-red-500 rounded-full tracking-widest uppercase">Logout</button>
              </div>
            </div>
            <footer className="pt-8 border-t border-white/5">
                <h4 className="text-lg font-black uppercase mb-1 tracking-tighter">Sarthak Gupta</h4>
                <p className="text-[11px] font-medium italic opacity-40">A lefty creating productive apps so that you could be lazy</p>
            </footer>
          </section>
        </main>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-xl">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white'}`}>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm({...form, type: 'one-time'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${form.type === 'one-time' ? 'bg-blue-600 text-white' : 'opacity-40'}`}>{t.typeOneTime}</button>
              <button onClick={() => setForm({...form, type: 'subscription'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${form.type === 'subscription' ? 'bg-blue-600 text-white' : 'opacity-40'}`}>{t.typeSub}</button>
            </div>
            
            <div className="flex gap-2 mb-6 p-1 bg-black/20 rounded-xl">
               <button onClick={() => setIsFixedMode(false)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${!isFixedMode ? 'bg-zinc-700 text-white' : 'opacity-40'}`}>{t.modeSplit}</button>
               <button onClick={() => setIsFixedMode(true)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${isFixedMode ? 'bg-zinc-700 text-white' : 'opacity-40'}`}>{t.modeFixed}</button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
              {templates.map(temp => (
                <button key={temp.name} onClick={() => setForm({...form, title: temp.name, type: temp.type})} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold border ${dark ? 'bg-zinc-800' : 'bg-slate-50'}`}>{temp.icon} {temp.name}</button>
              ))}
            </div>
            
            <div className="space-y-4">
              <input type="text" placeholder={t.activity} value={form.title} className={`w-full p-5 rounded-2xl outline-none ${dark ? 'bg-white/10' : 'bg-slate-100'}`} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-2">
                <input type="number" placeholder={isFixedMode ? t.fixedAmt : t.total} value={isFixedMode ? form.fixedAmount : form.totalAmount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/10' : 'bg-slate-100'}`} onChange={e => setForm({...form, [isFixedMode ? 'fixedAmount' : 'totalAmount']: e.target.value})} />
                <input type="number" placeholder={t.people} value={form.memberCount} className={`w-1/2 p-5 rounded-2xl outline-none ${dark ? 'bg-white/10' : 'bg-slate-100'}`} onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              <input type="text" placeholder={t.upiLabel} value={form.upi} className={`w-full p-5 rounded-2xl outline-none ${dark ? 'bg-white/10' : 'bg-slate-100'}`} onChange={e => setForm({...form, upi: e.target.value})} />
              <button onClick={saveRoom} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest">{isEditing ? t.save : t.launch}</button>
              <button onClick={() => setShowModal(false)} className="w-full text-[10px] font-black uppercase opacity-40 py-2 italic">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}