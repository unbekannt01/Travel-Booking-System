/**
 * YatraHub - Shared Gujarati Transliteration & Name Formatting Engine
 *
 * Provides automatic, high-accuracy phonetic transliteration of English
 * passenger names into Gujarati script for bus operators and conductors.
 * Also supports manual corrections (p.nameGu) and name script options:
 * - 'en': English (Last Name + First Name, middle omitted)
 * - 'gu': Gujarati (અટક + નામ)
 * - 'both': English + ગુજરાતી
 */

import { formatShortPassengerName } from "./seatLayouts.js"

// Common Gujarati surnames, given names, cities, and travel vocabulary
export const GUJARATI_NAME_DICT = Object.freeze({
  // Surnames
  ghetiya: "ઘેટિયા",
  hansaliya: "હંસાલીયા",
  govani: "ગોવાણી",
  kalavadiya: "કાલાવડિયા",
  kaneriya: "કનેરિયા",
  patel: "પટેલ",
  shah: "શાહ",
  sharma: "શર્મા",
  mehta: "મહેતા",
  trivedi: "ત્રિવેદી",
  dave: "દવે",
  vyas: "વ્યાસ",
  joshi: "જોશી",
  bhatt: "ભટ્ટ",
  rathod: "રાઠોડ",
  chavda: "ચાવડા",
  jadeja: "જાડેજા",
  vaghela: "વાઘેલા",
  solanki: "સોલંકી",
  parmar: "પરમાર",
  barot: "બારોટ",
  soni: "સોની",
  modi: "મોદી",
  gandhi: "ગાંધી",
  thakkar: "ઠક્કર",
  memon: "મેમણ",
  vora: "વોરા",
  desai: "દેસાઈ",
  pandya: "પંડ્યા",
  raval: "રાવલ",
  panchal: "પંચાલ",
  mistri: "મિર્સ્ત્રી",
  darji: "દરજી",
  suthar: "સુથાર",
  luhar: "લુહાર",
  zalavadiya: "ઝાલાવડિયા",
  radadiya: "રાદડિયા",
  savaliya: "સવાલીયા",
  kheni: "ખેણી",
  moradiya: "મોરડિયા",
  kaswala: "કાસવાલા",
  vaghani: "વાઘાણી",
  dhaduk: "ધાડુક",
  talaviya: "તળાવિયા",
  padariya: "પડારીયા",
  sojitra: "સોજીત્રા",
  kakadiya: "કાકડિયા",
  malaviya: "માલવિયા",
  mangroliya: "માંગરોળિયા",
  kotadiya: "કોઠારીયા",
  dobariya: "ડોબરીયા",
  bhimani: "ભીમાણી",
  khunt: "ખૂંટ",
  khuntbhai: "ખૂંટભાઈ",

  // Given Names
  bipin: "બિપીન",
  bipinbhai: "બિપીનભાઈ",
  bipinchandra: "બિપીનચંદ્ર",
  saroj: "સરોજ",
  sarojben: "સરોજબેન",
  navin: "નવીન",
  navinbhai: "નવીનભાઈ",
  joshna: "જોશના",
  joshnaben: "જોશનાબેન",
  natha: "નથા",
  nathalal: "નથુલાલ",
  sangita: "સંગીતા",
  sangitaben: "સંગીતાબેન",
  devraj: "દેવરાજ",
  devrajbhai: "દેવરાજભાઈ",
  gandu: "ગાંડુ",
  gandubhai: "ગાંડુભાઈ",
  madhavji: "માધવજી",
  madhavjibhai: "માધવજીભાઈ",
  jasmat: "જસમત",
  jasmatbhai: "જસમતભાઈ",
  kundan: "કુંદન",
  kundanbhai: "કુંદનભાઈ",
  ramesh: "રમેશ",
  rameshbhai: "રમેશભાઈ",
  suresh: "સુરેશ",
  sureshbhai: "સુરેશભાઈ",
  mahesh: "મહેશ",
  maheshbhai: "મહેશભાઈ",
  bharat: "ભરત",
  bharatbhai: "ભરતભાઈ",
  bharatkumar: "ભરતકુમાર",
  jagdish: "જગદીશ",
  jagdishbhai: "જગદીશભાઈ",
  hitesh: "હિતેશ",
  hiteshbhai: "હિતેશભાઈ",
  praveen: "પ્રવીણ",
  pravin: "પ્રવીણ",
  pravinbhai: "પ્રવીણભાઈ",
  kamlesh: "કમલેશ",
  kamleshbhai: "કમલેશભાઈ",
  mukesh: "મુકેશ",
  mukeshbhai: "મુકેશભાઈ",
  dilip: "દિલીપ",
  dilipbhai: "દિલીપભાઈ",
  naresh: "નરેશ",
  nareshbhai: "નરેશભાઈ",
  paresh: "પરેશ",
  pareshbhai: "પરેશભાઈ",
  rajesh: "રાજેશ",
  rajeshbhai: "રાજેશભાઈ",
  vijay: "વિજય",
  vijaybhai: "વિજયભાઈ",
  sanjay: "સંજય",
  sanjaybhai: "સંજયભાઈ",
  ajay: "અજય",
  ajaybhai: "અજયભાઈ",
  ketan: "કેતન",
  ketanbhai: "કેતનભાઈ",
  chetan: "ચેતન",
  chetanbhai: "ચેતનભાઈ",
  ashok: "અશોક",
  ashokbhai: "અશોકભાઈ",
  vinod: "વિનોદ",
  vinodbhai: "વિનોદભાઈ",
  manoj: "મનોજ",
  manojbhai: "મનોજભાઈ",
  anand: "આનંદ",
  anandbhai: "આનંદભાઈ",
  jayesh: "જયેશ",
  jayeshbhai: "જયેશભાઈ",
  kirit: "કિરીટ",
  kiritbhai: "કિરીટભાઈ",
  gita: "ગીતા",
  gitaben: "ગીતાબેન",
  rekha: "રેખા",
  rekhaben: "રેખાબેન",
  meena: "મીના",
  meenaben: "મીનાબેન",
  bhavna: "ભાવના",
  bhavnaben: "ભાવનાબેન",
  shobha: "શોભા",
  shobhaben: "શોભાબેન",
  daksha: "દક્ષા",
  dakshaben: "દક્ષાબેન",
  heena: "હીના",
  heenaben: "હીનાબેન",
  neeta: "નીતા",
  neetaben: "નીતાબેન",
  varsha: "વર્ષા",
  varshaben: "વર્ષાબેન",
  hansha: "હંસા",
  hanshaben: "હંસાબેન",
  manjula: "મંજુલા",
  manjulaben: "મંજુલાબેન",

  // Cities
  jetpur: "જેતપુર",
  rajkot: "રાજકોટ",
  ahmedabad: "અમદાવાદ",
  surat: "સુરત",
  junagadh: "જૂનાગઢ",
  vadodara: "વડોદરા",
  bhavnagar: "ભાવનગર",
  jamnagar: "જામનગર",
  amreli: "અમરેલી",
  bhuj: "ભુજ",
  gandhinagar: "ગાંધીનગર",
  anand_city: "આણંદ",
  mehsana: "મહેસાણા",
})

const GUJARATI_SUFFIXES = [
  { en: "bhai", gu: "ભાઈ" },
  { en: "ben", gu: "બેન" },
  { en: "kumar", gu: "કુમાર" },
  { en: "lal", gu: "લાલ" },
  { en: "chandra", gu: "ચંદ્ર" },
  { en: "prasad", gu: "પ્રસાદ" },
  { en: "das", gu: "દાસ" },
  { en: "ram", gu: "રામ" },
  { en: "singh", gu: "સિંહ" },
  { en: "sinh", gu: "સિંહ" },
  { en: "devi", gu: "દેવી" },
  { en: "wati", gu: "વતી" },
]

const PHONETIC_CONSONANTS = [
  ["ksh", "ક્ષ"],
  ["gny", "જ્ઞ"],
  ["dhy", "ધ્ય"],
  ["shh", "ષ"],
  ["chh", "છ"],
  ["kh", "ખ"],
  ["gh", "ઘ"],
  ["ch", "ચ"],
  ["jh", "ઝ"],
  ["th", "થ"],
  ["dh", "ધ"],
  ["ph", "ફ"],
  ["bh", "ભ"],
  ["sh", "શ"],
  ["k", "ક"],
  ["g", "ગ"],
  ["c", "ક"],
  ["j", "જ"],
  ["z", "ઝ"],
  ["t", "ત"],
  ["d", "દ"],
  ["n", "ન"],
  ["p", "પ"],
  ["f", "ફ"],
  ["b", "બ"],
  ["m", "મ"],
  ["y", "ય"],
  ["r", "ર"],
  ["l", "લ"],
  ["v", "વ"],
  ["w", "વ"],
  ["s", "સ"],
  ["h", "હ"],
]

const VOWEL_SIGNS = [
  ["aa", "ા"],
  ["ai", "ૈ"],
  ["au", "ૌ"],
  ["ee", "ી"],
  ["oo", "ૂ"],
  ["a", ""],
  ["i", "િ"],
  ["u", "ુ"],
  ["e", "ે"],
  ["o", "ો"],
]

const VOWEL_STANDALONE = [
  ["aa", "આ"],
  ["ai", "ઐ"],
  ["au", "ઔ"],
  ["ee", "ઈ"],
  ["oo", "ઊ"],
  ["a", "અ"],
  ["i", "ઇ"],
  ["u", "ઉ"],
  ["e", "એ"],
  ["o", "ઓ"],
]

/**
 * Check if string already contains Gujarati unicode characters (0x0A80 - 0x0AFF)
 * @param {string} str
 * @returns {boolean}
 */
export function isGujaratiScript(str) {
  if (!str) return false
  return /[\u0A80-\u0AFF]/.test(str)
}

/**
 * Phonetically transliterate a single English word into Gujarati
 * @param {string} word
 * @returns {string}
 */
function transliterateWord(word) {
  if (!word || typeof word !== "string") return ""
  if (isGujaratiScript(word)) return word

  const clean = word.toLowerCase().trim().replace(/[^a-z]/g, "")
  if (!clean) return word

  // 1. Exact Dictionary Match
  if (GUJARATI_NAME_DICT[clean]) {
    return GUJARATI_NAME_DICT[clean]
  }

  // 2. Suffix Decomposition (e.g. Ramesh + bhai -> રમેશભાઈ)
  for (const s of GUJARATI_SUFFIXES) {
    if (clean.length > s.en.length && clean.endsWith(s.en)) {
      const stem = clean.slice(0, -s.en.length)
      if (GUJARATI_NAME_DICT[stem]) {
        return GUJARATI_NAME_DICT[stem] + s.gu
      }
      const stemGu = transliterateWord(stem)
      if (stemGu && stemGu !== stem) {
        return stemGu + s.gu
      }
    }
  }

  // 3. Fallback: Phonetic state-machine transliteration
  let out = ""
  let i = 0
  const str = clean

  while (i < str.length) {
    // Check initial standalone vowel
    if (i === 0) {
      let matchedV = null
      for (const [v, g] of VOWEL_STANDALONE) {
        if (str.startsWith(v, i)) {
          matchedV = [v, g]
          break
        }
      }
      if (matchedV) {
        out += matchedV[1]
        i += matchedV[0].length
        continue
      }
    }

    // Check consonant
    let matchedC = null
    for (const [c, g] of PHONETIC_CONSONANTS) {
      if (str.startsWith(c, i)) {
        matchedC = [c, g]
        break
      }
    }

    if (matchedC) {
      out += matchedC[1]
      i += matchedC[0].length

      // Check following vowel sign
      let matchedV = null
      for (const [v, g] of VOWEL_SIGNS) {
        if (str.startsWith(v, i)) {
          matchedV = [v, g]
          break
        }
      }

      if (matchedV) {
        out += matchedV[1]
        i += matchedV[0].length
      } else if (i < str.length) {
        // Next character is also a consonant -> attach halant (conjunct)
        let nextIsC = false
        for (const [c] of PHONETIC_CONSONANTS) {
          if (str.startsWith(c, i)) {
            nextIsC = true
            break
          }
        }
        if (nextIsC) {
          out += "્"
        }
      }
    } else {
      out += str[i]
      i++
    }
  }

  return out || word
}

/**
 * Transliterate a full English passenger name into Gujarati
 * e.g., "Ghetiya Bipinbhai" -> "ઘેટિયા બિપીનભાઈ"
 * e.g., "Hansaliya Sarojben Gandubhai" -> "હંસાલીયા સરોજબેન ગાંડુભાઈ"
 *
 * @param {string|null|undefined} fullName
 * @returns {string}
 */
export function transliterateToGujarati(fullName) {
  if (!fullName || typeof fullName !== "string") return ""
  if (isGujaratiScript(fullName)) return fullName.trim()

  const words = fullName.trim().split(/\s+/).filter(Boolean)
  const guWords = words.map(transliterateWord)
  return guWords.join(" ")
}

/**
 * Format passenger name in Gujarati as Last Name + First Name (middle omitted)
 * e.g. "Ghetiya Bipinchandra Devrajbhai" -> "ઘેટિયા બિપીનચંદ્ર"
 *
 * @param {string} fullName - English or Gujarati full name
 * @param {string} [nameGu] - Explicit manual correction in Gujarati
 * @returns {string}
 */
export function formatShortGujaratiName(fullName, nameGu = "") {
  if (nameGu && nameGu.trim()) {
    const parts = nameGu.trim().split(/\s+/).filter(Boolean)
    if (parts.length <= 1) return parts[0] || ""
    return `${parts[0]} ${parts[1]}`
  }

  if (isGujaratiScript(fullName)) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length <= 1) return parts[0] || ""
    return `${parts[0]} ${parts[1]}`
  }

  // English input: extract Last Name + First Name, then transliterate
  const shortEn = formatShortPassengerName(fullName)
  return transliterateToGujarati(shortEn)
}

/**
 * Format passenger display name according to name script preference:
 * - 'en': English (Last Name + First Name)
 * - 'gu': Gujarati (અટક + નામ)
 * - 'both': English + ગુજરાતી
 *
 * @param {Object} passenger
 * @param {string} passenger.name
 * @param {string} [passenger.nameGu]
 * @param {'en'|'gu'|'both'} [script='en']
 * @returns {string}
 */
export function getPassengerScriptDisplayName(passenger, script = "en") {
  if (!passenger) return ""
  const enName = formatShortPassengerName(passenger.name || "")
  const guName = formatShortGujaratiName(passenger.name, passenger.nameGu)

  if (script === "gu") {
    return guName || enName
  }
  if (script === "both") {
    return guName && guName !== enName ? `${enName} (${guName})` : enName
  }
  return enName
}
