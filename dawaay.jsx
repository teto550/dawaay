import { useState, useEffect, useCallback } from "react";
import {
  Pill, MapPin, Phone, Search, Plus, Trash2, Pencil, LogOut,
  Building2, User, Navigation, Package, ArrowRight, X, Check
} from "lucide-react";

// ---------- palette ----------
const C = {
  bg: "#F6F4EF",
  card: "#FFFFFF",
  teal: "#0F5C56",
  tealDark: "#0B3F3B",
  sage: "#7FB69E",
  sageLight: "#E4EFE9",
  amber: "#E8A33D",
  amberDark: "#B97A1F",
  ink: "#1C2B2A",
  inkSoft: "#5B6B69",
  border: "#E4E0D6",
  danger: "#C4573E",
};

// ---------- helpers ----------
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function safeGet(key, shared) {
  try {
    const r = await window.storage.get(key, shared);
    return r ? r.value : null;
  } catch {
    return null;
  }
}
async function safeSet(key, value, shared) {
  try {
    return await window.storage.set(key, value, shared);
  } catch {
    return null;
  }
}
async function safeDelete(key, shared) {
  try {
    return await window.storage.delete(key, shared);
  } catch {
    return null;
  }
}
async function safeList(prefix, shared) {
  try {
    const r = await window.storage.list(prefix, shared);
    return r ? r.keys : [];
  } catch {
    return [];
  }
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ---------- small UI primitives ----------
function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block mb-1.5 text-sm font-medium" style={{ color: C.inkSoft }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "12px",
  border: `1.5px solid ${C.border}`,
  background: "#FCFBF9",
  color: C.ink,
  fontSize: "15px",
  outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function Button({ children, onClick, variant = "primary", full, disabled, type = "button", icon: Icon }) {
  const styles = {
    primary: { background: C.teal, color: "#fff" },
    amber: { background: C.amber, color: "#fff" },
    ghost: { background: "transparent", color: C.teal, border: `1.5px solid ${C.teal}` },
    danger: { background: "transparent", color: C.danger, border: `1.5px solid ${C.danger}` },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center gap-2 font-bold transition-transform active:scale-[0.98]"
      style={{
        ...styles[variant],
        width: full ? "100%" : "auto",
        padding: "12px 20px",
        borderRadius: "12px",
        fontSize: "15px",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

function TopBar({ title, onBack, onLogout }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {onBack ? (
        <button onClick={onBack} className="flex items-center gap-1" style={{ color: C.inkSoft }}>
          <ArrowRight size={20} />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Pill size={20} style={{ color: C.teal }} />
          <span className="font-black text-lg" style={{ color: C.teal }}>
            دوائي
          </span>
        </div>
      )}
      <span className="font-bold text-base" style={{ color: C.ink }}>
        {title}
      </span>
      {onLogout ? (
        <button onClick={onLogout} style={{ color: C.inkSoft }}>
          <LogOut size={19} />
        </button>
      ) : (
        <div style={{ width: 20 }} />
      )}
    </div>
  );
}

// ---------- Landing ----------
function Landing({ goto }) {
  return (
    <div className="px-5 pt-10 pb-6">
      <div className="flex flex-col items-center text-center mb-10">
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: 72,
            height: 72,
            borderRadius: "22px",
            background: `linear-gradient(135deg, ${C.teal}, ${C.sage})`,
          }}
        >
          <Pill size={34} color="#fff" />
        </div>
        <h1 className="font-black mb-2" style={{ fontSize: "32px", color: C.ink }}>
          دوائي
        </h1>
        <p style={{ color: C.inkSoft, fontSize: "15px", maxWidth: 280 }}>
          اعرف فين تلاقي دوائك، وقريب منك ازاي
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => goto("pharmacy")}
          className="text-right p-5 transition-transform active:scale-[0.98]"
          style={{ background: C.card, borderRadius: "20px", border: `1.5px solid ${C.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: 46, height: 46, borderRadius: "14px", background: C.sageLight }}
              >
                <Building2 size={22} style={{ color: C.teal }} />
              </div>
              <div>
                <div className="font-bold" style={{ color: C.ink, fontSize: "16px" }}>
                  أنا صيدلية
                </div>
                <div style={{ color: C.inkSoft, fontSize: "13px" }}>
                  اعرض الأدوية المتوفرة عندك وأسعارها
                </div>
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => goto("patient")}
          className="text-right p-5 transition-transform active:scale-[0.98]"
          style={{ background: C.card, borderRadius: "20px", border: `1.5px solid ${C.border}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 46, height: 46, borderRadius: "14px", background: "#FBEEDA" }}
            >
              <User size={22} style={{ color: C.amberDark }} />
            </div>
            <div>
              <div className="font-bold" style={{ color: C.ink, fontSize: "16px" }}>
                أنا مريض
              </div>
              <div style={{ color: C.inkSoft, fontSize: "13px" }}>
                دوّر على دوا واعرف أقرب صيدلية عندها
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ---------- Pharmacy Auth ----------
function PharmacyAuth({ onDone, onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loc, setLoc] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const shareLocation = async () => {
    setLocLoading(true);
    const l = await getLocation();
    setLoc(l);
    setLocLoading(false);
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) return;
    setSaving(true);
    const id = uid("pharm");
    const record = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      medicines: [],
      createdAt: Date.now(),
    };
    await safeSet(`pharmacy:${id}`, JSON.stringify(record), true);
    await safeSet("session", JSON.stringify({ type: "pharmacy", id }), false);
    setSaving(false);
    onDone(record);
  };

  return (
    <div className="px-5 pt-8 pb-6">
      <TopBar title="حساب صيدلية" onBack={onBack} />
      <Field label="اسم الصيدلية">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: صيدلية النور" />
      </Field>
      <Field label="رقم التليفون">
        <TextInput
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          type="tel"
          dir="ltr"
          style={{ textAlign: "right" }}
        />
      </Field>
      <Field label="العنوان">
        <TextInput
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="الحي، الشارع، المدينة"
        />
      </Field>

      <div className="mb-5">
        <button
          onClick={shareLocation}
          className="w-full flex items-center justify-center gap-2 py-3"
          style={{
            borderRadius: "12px",
            border: `1.5px dashed ${loc ? C.sage : C.border}`,
            color: loc ? C.teal : C.inkSoft,
            background: loc ? C.sageLight : "transparent",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {loc ? <Check size={17} /> : <Navigation size={17} />}
          {locLoading ? "بحدد الموقع..." : loc ? "تم تحديد الموقع الحالي" : "شارك الموقع الحالي (اختياري)"}
        </button>
      </div>

      <Button full onClick={submit} disabled={saving || !name || !phone || !address}>
        {saving ? "بيتحفظ..." : "إنشاء حساب الصيدلية"}
      </Button>
    </div>
  );
}

// ---------- Pharmacy Dashboard ----------
function PharmacyDashboard({ pharmacy, setPharmacy, onLogout }) {
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState("");
  const [mPrice, setMPrice] = useState("");
  const [editingId, setEditingId] = useState(null);

  const persist = async (next) => {
    setPharmacy(next);
    await safeSet(`pharmacy:${next.id}`, JSON.stringify(next), true);
  };

  const resetForm = () => {
    setMName("");
    setMQty("");
    setMPrice("");
    setEditingId(null);
  };

  const addOrUpdateMedicine = async () => {
    if (!mName.trim() || mQty === "" || mPrice === "") return;
    let meds;
    if (editingId) {
      meds = pharmacy.medicines.map((m) =>
        m.id === editingId ? { ...m, name: mName.trim(), qty: Number(mQty), price: Number(mPrice) } : m
      );
    } else {
      meds = [
        ...pharmacy.medicines,
        { id: uid("med"), name: mName.trim(), qty: Number(mQty), price: Number(mPrice) },
      ];
    }
    await persist({ ...pharmacy, medicines: meds });
    resetForm();
  };

  const editMedicine = (m) => {
    setEditingId(m.id);
    setMName(m.name);
    setMQty(String(m.qty));
    setMPrice(String(m.price));
  };

  const deleteMedicine = async (id) => {
    await persist({ ...pharmacy, medicines: pharmacy.medicines.filter((m) => m.id !== id) });
    if (editingId === id) resetForm();
  };

  return (
    <div className="px-5 pt-8 pb-10">
      <TopBar title={pharmacy.name} onLogout={onLogout} />

      <div className="flex items-center gap-4 mb-6 p-4" style={{ background: C.card, borderRadius: "16px", border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-1.5" style={{ color: C.inkSoft, fontSize: "13px" }}>
          <Phone size={14} /> {pharmacy.phone}
        </div>
        <div className="flex items-center gap-1.5" style={{ color: C.inkSoft, fontSize: "13px" }}>
          <MapPin size={14} /> {pharmacy.address}
        </div>
      </div>

      <div className="p-4 mb-6" style={{ background: C.card, borderRadius: "16px", border: `1px solid ${C.border}` }}>
        <div className="font-bold mb-3" style={{ color: C.ink, fontSize: "15px" }}>
          {editingId ? "تعديل دواء" : "إضافة دواء جديد"}
        </div>
        <Field label="اسم الدواء">
          <TextInput value={mName} onChange={(e) => setMName(e.target.value)} placeholder="مثال: بانادول اكسترا" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الكمية المتوفرة">
            <TextInput type="number" value={mQty} onChange={(e) => setMQty(e.target.value)} placeholder="0" />
          </Field>
          <Field label="السعر (جنيه)">
            <TextInput type="number" value={mPrice} onChange={(e) => setMPrice(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button full onClick={addOrUpdateMedicine} icon={editingId ? Check : Plus}>
            {editingId ? "حفظ التعديل" : "إضافة الدواء"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm} icon={X}>
              إلغاء
            </Button>
          )}
        </div>
      </div>

      <div className="font-bold mb-3" style={{ color: C.ink, fontSize: "15px" }}>
        الأدوية المتوفرة ({pharmacy.medicines.length})
      </div>

      {pharmacy.medicines.length === 0 ? (
        <div className="text-center py-10" style={{ color: C.inkSoft, fontSize: "14px" }}>
          <Package size={30} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
          لسه مفيش أدوية مضافة
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pharmacy.medicines.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3.5"
              style={{ background: C.card, borderRadius: "14px", border: `1px solid ${C.border}` }}
            >
              <div>
                <div className="font-bold" style={{ color: C.ink, fontSize: "14.5px" }}>
                  {m.name}
                </div>
                <div style={{ color: C.inkSoft, fontSize: "13px" }}>
                  الكمية: {m.qty} · السعر: {m.price} ج.م
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => editMedicine(m)} className="p-2" style={{ color: C.teal }}>
                  <Pencil size={16} />
                </button>
                <button onClick={() => deleteMedicine(m.id)} className="p-2" style={{ color: C.danger }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Patient Auth ----------
function PatientAuth({ onDone, onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loc, setLoc] = useState(null);
  const [address, setAddress] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const shareLocation = async () => {
    setLocLoading(true);
    const l = await getLocation();
    setLoc(l);
    setLocLoading(false);
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    const session = {
      type: "patient",
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    };
    await safeSet("session", JSON.stringify(session), false);
    setSaving(false);
    onDone(session);
  };

  return (
    <div className="px-5 pt-8 pb-6">
      <TopBar title="حساب مريض" onBack={onBack} />
      <Field label="الاسم">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" />
      </Field>
      <Field label="رقم التليفون">
        <TextInput
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          type="tel"
          dir="ltr"
          style={{ textAlign: "right" }}
        />
      </Field>
      <Field label="العنوان (اختياري)">
        <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="حيك أو منطقتك" />
      </Field>

      <div className="mb-5">
        <button
          onClick={shareLocation}
          className="w-full flex items-center justify-center gap-2 py-3"
          style={{
            borderRadius: "12px",
            border: `1.5px dashed ${loc ? C.sage : C.border}`,
            color: loc ? C.teal : C.inkSoft,
            background: loc ? C.sageLight : "transparent",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {loc ? <Check size={17} /> : <Navigation size={17} />}
          {locLoading ? "بحدد الموقع..." : loc ? "تم تحديد موقعك" : "شارك موقعك علشان نلاقيلك أقرب صيدلية"}
        </button>
      </div>

      <Button full onClick={submit} disabled={saving || !name || !phone}>
        {saving ? "بيتحفظ..." : "دخول"}
      </Button>
    </div>
  );
}

// ---------- Patient Search ----------
function PatientSearch({ patient, onLogout }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    if (!term.trim()) return;
    setSearching(true);
    setSearched(true);
    const keys = await safeList("pharmacy:", true);
    const q = term.trim().toLowerCase();
    const found = [];
    for (const k of keys) {
      const raw = await safeGet(k, true);
      if (!raw) continue;
      try {
        const ph = JSON.parse(raw);
        const matches = (ph.medicines || []).filter((m) => m.name.toLowerCase().includes(q));
        matches.forEach((m) => {
          const dist =
            patient.lat != null && ph.lat != null
              ? haversineKm({ lat: patient.lat, lng: patient.lng }, { lat: ph.lat, lng: ph.lng })
              : null;
          found.push({ pharmacy: ph, medicine: m, dist });
        });
      } catch {}
    }
    found.sort((a, b) => {
      if (a.dist == null && b.dist == null) return 0;
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });
    setResults(found);
    setSearching(false);
  }, [term, patient]);

  return (
    <div className="px-5 pt-8 pb-10">
      <TopBar title={`أهلاً ${patient.name}`} onLogout={onLogout} />

      <div className="flex gap-2 mb-6">
        <TextInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="اكتب اسم الدواء اللي بتدور عليه"
        />
        <button
          onClick={runSearch}
          className="flex items-center justify-center"
          style={{ width: 48, borderRadius: "12px", background: C.teal, color: "#fff" }}
        >
          <Search size={19} />
        </button>
      </div>

      {searching && (
        <div className="text-center py-8" style={{ color: C.inkSoft }}>
          بندور على "{term}"...
        </div>
      )}

      {!searching && searched && results && results.length === 0 && (
        <div className="text-center py-10" style={{ color: C.inkSoft, fontSize: "14px" }}>
          <Package size={30} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
          مفيش صيدليات متسجلة عندها "{term}" دلوقتي
        </div>
      )}

      {!searching && results && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div style={{ color: C.inkSoft, fontSize: "13px" }}>
            لقينا {results.length} نتيجة
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className="p-4"
              style={{ background: C.card, borderRadius: "16px", border: `1px solid ${C.border}` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold" style={{ color: C.ink, fontSize: "15.5px" }}>
                    {r.pharmacy.name}
                  </div>
                  <div style={{ color: C.inkSoft, fontSize: "13px" }}>{r.pharmacy.address}</div>
                </div>
                {r.dist != null && (
                  <span
                    className="font-bold whitespace-nowrap"
                    style={{ color: C.teal, fontSize: "13px", background: C.sageLight, padding: "4px 10px", borderRadius: "999px" }}
                  >
                    {r.dist < 1 ? `${Math.round(r.dist * 1000)} م` : `${r.dist.toFixed(1)} كم`}
                  </span>
                )}
              </div>

              <div
                className="flex items-center justify-between p-2.5 mb-3"
                style={{ background: "#FBEEDA", borderRadius: "10px" }}
              >
                <span className="font-bold" style={{ color: C.amberDark, fontSize: "14px" }}>
                  {r.medicine.name}
                </span>
                <span style={{ color: C.amberDark, fontSize: "13px" }}>
                  متوفر: {r.medicine.qty} · {r.medicine.price} ج.م
                </span>
              </div>

              <div className="flex gap-2">
                <a
                  href={`tel:${r.pharmacy.phone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5"
                  style={{ border: `1.5px solid ${C.teal}`, borderRadius: "10px", color: C.teal, fontSize: "13.5px", fontWeight: 700 }}
                >
                  <Phone size={15} /> اتصل
                </a>
                {r.pharmacy.lat != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${r.pharmacy.lat},${r.pharmacy.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5"
                    style={{ background: C.teal, borderRadius: "10px", color: "#fff", fontSize: "13.5px", fontWeight: 700 }}
                  >
                    <MapPin size={15} /> الموقع
                  </a>
                ) : (
                  <div
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5"
                    style={{ background: C.border, borderRadius: "10px", color: C.inkSoft, fontSize: "13.5px" }}
                  >
                    <MapPin size={15} /> بدون موقع
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && (
        <div className="text-center py-10" style={{ color: C.inkSoft, fontSize: "14px" }}>
          <Search size={30} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
          دوّر باسم الدوا علشان تلاقي أقرب صيدلية عندها
        </div>
      )}
    </div>
  );
}

// ---------- Root ----------
export default function App() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("landing");
  const [pharmacy, setPharmacy] = useState(null);
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    (async () => {
      const raw = await safeGet("session", false);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.type === "pharmacy") {
            const pRaw = await safeGet(`pharmacy:${s.id}`, true);
            if (pRaw) {
              setPharmacy(JSON.parse(pRaw));
              setView("pharmacy-dash");
            }
          } else if (s.type === "patient") {
            setPatient(s);
            setView("patient-search");
          }
        } catch {}
      }
      setBooting(false);
    })();
  }, []);

  const logout = async () => {
    await safeDelete("session", false);
    setPharmacy(null);
    setPatient(null);
    setView("landing");
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        * { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box; }
        input::placeholder { color: #A7A196; }
        input:focus { border-color: ${C.teal} !important; }
      `}</style>

      <div style={{ maxWidth: 440, margin: "0 auto", minHeight: "100vh", background: C.bg }}>
        {booting ? (
          <div className="flex items-center justify-center" style={{ height: "100vh", color: C.inkSoft }}>
            بيحمّل...
          </div>
        ) : view === "landing" ? (
          <Landing goto={(v) => setView(v === "pharmacy" ? "pharmacy-auth" : "patient-auth")} />
        ) : view === "pharmacy-auth" ? (
          <PharmacyAuth
            onBack={() => setView("landing")}
            onDone={(p) => {
              setPharmacy(p);
              setView("pharmacy-dash");
            }}
          />
        ) : view === "pharmacy-dash" && pharmacy ? (
          <PharmacyDashboard pharmacy={pharmacy} setPharmacy={setPharmacy} onLogout={logout} />
        ) : view === "patient-auth" ? (
          <PatientAuth
            onBack={() => setView("landing")}
            onDone={(p) => {
              setPatient(p);
              setView("patient-search");
            }}
          />
        ) : view === "patient-search" && patient ? (
          <PatientSearch patient={patient} onLogout={logout} />
        ) : (
          <Landing goto={(v) => setView(v === "pharmacy" ? "pharmacy-auth" : "patient-auth")} />
        )}
      </div>
    </div>
  );
}
