import { Toilet, Armor } from './types';

const ADJECTIVES_BY_ZONE = [
  // Zone 1: levels 1-10 (Sewer Starters)
  ["Grimy", "Leaky", "Salvaged", "Cruddy", "Basic", "Cracked", "Retro", "Duct-Taped", "Cardboard", "Smelly"],
  // Zone 2: levels 11-20 (Neighborhood & Household)
  ["Suburban", "Office", "Chrome", "Double-Flush", "Commuter", "Commercial", "Luxury Ceramic", "High-Flow", "Standard", "Polished"],
  // Zone 3: levels 21-30 (Golden Gilded Era)
  ["Gilded", "Royal", "Aristocratic", "Sovereign", "Golden", "Imperial", "Emerald-Toned", "Sapphire-Rimmed", "Jeweled", "Ornate"],
  // Zone 4: levels 31-40 (Industrial Strength)
  ["Steampunk", "Hydraulic", "High-Pressure", "Copper-Wound", "Ironclad", "Boiler-Plated", "Steam-Powered", "Piston-Loaded", "Riveted", "Industrial"],
  // Zone 5: levels 41-50 (Elemental Fury)
  ["Magma", "Frosty", "Thunderous", "Glacial", "Stormy", "Volcanic", "Wind-Whipped", "Torrential", "Blizzard", "Pyromaniac"],
  // Zone 6: levels 51-60 (Sci-Fi & Cybernetics)
  ["Holographic", "Quantum", "Nanotech", "Overclocked", "Laser-Guided", "Cybernetic", "Matrix", "Neon-Pulse", "Synth-Fiber", "Neural"],
  // Zone 7: levels 61-70 (Space & Exploration)
  ["Interstellar", "Zero-Gravity", "Antimatter", "Warp-Drive", "Orbital", "Nebula-Mist", "Asteroid", "Supernova", "Cosmic", "Galactic"],
  // Zone 8: levels 71-80 (Mythical & Ancient)
  ["Mythic", "Elven", "Dragon-Fire", "Runed", "Sorcerer's", "Temple", "Cursed", "Blessed", "Necromantic", "Phoenix"],
  // Zone 9: levels 81-90 (Dimensional Singularity)
  ["Singularity", "Chronoshift", "Multiverse", "Wormhole", "Matrix-Void", "Quantum-Rift", "Paradox", "Dark-Energy", "Void", "Abstract"],
  // Zone 10: levels 91-100 (Ultimate Transcendence)
  ["Omnipotent", "Divine", "Ascended", "Hyper-Space", "Transcendent", "Supreme", "Infinite-Poop", "Almighty", "Absolute", "Developer"]
];

const NOUNS_BY_ZONE = [
  ["Potty", "Latrine", "Box", "Sump", "Basin", "Bucket", "Outhouse", "Drain"],
  ["Throne", "Commode", "Urinal", "Stall", "Washbox", "Bowl"],
  ["Throne", "Seat of Power", "Gold Urinal", "Royal Basin", "Crown Stall"],
  ["Engine Toilet", "Valve Latrine", "Brass Commode", "Boiler Potty", "Gearbox Stall"],
  ["Lavabowl", "Frostbidet", "Thunderstall", "Gale-Force Urinal", "Geo-Throne"],
  ["Washlet", "Pod", "Interface", "Terminal", "Bidet 9000", "Synth-Throne"],
  ["Space Station", "Lunar Potty", "Alien Pod", "Comet Commode", "Star Gate Toilet"],
  ["Altar", "Relic Seat", "Arcane Basin", "Dragon Urinal", "Rune Throne"],
  ["Continuum Seat", "Void Basin", "Paradox Potty", "Gravity Singularity", "Infinity Commode"],
  ["God Throne", "Alpha-Omega Bidet", "Nirvana Cup", "Cosmic Overlord", "Plunger-Slayer", "Universal Crown"]
];

const EMOJIS_BY_ZONE = [
  ["🛖", "🥣", "🏺", "📦", "🛢️", "🚽", "💩"],
  ["🚽", "🧼", "🚪", "🏢", "🏨", "🧹"],
  ["🏆", "👑", "🏰", "💎", "💍", "🪙"],
  ["⚙️", "🛠️", "🔩", "🏭", "🌡️", "💨"],
  ["🌋", "❄️", "⚡", "🔥", "🌪️", "🌊"],
  ["🧠", "🤖", "🚀", "📡", "🔋", "💻"],
  ["🚀", "🛸", "🪐", "🛰️", "👽", "🌌"],
  ["🐉", "🦄", "🔮", "📜", "🛡️", "🏛️"],
  ["🌀", "⌛", "🧿", "🔭", "🕳️", "🧭"],
  ["💎", "👑", "✨", "🚽", "💩", "🌟"]
];

const COLORS_BY_ZONE = [
  ["#8b5a2b", "#78350f", "#450a0a"],
  ["#e5e7eb", "#9ca3af", "#4b5563"],
  ["#fbbf24", "#f59e0b", "#d97706"],
  ["#b45309", "#854d0e", "#7c2d12"],
  ["#f97316", "#ef4444", "#dc2626"],
  ["#06b6d4", "#0891b2", "#0369a1"],
  ["#3b82f6", "#1d4ed8", "#1e40af"],
  ["#a855f7", "#7c3aed", "#6d28d9"],
  ["#ec4899", "#db2777", "#be185d"],
  ["#10b981", "#059669", "#047857"]
];

const DESCRIPTIVE_ACTIONS = [
  "washes away nasty bacteria with a localized waterfall.",
  "vaporizes dangerous toilet germs with double-flush power.",
  "inflicts pure psychological damage upon any dirty microbe.",
  "restores plumbing order with hyper-pressure spray mechanics.",
  "unleashes an unstoppable detergent tidal wave onto sanity foes.",
  "rewrites the liquid dynamic of trash sanitization forever.",
  "creates an incredibly safe and clean zone of pure relief.",
  "forces bad sewer bacteria to meet their ultimate aquatic doom."
];

const DESCRIPTIVE_PERKS = [
  "Triggers a massive sanitizing wash splash.",
  "Reduces reload triggers and enhances flush speed.",
  "Equips explosive spray ripples to maximize impact.",
  "Grants high-power double sweep diameter.",
  "Unleashes clean energy forcefield duration.",
  "Blasts heavy sanitation bubbles at all surrounding germs.",
  "Amplifies core flush pressure for extreme damage ranges.",
  "Generates hyper-frequency washing waves."
];

// Preserved original handcrafted toilets
const HANDCRAFTED_TOILETS: Record<number, Toilet> = {
  1: {
    id: 'porta_potty',
    name: 'Rusty Porta-Potty',
    emoji: '🛖',
    cost: 0, // Starts unlocked!
    cooldownMs: 6000,
    description: 'A smelling plastic box on a sunny construction site. It leaks, but it flushes!',
    perk: 'Standard Splash damage. Base wash.',
    color: '#8b5a2b',
    pulseColor: '#2b8b5a',
    damage: 10,
    level: 1,
    flushRadius: 150
  },
  2: {
    id: 'ceramic_throne',
    name: 'Classic Porcelain Throne',
    emoji: '🚽',
    cost: 15,
    cooldownMs: 4500,
    description: 'Elegant, white, gleaming ceramic. The comfort level is unmatched. Pure household bliss.',
    perk: 'Shorter cooldown, cleaner wash wave.',
    color: '#e5e7eb',
    pulseColor: '#38bdf8',
    damage: 16,
    level: 2,
    flushRadius: 200
  },
  3: {
    id: 'golden_stall',
    name: '24K Golden Urinal',
    emoji: '🏆',
    cost: 50,
    cooldownMs: 3500,
    description: 'Constructed entirely from solid gold mined by royal plumbers. Smells like expensive luxury.',
    perk: 'Double-diameter sweep + drops extra coins.',
    color: '#fbbf24',
    pulseColor: '#f59e0b',
    damage: 25,
    level: 3,
    flushRadius: 280
  },
  4: {
    id: 'volcanic_latrine',
    name: 'Volcanic Latrine 🌋',
    emoji: '🌋',
    cost: 90,
    cooldownMs: 3000,
    description: 'Carved out of active volcanic stone. Warm to sit on, literally melts sanitary foes!',
    perk: 'Incinerating heat-wave splash + extra damage.',
    color: '#f97316',
    pulseColor: '#ef4444',
    damage: 38,
    level: 4,
    flushRadius: 350
  },
  5: {
    id: 'neon_bidet',
    name: 'Cyber-Bidet washlet 3000',
    emoji: '🧠',
    cost: 140,
    cooldownMs: 2200,
    description: 'Heated seat, neon bottom lighting, and an AI-controlled water jet that targets dirt with laser-guided precision.',
    perk: 'Rapid reload + slow duration forcefield that shields HP.',
    color: '#06b6d4',
    pulseColor: '#22c55e',
    damage: 55,
    level: 5,
    flushRadius: 420
  },
  6: {
    id: 'space_station',
    name: 'Space Toilet Station',
    emoji: '🚀',
    cost: 220,
    cooldownMs: 1800,
    description: 'Zero gravity waste system fitted on interstellar space shuttles. Antimatter-flush enabled.',
    perk: 'Anti-gravity beam + massive space shockwave.',
    color: '#3b82f6',
    pulseColor: '#a855f7',
    damage: 80,
    level: 6,
    flushRadius: 500
  },
  7: {
    id: 'cosmic_singularity',
    name: 'Cosmic Gravity Toilet',
    emoji: '🌀',
    cost: 350,
    cooldownMs: 1200,
    description: 'An advanced waste extraction system powered by a miniature black hole. Sucks impurities into another dimension.',
    perk: 'Ultra fast cool-down + drags enemies toward the epicenter.',
    color: '#8b5cf6',
    pulseColor: '#ec4899',
    damage: 120,
    level: 7,
    flushRadius: 600
  },
  8: {
    id: 'diamond_bidet',
    name: 'Ultimate Diamond Bidet 💎',
    emoji: '💎',
    cost: 600,
    cooldownMs: 750,
    description: 'Crafted from pressurized cosmic carbon. The ultimate flushing weapon in the known multiverse.',
    perk: 'Flashes blinding light + instant high fire-rate blasting.',
    color: '#38bdf8',
    pulseColor: '#60a5fa',
    damage: 200,
    level: 8,
    flushRadius: 700
  }
};

const buildToiletCatalog = (): Toilet[] => {
  const list: Toilet[] = [];

  for (let L = 1; L <= 100; L++) {
    const zoneIndex = Math.min(9, Math.floor((L - 1) / 10));
    
    // --- Toilet A (Primary) ---
    if (HANDCRAFTED_TOILETS[L]) {
      list.push(HANDCRAFTED_TOILETS[L]);
    } else {
      // Procedural Toilet A
      const adjIndex = (L * 3) % ADJECTIVES_BY_ZONE[zoneIndex].length;
      const nounIndex = (L * 7) % NOUNS_BY_ZONE[zoneIndex].length;
      const emojiIndex = (L * 5) % EMOJIS_BY_ZONE[zoneIndex].length;
      const colorIndex = (L * 2) % COLORS_BY_ZONE[zoneIndex].length;
      const pulseColorIndex = (L * 4 + 1) % COLORS_BY_ZONE[zoneIndex].length;

      const name = `${ADJECTIVES_BY_ZONE[zoneIndex][adjIndex]} ${NOUNS_BY_ZONE[zoneIndex][nounIndex]}`;
      const emoji = EMOJIS_BY_ZONE[zoneIndex][emojiIndex];
      const color = COLORS_BY_ZONE[zoneIndex][colorIndex];
      const pulseColor = COLORS_BY_ZONE[zoneIndex][pulseColorIndex];

      // Exponential coin scaling
      const cost = Math.floor(Math.pow(L, 1.62) * 15);
      // Continuous cooldown decrease
      const cooldownMs = Math.max(150, Math.floor(6000 * Math.pow(0.958, L - 1)));
      // Scaling damage
      const damage = Math.floor(12 + L * 6 + Math.pow(L, 1.25) * 0.7);
      // Scaling flush radius (from L 1-100: starts ~150 scaling up to ~750)
      const flushRadius = Math.floor(150 + L * 5 + Math.pow(L, 1.05) * 1.5);

      const actionText = DESCRIPTIVE_ACTIONS[L % DESCRIPTIVE_ACTIONS.length];
      const description = `This exclusive Level ${L} toilet ${actionText} Designed with advanced plumbing features.`;
      const perkId = DESCRIPTIVE_PERKS[L % DESCRIPTIVE_PERKS.length];
      const perk = `${perkId} Deals +${Math.floor(L * 0.4)}% precision critical washes.`;

      list.push({
        id: `toilet_lvl_${L}_a`,
        name,
        emoji,
        cost,
        cooldownMs,
        description,
        perk,
        color,
        pulseColor,
        damage,
        level: L,
        flushRadius
      });
    }

    // --- Toilet B (Secondary) ---
    const adjIndexB = (L * 11 + 4) % ADJECTIVES_BY_ZONE[zoneIndex].length;
    const nounIndexB = (L * 13 + 2) % NOUNS_BY_ZONE[zoneIndex].length;
    const emojiIndexB = (L * 17 + 1) % EMOJIS_BY_ZONE[zoneIndex].length;
    const colorIndexB = (L * 6 + 1) % COLORS_BY_ZONE[zoneIndex].length;
    const pulseColorIndexB = (L * 8 + 2) % COLORS_BY_ZONE[zoneIndex].length;

    const nameB = `Premium ${ADJECTIVES_BY_ZONE[zoneIndex][adjIndexB]} ${NOUNS_BY_ZONE[zoneIndex][nounIndexB]}`;
    const emojiB = EMOJIS_BY_ZONE[zoneIndex][emojiIndexB];
    const colorB = COLORS_BY_ZONE[zoneIndex][colorIndexB];
    const pulseColorB = COLORS_BY_ZONE[zoneIndex][pulseColorIndexB];

    // Slightly higher cost and damage for premium variant B
    const costB = Math.floor(Math.pow(L, 1.65) * 18) + 10;
    const cooldownMsB = Math.max(150, Math.floor(5500 * Math.pow(0.955, L - 1)));
    const damageB = Math.floor(16 + L * 6.5 + Math.pow(L, 1.28) * 0.75);
    // Slightly higher flush radius
    const flushRadiusB = Math.floor(180 + L * 5.5 + Math.pow(L, 1.05) * 2.0);

    const actionTextB = DESCRIPTIVE_ACTIONS[(L + 1) % DESCRIPTIVE_ACTIONS.length];
    const descriptionB = `An engineered Level ${L} bidet that ${actionTextB} Highly luxurious comfort cushion included.`;
    const perkIdB = DESCRIPTIVE_PERKS[(L + 1) % DESCRIPTIVE_PERKS.length];
    const perkB = `${perkIdB} Speeds up flush pressure regeneration by +${Math.floor(L * 0.5)}%.`;

    list.push({
      id: `toilet_lvl_${L}_b`,
      name: nameB,
      emoji: emojiB,
      cost: costB,
      cooldownMs: cooldownMsB,
      description: descriptionB,
      perk: perkB,
      color: colorB,
      pulseColor: pulseColorB,
      damage: damageB,
      level: L,
      flushRadius: flushRadiusB
    });
  }

  return list;
};

export const TOILET_CATALOG: Toilet[] = [
  {
    id: 'cowguy_throne',
    name: "Cowguy's Galactic Throne",
    emoji: '🤠',
    cost: 0,
    cooldownMs: 1200,
    description: "An absolute masterpiece of plumbing blessed by Cowguy55. Blasts enemies with supersonic milking power!",
    perk: "Ultra speed cooldown + 500 damage super blast + Spills golden milk!",
    color: '#eab308',
    pulseColor: '#ef4444',
    damage: 500,
    level: 1,
    flushRadius: 1000
  },
  ...buildToiletCatalog()
];

export interface EnemyVariety {
  type: 'germ' | 'fly' | 'soap' | 'toilet_paper' | 'brush' | 'bleach' | 'plunger';
  name: string;
  emoji: string;
  maxHp: number;
  speed: number;
  size: number;
  scoreValue: number;
  introducedLevel: number;
}

const ENEMY_ADJECTIVES = [
  "Toxic", "Pesky", "Sanitary", "Unrolled", "Berserker", "Acidic", "Grand", "Rusty", "Dirty", "Stinky",
  "Septic", "Moldy", "Crusty", "Noxious", "Slippery", "Fuming", "Rotten", "Radioactive", "Biohazard", "Gutter",
  "Caustic", "Slime", "Sewer", "Clogged", "Drain", "Bubbling", "Filthy", "Swamp", "Muddy", "Chemical",
  "Grimy", "Foamy", "Greasy", "Polluted", "Corrosive", "Pestilent", "Vile", "Putrid", "Damp", "Plumbing",
  "Sludge", "Swill", "Murky", "Smelly", "Rancid", "Feculent", "Stale", "Corrupted", "Vaporous", "Germy",
  "Infectious", "Contaminated", "Decayed", "Yucky", "Gross", "Grimace", "Nasty", "Horrid", "Mucky", "Stagnant",
  "Putrescent", "Mephitic", "Fetid", "Odorous", "Rank", "Spoiled", "Sullied", "Soiled", "Befouled", "Dingy",
  "Squalid", "Sordid", "Tarnished", "Dusty", "Cobwebbed", "Forgotten", "Overgrown", "Mutated", "Rabid", "Feral",
  "Slithering", "Creeping", "Crawling", "Scuttling", "Buzzing", "Splatting", "Dripping", "Flowing", "Oozing", "Bursting",
  "Aggressive", "Unstoppable", "Insane", "Enraged", "Apocalyptic", "Doomsday", "Omega", "Forbidden", "Legendary", "Ultimate"
];

const ENEMY_NOUNS = [
  "Microbe", "Flyer", "Patrol", "Mummy", "Striker", "Bomber", "Overlord", "Roach", "Worm", "Leech",
  "Sludge", "Blob", "Fungus", "Spore", "Snail", "Spectre", "Grub", "Gnat", "Centipede", "Bacteria",
  "Parasite", "Aerosol", "Scrubber", "Detergent", "Clogger", "Drainer", "Sewer-Rat", "Germ-Ball", "Scum", "Gunk",
  "Bane", "Viper", "Beast", "Critter", "Crawler", "Gargoyle", "Demon", "Phantom", "Slayer", "Wrecker",
  "Horror", "Terror", "Devourer", "Scourge", "Plague", "Infection", "Colony", "Swarm", "Mutant", "Anomaly",
  "Stalker", "Spitter", "Stinger", "Ooze", "Mold", "Mildew", "Muck", "Grime", "Rust", "Corrosion",
  "Chemical", "Vapor", "Gas", "Acid", "Poison", "Toxin", "Venom", "Enzyme", "Catalyst", "Reagent",
  "Plunger", "Brush", "Soap", "Paper", "Wasp", "Hornet", "Tick", "Mite", "Louse", "Flea",
  "Slug", "Larva", "Maggot", "Cocoon", "Pupa", "Virus", "Viroid", "Prion", "Amoeba", "Ciliate",
  "Flagellate", "Sporozoa", "Yeaster", "Phage", "Superbug", "Overgloom", "Cataclysm", "Abomination", "Leviathan", "Titan"
];

const ENEMY_EMOJIS = [
  '🦠', '🪰', '🧼', '🧻', '🧹', '🧴', '🪠', '🐀', '🐛', '🦎', 
  '🐸', '🦟', '🦗', '🕷️', '🦂', '🦨', '🦝', '🐊', '🧽', '🧪', 
  '☣️', '⚠️', '💀', '👻', '🐙', '🐌', '🪱', '🦖', '🦧', '🐖', 
  '🦇', '🦫', '🦦', '🦴', '🍄', '🌵', '🕸️', '🐝'
];

const buildAllEnemyVarieties = (): EnemyVariety[] => {
  const list: EnemyVariety[] = [];
  const types: Array<'germ' | 'fly' | 'soap' | 'toilet_paper' | 'brush' | 'bleach' | 'plunger'> = [
    'germ', 'fly', 'soap', 'toilet_paper', 'brush', 'bleach', 'plunger'
  ];

  for (let L = 1; L <= 100; L++) {
    const type = types[(L - 1) % types.length];
    
    // Select unique adjectives and nouns deterministically based on L
    const adj = ENEMY_ADJECTIVES[(L - 1) % ENEMY_ADJECTIVES.length];
    const noun = ENEMY_NOUNS[(L - 1) % ENEMY_NOUNS.length];
    const emoji = ENEMY_EMOJIS[(L - 1) % ENEMY_EMOJIS.length];

    // Scale statistics progressively
    const hp = Math.floor(15 + L * 3.5 + Math.pow(L, 1.3) * 1.5);
    
    const typeSpeedBonus = type === 'fly' ? 0.7 : type === 'soap' || type === 'bleach' ? -0.3 : 0;
    const speed = Math.round((Math.max(0.6, Math.min(2.8, 1.1 + (L * 0.008) + typeSpeedBonus)) + Number.EPSILON) * 100) / 100;
    
    const size = Math.max(18, Math.min(46, 22 + (L % 14)));
    const scoreValue = 10 + L * 4;

    list.push({
      type,
      name: `${adj} ${noun}`,
      emoji,
      maxHp: hp,
      speed,
      size,
      scoreValue,
      introducedLevel: L
    });
  }
  return list;
};

export const ALL_ENEMY_VARIETIES = buildAllEnemyVarieties();

export const ENEMY_VARIETIES = ALL_ENEMY_VARIETIES.slice(0, 7);

const ARMOR_ADJECTIVES_BY_ZONE = [
  ["Grimy", "Taped", "Plastic", "Leaky", "Ripped", "Cardboard", "Improvised", "Scrap", "Bubble-Wrapped", "Rusty"],
  ["Household", "Rubber", "Sponge", "Ceramic", "Vinyl", "Plumber's", "Silicone", "Heavy-Duty", "Reinforced", "Steel-Toed"],
  ["Polished", "Silver", "Gilded", "Porcelain", "Golden", "Royal", "Regal", "Crowned", "Imperial", "Majestic"],
  ["Brass-Bound", "Copper-Plated", "Steam-Powered", "Riveted", "Pneumatic", "Gear-Tooth", "Piston", "Heavy-Iron", "Boiler-Suit", "Alloy"],
  ["Volcanic", "Fire-Retardant", "Magma", "Thermal", "Frost-Guard", "Glacial", "Storm-Chasing", "Lightning-Rod", "Ice-Capped", "Static"],
  ["Carbon-Fiber", "Nano-Weave", "Neo-Tokyo", "Laser-Shield", "Cybernetic", "Matrix", "Kinetic", "Biosphere", "Grid-Runner", "Holographic"],
  ["Space-Suit", "Gravitational", "Antimatter", "Warp-Field", "Solar-Flare", "Meteorite", "Vacuum", "Star-Core", "Astro", "Nebula"],
  ["Arcane", "Runed", "Sorcerer's", "Mithril", "Dragon-Scale", "Wizard", "Sacred", "Enchanted", "Elven", "Divine"],
  ["Void-Plate", "Singularity-Wrap", "Paradox", "Warp", "Shadow-Energy", "Dark-Matter", "Reality-Bending", "Dimension-Shift", "Quantum", "Infinity"],
  ["Omnipotent", "Transcendence", "God-Plate", "Universe-Shield", "Plunger-Buster", "Alpha", "Omega", "Cosmic-Eternal", "Apex", "Absolute"]
];

const ARMOR_NOUNS_BY_ZONE = [
  ["Poncho", "Guard", "Vest", "Wrapper", "Apron", "Shin-Guards", "Scrap-Mail"],
  ["Smock", "Overall", "Shell", "Shield", "Chestplate", "Fitted-Mail"],
  ["Breastplate", "Cuirass", "Great-Shield", "Plate", "Hauberk", "Royal-Robes"],
  ["Boiler", "Exo-Skeleton", "Gearmail", "Steam-Shell", "Deflector", "Forge-Frame"],
  ["Heatshield", "Frostcloak", "Magma-Guard", "Stormcoat", "Aegis", "Insulation"],
  ["Exo-Suit", "Mesh", "Nanocloak", "Force-Field", "Deflector-Shell", "Matrix-Core"],
  ["Space-Rig", "Jet-Vest", "Astroplate", "Astroguard", "Warp-Shell", "Star-Cuirass"],
  ["Mystic Cloak", "Spellguard", "Dragon-Plate", "Aegis-Carapace", "Rune-Carapace", "Mantle"],
  ["Paradox Shell", "Singularity Vest", "Chronoshield", "Null-Barrier", "Rift-Plate", "Void-Mail"],
  ["Creation Guard", "Godly Carapace", "Infinity-Rig", "Overlord Frame", "Ultimate-Plate", "Cosmic Aegis"]
];

const ARMOR_EMOJIS_BY_ZONE = [
  ["🦺", "📦", "👕", "🧥", "🩹", "🩹"],
  ["👕", "🥼", "🦺", "🛡️", "🧤", "🦺"],
  ["🛡️", "👑", "🎖️", "🥇", "💍", "💎"],
  ["⚙️", "🛠️", "🦾", "🦿", "🔩", "🦺"],
  ["🔥", "❄️", "⚡", "☄️", "☔", "🌡️"],
  ["🤖", "💻", "🧠", "🔋", "💿", "🚀"],
  ["🧑‍🚀", "🚀", "🛸", "🪐", "🌌", "🌟"],
  ["🔮", "📜", "🛡️", "⚔️", "🎭", "👑"],
  ["🌀", "🕳️", "🧿", "🔭", "🧪", "🧬"],
  ["✨", "👑", "💎", "🌟", "🛡️", "🛸"]
];

const ABILITY_TYPES: Array<{
  id: Armor['abilityId'];
  name: string;
  desc: string;
}> = [
  { id: 'soap_ring', name: 'Sanitization Soap Ring', desc: 'Spawns orbital rotating soap bars around you that pop and melt touching germs.' },
  { id: 'dash_impulse', name: 'Kinetic Shockwave Dash', desc: 'Every 5 seconds, releases a powerful shockwave ring that knocks back nearby germs and inflicts damage.' },
  { id: 'acid_spill', name: 'Blue Sanitizing Trail', desc: 'Automatically drips clean blue sanitizing puddles that melt enemies walking over them.' },
  { id: 'magnet', name: 'Industrial Pull Magnet', desc: 'Greatly increases item and coin vacuum radius, vacuuming treasures from far away.' },
  { id: 'bouncy_shield', name: 'Thorns Spiky Reflect', desc: 'When you take damage, deal 120% of received damage back to the attacker as splash recoil.' },
  { id: 'nuclear_flush_boost', name: 'Hyper-Velocity Flusher', desc: 'Increases the speed and physical sweep size of game flushes by 30%.' },
  { id: 'electro_shock', name: 'Static Chain-Lightning', desc: 'Periodically shoots electric jolts zapping random nearby microbial targets.' }
];

const buildArmorCatalog = (): Armor[] => {
  const list: Armor[] = [];
  
  // Handcraft level 1 starting armor
  list.push({
    id: 'basic_poncho',
    name: 'Dilapidated Trash Poncho',
    emoji: '🦺',
    cost: 0, // Starts unlocked at level 1!
    level: 1,
    description: 'A plastic trash bag with a couple of arm-holes cut out. It blocks some dust, technically.',
    perk: 'Blocks 10% of incoming germ impacts. Generates minor bio-shield of 15 HP.',
    shieldHp: 15,
    maxShieldHp: 15,
    shieldAbsorbPercent: 0.10,
    abilityId: 'magnet',
    abilityName: 'Minor Pull Spark',
    abilityDescription: 'Gently pulls coins from a small distance.',
    color: '#a1a1aa'
  });

  for (let L = 1; L <= 100; L++) {
    const zoneIndex = Math.min(9, Math.floor((L - 1) / 10));
    
    // Skill index selection
    const adjIndex = (L * 4 + 3) % ARMOR_ADJECTIVES_BY_ZONE[zoneIndex].length;
    const nounIndex = (L * 8 + 1) % ARMOR_NOUNS_BY_ZONE[zoneIndex].length;
    const emojiIndex = (L * 6 + 2) % ARMOR_EMOJIS_BY_ZONE[zoneIndex].length;
    const abilityIndex = (L * 3) % ABILITY_TYPES.length;

    const name = `${ARMOR_ADJECTIVES_BY_ZONE[zoneIndex][adjIndex]} ${ARMOR_NOUNS_BY_ZONE[zoneIndex][nounIndex]}`;
    const emoji = ARMOR_EMOJIS_BY_ZONE[zoneIndex][emojiIndex];
    const color = COLORS_BY_ZONE[zoneIndex][L % COLORS_BY_ZONE[zoneIndex].length];

    // Costs scale up similar to toilets
    const cost = Math.floor(Math.pow(L, 1.58) * 12) + 5;
    
    // Shield health capacity increases with level, e.g. Level 1: ~20 Shield, Level 100: ~1200 Shield
    const maxShieldHp = Math.floor(15 + L * 8 + Math.pow(L, 1.5) * 0.4);
    
    // Shield absorption increases from 12% to 85%
    const shieldAbsorbPercent = Math.min(0.85, 0.12 + (L * 0.0075));
    
    const activeAbility = ABILITY_TYPES[abilityIndex];

    const description = `This exclusive Level ${L} gear provides premium bodily coverage on active sanitization fields.`;
    const perk = `Reduces core body hits by ${Math.floor(shieldAbsorbPercent * 100)}% and adds +${maxShieldHp} rechargeable Energy Shield HP.`;

    if (L === 1) {
      list.push({
        id: `armor_lvl_1_proc`,
        name: `Starter Plumbing Vest`,
        emoji: '🎽',
        cost: 8,
        level: 1,
        description: 'Smells of detergent but gets you initialized.',
        perk: 'Reduces core hits by 15% and adds +25 shield HP.',
        shieldHp: 25,
        maxShieldHp: 25,
        shieldAbsorbPercent: 0.15,
        abilityId: 'magnet',
        abilityName: 'Minor Pull Spark',
        abilityDescription: 'Gently vacuum coins from a standard bounds.',
        color: '#64748b'
      });
      continue;
    }

    list.push({
      id: `armor_lvl_${L}`,
      name,
      emoji,
      cost,
      level: L,
      description,
      perk,
      shieldHp: maxShieldHp,
      maxShieldHp,
      shieldAbsorbPercent,
      abilityId: activeAbility.id,
      abilityName: activeAbility.name,
      abilityDescription: activeAbility.desc,
      color
    });
  }

  return list;
};

export const ARMOR_CATALOG: Armor[] = [
  {
    id: 'cowguy_suit',
    name: "Cowguy's Galactic Cow Suit",
    emoji: '🐮',
    cost: 0,
    level: 1,
    description: "A legendary black-and-white bovine armor suit blessed by Cowguy55. Compact and lightweight, releases awesome kinetic milk shockwaves!",
    perk: "Reduces core body hits by 85% and adds +500 rechargeable Energy Shield HP!",
    shieldHp: 500,
    maxShieldHp: 500,
    shieldAbsorbPercent: 0.85,
    abilityId: 'dash_impulse',
    abilityName: "Supersonic Cow Shockwave",
    abilityDescription: "Every 5 seconds, releases a devastating supersonic kinetic milk blast knocking enemies back and vaporizing them!",
    color: '#ffffff'
  },
  ...buildArmorCatalog()
];
