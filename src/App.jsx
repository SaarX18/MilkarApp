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
    copy: 'Code Copied!', joinBtn: 'Join', about: 'System Protocol', 
    typeOneTime: 'One-Time Split', typeSub: 'Prepaid Wallet', deduct: 'Deduct Fee',
    edit: 'Edit Event', save: 'Save Changes', 
    walletTitle: 'Personal Vault', walletSub: 'Secure Digital Balance',
    vaultBal: 'Available Balance', vaultPending: 'Pending Verification',
    transfer: 'Transfer Funds', move: 'Execute Move'
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
    joinBtn: 'जुड़ें', about: 'सिस्टम प्रोटोकॉल', typeOneTime: 'एक बार का हिसाब', 
    typeSub: 'प्रीपेड वॉलेट', deduct: 'फीस काटें',
    edit: 'बदलाव करें', save: 'सुरक्षित करें',
    walletTitle: 'मेरा वॉलेट', walletSub: 'सुरक्षित डिजिटल बैलेंस',
    vaultBal: 'उपलब्ध राशि', vaultPending: 'पुष्टि बकाया',
    transfer: 'पैसे भेजें', move: 'ट्रांसफर'
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [tempName, setTempName] = useState('');
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(true);
  const [view, setView] = useState('app'); 
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [isFixedMode, setIsFixedMode] = useState(false);
  const [form, setForm] = useState({ title: '', totalAmount: '', fixedAmount: '', memberCount: '', upi: '', type: 'one-time' });
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', amount: '' });
  const [inputCode, setInputCode] = useState('');
  const [unlockedRooms, setUnlockedRooms] = useState([]);
  const [hasClickedPay, setHasClickedPay] = useState({});

  const t = translations[lang] || translations.en;

  const calculateWallet = () => {
    let balance = 0, pending = 0;
    const roomBalances = [];
    events.forEach(ev => {
      ev.contributions?.forEach(c => {
        if (c.userId === user?.id) {
          if (c.verified) {
              balance += parseFloat(c.balance || 0);
              roomBalances.push({ id: ev.id, title: ev.title, balance: c.balance });
          } else {
              pending += parseFloat(c.amountPaid || 0);
          }
        }
      });
    });
    return { balance: balance.toFixed(2), pending: pending.toFixed(2), roomBalances };
  };

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
      setEvents(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = () => {
    if (!tempName) return alert("Enter name");
    const u = { name: tempName, id: `${tempName.replace(/\s+/g, '')}_${Math.floor(1000 + Math.random() * 9000)}` };
    localStorage.setItem('milkar_user', JSON.stringify(u));
    setUser(u);
  };

  const handleTransfer = async () => {
    const { fromId, toId, amount } = transferForm;
    const amt = parseFloat(amount);
    if (!fromId || !toId || !amt || fromId === toId) return alert("Invalid Transfer Request");
    const sourceEvent = events.find(e => e.id === fromId);
    const targetEvent = events.find(e => e.id === toId);
    const userContrib = sourceEvent.contributions.find(c => c.userId === user.id);
    if (parseFloat(userContrib.balance) < amt) return alert("Insufficient Vault Balance");
    const updatedSource = sourceEvent.contributions.map(c => c.userId === user.id ? { ...c, balance: (parseFloat(c.balance) - amt).toFixed(2) } : c);
    await updateDoc(doc(db, "events", fromId), { contributions: updatedSource });
    const existingTarget = targetEvent.contributions?.find(c => c.userId === user.id);
    let updatedTarget;
    if (existingTarget) {
        updatedTarget = targetEvent.contributions.map(c => c.userId === user.id ? { ...c, balance: (parseFloat(c.balance) + amt).toFixed(2), amountPaid: (parseFloat(c.amountPaid) + amt).toFixed(2) } : c);
    } else {
        updatedTarget = [...(targetEvent.contributions || []), { name: user.name, userId: user.id, verified: true, amountPaid: amt, balance: amt, time: Date.now() }];
    }
    await updateDoc(doc(db, "events", toId), { contributions: updatedTarget });
    setShowTransferModal(false);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  };

  const saveRoom = async () => {
    if (!form.title || (!form.totalAmount && !form.fixedAmount)) return alert("Fill details");
    let perPerson = isFixedMode ? parseFloat(form.fixedAmount) : (parseFloat(form.totalAmount) / (parseInt(form.memberCount) || 1));
    const payload = { ...form, totalAmount: isFixedMode ? (perPerson * form.memberCount) : form.totalAmount, perPerson: perPerson.toFixed(2), isFixedMode };
    if (isEditing) {
      await updateDoc(doc(db, "events", isEditing), payload);
      setIsEditing(null);
    } else {
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      await addDoc(collection(db, "events"), { ...payload, roomCode, creator: user.name, creatorUpi: form.upi, creatorId: user.id, contributions: [], createdAt: serverTimestamp() });
      setUnlockedRooms(prev => [...prev, roomCode]);
    }
    setShowModal(false);
  };

  const handlePaymentNotification = async (ev) => {
    let amt = ev.type === 'subscription' ? prompt("Recharge Amount? (₹)") : ev.perPerson;
    if (!amt) return;
    await updateDoc(doc(db, "events", ev.id), { contributions: arrayUnion({ name: user.name, userId: user.id, verified: false, amountPaid: parseFloat(amt), balance: parseFloat(amt), time: Date.now() }) });
    setHasClickedPay(p => ({...p, [ev.id]: false}));
  };

  if (!user) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-sm p-10 rounded-[3rem] bg-zinc-900 border border-white/5 text-center shadow-2xl">
        <h1 className="text-5xl font-black text-blue-500 italic mb-2 tracking-tighter uppercase">{t.logo}</h1>
        <p className="text-[11px] opacity-60 mb-8 uppercase tracking-widest">{t.loginSub}</p>
        <input type="text" placeholder={t.enterName} className="w-full p-5 mb-8 rounded-2xl bg-white/10 outline-none" onChange={e => setTempName(e.target.value)} />
        <button onClick={handleLogin} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase shadow-lg">Enter App</button>
      </div>
    </div>
  );

  const walletData = calculateWallet();

  return (
    <div className={`min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-slate-900'} font-sans pb-20 transition-colors duration-300`}>
      <nav className={`p-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md border-b ${dark ? 'bg-black/50 border-white/5' : 'bg-white/70 border-slate-100'}`}>
        <h1 onClick={() => setView('app')} className="text-2xl font-black italic text-blue-500 tracking-tighter uppercase cursor-pointer">{t.logo}</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('wallet')} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>💰</button>
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className={`text-[9px] font-black px-3 py-1 rounded-full border ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{lang.toUpperCase()}</button>
          <button onClick={() => setView(view === 'app' ? 'about' : 'app')} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{view === 'app' ? '❓' : '📱'}</button>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-full ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      {view === 'wallet' ? (
        <main className="max-w-xl mx-auto p-6">
          <h2 className="text-4xl font-black mb-1 italic uppercase text-blue-500">{t.walletTitle}</h2>
          <p className="text-[10px] opacity-50 mb-10 uppercase tracking-widest">{t.walletSub}</p>
          <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-6">
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase bg-white/20 px-3 py-1 rounded-full mb-3 inline-block">Secure Vault</span>
              <p className="text-xs opacity-80">{t.vaultBal}</p>
              <h3 className="text-5xl font-black mb-6 tracking-tighter italic">₹{walletData.balance}</h3>
              <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase opacity-60">{t.vaultPending}</span>
                <span className="text-sm font-black">₹{walletData.pending}</span>
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 text-9xl font-black italic opacity-10 uppercase">Vault</div>
          </div>
          <button onClick={() => setShowTransferModal(true)} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest mb-10 shadow-lg">⚡ {t.transfer}</button>
          <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase opacity-40 italic px-2">Allocation Breakdown</h4>
              {walletData.roomBalances.map((rb, i) => (
                  <div key={i} className={`p-5 rounded-3xl border flex justify-between items-center ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50'}`}>
                      <span className="text-xs font-black uppercase tracking-tight">{rb.title}</span>
                      <span className="text-sm font-black text-blue-500">₹{rb.balance}</span>
                  </div>
              ))}
          </div>
        </main>
      ) : view === 'about' ? (
        <main className="max-w-xl mx-auto p-6">
          <h2 className="text-4xl font-black mb-8 italic uppercase text-blue-500">{t.about}</h2>
          <div className="space-y-6">
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">⚖️</span>
              <h3 className="text-xl font-black mb-2 uppercase italic text-blue-500">Unified Ledger</h3>
              <p className="opacity-60 text-sm leading-relaxed italic">Milkar replaces manual math with a high-precision splitting protocol. It tracks Every Rupee across group events in a single, transparent ledger.</p>
            </div>
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">📈</span>
              <h3 className="text-xl font-black mb-2 uppercase italic text-blue-500">Live Progress Track</h3>
              <p className="opacity-60 text-sm leading-relaxed italic">Real-time payment visualization. Monitor collection status with dynamic progress bars that update the moment a host confirms a transaction.</p>
            </div>
            <div className={`p-8 rounded-[2.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-4xl mb-4 block">🔒</span>
              <h3 className="text-xl font-black mb-2 uppercase italic text-blue-500">Escrow Vault</h3>
              <p className="opacity-60 text-sm leading-relaxed italic">Your money is strictly protected. By using the 'Notify Host' protocol, your payments are timestamped and locked until verified, preventing double-payments.</p>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-xl mx-auto p-6">
          <div className="flex gap-2 mb-10">
            <input type="text" placeholder={t.roomCode} className={`flex-1 p-5 rounded-2xl outline-none ${dark ? 'bg-zinc-900' : 'bg-slate-100 border-slate-200 text-slate-900'}`} value={inputCode} onChange={e => setInputCode(e.target.value)} />
            <button onClick={() => {
               if(events.some(e => e.roomCode === inputCode)) { setUnlockedRooms([...unlockedRooms, inputCode]); setInputCode(''); }
               else alert("Invalid Code");
            }} className="px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">{t.joinBtn}</button>
          </div>
          <button onClick={() => { setIsEditing(null); setShowModal(true); }} className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg mb-12 shadow-lg uppercase tracking-widest">+ {t.create}</button>
          <div className="space-y-12">
            {events.filter(ev => unlockedRooms.includes(ev.roomCode) || ev.creatorId === user.id).map(ev => {
              const isSub = ev.type === 'subscription';
              const verifiedTotal = ev.contributions?.filter(c => c.verified).reduce((sum, c) => sum + parseFloat(c.amountPaid), 0) || 0;
              const progress = Math.min((verifiedTotal / parseFloat(ev.totalAmount)) * 100, 100);
              return (
                <div key={ev.id} className={`p-8 rounded-[3.5rem] border ${dark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">{ev.title}</p>
                        {ev.creatorId === user.id && (
                          <button onClick={() => { setForm(ev); setIsEditing(ev.id); setIsFixedMode(ev.isFixedMode); setShowModal(true); }} className="text-[10px] opacity-30">✏️</button>
                        )}
                      </div>
                      <h2 className="text-5xl font-black tracking-tighter italic">₹{ev.perPerson}</h2>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(ev.roomCode); alert(t.copy); }} className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase">#{ev.roomCode}</button>
                  </div>
                  {!isSub && (
                    <div className="mb-8">
                      <div className="w-full h-3 bg-zinc-800/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col items-center mb-10">
                    <div className="p-4 bg-white rounded-3xl mb-4 border border-slate-100 shadow-sm"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${isSub ? '' : ev.perPerson}&cu=INR`)}`} className="w-20 h-20" alt="QR" /></div>
                    <a href={`upi://pay?pa=${ev.creatorUpi}&pn=${ev.creator}&am=${isSub ? '' : ev.perPerson}&cu=INR`} onClick={() => setTimeout(() => setHasClickedPay(p => ({...p, [ev.id]: true})), 2000)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase text-center shadow-md">{t.payNow}</a>
                    {hasClickedPay[ev.id] && <button onClick={() => handlePaymentNotification(ev)} className="w-full mt-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase animate-pulse">Notify Host</button>}
                  </div>
                  <div className="space-y-2">
                    {ev.contributions?.map((c, i) => (
                      <div key={i} className={`flex justify-between items-center p-4 rounded-2xl ${c.verified ? 'bg-emerald-500/5' : 'bg-orange-500/5'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-tight">{c.name} {c.verified ? '✅' : '⏳'}</span>
                          <span className="text-[9px] font-bold text-blue-500">Balance: ₹{c.balance}</span>
                        </div>
                        {ev.creatorId === user.id && !c.verified && (
                          <button onClick={async () => {
                            const up = ev.contributions.map((item, idx) => idx === i ? {...item, verified: true} : item);
                            await updateDoc(doc(db, "events", ev.id), { contributions: up });
                            confetti({ particleCount: 50 });
                          }} className="bg-emerald-600 text-white text-[8px] font-black px-4 py-2 rounded-full uppercase">Verify</button>
                        )}
                        {ev.creatorId === user.id && isSub && c.verified && (
                          <button onClick={async () => {
                            const newBal = (parseFloat(c.balance) - parseFloat(ev.perPerson)).toFixed(2);
                            if (newBal < 0) return alert("Insufficient Balance");
                            const up = ev.contributions.map((item, idx) => idx === i ? {...item, balance: newBal} : item);
                            await updateDoc(doc(db, "events", ev.id), { contributions: up });
                            confetti({ particleCount: 40 });
                          }} className="bg-blue-600 text-white text-[8px] font-black px-4 py-2 rounded-full uppercase">Deduct</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {ev.creatorId === user.id && (
                    <button onClick={async () => window.confirm("Delete?") && await deleteDoc(doc(db, "events", ev.id))} className="mt-8 text-[9px] font-black text-red-500 opacity-30 uppercase tracking-widest">🗑️ {t.end}</button>
                  )}
                </div>
              );
            })}
          </div>
          <section className={`mt-20 p-8 rounded-[3rem] border ${dark ? 'bg-zinc-900/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-xl font-black uppercase italic tracking-tighter">{user.name}</h4>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[10px] font-black px-5 py-2 bg-red-500/10 text-red-500 rounded-full tracking-widest uppercase">Logout</button>
            </div>
            <footer className="pt-8 border-t border-white/5">
                <h4 className="text-lg font-black uppercase mb-1 tracking-tighter">Sarthak Gupta</h4>
                <p className="text-[11px] font-medium italic opacity-40">A lefty creating productive apps so that you could be lazy</p>
            </footer>
          </section>
        </main>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/95 z-[101] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className={`w-full max-w-sm p-10 rounded-[3rem] border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'} shadow-2xl`}>
             <h3 className="text-xl font-black uppercase italic text-blue-500 mb-6 tracking-tighter">Internal Vault Transfer</h3>
             <div className="space-y-4">
                <p className={`text-[10px] font-black ${dark ? 'text-blue-500/60' : 'text-blue-600'} uppercase px-2`}>From Room</p>
                <select className={`w-full p-5 rounded-2xl outline-none text-[11px] font-black uppercase ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`} onChange={e => setTransferForm({...transferForm, fromId: e.target.value})}>
                  <option className={dark ? 'bg-zinc-900' : 'bg-white'}>Select Room...</option>
                  {walletData.roomBalances.map(rb => <option key={rb.id} value={rb.id} className={dark ? 'bg-zinc-900' : 'bg-white'}>{rb.title} (₹{rb.balance})</option>)}
                </select>
                <p className={`text-[10px] font-black ${dark ? 'text-blue-500/60' : 'text-blue-600'} uppercase px-2`}>To Room</p>
                <select className={`w-full p-5 rounded-2xl outline-none text-[11px] font-black uppercase ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`} onChange={e => setTransferForm({...transferForm, toId: e.target.value})}>
                  <option className={dark ? 'bg-zinc-900' : 'bg-white'}>Select Room...</option>
                  {events.filter(ev => unlockedRooms.includes(ev.roomCode) || ev.creatorId === user.id).map(ev => <option key={ev.id} value={ev.id} className={dark ? 'bg-zinc-900' : 'bg-white'}>{ev.title}</option>)}
                </select>
                <input type="number" placeholder="Amount (₹)" className={`w-full p-5 rounded-2xl outline-none font-bold ${dark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-900'}`} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} />
                <button onClick={handleTransfer} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">{t.move}</button>
                <button onClick={() => setShowTransferModal(false)} className={`w-full text-[10px] font-black uppercase ${dark ? 'opacity-40' : 'text-slate-400'} py-2 italic`}>Cancel</button>
             </div>
           </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-xl">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border shadow-2xl ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm({...form, type: 'one-time'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${form.type === 'one-time' ? 'bg-blue-600 text-white shadow-md' : dark ? 'opacity-40' : 'bg-slate-100 text-slate-400'}`}>{t.typeOneTime}</button>
              <button onClick={() => setForm({...form, type: 'subscription'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${form.type === 'subscription' ? 'bg-blue-600 text-white shadow-md' : dark ? 'opacity-40' : 'bg-slate-100 text-slate-400'}`}>{t.typeSub}</button>
            </div>
            <div className={`flex gap-2 mb-6 p-1 rounded-xl ${dark ? 'bg-black/20' : 'bg-slate-50'}`}>
               <button onClick={() => setIsFixedMode(false)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${!isFixedMode ? (dark ? 'bg-zinc-700 text-white' : 'bg-white text-blue-600 shadow-sm') : 'opacity-40'}`}>{t.modeSplit}</button>
               <button onClick={() => setIsFixedMode(true)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${isFixedMode ? (dark ? 'bg-zinc-700 text-white' : 'bg-white text-blue-600 shadow-sm') : 'opacity-40'}`}>{t.modeFixed}</button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder={t.activity} value={form.title} className={`w-full p-5 rounded-2xl outline-none font-bold ${dark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-400'}`} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex gap-2">
                <input type="number" placeholder={isFixedMode ? t.fixedAmt : t.total} value={isFixedMode ? form.fixedAmount : form.totalAmount} className={`w-1/2 p-5 rounded-2xl outline-none font-bold ${dark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-400'}`} onChange={e => setForm({...form, [isFixedMode ? 'fixedAmount' : 'totalAmount']: e.target.value})} />
                <input type="number" placeholder={t.people} value={form.memberCount} className={`w-1/2 p-5 rounded-2xl outline-none font-bold ${dark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-400'}`} onChange={e => setForm({...form, memberCount: e.target.value})} />
              </div>
              <input type="text" placeholder="UPI ID" value={form.upi} className={`w-full p-5 rounded-2xl outline-none font-mono text-xs ${dark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-400'}`} onChange={e => setForm({...form, upi: e.target.value})} />
              <button onClick={saveRoom} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">{isEditing ? t.save : t.launch}</button>
              <button onClick={() => setShowModal(false)} className={`w-full text-[10px] py-2 italic uppercase font-black ${dark ? 'opacity-40' : 'text-slate-400'}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}