// Alle vakken, onderdelen en examens. Pas hier namen of onderdelen aan.
export const BLOK_START = "2026-12-20";

const range = (n, start = 1) => Array.from({ length: n }, (_, i) => i + start);

export const COURSES = [
  {
    id: "oo",
    name: "Basismodellen uit operationeel onderzoek",
    short: "Operationeel onderzoek",
    tab: "Operationeel onderzoek",
    color: "#7b4b94",
    exam: { date: "2027-01-09", time: "16:30", room: "PDS - 01.30 (aula Pieter De Somer)", label: "Basismodellen uit operationeel onderzoek (TEW)" },
    parts: [
      { id: "th", label: "Theorie" },
      { id: "oef", label: "Oefeningen" },
    ],
    sections: [
      {
        title: "Deel 1 · Lineaire en geheeltallige programmering",
        modules: [
          { id: "lp1", num: "1", title: "LP: inleiding en modelleren" },
          { id: "lp2", num: "2", title: "LP: oplossen" },
          { id: "lp3", num: "3", title: "Sensitiviteitsanalyse" },
          { id: "ip", num: "4", title: "Geheeltallige programmering" },
        ],
      },
      {
        title: "Deel 2 · Netwerken en combinatorische optimalisatie",
        modules: [
          { id: "net", num: "5", title: "Netwerken" },
          { id: "comb", num: "6", title: "Combinatorische optimalisatie" },
        ],
      },
    ],
  },
  {
    id: "wis",
    name: "Wiskunde voor economen (deel 1)",
    short: "Wiskunde",
    tab: "Wiskunde",
    color: "#2f5d8a",
    exam: { date: "2027-01-13", time: "16:30", room: "PDS - 01.30 (aula Pieter De Somer)", label: "Wiskunde voor economen (deel 1)" },
    parts: [
      { id: "th", label: "Theorie" },
      { id: "wc", label: "Boek / werkcollege" },
      { id: "extra", label: "Extra oefeningen" },
    ],
    sections: [
      {
        title: "Modules",
        modules: range(10).map((n) => ({ id: `m${n}`, num: String(n), title: `Module ${n}` })),
      },
    ],
  },
  {
    id: "bi",
    name: "Grondslagen van de beleidsinformatica",
    short: "Beleidsinformatica",
    tab: "Beleidsinformatica",
    color: "#2a7f62",
    exam: { date: "2027-01-22", time: "08:30", room: "GT - 00.2.02 (aula)", label: "Grondslagen van de beleidsinformatica (HIR)" },
    parts: [
      { id: "th", label: "Theorie" },
      { id: "oef", label: "Oefeningen" },
    ],
    sections: [
      {
        title: "ICTS · theorie",
        parts: [{ id: "th", label: "Theorie" }],
        modules: [
          { id: "icts1", num: "H1", title: "Inleiding tot informatiesystemen" },
          { id: "icts2", num: "H2", title: "De digitale voorstelling van gegevens" },
          { id: "icts3", num: "H3", title: "De digitale weergave van multimediale gegevens" },
          { id: "icts4", num: "H4", title: "Gegevensstructuren en -formaten" },
          { id: "icts5", num: "H5", title: "Het document-georiënteerde gegevensmodel" },
          { id: "icts6", num: "H6", title: "Het relationele gegevensmodel" },
          { id: "icts7", num: "H7", title: "Persistente gegevensopslag" },
          { id: "icts8", num: "H8", title: "Gegevensinvoer en -uitvoer" },
        ],
      },
      {
        title: "Programmeren · theorie en oefeningen",
        hint: "Klik op het potloodje om de naam van een module of hoofdstuk te wijzigen.",
        modules: range(10).map((n) => ({ id: `prog${n}`, num: `S${n}`, title: `Sessie ${n}` })),
      },
    ],
  },
  {
    id: "stat",
    name: "Bedrijfsstatistiek",
    short: "Statistiek",
    tab: "Statistiek",
    color: "#b5832a",
    exam: { date: "2027-01-23", time: "12:30", room: "PDS - 01.30 (aula Pieter De Somer)", label: "Bedrijfsstatistiek (TEW)" },
    parts: [
      { id: "cursus", label: "Cursus" },
      { id: "oef", label: "Oefeningen" },
    ],
    sections: [
      {
        title: "Hoofdstukken",
        modules: [
          { id: "h1", num: "1", title: "Kansrekenen"},
          { id: "h2", num: "2", title: "Toevalsveranderlijken" },
          { id: "h3", num: "3", title: "Kansmodellen" },
          { id: "h4", num: "4", title: "Toevalsvectoren" },
          { id: "h5", num: "5", title: "Limietstellingen" },
          { id: "h6", num: "6", title: "Beschrijvende statistiek" },
          { id: "h7", num: "7", title: "Steekproeven" },
          { id: "h8", num: "8", title: "Puntschatters" },
          { id: "h9", num: "9", title: "Intervalschatters" },
        ],
      },
    ],
  },
  {
    id: "mp",
    name: "Markten en prijzen",
    short: "Markten en prijzen",
    tab: "Markten & prijzen",
    color: "#c8553d",
    sp: 6,
    exam: { date: "2027-01-29", time: "08:30", room: "", label: "Markten en prijzen" },
    parts: [
      { id: "th", label: "Les / theorie" },
      { id: "wc", label: "Werkcollege" },
      { id: "herh", label: "Herhalingsoef." },
    ],
    sections: [
      {
        title: "Modules",
        modules: [
          "Economie en welvaart",
          "Speltheorie",
          "Vraag en aanbod",
          "Schokken en elasticiteiten",
          "Gezinnen op outputmarkten",
          "Ondernemingen op outputmarkten",
          "Ondernemingen op factormarkten",
          "Markt en overheid",
          "Onvolmaakte mededinging",
          "Publieke goederen en externe effecten",
          "Asymmetrische informatie en (her)verdeling",
        ].map((title, i) => ({ id: `m${i}`, num: String(i), title })),
      },
    ],
  },
];

// Doelen voor de blok (20/12). `key` verwijst naar een opgeslagen vinkje;
// sommige doelen delen hun vinkje met een onderdeel in het vak-tabblad.
export const GOALS = [
  {
    course: "mp",
    title: "Elk werkcollege opnieuw maken + schema",
    columns: [
      { id: "redo", label: "WC-oefeningen opnieuw", key: (m) => `g:mp:${m.id}:redo` },
      { id: "schema", label: "Schema", key: (m) => `g:mp:${m.id}:schema` },
    ],
  },
  {
    course: "stat",
    title: "Elk hoofdstuk al eens gezien",
    columns: [{ id: "seen", label: "Gezien", key: (m) => `p:stat:${m.id}:cursus` }],
  },
  {
    course: "wis",
    title: "Elk werkcollege gemaakt (+ eventueel schema)",
    columns: [
      { id: "wc", label: "WC gemaakt", key: (m) => `p:wis:${m.id}:wc` },
      { id: "schema", label: "Schema", optional: true, key: (m) => `g:wis:${m.id}:schema` },
    ],
  },
];

export const UNDERSTANDING = [
  { id: "goed", label: "Goed gekend", short: "Goed" },
  { id: "herhalen", label: "Te herhalen", short: "Herhalen" },
  { id: "niks", label: "Snap er niks van", short: "Snap niks" },
];
