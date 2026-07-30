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
  Moon,
  Sun,
  Pencil,
} from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

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

const MALTIDER = ["Frukost", "Mellanmål FM", "Lunch", "Mellanmål EM", "Middag", "Kvällsmål", "D-droppar"];

// Ungefärliga riktvärden för vakna-fönster (timmar) per ålder — inte en exakt vetenskaplig
// algoritm, utan en grov fingervisning likt de flesta sömnkonsulters riktmärken.
// vaknaFonster: timmar vaken innan respektive tupplur under dagen, i ordning.
// sistaVaknaFonster: timmar vaken innan läggning för kvällen.
const SOMN_SCHEMA = [
  { maxVeckor: 8, beskrivning: "Nyfödd — sömnen är oregelbunden än, inga fasta mönster.", vaknaFonster: [], sistaVaknaFonster: 1, rekommenderadTotalTimmar: 16 },
  { maxVeckor: 17, beskrivning: "Ofta runt 4 tupplurar per dag.", vaknaFonster: [1.25, 1.5, 1.5], sistaVaknaFonster: 1.75, rekommenderadTotalTimmar: 14.5 },
  { maxVeckor: 26, beskrivning: "Ofta runt 3 tupplurar per dag.", vaknaFonster: [1.75, 2, 2.25], sistaVaknaFonster: 2.5, rekommenderadTotalTimmar: 13.5 },
  { maxVeckor: 35, beskrivning: "Ofta 3 tupplurar, på väg mot 2.", vaknaFonster: [2.25, 2.5, 2.5], sistaVaknaFonster: 3.25, rekommenderadTotalTimmar: 13 },
  { maxVeckor: 52, beskrivning: "Ofta runt 2 tupplurar per dag.", vaknaFonster: [2.75, 3], sistaVaknaFonster: 3.25, rekommenderadTotalTimmar: 13 },
  { maxVeckor: 78, beskrivning: "Ofta 2 tupplurar, något längre vakna-fönster.", vaknaFonster: [3, 3.25], sistaVaknaFonster: 3.5, rekommenderadTotalTimmar: 12.5 },
  { maxVeckor: 130, beskrivning: "Ofta 1 tuppplur mitt på dagen.", vaknaFonster: [5], sistaVaknaFonster: 4, rekommenderadTotalTimmar: 12 },
  { maxVeckor: Infinity, beskrivning: "Många barn slutar med tuppluren i den här åldern.", vaknaFonster: [], sistaVaknaFonster: 6, rekommenderadTotalTimmar: 11 },
];

function getSomnSchema(alderIVeckor) {
  return SOMN_SCHEMA.find((s) => alderIVeckor < s.maxVeckor) || SOMN_SCHEMA[SOMN_SCHEMA.length - 1];
}

function beraknaAlderIVeckor(fodelsedatum) {
  if (!fodelsedatum) return null;
  const ms = Date.now() - new Date(fodelsedatum + "T00:00:00").getTime();
  if (ms < 0) return null;
  return ms / (1000 * 60 * 60 * 24 * 7);
}

function formatAlder(veckor) {
  if (veckor == null) return null;
  if (veckor < 8) return `${Math.floor(veckor)} v`;
  const manader = Math.floor(veckor / 4.345);
  if (manader < 24) return `${manader} mån`;
  return `${Math.floor(manader / 12)} år`;
}

function formatKlockslag(iso) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function toLocalTimeInputValue(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(originalIso, timeStr) {
  const d = new Date(originalIso);
  const [hh, mm] = timeStr.split(":").map(Number);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function formatVaraktighet(minuter) {
  const h = Math.floor(minuter / 60);
  const m = Math.round(minuter % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// Hur många minuter av ett sömnpass som faller inom ett visst (lokalt) dygn — ett pass
// som sträcker sig över midnatt ska delas upp mellan de två dygnen det faktiskt pågår,
// inte räknas i sin helhet på det dygn det började.
function minuterSomnPaDag(start, slut, dagISO) {
  const dagStart = new Date(`${dagISO}T00:00:00`).getTime();
  const dagSlut = dagStart + 24 * 60 * 60 * 1000;
  const overlapStart = Math.max(new Date(start).getTime(), dagStart);
  const overlapSlut = Math.min(new Date(slut).getTime(), dagSlut);
  return Math.max(0, overlapSlut - overlapStart) / 60000;
}

// Räknar ut när nästa sömnpass (eller läggning) väntas, baserat på senast avslutade
// sömnpass och hur många tupplurar som redan är loggade samma dag.
function berakSomnprognos(somnloggar, alderIVeckor) {
  if (alderIVeckor == null) return null;

  const nu = new Date();
  const avslutade = somnloggar
    .filter((s) => s.slut && new Date(s.slut) <= nu)
    .sort((a, b) => new Date(b.slut) - new Date(a.slut));
  const senaste = avslutade[0];
  if (!senaste) return null;

  const schema = getSomnSchema(alderIVeckor);
  const referensTid = new Date(senaste.slut);
  const referensDag = localDateKey(referensTid);

  const antalPassIdag = avslutade.filter(
    (s) => s.typ === "pass" && localDateKey(s.slut) === referensDag && new Date(s.slut) <= referensTid
  ).length;

  const arLaggning = antalPassIdag >= schema.vaknaFonster.length;
  const vaknaFonster = arLaggning ? schema.sistaVaknaFonster : schema.vaknaFonster[antalPassIdag];
  const tid = new Date(referensTid.getTime() + vaknaFonster * 60 * 60 * 1000);

  return {
    label: arLaggning ? "Läggning" : "Nästa sömnpass",
    tid,
    schema,
  };
}

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

// Lokalt datum (inte UTC) — .toISOString().slice(0,10) skulle annars lägga t.ex.
// 00:57 svensk tid på fel dag, eftersom UTC ligger 1-2 timmar efter lokal tid.
const localDateKey = (instant) => {
  const d = instant instanceof Date ? instant : new Date(instant);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dag}`;
};

const todayISO = () => localDateKey(new Date());

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
// Delad lagring via Firestore, ett dokument per nyckel under families/{familjekod}/entries/{key}.
// Realtidslyssning gör att partnerns ändringar dyker upp automatiskt. Faller tillbaka till
// enbart in-memory state (storageOk=false) om Firestore inte går att nå.

function usePersistentState(key, initialValue, familjekod) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    if (!familjekod) return;
    let mounted = true;
    let harFattSvar = false;
    setLoaded(false);
    const ref = doc(db, "families", familjekod, "entries", key);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!mounted) return;
        harFattSvar = true;
        if (snap.exists() && "value" in snap.data()) setValue(snap.data().value);
        setLoaded(true);
        setStorageOk(true);
      },
      () => {
        if (!mounted) return;
        harFattSvar = true;
        setLoaded(true);
        setStorageOk(false);
      }
    );
    // Säkerhetsnät: om anslutningen hänger sig helt utan att varken lyckas eller
    // ge ett fel (t.ex. blockerad brandvägg) ska appen ändå visas, inte snurra evigt.
    const timeout = setTimeout(() => {
      if (mounted && !harFattSvar) {
        setLoaded(true);
        setStorageOk(false);
      }
    }, 8000);
    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [key, familjekod]);

  const persist = useCallback(
    async (newValue) => {
      setValue(newValue);
      if (!familjekod) return;
      try {
        await setDoc(doc(db, "families", familjekod, "entries", key), { value: newValue });
      } catch (e) {
        setStorageOk(false);
      }
    },
    [key, familjekod]
  );

  return [value, persist, loaded, storageOk];
}

// ---- Familjekod ----
// Vilken delad familj den här enheten är kopplad till. Sparas bara lokalt (per enhet) —
// det är koden själv, inte kontot, som avgör vilken delad loggbok man ser.

function useFamiljekod() {
  const [familjekod, setFamiljekodState] = useState(() => {
    try {
      return localStorage.getItem("familjekod") || "";
    } catch (e) {
      return "";
    }
  });

  const setFamiljekod = (kod) => {
    try {
      if (kod) localStorage.setItem("familjekod", kod);
      else localStorage.removeItem("familjekod");
    } catch (e) {
      // ignorera — faller tillbaka till att fråga igen nästa gång
    }
    setFamiljekodState(kod);
  };

  return [familjekod, setFamiljekod];
}

const KODALFABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan 0/O/1/I/L för läsbarhet

function genereraFamiljekod() {
  const slumptal = new Uint32Array(8);
  crypto.getRandomValues(slumptal);
  let kod = "";
  for (let i = 0; i < 8; i++) {
    kod += KODALFABET[slumptal[i] % KODALFABET.length];
    if (i === 3) kod += "-";
  }
  return kod;
}

// ---- Main component ----

export default function MatLogg() {
  const [familjekod, setFamiljekod] = useFamiljekod();
  const [flik, setFlik] = useState("oversikt");

  const [barnNamn, setBarnNamn, namnLoaded] = usePersistentState("barn-namn", "", familjekod);
  const [barnFodelsedatum, setBarnFodelsedatum, fodelsedatumLoaded] = usePersistentState(
    "barn-fodelsedatum",
    "",
    familjekod
  );
  const [provadeSmaker, setProvadeSmaker, smakerLoaded] = usePersistentState("provade-smaker-v2", [], familjekod);
  const [allergenLogg, setAllergenLogg, allergenLoaded] = usePersistentState("allergen-logg-v2", [], familjekod);
  const [dagsloggar, setDagsloggar, dagsloggarLoaded, storageOk] = usePersistentState(
    "dagsloggar-v2",
    {},
    familjekod
  );
  const [somnloggar, setSomnloggar, somnloggarLoaded] = usePersistentState("somn-loggar-v1", [], familjekod);

  if (!familjekod) {
    return <FamiljekodVy onKlar={setFamiljekod} />;
  }

  const allLoaded =
    namnLoaded && fodelsedatumLoaded && smakerLoaded && allergenLoaded && dagsloggarLoaded && somnloggarLoaded;

  if (!allLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF6EF]">
        <Loader2 className="w-6 h-6 text-[#E8743B] animate-spin" />
      </div>
    );
  }

  const totaltAntalMaltider = Object.values(dagsloggar).reduce((sum, dag) => sum + dag.length, 0);
  const totaltAntalSomnpass = somnloggar.filter((s) => s.slut).length;
  const alderIVeckor = beraknaAlderIVeckor(barnFodelsedatum);

  // Poäng: 1 poäng per provad smak, 3 poäng per introducerat allergen (utan stark reaktion),
  // 0.5 poäng per loggad måltid och per loggat sömnpass (max 50 vardera räknas)
  const poang =
    provadeSmaker.length * 1 +
    allergenLogg.filter((a) => a.reaktion !== "stark").length * 3 +
    Math.min(totaltAntalMaltider, 50) * 0.5 +
    Math.min(totaltAntalSomnpass, 50) * 0.5;

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
            Lilla Tugg
          </h1>
          <p className="text-[#6B6358] text-sm mt-1">
            Logga måltider och sömn, upptäck smaker, introducera allergener.
          </p>
          <p className="text-xs text-[#A9A092] mt-2">
            Familj: <span className="font-medium text-[#6B6358]">{familjekod}</span>{" "}
            <button
              onClick={() => {
                if (confirm("Lämna den här familjen på den här enheten? Du kan gå med igen med koden.")) {
                  setFamiljekod("");
                }
              }}
              className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
            >
              byt
            </button>
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
            { key: "somn", label: "Sömn" },
            { key: "smaker", label: "Smaker" },
            { key: "allergen", label: "Allergen" },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={flik === t.key}
              onClick={() => setFlik(t.key)}
              className={`flex-1 min-w-0 px-1 py-2.5 rounded-xl text-center leading-tight text-[11px] sm:text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B] ${
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
            barnFodelsedatum={barnFodelsedatum}
            setBarnFodelsedatum={setBarnFodelsedatum}
            alderIVeckor={alderIVeckor}
            provadeSmaker={provadeSmaker}
            allergenLogg={allergenLogg}
            poang={poang}
            dagsloggar={dagsloggar}
            somnloggar={somnloggar}
          />
        )}
        {flik === "dagbok" && <DagbokVy dagsloggar={dagsloggar} setDagsloggar={setDagsloggar} />}
        {flik === "somn" && (
          <SomnVy somnloggar={somnloggar} setSomnloggar={setSomnloggar} alderIVeckor={alderIVeckor} />
        )}
        {flik === "smaker" && <SmakerVy provade={provadeSmaker} setProvade={setProvadeSmaker} />}
        {flik === "allergen" && <AllergenVy logg={allergenLogg} setLogg={setAllergenLogg} />}
      </div>
    </div>
  );
}

// ---- Familjekod-onboarding ----

function FamiljekodVy({ onKlar }) {
  const [lage, setLage] = useState(null); // null | "skapa" | "ansluta"
  const [nyKod] = useState(() => genereraFamiljekod());
  const [inputKod, setInputKod] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF6EF] px-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>
      <div className="font-body max-w-sm w-full">
        <h1 className="font-display text-2xl font-semibold text-center mb-2">Lilla Tugg</h1>
        <p className="text-[#6B6358] text-sm text-center mb-6">
          Skapa en familj eller gå med i en, så delar du och din partner samma loggbok.
        </p>

        {lage === null && (
          <div className="space-y-3">
            <button
              onClick={() => setLage("skapa")}
              className="w-full bg-[#E8743B] text-white rounded-xl py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              Skapa ny familj
            </button>
            <button
              onClick={() => setLage("ansluta")}
              className="w-full bg-white border border-[#E8DFCC] rounded-xl py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              Jag har en familjekod
            </button>
          </div>
        )}

        {lage === "skapa" && (
          <div className="bg-white border border-[#E8DFCC] rounded-2xl p-5 text-center">
            <p className="text-xs text-[#6B6358] mb-2">Er familjekod</p>
            <p className="font-display text-2xl font-semibold tracking-wide mb-4">{nyKod}</p>
            <p className="text-xs text-[#A9A092] mb-4">
              Spara den här koden — din partner skriver in exakt samma kod för att se samma loggbok.
            </p>
            <button
              onClick={() => onKlar(nyKod)}
              className="w-full bg-[#E8743B] text-white rounded-xl py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              Jag har sparat koden, fortsätt
            </button>
          </div>
        )}

        {lage === "ansluta" && (
          <div className="bg-white border border-[#E8DFCC] rounded-2xl p-5">
            <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Familjekod</label>
            <input
              value={inputKod}
              onChange={(e) => setInputKod(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && inputKod.trim() && onKlar(inputKod.trim())}
              placeholder="XXXX-XXXX"
              className="w-full bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm mb-3 text-center tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
            />
            <button
              onClick={() => inputKod.trim() && onKlar(inputKod.trim())}
              disabled={!inputKod.trim()}
              className="w-full bg-[#E8743B] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              Gå med
            </button>
          </div>
        )}

        {lage !== null && (
          <button
            onClick={() => setLage(null)}
            className="w-full text-xs text-[#A9A092] mt-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
          >
            Tillbaka
          </button>
        )}
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

function OversiktVy({
  barnNamn,
  setBarnNamn,
  barnFodelsedatum,
  setBarnFodelsedatum,
  alderIVeckor,
  provadeSmaker,
  allergenLogg,
  poang,
  dagsloggar,
  somnloggar,
}) {
  const [namnInput, setNamnInput] = useState(barnNamn);
  const { aktuell, nasta } = getNiva(poang);

  const idagISO = todayISO();
  const dagensPoster = dagsloggar[idagISO] || [];

  const nastaAllergen = ALLERGEN_FORSLAG.find(
    (a) => !allergenLogg.some((l) => l.allergen === a)
  );

  const somnprognos = berakSomnprognos(somnloggar, alderIVeckor);

  const dagensSomn = somnloggar.filter((s) => localDateKey(s.start) === idagISO);
  const dagensHandelser = [
    ...dagensPoster.map((p) => ({ tid: p.tid, typ: "matlogg", data: p })),
    ...dagensSomn.map((s) => ({ tid: s.start, typ: "somn", data: s })),
  ].sort((a, b) => new Date(a.tid) - new Date(b.tid));

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

      {/* Barnets namn och ålder */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-[#EAF1E8] flex items-center justify-center text-lg shrink-0">
            🙂
          </span>
          <input
            value={namnInput}
            onChange={(e) => setNamnInput(e.target.value)}
            placeholder="Barnets namn (valfritt)"
            className="flex-1 min-w-0 bg-transparent text-sm focus-visible:outline-none placeholder:text-[#A9A092]"
          />
          <button
            onClick={() => setBarnNamn(namnInput.trim())}
            className="shrink-0 text-xs font-medium bg-[#2D2A26] text-white px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
          >
            Spara
          </button>
        </div>
        <div className="flex items-center gap-2.5 mt-2.5 pt-2.5 border-t border-[#F0E9DB]">
          <span className="w-9 h-9 rounded-full bg-[#EAF1E8] flex items-center justify-center text-lg shrink-0">
            🎂
          </span>
          <input
            type="date"
            value={barnFodelsedatum}
            onChange={(e) => setBarnFodelsedatum(e.target.value)}
            max={todayISO()}
            className="flex-1 min-w-0 max-w-full box-border bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
          />
          {alderIVeckor != null && (
            <span className="shrink-0 text-xs text-[#A9A092]">{formatAlder(alderIVeckor)}</span>
          )}
        </div>
      </div>

      {/* Översikt idag */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5">
        <h3 className="font-display text-base font-semibold mb-2.5">Översikt idag</h3>
        {dagensHandelser.length === 0 ? (
          <p className="text-[#A9A092] text-sm">Inget loggat ännu idag.</p>
        ) : (
          <ul className="space-y-2">
            {dagensHandelser.map((h) => (
              <li key={h.data.id} className="text-sm flex gap-2.5">
                <span className="text-xs text-[#A9A092] shrink-0 w-10 pt-0.5">{formatKlockslag(h.tid)}</span>
                {h.typ === "matlogg" ? (
                  <span>
                    <span className="text-[#E8743B] font-medium">{h.data.maltid}:</span> {h.data.ratt}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {h.data.typ === "natt" ? (
                      <Moon className="w-3.5 h-3.5 text-[#5B7B5A] shrink-0" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-[#E8743B] shrink-0" />
                    )}
                    {h.data.typ === "natt" ? "Natt" : "Tuppplur"}
                    {h.data.slut
                      ? ` · ${formatVaraktighet((new Date(h.data.slut) - new Date(h.data.start)) / 60000)}`
                      : " · pågår"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nästa sömnpass */}
      {somnprognos && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 flex gap-2.5 mb-5">
          <AlertCircle className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#2D2A26]">{somnprognos.label}</p>
            <p className="text-sm text-[#5B4A3A] mt-0.5">Ungefär kl {formatKlockslag(somnprognos.tid)}</p>
          </div>
        </div>
      )}

      {/* Översikt totalt */}
      <h3 className="font-display text-base font-semibold mb-2.5">Översikt totalt</h3>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <StatCard emoji="🥕" varde={`${provadeSmaker.length}/${SMAK_FORSLAG.length}`} label="Smaker" />
        <StatCard emoji="🥚" varde={`${allergenLogg.length}/${ALLERGEN_FORSLAG.length}`} label="Allergener" />
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
  const [nyTid, setNyTid] = useState(toLocalTimeInputValue(new Date().toISOString()));
  const [nyRatt, setNyRatt] = useState("");
  const [nyKommentar, setNyKommentar] = useState("");
  const [nyMaltid, setNyMaltid] = useState(MALTIDER[2]); // Lunch default
  const [maltidOppen, setMaltidOppen] = useState(false);
  const [redigerarId, setRedigerarId] = useState(null);
  const [redigerTid, setRedigerTid] = useState("");

  const dagensPoster = dagsloggar[datum] || [];

  const laggTill = () => {
    const text = nyRatt.trim();
    if (!text || !nyTid) return;
    const post = {
      id: crypto.randomUUID(),
      maltid: nyMaltid,
      ratt: text,
      kommentar: nyKommentar.trim(),
      tid: new Date(`${datum}T${nyTid}:00`).toISOString(),
    };
    setDagsloggar({ ...dagsloggar, [datum]: [...dagensPoster, post] });
    setNyRatt("");
    setNyKommentar("");
    setNyTid(toLocalTimeInputValue(new Date().toISOString()));
  };

  const taBort = (id) => {
    setDagsloggar({ ...dagsloggar, [datum]: dagensPoster.filter((p) => p.id !== id) });
  };

  const borjaRedigeraTid = (post) => {
    setRedigerarId(post.id);
    setRedigerTid(toLocalTimeInputValue(post.tid));
  };

  const sparaTid = (dag, post) => {
    if (!redigerTid) return;
    const nyttTid = new Date(`${dag}T${redigerTid}:00`).toISOString();
    setDagsloggar({
      ...dagsloggar,
      [dag]: dagsloggar[dag].map((p) => (p.id === post.id ? { ...p, tid: nyttTid } : p)),
    });
    setRedigerarId(null);
  };

  const alleDatum = Object.keys(dagsloggar)
    .filter((d) => dagsloggar[d].length > 0)
    .sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Klockslag</label>
            <input
              type="time"
              value={nyTid}
              onChange={(e) => setNyTid(e.target.value)}
              className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
            />
          </div>
        </div>

        <div className="relative min-w-0 mb-3">
          <label className="block text-xs font-medium text-[#6B6358] mb-1.5">Måltid</label>
          <button
            onClick={() => setMaltidOppen(!maltidOppen)}
            className="w-full min-w-0 flex items-center justify-between bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
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
                  .map((post) =>
                    redigerarId === post.id ? (
                      <div key={post.id} className="px-4 py-3">
                        <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Klockslag</label>
                        <input
                          type="time"
                          value={redigerTid}
                          onChange={(e) => setRedigerTid(e.target.value)}
                          className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-1.5 text-sm mb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRedigerarId(null)}
                            className="flex-1 text-xs font-medium bg-[#FBF6EF] border border-[#E8DFCC] rounded-full py-1.5"
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => sparaTid(d, post)}
                            className="flex-1 text-xs font-medium bg-[#2D2A26] text-white rounded-full py-1.5"
                          >
                            Spara
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={post.id} className="flex items-start justify-between px-4 py-3">
                        <div>
                          <span className="text-xs text-[#A9A092]">{formatKlockslag(post.tid)}</span>{" "}
                          <span className="text-xs font-medium text-[#E8743B] uppercase tracking-wide">
                            {post.maltid}
                          </span>
                          <p className="text-sm mt-0.5">{post.ratt}</p>
                          {post.kommentar && (
                            <p className="text-xs text-[#A9A092] mt-0.5">{post.kommentar}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => borjaRedigeraTid(post)}
                            className="text-[#A9A092] hover:text-[#2D2A26] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                            aria-label="Redigera klockslag"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const ny = dagsloggar[d].filter((p) => p.id !== post.id);
                              setDagsloggar({ ...dagsloggar, [d]: ny });
                            }}
                            className="text-[#A9A092] hover:text-[#C75450] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                            aria-label="Ta bort"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sömn ----
// Sömnpoäng och nästa-sömnpass-prognos bygger på grova, allmänna riktvärden
// (liknande de flesta sömnkonsulters wake-window-tabeller) — inte en klinisk
// bedömning av det egna barnet. Se SOMN_SCHEMA-kommentaren ovan.

function SomnVy({ somnloggar, setSomnloggar, alderIVeckor }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const nuTimme = new Date().getHours();
  const [nyTyp, setNyTyp] = useState(nuTimme >= 19 || nuTimme < 6 ? "natt" : "pass");
  const [redigerarId, setRedigerarId] = useState(null);
  const [redigerStart, setRedigerStart] = useState("");
  const [redigerSlut, setRedigerSlut] = useState("");

  const [visaEfterhand, setVisaEfterhand] = useState(false);
  const [efterhandTyp, setEfterhandTyp] = useState("pass");
  const [efterhandDatum, setEfterhandDatum] = useState(todayISO());
  const [efterhandStart, setEfterhandStart] = useState("");
  const [efterhandSlut, setEfterhandSlut] = useState("");
  const [efterhandFel, setEfterhandFel] = useState("");

  const aktivt = somnloggar.find((s) => !s.slut);
  const schema = alderIVeckor != null ? getSomnSchema(alderIVeckor) : null;
  const somnprognos = berakSomnprognos(somnloggar, alderIVeckor);
  const avslutade = somnloggar.filter((s) => s.slut);

  const laggBarnet = () => {
    const post = { id: crypto.randomUUID(), typ: nyTyp, start: new Date().toISOString(), slut: null };
    setSomnloggar([post, ...somnloggar]);
  };

  const barnetVaknade = () => {
    setSomnloggar(
      somnloggar.map((s) => (s.id === aktivt.id ? { ...s, slut: new Date().toISOString() } : s))
    );
  };

  const taBort = (id) => {
    setSomnloggar(somnloggar.filter((s) => s.id !== id));
  };

  const laggTillEfterhand = () => {
    if (!efterhandStart || !efterhandSlut) return;
    const start = new Date(`${efterhandDatum}T${efterhandStart}:00`);
    let slut = new Date(`${efterhandDatum}T${efterhandSlut}:00`);
    if (slut <= start) slut = new Date(slut.getTime() + 24 * 60 * 60 * 1000);
    const nu = new Date();
    if (start > nu || slut > nu) {
      setEfterhandFel("Den tiden ligger i framtiden — kontrollera datum och klockslag.");
      return;
    }
    setEfterhandFel("");
    setSomnloggar([
      { id: crypto.randomUUID(), typ: efterhandTyp, start: start.toISOString(), slut: slut.toISOString() },
      ...somnloggar,
    ]);
    setEfterhandStart("");
    setEfterhandSlut("");
  };

  const borjaRedigera = (post) => {
    setRedigerarId(post.id);
    setRedigerStart(toLocalTimeInputValue(post.start));
    setRedigerSlut(post.slut ? toLocalTimeInputValue(post.slut) : "");
  };

  const sparaRedigering = (post) => {
    const nyStart = combineDateAndTime(post.start, redigerStart);
    const nySlut = post.slut ? combineDateAndTime(post.slut, redigerSlut) : null;
    if (nySlut && new Date(nySlut) <= new Date(nyStart)) return;
    setSomnloggar(
      somnloggar.map((s) => (s.id === post.id ? { ...s, start: nyStart, slut: nySlut } : s))
    );
    setRedigerarId(null);
  };

  // Sömnpoäng idag: andel av ungefärligt rekommenderat dygnsbehov. Ett sömnpass som
  // sträcker sig över midnatt delas upp mellan de två dygnen det faktiskt pågår.
  const idagISO = todayISO();
  const minuterIdag =
    avslutade.reduce((sum, s) => sum + minuterSomnPaDag(s.start, s.slut, idagISO), 0) +
    (aktivt ? minuterSomnPaDag(aktivt.start, new Date().toISOString(), idagISO) : 0);
  const somnpoangIdag = schema ? Math.min(100, Math.round((minuterIdag / 60 / schema.rekommenderadTotalTimmar) * 100)) : null;

  // Statistik senaste 7 dagarna
  const senaste7Dagar = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDateKey(d);
  });
  const timmarPerDag = senaste7Dagar.map(
    (dag) => avslutade.reduce((sum, s) => sum + minuterSomnPaDag(s.start, s.slut, dag), 0) / 60
  );
  const maxSkala = Math.max(schema?.rekommenderadTotalTimmar || 0, ...timmarPerDag, 1) * 1.15;

  // Historik grupperad per dag
  const perDag = {};
  for (const s of avslutade) {
    const dag = localDateKey(s.start);
    (perDag[dag] ||= []).push(s);
  }
  const alleDatum = Object.keys(perDag).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      {schema && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 mb-5">
          <p className="text-sm font-medium text-[#2D2A26]">
            {formatAlder(alderIVeckor)} — {schema.beskrivning}
          </p>
          <p className="text-xs text-[#5B4A3A] mt-1">
            Ungefärliga riktvärden, inte en exakt bedömning av just ditt barn — stäm av med BVC om
            sömnen oroar dig.
          </p>
        </div>
      )}
      {!schema && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 mb-5 flex gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
          <p className="text-sm text-[#5B4A3A]">
            Fyll i barnets födelsedatum under Översikt för att få en prognos för nästa sömnpass.
          </p>
        </div>
      )}

      {/* Start/stopp */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5">
        {aktivt ? (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-[#A9A092] mb-1">
              {aktivt.typ === "natt" ? "Natt" : "Tuppplur"} sedan {formatKlockslag(aktivt.start)}
            </p>
            <p className="font-display text-2xl font-semibold mb-4">
              {formatVaraktighet((Date.now() - new Date(aktivt.start).getTime()) / 60000)}
            </p>
            <button
              onClick={barnetVaknade}
              className="w-full flex items-center justify-center gap-1.5 bg-[#E8743B] text-white rounded-xl py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              <Sun className="w-4 h-4" /> Barnet vaknade
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNyTyp("pass")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
                  nyTyp === "pass"
                    ? "bg-[#5B7B5A] text-white border-[#5B7B5A]"
                    : "bg-[#FBF6EF] text-[#6B6358] border-[#E8DFCC]"
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Tuppplur
              </button>
              <button
                onClick={() => setNyTyp("natt")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
                  nyTyp === "natt"
                    ? "bg-[#5B7B5A] text-white border-[#5B7B5A]"
                    : "bg-[#FBF6EF] text-[#6B6358] border-[#E8DFCC]"
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Natt
              </button>
            </div>
            <button
              onClick={laggBarnet}
              className="w-full flex items-center justify-center gap-1.5 bg-[#E8743B] text-white rounded-xl py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              <Moon className="w-4 h-4" /> Lägg barnet
            </button>
          </div>
        )}
      </div>

      {/* Lägg till i efterhand */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] mb-5 overflow-hidden">
        <button
          onClick={() => setVisaEfterhand(!visaEfterhand)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#6B6358] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
        >
          Lägg till sömnpass i efterhand
          <ChevronDown className={`w-3.5 h-3.5 text-[#A9A092] transition-transform ${visaEfterhand ? "rotate-180" : ""}`} />
        </button>
        {visaEfterhand && (
          <div className="px-4 pb-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setEfterhandTyp("pass")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
                  efterhandTyp === "pass"
                    ? "bg-[#5B7B5A] text-white border-[#5B7B5A]"
                    : "bg-[#FBF6EF] text-[#6B6358] border-[#E8DFCC]"
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Tuppplur
              </button>
              <button
                onClick={() => setEfterhandTyp("natt")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
                  efterhandTyp === "natt"
                    ? "bg-[#5B7B5A] text-white border-[#5B7B5A]"
                    : "bg-[#FBF6EF] text-[#6B6358] border-[#E8DFCC]"
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Natt
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="min-w-0">
                <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Datum</label>
                <input
                  type="date"
                  value={efterhandDatum}
                  onChange={(e) => {
                    setEfterhandDatum(e.target.value);
                    setEfterhandFel("");
                  }}
                  max={todayISO()}
                  className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Somnade</label>
                <input
                  type="time"
                  value={efterhandStart}
                  onChange={(e) => {
                    setEfterhandStart(e.target.value);
                    setEfterhandFel("");
                  }}
                  className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Vaknade</label>
                <input
                  type="time"
                  value={efterhandSlut}
                  onChange={(e) => {
                    setEfterhandSlut(e.target.value);
                    setEfterhandFel("");
                  }}
                  className="w-full max-w-full min-w-0 box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                />
              </div>
            </div>
            {efterhandFel && (
              <p className="text-[#C75450] text-xs mb-3 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {efterhandFel}
              </p>
            )}
            <button
              onClick={laggTillEfterhand}
              disabled={!efterhandStart || !efterhandSlut}
              className="w-full flex items-center justify-center gap-1.5 bg-[#5B7B5A] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743B]"
            >
              <Plus className="w-4 h-4" /> Lägg till
            </button>
          </div>
        )}
      </div>

      {/* Nästa sömnpass */}
      {!aktivt && somnprognos && (
        <div className="bg-[#EAF1E8] border border-[#5B7B5A]/20 rounded-2xl px-4 py-3.5 mb-5 flex gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{somnprognos.label}</p>
            <p className="text-xs text-[#5B4A3A] mt-0.5">Ungefär kl {formatKlockslag(somnprognos.tid)}</p>
          </div>
        </div>
      )}

      {/* Sömnpoäng idag */}
      {somnpoangIdag != null && (
        <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl">💤</span>
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">{somnpoangIdag}% av rekommenderat idag</p>
            <p className="text-xs text-[#A9A092] mt-0.5">
              {formatVaraktighet(minuterIdag)} sovet av ~{schema.rekommenderadTotalTimmar} h riktvärde
            </p>
            <div className="h-1.5 bg-[#F0E9DB] rounded-full overflow-hidden mt-1.5 max-w-[200px]">
              <div
                className="h-full bg-[#5B7B5A] rounded-full transition-all"
                style={{ width: `${somnpoangIdag}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Statistik senaste 7 dagarna */}
      <div className="bg-white rounded-2xl border border-[#E8DFCC] p-4 mb-5">
        <h3 className="font-display text-base font-semibold mb-1">Senaste 7 dagarna</h3>
        {schema && (
          <p className="text-xs text-[#A9A092] mb-3">
            Streckad linje = ungefärligt riktvärde ({schema.rekommenderadTotalTimmar} h/dygn)
          </p>
        )}
        <div className="relative h-28 flex items-end gap-2 mt-2">
          {schema && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-[#A9A092]"
              style={{ bottom: `${Math.min(100, (schema.rekommenderadTotalTimmar / maxSkala) * 100)}%` }}
            />
          )}
          {senaste7Dagar.map((dag, i) => (
            <div key={dag} className="flex-1 h-full flex flex-col items-center justify-end gap-1 relative z-10">
              {timmarPerDag[i] > 0 && (
                <span className="text-[10px] text-[#6B6358]">{timmarPerDag[i].toFixed(1)}h</span>
              )}
              <div
                className="w-full max-w-[28px] bg-[#5B7B5A] rounded-t-md"
                style={{ height: `${Math.max(timmarPerDag[i] > 0 ? 3 : 0, (timmarPerDag[i] / maxSkala) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-1.5">
          {senaste7Dagar.map((dag) => (
            <span key={dag} className="flex-1 text-center text-[10px] text-[#A9A092] capitalize">
              {new Date(dag + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short" })}
            </span>
          ))}
        </div>
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
                {[...perDag[d]]
                  .sort((a, b) => new Date(b.start) - new Date(a.start))
                  .map((post) =>
                    redigerarId === post.id ? (
                      <div key={post.id} className="px-4 py-3">
                        <div className="flex gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Somnade</label>
                            <input
                              type="time"
                              value={redigerStart}
                              onChange={(e) => setRedigerStart(e.target.value)}
                              className="w-full min-w-0 max-w-full box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-[10px] font-medium text-[#6B6358] mb-1">Vaknade</label>
                            <input
                              type="time"
                              value={redigerSlut}
                              onChange={(e) => setRedigerSlut(e.target.value)}
                              className="w-full min-w-0 max-w-full box-border appearance-none bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRedigerarId(null)}
                            className="flex-1 text-xs font-medium bg-[#FBF6EF] border border-[#E8DFCC] rounded-full py-1.5"
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => sparaRedigering(post)}
                            className="flex-1 text-xs font-medium bg-[#2D2A26] text-white rounded-full py-1.5"
                          >
                            Spara
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={post.id} className="flex items-start justify-between px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          {post.typ === "natt" ? (
                            <Moon className="w-4 h-4 text-[#5B7B5A] shrink-0 mt-0.5" />
                          ) : (
                            <Sun className="w-4 h-4 text-[#E8743B] shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm">
                              {formatKlockslag(post.start)} – {formatKlockslag(post.slut)}
                            </p>
                            <p className="text-xs text-[#A9A092] mt-0.5">
                              {formatVaraktighet((new Date(post.slut) - new Date(post.start)) / 60000)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => borjaRedigera(post)}
                            className="text-[#A9A092] hover:text-[#2D2A26] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                            aria-label="Redigera"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => taBort(post.id)}
                            className="text-[#A9A092] hover:text-[#C75450] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] rounded"
                            aria-label="Ta bort"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
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
                className="flex-1 min-w-0 bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B]"
              >
                <option value="ingen">Ingen reaktion</option>
                <option value="mild">Mild reaktion</option>
                <option value="stark">Stark reaktion</option>
              </select>
              <input
                value={kommentarval[allergen] || ""}
                onChange={(e) => setKommentarval({ ...kommentarval, [allergen]: e.target.value })}
                placeholder="Anteckning (valfri)"
                className="flex-1 min-w-0 bg-[#FBF6EF] border border-[#E8DFCC] rounded-xl px-2.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8743B] placeholder:text-[#A9A092]"
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
