import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Plus,
  X,
  AlertCircle,
  Trash2,
  ChevronDown,
  Loader2,
  BookOpen,
  ExternalLink,
} from "lucide-react";

import hjalteBild1 from "../assets/hjaltar/niva-1.png";
import hjalteBild2 from "../assets/hjaltar/niva-2.png";
import hjalteBild3 from "../assets/hjaltar/niva-3.png";
import hjalteBild4 from "../assets/hjaltar/niva-4.png";
import hjalteBild5 from "../assets/hjaltar/niva-5.png";
import hjalteBild6 from "../assets/hjaltar/niva-6.png";
import hjalteBild7 from "../assets/hjaltar/niva-7.png";
import hjalteBild8 from "../assets/hjaltar/niva-8.png";
import hjalteBild9 from "../assets/hjaltar/niva-9.png";
import hjalteBild10 from "../assets/hjaltar/niva-10.png";

// ---- Static reference data ----

const SMAK_FORSLAG = [
  "Banan", "Morot", "Broccoli", "Blomkål", "Päron", "Äpple", "Mango", "Persika",
  "Pumpa", "Squash", "Ärtor", "Spenat", "Grönkål", "Linser", "Kikärtor", "Quinoa",
  "Havre", "Ris", "Potatis", "Palsternacka", "Rödbeta", "Majs", "Gurka", "Tomat",
  "Paprika", "Hallon", "Blåbär", "Jordgubbe", "Avokado", "Sötpotatis",
];

const ALLERGEN_FORSLAG = [
  "Komjölk (yoghurt/ost)",
  "Ägg (välkokt)",
  "Jordnöt",
  "Trädnötter (t.ex. mandel, valnöt)",
  "Vete/gluten",
  "Soja",
  "Fisk",
  "Skaldjur",
  "Sesam",
  "Senap",
];

const MALTIDER = ["Frukost", "Mellanmål FM", "Lunch", "Mellanmål EM", "Middag", "Kvällsmål"];

const TILLVAXTNIVAER = [
  { namn: "Lilla hjälten", beskrivning: "Allt börjar med en cape och ett leende.", bild: hjalteBild1, poangKrav: 0 },
  { namn: "Stjärnälva", beskrivning: "Första gnistorna av magi visar sig.", bild: hjalteBild2, poangKrav: 5 },
  { namn: "Djungelhjälte", beskrivning: "Vänner med allt som växer.", bild: hjalteBild3, poangKrav: 15 },
  { namn: "Voltflickan", beskrivning: "Full av energi och blixtsnabb.", bild: hjalteBild4, poangKrav: 30 },
  { namn: "Hammarhjälte", beskrivning: "Stark som en åskvigg.", bild: hjalteBild5, poangKrav: 50 },
  { namn: "Skugghjälte", beskrivning: "Tyst, snabb och alltid redo.", bild: hjalteBild6, poangKrav: 75 },
  { namn: "Rymdhjälte", beskrivning: "Utrustad för uppdrag bortom det kända.", bild: hjalteBild7, poangKrav: 100 },
  { namn: "Ljushjälte", beskrivning: "Lyser upp allt i sin närhet.", bild: hjalteBild8, poangKrav: 130 },
  { namn: "Superbebis", beskrivning: "Stadens favorit i cape.", bild: hjalteBild9, poangKrav: 165 },
  { namn: "Guldhjälte", beskrivning: "En sann legend i rustning.", bild: hjalteBild10, poangKrav: 200 },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatSwedishDate = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
};

const formatSwedishDateShort = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00");
  if (isoDate === todayISO()) return "Idag";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
};

// ---- Storage hook ----
// Persists to window.storage (personal, not shared) with fallback to in-memory state.

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await window.storage.get(key, false);
        if (mounted) {
          if (result && result.value) setValue(JSON.parse(result.value));
          setLoaded(true);
        }
      } catch (e) {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key]);

  const persist = useCallback(
    async (newValue) => {
      setValue(newValue);
      try {
        const result = await window.storage.set(key, JSON.stringify(newValue), false);
        if (!result) setStorageOk(false);
      } catch (e) {
        setStorageOk(false);
      }
    },
    [key]
  );

  return [value, persist, loaded, storageOk];
}

// ---- Main component ----

export default function MatLogg() {
  const [flik, setFlik] = useState("oversikt");

  const [barnNamn, setBarnNamn, namnLoaded] = usePersistentState("barn-namn", "");
  const [provadeSmaker, setProvadeSmaker, smakerLoaded] = usePersistentState("provade-smaker-v2", []);
  const [allergenLogg, setAllergenLogg, allergenLoaded] = usePersistentState("allergen-logg-v2", []);
  const [dagsloggar, setDagsloggar, dagsloggarLoaded, storageOk] = usePersistentState("dagsloggar-v2", {});

  const allLoaded = namnLoaded && smakerLoaded && allergenLoaded && dagsloggarLoaded;

  if (!allLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF6EF]">
        <Loader2 className="w-6 h-6 text-[#E8743B] animate-spin" />
      </div>
    );
  }

  const totaltAntalMaltider = Object.values(dagsloggar).reduce((sum, dag) => sum + dag.length, 0);

  // Poäng: 1 poäng per provad smak, 3 poäng per introducerat allergen (utan stark reaktion), 1 poäng per loggad måltid (max 1/dag räknas inte särskilt, men vi räknar enkelt här)
  const poang =
    provadeSmaker.length * 1 +
    allergenLogg.filter((a) => a.reaktion !== "stark").length * 3 +
    Math.min(totaltAntalMaltider, 50) * 0.5;

  return (
    <div className="min-h-screen bg-[#FBF6EF] text-[#2D2A26]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div className="font-body max-w-2xl mx-auto px-5 pt-8 pb-24">
        <header className="mb-6">
          <h1 className="font-display text-[2rem] leading-tight font-semibold text-[#2D2A26]">
            Småbarnsmat
          </h1>
          <p className="text-[#6B6358] text-sm mt-1">
            Logga måltider, upptäck smaker, introducera allergener.
          </p>
          {!storageOk && (
            <p className="text-[#C75450] text-xs mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Kunde inte spara just nu — försök igen om en stund.
            </p>
          )}
        </header>

        <nav className="flex gap-1 mb-6 bg-[#F0E9DB] p-1 rounded-2xl" role="tablist">
          {[
            { key: "oversikt", label: "Översikt" },
            { key: "dagbok", label: "Dagbok" },
            { key: "smaker", label: "Smaker" },
            { key: "allergen", label: "Allergen" },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={flik === t.key}
              onClick={() => setFlik(t.key)}
              className={`flex-1 min-w-0 truncate px-1.5 py-2.5 rounded-xl text-[13px] sm:text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B] ${
                flik === t.key ? "bg-white text-[#2D2A26] shadow-sm" : "text-[#6B6358] hover:text-[#2D2A26]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {flik === "oversikt" && (
          <OversiktVy
            barnNamn={barnNamn}
            setBarnNamn={setBarnNamn}
            provadeSmaker={provadeSmaker}
            allergenLogg={allergenLogg}
            totaltAntalMaltider={totaltAntalMaltider}
            poang={poang}
            dagsloggar={dagsloggar}
          />
        )}
        {flik === "dagbok" && <DagbokVy dagsloggar={dagsloggar} setDagsloggar={setDagsloggar} />}
        {flik === "smaker" && <SmakerVy provade={provadeSmaker} setProvade={setProvadeSmaker} />}
        {flik === "allergen" && <AllergenVy logg={allergenLogg} setLogg={setAllergenLogg} />}
      </div>
    </div>
  );
}

// ---- Tillväxtresa-hjälpare ----

function getNiva(poang) {
  let aktuell = TILLVAXTNIVAER[0];
  let index = 0;
  for (let i = 0; i < TILLVAXTNIVAER.length; i++) {
    if (poang >= TILLVAXTNIVAER[i].poangKrav) {
      aktuell = TILLVAXTNIVAER[i];
      index = i;
    }
  }
  const nasta = TILLVAXTNIVAER[index + 1];
  return { aktuell, nasta, index };
}

// ---- Översikt ----

function OversiktVy({ barnNamn, setBarnNamn, provadeSmaker, allergenLogg, totaltAntalMaltider, poang, dagsloggar }) {
  const [namnInput, setNamnInput] = useState(barnNamn);
  const { aktuell, nasta } = getNiva(poang);

  const idagISO = todayISO();
  const dagensPoster = dagsloggar[idagISO] || [];

  const nastaAllergen = ALLERGEN_FORSLAG.find(
    (a) => !allergenLogg.some((l) => l.allergen === a)
  );

  const progressMot = nasta
    ? Math.min(100, Math.round(((poang - aktuell.poangKrav) / (nasta.poangKrav - aktuell.poangKrav)) * 100))
    : 100;

  return (
    <div>
      {/* Tillväxtresa */}
      <div className="bg-gradient-to-b from-[#EAF1E8] to-[#FBF6EF] border border-[#5B7B5A]/20 rounded-2xl px-6 py-7 mb-5 text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-white shadow-sm overflow-hidden mx-auto mb-3">
            <img src={aktuell.bild} alt={aktuell.namn} className="w-full h-full object-cover" />
          </div>
          <span className="absolute -bottom-1 right-0 bg-[#E8743B] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Nivå {TILLVAXTNIVAER.indexOf(aktuell) + 1}
          </span>
        </div>
        <p className="font-display text-xl font-semibold mt-2">{aktuell.namn}</p>
        <p className="text-sm text-[#6B6358] mt-0.5">{aktuell.beskrivning}</p>

        <div className="mt-4 max-w-xs mx-auto">
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5B7B5A] rounded-full transition-all"
              style={{ width: `${progressMot}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#A9A092] mt-1.5">
            <span>{Math.round(poang)} poäng</span>
            {nasta && (
              <span className="inline-flex items-center gap-1">
                {Math.max(0, Math.ceil(nasta.poangKrav - poang))} till {nasta.namn}
                <img src={nasta.bild} alt={nasta.namn} className="w-4 h-4 rounded-full object-cover inline-block" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barnets namn */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-3 mb-5 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-[#EAF1E8] flex items-center justify-center text-lg shrink-0">
          🙂
        </span>
        <input
          value={namnInput}
          onChange={(e) => setNamnInput(e.target.value)}
          placeholder="Barnets namn (valfritt)"
          className="flex-1 bg-transparent text-sm focus-visible:outline-none placeholder:text-[#A9A092]"
        />
        <button
          onClick={() => setBarnNamn(namnInput.trim())}
          className="shrink-0 text-xs font-medium bg-[#2D2A26] text-white px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
        >
          Spara
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <StatCard emoji="🥕" varde={`${provadeSmaker.length}/${SMAK_FORSLAG.length}`} label="Smaker" />
        <StatCard emoji="🥚" varde={`${allergenLogg.length}/${ALLERGEN_FORSLAG.length}`} label="Allergener" />
        <StatCard emoji="🍽️" varde={totaltAntalMaltider} label="Måltider" />
      </div>

      {/* Idag */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5">
        <h3 className="font-display text-base font-semibold mb-2.5">Idag</h3>
        {dagensPoster.length === 0 ? (
          <p className="text-[#A9A092] text-sm">Inga loggade måltider ännu idag.</p>
        ) : (
          <ul className="space-y-1.5">
            {dagensPoster.map((p) => (
              <li key={p.id} className="text-sm flex gap-2">
                <span className="text-[#E8743B] font-medium shrink-0">{p.maltid}:</span>
                <span>{p.ratt}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nästa allergen */}
      {nastaAllergen && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 flex gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#2D2A26]">Nästa allergen att introducera</p>
            <p className="text-sm text-[#5B4A3A] mt-0.5">{nastaAllergen}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, varde, label }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8DFCC] py-4 text-center">
      <p className="text-xl mb-1">{emoji}</p>
      <p className="font-display text-lg font-semibold">{varde}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#A9A092] mt-0.5">{label}</p>
    </div>
  );
}

// ---- Dagbok ----

function DagbokVy({ dagsloggar, setDagsloggar }) {
  const [datum, setDatum] = useState(todayISO());
  const [nyRatt, setNyRatt] = useState("");
  const [nyKommentar, setNyKommentar] = useState("");
  const [nyMaltid, setNyMaltid] = useState(MALTIDER[2]); // Lunch default
  const [maltidOppen, setMaltidOppen] = useState(false);

  const dagensPoster = dagsloggar[datum] || [];

  const laggTill = () => {
    const text = nyRatt.trim();
    if (!text) return;
    const post = {
      id: crypto.randomUUID(),
      maltid: nyMaltid,
      ratt: text,
      kommentar: nyKommentar.trim(),
      tid: new Date().toISOString(),
    };
    setDagsloggar({ ...dagsloggar, [datum]: [...dagensPoster, post] });
    setNyRatt("");
    setNyKommentar("");
  };

  const taBort = (id) => {
    setDagsloggar({ ...dagsloggar, [datum]: dagensPoster.filter((p) => p.id !== id) });
  };

  const alleDatum = Object.keys(dagsloggar)
    .filter((d) => dagsloggar[d].length > 0)
    .sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Måltid</label>
            <button
              onClick={() => setMaltidOppen(!maltidOppen)}
              className="w-full flex items-center justify-between bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
            >
              {nyMaltid}
              <ChevronDown className="w-3.5 h-3.5 text-[#A9A092]" />
            </button>
            {maltidOppen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[#E8DFCC] rounded-xl shadow-lg overflow-hidden">
                {MALTIDER.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setNyMaltid(m);
                      setMaltidOppen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${
                      nyMaltid === m ? "bg-[#5B7B5A] text-white" : "hover:bg-[#F0E9DB]"
                    }`}
                  >
                    {m}
                    {nyMaltid === m && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Vad åt barnet?</label>
        <input
          value={nyRatt}
          onChange={(e) => setNyRatt(e.target.value)}
          placeholder="t.ex. havregrynsgröt med blåbär"
          className="w-full bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm mb-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
        />

        <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Anteckning (valfri)</label>
        <input
          value={nyKommentar}
          onChange={(e) => setNyKommentar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && laggTill()}
          placeholder="hur gick det?"
          className="w-full bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm mb-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
        />

        <button
          onClick={laggTill}
          disabled={!nyRatt.trim()}
          className="w-full flex items-center justify-center gap-1.5 bg-[#E8743B] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
        >
          <Plus className="w-4 h-4" /> Logga måltid
        </button>
      </div>

      <h3 className="font-display text-base font-semibold mb-3">Historik</h3>
      {alleDatum.length === 0 ? (
        <p className="text-[#A9A092] text-sm text-center py-8">Inget loggat än.</p>
      ) : (
        <div className="space-y-4">
          {alleDatum.map((d) => (
            <div key={d}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#A9A092] mb-2 px-1 capitalize">
                {formatSwedishDateShort(d)}
              </p>
              <div className="bg-white rounded-2xl border border-[#E8DFCC] divide-y divide-[#F0E9DB]">
                {[...dagsloggar[d]]
                  .sort((a, b) => new Date(a.tid) - new Date(b.tid))
                  .map((post) => (
                    <div key={post.id} className="flex items-start justify-between px-4 py-3">
                      <div>
                        <span className="text-xs font-medium text-[#E8743B] uppercase tracking-wide">
                          {post.maltid}
                        </span>
                        <p className="text-sm mt-0.5">{post.ratt}</p>
                        {post.kommentar && (
                          <p className="text-xs text-[#A9A092] mt-0.5">{post.kommentar}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const ny = dagsloggar[d].filter((p) => p.id !== post.id);
                          setDagsloggar({ ...dagsloggar, [d]: ny });
                        }}
                        className="text-[#A9A092] hover:text-[#C75450] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded shrink-0"
                        aria-label="Ta bort"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Smaker ----

function SmakerVy({ provade, setProvade }) {
  const [nyttNamn, setNyttNamn] = useState("");

  const antalProvade = provade.length;
  const provadeNamn = new Set(provade.map((p) => p.namn));
  const attProva = SMAK_FORSLAG.filter((s) => !provadeNamn.has(s));

  const markeraProvad = (namn) => {
    if (provadeNamn.has(namn)) return;
    setProvade([{ id: crypto.randomUUID(), namn, datum: todayISO(), reaktion: "neutral" }, ...provade]);
  };

  const laggTillEget = () => {
    const namn = nyttNamn.trim();
    if (!namn) return;
    markeraProvad(namn);
    setNyttNamn("");
  };

  const taBort = (id) => {
    setProvade(provade.filter((p) => p.id !== id));
  };

  const uppdateraReaktion = (id, reaktion) => {
    setProvade(provade.map((p) => (p.id === id ? { ...p, reaktion } : p)));
  };

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5 flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold">
            {antalProvade} av {SMAK_FORSLAG.length + Math.max(0, provade.length - SMAK_FORSLAG.length)} provade
          </p>
          <div className="h-1.5 bg-[#F0E9DB] rounded-full overflow-hidden mt-1.5 max-w-[200px]">
            <div
              className="h-full bg-[#E8743B] rounded-full transition-all"
              style={{ width: `${Math.min(100, (antalProvade / SMAK_FORSLAG.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={nyttNamn}
          onChange={(e) => setNyttNamn(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && laggTillEget()}
          placeholder="Lägg till smak..."
          className="flex-1 bg-white border border-[#E8DFCC] rounded-full px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
        />
        <button
          onClick={laggTillEget}
          disabled={!nyttNamn.trim()}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-[#5B7B5A] text-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
          aria-label="Lägg till smak"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {attProva.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm text-[#6B6358] mb-2.5">Att prova ({attProva.length})</h3>
          <div className="flex flex-wrap gap-2">
            {attProva.map((namn) => (
              <button
                key={namn}
                onClick={() => markeraProvad(namn)}
                className="px-4 py-2 rounded-full bg-white border border-[#E8DFCC] text-sm font-medium hover:border-[#5B7B5A]/50 hover:bg-[#EAF1E8] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
              >
                {namn}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm text-[#6B6358] mb-2.5">Provade ({provade.length})</h3>
        {provade.length === 0 ? (
          <p className="text-[#A9A092] text-sm text-center py-6">Inga smaker provade än. Tryck på en ovan.</p>
        ) : (
          <ul className="space-y-2">
            {provade.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-white rounded-xl border border-[#E8DFCC] px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#5B7B5A] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.namn}</p>
                    <p className="text-xs text-[#A9A092]">{formatSwedishDateShort(p.datum)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.reaktion}
                    onChange={(e) => uppdateraReaktion(p.id, e.target.value)}
                    className="text-xs bg-[#FBF6EF] border border-[#E8DFCC] rounded-full px-2.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                  >
                    <option value="gillade">Gillade</option>
                    <option value="neutral">Neutral</option>
                    <option value="ogillade">Ogillade</option>
                  </select>
                  <button
                    onClick={() => taBort(p.id)}
                    className="text-[#A9A092] hover:text-[#C75450] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                    aria-label="Ta bort"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Allergen ----
// Loggverktyg med en redigerbar, generisk ordningsföljd som utgångspunkt.
// Ger INGEN egen medicinsk rekommendation om tidpunkt — disclaimer är central, inte en fotnot.

function AllergenVy({ logg, setLogg }) {
  const [reaktionsval, setReaktionsval] = useState({});
  const [kommentarval, setKommentarval] = useState({});
  const [nyttNamn, setNyttNamn] = useState("");
  const [egnaForslag, setEgnaForslag] = useState([]);

  const introducerade = new Set(logg.map((l) => l.allergen));
  const allaForslag = [...ALLERGEN_FORSLAG, ...egnaForslag];
  const attIntroducera = allaForslag.filter((a) => !introducerade.has(a));
  const nasta = attIntroducera[0];

  const registrera = (allergen) => {
    const post = {
      id: crypto.randomUUID(),
      allergen,
      datum: todayISO(),
      reaktion: reaktionsval[allergen] || "ingen",
      kommentar: (kommentarval[allergen] || "").trim(),
    };
    setLogg([post, ...logg]);
  };

  const taBortFranLogg = (id) => {
    setLogg(logg.filter((l) => l.id !== id));
  };

  const laggTillEget = () => {
    const namn = nyttNamn.trim();
    if (!namn || allaForslag.includes(namn)) return;
    setEgnaForslag([...egnaForslag, namn]);
    setNyttNamn("");
  };

  return (
    <div>
      {/* Disclaimer — central, inte gömd */}
      <div className="bg-white border-2 border-[#E8743B] rounded-2xl px-4 py-4 mb-5">
        <div className="flex gap-2.5">
          <BookOpen className="w-4 h-4 text-[#E8743B] shrink-0 mt-0.5" />
          <h3 className="font-display text-base font-semibold">Att tänka på</h3>
        </div>
        <ul className="text-sm text-[#5B4A3A] mt-2.5 space-y-1.5 pl-1">
          <li>· Rådfråga alltid BVC eller barnläkare om när och i vilken ordning ni bör introducera allergener — särskilt om allergi finns i familjen.</li>
          <li>· Introducera vanligtvis en allergen i taget, och vänta några dagar innan nästa, för att kunna se eventuella reaktioner.</li>
          <li>· Vid kraftig reaktion (svullnad, andnöd, kräkningar) — ring 112.</li>
        </ul>
        <a
          href="https://www.livsmedelsverket.se/matvanor-halsa--miljo/kostrad-och-matvanor/spadbarn"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#E8743B] font-medium mt-3 underline"
        >
          Källa: Livsmedelsverket — Mat för spädbarn <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {nasta && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 mb-5 flex gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Nästa allergen: {nasta}</p>
            <p className="text-xs text-[#5B4A3A] mt-0.5">
              Bra läge att börja. Stäm av tajming med BVC om ni är osäkra.
            </p>
          </div>
        </div>
      )}

      <h3 className="text-sm text-[#6B6358] mb-2.5">Att introducera</h3>
      <div className="space-y-3 mb-6">
        {attIntroducera.map((allergen, i) => (
          <div key={allergen} className="bg-white rounded-2xl border border-[#E8DFCC] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#F0E9DB] text-sm font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm font-medium">{allergen}</p>
              </div>
              <button
                onClick={() => registrera(allergen)}
                className="shrink-0 bg-[#E8743B] text-white text-xs font-medium px-3.5 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
              >
                Introducera
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={reaktionsval[allergen] || "ingen"}
                onChange={(e) => setReaktionsval({ ...reaktionsval, [allergen]: e.target.value })}
                className="flex-1 bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
              >
                <option value="ingen">Ingen reaktion</option>
                <option value="mild">Mild reaktion</option>
                <option value="stark">Stark reaktion</option>
              </select>
              <input
                value={kommentarval[allergen] || ""}
                onChange={(e) => setKommentarval({ ...kommentarval, [allergen]: e.target.value })}
                placeholder="Anteckning (valfri)"
                className="flex-1 bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            value={nyttNamn}
            onChange={(e) => setNyttNamn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && laggTillEget()}
            placeholder="Lägg till eget allergen..."
            className="flex-1 bg-white border border-[#E8DFCC] rounded-full px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
          />
          <button
            onClick={laggTillEget}
            disabled={!nyttNamn.trim()}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-[#5B7B5A] text-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            aria-label="Lägg till allergen"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h3 className="text-sm text-[#6B6358] mb-2.5">Historik</h3>
      {logg.length === 0 ? (
        <p className="text-[#A9A092] text-sm text-center py-6">Inga allergener introducerade än.</p>
      ) : (
        <ul className="space-y-2">
          {logg.map((post) => (
            <li
              key={post.id}
              className="flex items-start justify-between bg-white rounded-xl border border-[#E8DFCC] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{post.allergen}</p>
                <p className="text-xs text-[#A9A092] mt-0.5 capitalize">
                  {formatSwedishDateShort(post.datum)}
                  {post.kommentar && ` · ${post.kommentar}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    post.reaktion === "stark"
                      ? "bg-[#C75450]/10 text-[#C75450]"
                      : post.reaktion === "mild"
                      ? "bg-[#E8743B]/10 text-[#E8743B]"
                      : "bg-[#5B7B5A]/10 text-[#5B7B5A]"
                  }`}
                >
                  {post.reaktion === "stark" ? "Stark" : post.reaktion === "mild" ? "Mild" : "Ingen"}
                </span>
                <button
                  onClick={() => taBortFranLogg(post.id)}
                  className="text-[#A9A092] hover:text-[#C75450] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                  aria-label="Ta bort"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
