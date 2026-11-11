// =====================================================
// NEON DROP // 100% Original Tactical Arsenal & Blade Engine
// =====================================================

const RARITIES = {
  // Base prices calibrated for a $35 reference case to yield ~64.5% RTP (35.5% House Edge)
  blue:   { id: 'blue',   name: 'Padrão (Azul)',       color: '#4b69ff', weight: 75.0, next: 'purple', basePrice: 5.5 },
  purple: { id: 'purple', name: 'Tático (Roxo)',       color: '#8847ff', weight: 16.0, next: 'pink',   basePrice: 22  },
  pink:   { id: 'pink',   name: 'Protótipo (Rosa)',    color: '#d32ce6', weight: 5.5,  next: 'red',    basePrice: 70  },
  red:    { id: 'red',    name: 'Relíquia (Vermelho)', color: '#eb4b4b', weight: 2.5,  next: 'gold',   basePrice: 210 },
  gold:   { id: 'gold',   name: '★ Apex Mítico',       color: '#ffd700', weight: 1.0,  next: null,     basePrice: 700 },
};

const RARITY_ORDER = ['blue', 'purple', 'pink', 'red', 'gold'];

// =====================================================
// 6-TIER TACTICAL CASE CONTAINER SVG ENGINE
// =====================================================
let svgCounter = 0;

function getTacticalCaseSVG(caseObj) {
  const uid = ++svgCounter;
  const gid = `case_g_${uid}`;
  const glowId = `case_gl_${uid}`;
  const c1 = caseObj?.c1 || '#0075ff';
  const c2 = caseObj?.c2 || '#00b24b';
  const tier = caseObj?.tier || 1;

  let bodySvg = '';
  switch (tier) {
    case 1: // Tier 1: Maleta Tática Militar
      bodySvg = `
        <path d="M26 22V15C26 13 28 11 31 11H49C52 11 54 13 54 15V22" stroke="#9aa1b1" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="8" y="21" width="64" height="46" rx="6" fill="#181a1f" stroke="#2d2f33" stroke-width="2"/>
        <rect x="11" y="24" width="58" height="40" rx="4" fill="#1f2229" stroke="url(#${gid})" stroke-width="2"/>
        <rect x="16" y="29" width="6" height="30" rx="1.5" fill="#14161a"/>
        <rect x="58" y="29" width="6" height="30" rx="1.5" fill="#14161a"/>
        <rect x="8" y="40" width="64" height="6" fill="url(#${gid})"/>
        <rect x="21" y="19" width="8" height="7" rx="1.5" fill="${c1}"/>
        <rect x="51" y="19" width="8" height="7" rx="1.5" fill="${c1}"/>
        <rect x="33" y="36" width="14" height="14" rx="3" fill="#121316" stroke="${c2}" stroke-width="2"/>
        <circle cx="40" cy="43" r="3" fill="${c1}"/>
      `;
      break;
    case 2: // Tier 2: Contêiner Criogênico Cilíndrico
      bodySvg = `
        <rect x="16" y="10" width="48" height="8" rx="3" fill="#232730" stroke="${c1}" stroke-width="2"/>
        <rect x="16" y="62" width="48" height="8" rx="3" fill="#232730" stroke="${c1}" stroke-width="2"/>
        <rect x="18" y="18" width="44" height="44" fill="#161920" stroke="url(#${gid})" stroke-width="2.5"/>
        <path d="M12 24H18M12 36H18M12 44H18M12 56H18" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M62 24H68M62 36H68M62 44H68M62 56H68" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="29" y="24" width="22" height="32" rx="11" fill="#0e1116" stroke="${c1}" stroke-width="2"/>
        <rect x="34" y="29" width="12" height="22" rx="6" fill="url(#${gid})" opacity="0.85"/>
        <line x1="29" y1="40" x2="51" y2="40" stroke="#ffffff" stroke-width="1.5" opacity="0.7"/>
      `;
      break;
    case 3: // Tier 3: Cofre Blindado Hexagonal
      bodySvg = `
        <polygon points="24,12 56,12 72,40 56,68 24,68 8,40" fill="#181b22" stroke="url(#${gid})" stroke-width="3"/>
        <polygon points="28,18 52,18 64,40 52,62 28,62 16,40" fill="#222630" stroke="#2d2f33" stroke-width="1.5"/>
        <circle cx="40" cy="40" r="14" fill="#12141a" stroke="${c1}" stroke-width="2.5"/>
        <line x1="40" y1="26" x2="40" y2="54" stroke="${c2}" stroke-width="2"/>
        <line x1="26" y1="40" x2="54" y2="40" stroke="${c2}" stroke-width="2"/>
        <circle cx="40" cy="40" r="5" fill="url(#${gid})"/>
      `;
      break;
    case 4: // Tier 4: Cápsula de Plasma Suspensa
      bodySvg = `
        <path d="M14 16L24 10H56L66 16V64L56 70H24L14 64V16Z" fill="#15171e" stroke="url(#${gid})" stroke-width="2.5"/>
        <rect x="18" y="20" width="6" height="40" rx="2" fill="${c1}" opacity="0.75"/>
        <rect x="56" y="20" width="6" height="40" rx="2" fill="${c1}" opacity="0.75"/>
        <circle cx="40" cy="40" r="16" fill="url(#${glowId})" stroke="${c2}" stroke-width="2"/>
        <circle cx="40" cy="40" r="8" fill="url(#${gid})"/>
        <ellipse cx="40" cy="40" rx="22" ry="7" stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.65"/>
      `;
      break;
    case 5: // Tier 5: Relicário Valquíria
      bodySvg = `
        <path d="M6 26L22 14H58L74 26L64 66H16L6 26Z" fill="#1a1820" stroke="url(#${gid})" stroke-width="3"/>
        <path d="M14 30L26 20H54L66 30L58 60H22L14 30Z" fill="#24202c" stroke="${c2}" stroke-width="1.5"/>
        <polygon points="40,22 50,40 40,56 30,40" fill="url(#${gid})" stroke="#ffffff" stroke-width="1.5"/>
        <path d="M10 26L26 38M70 26L54 38" stroke="${c1}" stroke-width="2.5"/>
      `;
      break;
    default: // Tier 6: Sarcófago Quântico Soberano
      bodySvg = `
        <polygon points="40,6 68,20 62,68 18,68 12,20" fill="#17161c" stroke="url(#${gid})" stroke-width="3"/>
        <polygon points="40,13 60,24 55,62 25,62 20,24" fill="#211f29" stroke="${c1}" stroke-width="1.5"/>
        <ellipse cx="40" cy="40" rx="26" ry="9" transform="rotate(-24 40 40)" stroke="${c1}" stroke-width="2" fill="none"/>
        <ellipse cx="40" cy="40" rx="26" ry="9" transform="rotate(24 40 40)" stroke="${c2}" stroke-width="2" fill="none"/>
        <polygon points="40,25 49,40 40,55 31,40" fill="url(#${gid})" stroke="#ffffff" stroke-width="2"/>
        <circle cx="40" cy="40" r="4" fill="#ffffff"/>
      `;
      break;
  }

  return `
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" x1="8" y1="8" x2="72" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <radialGradient id="${glowId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${c1}" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#141415" stop-opacity="0.9" />
        </radialGradient>
      </defs>
      ${bodySvg}
    </svg>
  `;
}

// =====================================================
// 4-LAYER TACTICAL WEAPON & BLADE VECTOR ENGINE (16 SILHOUETTES)
// =====================================================
function buildSkinPatternOverlay(pattern, c1, c2) {
  switch (pattern) {
    case 'tiger':
      return `
        <g opacity="0.38" stroke="#0b0d12" stroke-width="3.2" stroke-linecap="round">
          <path d="M28 18L36 42L32 62"/>
          <path d="M46 16L54 40L49 62"/>
          <path d="M64 16L71 42L66 64"/>
          <path d="M82 18L90 40L85 60"/>
          <path d="M100 20L106 42L101 58"/>
          <path d="M118 22L124 44"/>
        </g>
      `;
    case 'hex':
      return `
        <g opacity="0.32" stroke="#ffffff" stroke-width="1">
          <polygon points="36,28 43,24 50,28 50,36 43,40 36,36" fill="none"/>
          <polygon points="50,28 57,24 64,28 64,36 57,40 50,36" fill="none"/>
          <polygon points="64,28 71,24 78,28 78,36 71,40 64,36" fill="none"/>
          <polygon points="43,40 50,36 57,40 57,48 50,52 43,48" fill="none"/>
          <polygon points="57,40 64,36 71,40 71,48 64,52 57,48" fill="none"/>
          <polygon points="78,28 85,24 92,28 92,36 85,40 78,36" fill="none"/>
          <polygon points="92,28 99,24 106,28 106,36 99,40 92,36" fill="none"/>
        </g>
      `;
    case 'circuit':
      return `
        <g opacity="0.52" stroke="${c2}" stroke-width="1.4" fill="none">
          <path d="M24 36H46L53 29H76L82 35H108"/>
          <path d="M38 44H62L69 38H96"/>
          <circle cx="46" cy="36" r="2.2" fill="#ffffff"/>
          <circle cx="76" cy="29" r="2.2" fill="#ffffff"/>
          <circle cx="62" cy="44" r="2.2" fill="${c2}"/>
          <circle cx="96" cy="38" r="2.2" fill="#ffffff"/>
        </g>
      `;
    case 'damascus':
      return `
        <g opacity="0.36" stroke="#ffffff" stroke-width="1.3" fill="none">
          <path d="M18 32Q38 22 58 32T98 32T134 32"/>
          <path d="M18 39Q38 29 58 39T98 39T134 39"/>
          <path d="M18 46Q38 36 58 46T98 46T134 46"/>
        </g>
      `;
    case 'doppler':
      return `
        <g opacity="0.48">
          <ellipse cx="52" cy="36" rx="28" ry="14" fill="${c2}" filter="blur(4px)"/>
          <ellipse cx="88" cy="38" rx="24" ry="12" fill="${c1}" filter="blur(3px)"/>
          <path d="M26 36C46 22 74 48 112 30" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.65"/>
        </g>
      `;
    case 'fade':
      return `
        <g opacity="0.42">
          <polygon points="20,20 75,20 55,60 20,60" fill="#ff007f"/>
          <polygon points="60,20 110,20 95,60 45,60" fill="#ffae00"/>
          <line x1="24" y1="28" x2="118" y2="28" stroke="#ffffff" stroke-width="2" opacity="0.55"/>
        </g>
      `;
    default: // 'carbon'
      return `
        <g opacity="0.32" stroke="#0d0f14" stroke-width="2">
          <line x1="22" y1="54" x2="48" y2="20"/>
          <line x1="36" y1="54" x2="62" y2="20"/>
          <line x1="50" y1="54" x2="76" y2="20"/>
          <line x1="64" y1="54" x2="90" y2="20"/>
          <line x1="78" y1="54" x2="104" y2="20"/>
          <line x1="92" y1="54" x2="118" y2="20"/>
          <line x1="24" y1="35" x2="116" y2="35" stroke="${c2}" stroke-width="1.6" opacity="0.8"/>
        </g>
      `;
  }
}

function getTacticalWeaponSVG(item) {
  const uid = ++svgCounter;
  const gid = `wp_g_${uid}`;
  const metalId = `wp_m_${uid}`;
  const clipId = `wp_c_${uid}`;

  const shape = item?.shape || 'rifle_heavy';
  const rColor = RARITIES[item?.rarity]?.color || '#4b69ff';
  const c1 = item?.c1 || rColor;
  const c2 = item?.c2 || '#0075ff';
  const pattern = item?.pattern || 'carbon';
  const floatVal = typeof item?.float === 'number' ? item.float : 0.04;
  const isSync = Boolean(item?.statTrak);

  // Layer 1: Gunmetal mechanical parts (grip, barrel, scope, mag, trigger)
  let mechUnderlay = '';
  // Layer 2: Skinned receiver / slide / blade geometry (used inside <clipPath> for patterns + wear)
  let skinBodyPath = '';
  // Layer 3: Mechanical details on top (rails, bolts, pivot pins, bevel lines)
  let mechOverlay = '';
  // SyncTrack™ LED mount coordinates
  let syncX = 56;
  let syncY = 36;

  switch (shape) {
    case 'pistol_light': // Kestrel-9 Tactical Sidearm
      mechUnderlay = `
        <path d="M36 42H62L52 72H35L42 46H32L36 42Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.5"/>
        <path d="M58 44C60 50 66 50 68 44" stroke="#646d80" stroke-width="2" fill="none"/>
        <rect x="102" y="31" width="12" height="6" rx="1.5" fill="#16181f" stroke="#394150" stroke-width="1.2"/>
        <rect x="44" y="21" width="14" height="6" rx="1" fill="#16181f" stroke="${c2}" stroke-width="1.2"/>
      `;
      skinBodyPath = `<path d="M32 26H102L106 33L101 42H32L28 34L32 26Z"/>`;
      mechOverlay = `
        <line x1="38" y1="31" x2="46" y2="39" stroke="#111318" stroke-width="2"/>
        <line x1="44" y1="31" x2="52" y2="39" stroke="#111318" stroke-width="2"/>
        <line x1="50" y1="31" x2="58" y2="39" stroke="#111318" stroke-width="2"/>
        <rect x="66" y="29" width="22" height="4" rx="1" fill="#111318" opacity="0.65"/>
        <rect x="74" y="42" width="22" height="4" rx="1" fill="#1b1e26"/>
      `;
      syncX = 68; syncY = 34;
      break;

    case 'pistol_heavy': // Enforcer .50 Hand Cannon (Deagle-style)
      mechUnderlay = `
        <path d="M30 43H60L49 74H30L38 48H24L30 43Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.5"/>
        <path d="M56 44C58 51 66 51 68 44" stroke="#646d80" stroke-width="2.2" fill="none"/>
        <polygon points="24,25 32,20 32,30" fill="#1b1e26"/>
      `;
      skinBodyPath = `<path d="M28 22H112L118 30L112 43H28L23 33L28 22Z"/>`;
      mechOverlay = `
        <polygon points="68,26 106,26 102,34 68,34" fill="#12141a" opacity="0.55"/>
        <rect x="92" y="24" width="4" height="7" rx="1" fill="#111318"/>
        <rect x="99" y="24" width="4" height="7" rx="1" fill="#111318"/>
        <circle cx="44" cy="36" r="2.2" fill="#111318"/>
      `;
      syncX = 64; syncY = 35;
      break;

    case 'smg_compact': // Viper-7 Compact Submachine Gun
      mechUnderlay = `
        <path d="M12 34H28V40H16V50H10V34H12Z" fill="url(#${metalId})"/>
        <path d="M44 45H58L51 69H38L44 45Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.2"/>
        <path d="M72 44H84L91 72H79L72 44Z" fill="#181b22" stroke="${c1}" stroke-width="1.3"/>
        <rect x="104" y="32" width="28" height="8" rx="3" fill="#15181f" stroke="#394150" stroke-width="1.4"/>
        <rect x="52" y="20" width="22" height="6" rx="1.5" fill="#161920" stroke="${c2}" stroke-width="1.2"/>
      `;
      skinBodyPath = `<path d="M28 26H104L107 34L103 45H28V26Z"/>`;
      mechOverlay = `
        <rect x="34" y="31" width="24" height="5" rx="1.5" fill="#12141a" opacity="0.65"/>
        <circle cx="68" cy="36" r="2.5" fill="#12141a"/>
        <circle cx="78" cy="36" r="2.5" fill="#12141a"/>
        <circle cx="88" cy="36" r="2.5" fill="#12141a"/>
      `;
      syncX = 56; syncY = 36;
      break;

    case 'pdw_vector': // Vector-X Futuristic PDW
      mechUnderlay = `
        <path d="M10 29H30V54H24V38H14V52H8V31L10 29Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.2"/>
        <path d="M80 48L89 74H77L69 48H80Z" fill="#161920" stroke="${c2}" stroke-width="1.3"/>
        <rect x="108" y="34" width="18" height="6" rx="2" fill="#161920" stroke="#454e60" stroke-width="1.3"/>
        <path d="M50 18H82L78 25H46L50 18Z" fill="#14171d" stroke="${c1}" stroke-width="1.4"/>
      `;
      skinBodyPath = `<path d="M28 25H106L110 34L104 49H64L58 62H44L47 46H28V25Z"/>`;
      mechOverlay = `
        <polygon points="34,33 50,33 47,43 34,43" fill="#121318"/>
        <rect x="64" y="30" width="32" height="5" rx="1.5" fill="#12141a" opacity="0.6"/>
        <line x1="66" y1="41" x2="96" y2="41" stroke="#ffffff" stroke-width="1.5" opacity="0.45"/>
      `;
      syncX = 68; syncY = 36;
      break;

    case 'shotgun_tac': // Breacher-12 Combat Shotgun
      mechUnderlay = `
        <path d="M6 38L26 32V46L10 54L6 38Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.4"/>
        <path d="M36 44H48L41 68H29L36 44Z" fill="url(#${metalId})"/>
        <rect x="92" y="29" width="38" height="4.5" rx="1.5" fill="#232832"/>
        <rect x="92" y="35" width="34" height="4" rx="1.5" fill="#171a21"/>
        <rect x="78" y="39" width="32" height="7" rx="2.5" fill="#14161c" stroke="${c2}" stroke-width="1.3"/>
      `;
      skinBodyPath = `<path d="M26 27H94L98 33L92 44H26V27Z"/>`;
      mechOverlay = `
        <rect x="34" y="31" width="18" height="4" rx="1" fill="#111318" opacity="0.7"/>
        <circle cx="62" cy="32" r="1.8" fill="#111318"/>
        <circle cx="70" cy="32" r="1.8" fill="#111318"/>
        <circle cx="78" cy="32" r="1.8" fill="#111318"/>
        <circle cx="86" cy="32" r="1.8" fill="#111318"/>
      `;
      syncX = 52; syncY = 35;
      break;

    case 'rifle_bullpup': // Phantom-M4 Spec-Ops Suppressed Carbine
      mechUnderlay = `
        <path d="M8 28H26V50L10 54V28Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.3"/>
        <path d="M52 44H64L58 68H46L52 44Z" fill="url(#${metalId})"/>
        <path d="M28 44H42L36 70H23L28 44Z" fill="#171a22" stroke="${c1}" stroke-width="1.3"/>
        <rect x="104" y="31" width="30" height="8" rx="3" fill="#16181f" stroke="${c2}" stroke-width="1.4"/>
        <path d="M46 18H76L72 26H42L46 18Z" fill="#151820" stroke="${c1}" stroke-width="1.4"/>
      `;
      skinBodyPath = `<path d="M24 26H104L107 34L102 44H24V26Z"/>`;
      mechOverlay = `
        <rect x="32" y="30" width="22" height="4" rx="1" fill="#111318" opacity="0.65"/>
        <rect x="64" y="30" width="32" height="5" rx="1.5" fill="#111318" opacity="0.55"/>
        <line x1="28" y1="25" x2="96" y2="25" stroke="#9aa1b1" stroke-width="1.8" stroke-dasharray="3 2"/>
      `;
      syncX = 58; syncY = 36;
      break;

    case 'rifle_dmr': // Aegis-SSR Marksman Rifle
      mechUnderlay = `
        <path d="M6 30H26V48L8 54V30Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.3"/>
        <path d="M44 43H55L49 66H38L44 43Z" fill="url(#${metalId})"/>
        <rect x="64" y="43" width="14" height="19" rx="1.5" fill="#171a22" stroke="${c1}" stroke-width="1.3"/>
        <rect x="104" y="33" width="30" height="4" fill="#222630"/>
        <polygon points="132,31 138,31 138,39 132,39" fill="${c2}"/>
        <path d="M40 16H82L78 24H44L40 16Z" fill="#14171e" stroke="${c2}" stroke-width="1.5"/>
      `;
      skinBodyPath = `<path d="M26 27H104L108 35L102 43H26V27Z"/>`;
      mechOverlay = `
        <rect x="34" y="31" width="26" height="4" rx="1" fill="#111318" opacity="0.6"/>
        <rect x="68" y="31" width="28" height="4" rx="1" fill="#111318" opacity="0.6"/>
        <line x1="96" y1="43" x2="104" y2="58" stroke="#646d80" stroke-width="2"/>
      `;
      syncX = 56; syncY = 35;
      break;

    case 'sniper_bolt': // Titan-AWM Heavy Sniper
      mechUnderlay = `
        <rect x="102" y="32" width="32" height="4.5" fill="#232834"/>
        <rect x="131" y="29" width="7" height="10" rx="1.5" fill="#151820" stroke="${c2}" stroke-width="1.3"/>
        <rect x="58" y="45" width="16" height="16" rx="1.5" fill="#171a22" stroke="#394150" stroke-width="1.3"/>
        <path d="M36 13H88L83 22H41L36 13Z" fill="#14161d" stroke="${c1}" stroke-width="1.6"/>
        <line x1="50" y1="22" x2="50" y2="27" stroke="#646d80" stroke-width="3"/>
        <line x1="74" y1="22" x2="74" y2="27" stroke="#646d80" stroke-width="3"/>
      `;
      skinBodyPath = `<path d="M6 29L28 27H102L106 35L98 45H50L44 64H30L35 46H22L16 54H6V29Z"/>`;
      mechOverlay = `
        <rect x="14" y="34" width="14" height="8" rx="2" fill="#12141a"/>
        <rect x="46" y="31" width="44" height="4.5" rx="1.5" fill="#12141a" opacity="0.65"/>
        <line x1="92" y1="44" x2="102" y2="62" stroke="#646d80" stroke-width="2"/>
      `;
      syncX = 62; syncY = 36;
      break;

    case 'railgun': // Omega-Rail Electromagnetic Cannon
      mechUnderlay = `
        <path d="M8 28H26V52L8 56V28Z" fill="url(#${metalId})"/>
        <path d="M44 46H56L50 68H38L44 46Z" fill="url(#${metalId})"/>
        <rect x="56" y="33" width="78" height="4" rx="2" fill="${c2}"/>
        <path d="M44 16H78L82 23H40L44 16Z" fill="#14171e" stroke="${c2}" stroke-width="1.5"/>
      `;
      skinBodyPath = `
        <path d="M24 24H132L136 31H56V39H136L132 46H24V24Z"/>
      `;
      mechOverlay = `
        <rect x="32" y="29" width="18" height="12" rx="2" fill="#12141a" stroke="${c1}" stroke-width="1.2"/>
        <line x1="72" y1="24" x2="72" y2="31" stroke="#12141a" stroke-width="2.5"/>
        <line x1="92" y1="24" x2="92" y2="31" stroke="#12141a" stroke-width="2.5"/>
        <line x1="112" y1="24" x2="112" y2="31" stroke="#12141a" stroke-width="2.5"/>
      `;
      syncX = 56; syncY = 36;
      break;

    case 'karambit': // ★ Garra Karambit
      mechUnderlay = `
        <circle cx="24" cy="56" r="10" stroke="${c2}" stroke-width="4" fill="#12141a"/>
        <circle cx="24" cy="56" r="5" fill="#141415"/>
        <path d="M31 49C39 39 51 34 61 38L51 55C43 53 36 53 31 49Z" fill="url(#${metalId})" stroke="#454e60" stroke-width="1.6"/>
      `;
      skinBodyPath = `<path d="M61 38C82 18 106 14 126 24C104 31 84 44 51 55Z"/>`;
      mechOverlay = `
        <path d="M64 41C82 25 102 21 118 25" stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.65"/>
        <circle cx="42" cy="46" r="2" fill="${c1}"/>
        <circle cx="50" cy="43" r="2" fill="${c1}"/>
      `;
      syncX = 68; syncY = 34;
      break;

    case 'butterfly': // ★ Balisong Dual
      mechUnderlay = `
        <path d="M62 36L18 52L22 60L64 43Z" fill="url(#${metalId})" stroke="${c1}" stroke-width="1.6"/>
        <path d="M66 45L24 68L29 75L68 51Z" fill="url(#${metalId})" stroke="${c2}" stroke-width="1.6"/>
        <circle cx="62" cy="39" r="2.5" fill="#ffffff"/>
        <circle cx="66" cy="48" r="2.5" fill="#ffffff"/>
      `;
      skinBodyPath = `<path d="M62 36L124 14C118 33 98 45 66 47Z"/>`;
      mechOverlay = `
        <line x1="70" y1="37" x2="108" y2="23" stroke="#12141a" stroke-width="2" opacity="0.6"/>
        <line x1="30" y1="51" x2="52" y2="43" stroke="#12141a" stroke-width="2.5" stroke-dasharray="3 3"/>
      `;
      syncX = 76; syncY = 33;
      break;

    case 'bayonet': // ★ Baioneta M-Tática
      mechUnderlay = `
        <rect x="12" y="36" width="36" height="12" rx="3" fill="url(#${metalId})" stroke="#454e60" stroke-width="1.5"/>
        <rect x="47" y="26" width="6" height="32" rx="2" fill="#232834" stroke="${c2}" stroke-width="1.5"/>
        <line x1="20" y1="36" x2="20" y2="48" stroke="#12141a" stroke-width="2"/>
        <line x1="28" y1="36" x2="28" y2="48" stroke="#12141a" stroke-width="2"/>
        <line x1="36" y1="36" x2="36" y2="48" stroke="#12141a" stroke-width="2"/>
      `;
      skinBodyPath = `<path d="M53 32H112L130 42L110 52H53V32Z"/>`;
      mechOverlay = `
        <rect x="60" y="39" width="42" height="3.5" rx="1.5" fill="#12141a" opacity="0.65"/>
        <path d="M62 32L66 29L70 32L74 29L78 32L82 29L86 32" stroke="#ffffff" stroke-width="1.3" fill="none"/>
      `;
      syncX = 70; syncY = 40;
      break;

    case 'kunai': // ★ Adaga Espectral Kunai
      mechUnderlay = `
        <circle cx="18" cy="42" r="8" stroke="${c2}" stroke-width="3.5" fill="none"/>
        <rect x="26" y="38" width="24" height="8" rx="2" fill="url(#${metalId})" stroke="#454e60" stroke-width="1.4"/>
      `;
      skinBodyPath = `<polygon points="50,26 128,42 50,58 58,42"/>`;
      mechOverlay = `
        <line x1="58" y1="42" x2="122" y2="42" stroke="#ffffff" stroke-width="1.8" opacity="0.75"/>
        <polygon points="62,38 82,42 62,46" fill="#12141a" opacity="0.7"/>
      `;
      syncX = 68; syncY = 40;
      break;

    case 'tanto': // ★ Lâmina Cyber-Tanto
      mechUnderlay = `
        <path d="M10 44L44 38L46 48L12 54Z" fill="url(#${metalId})" stroke="${c1}" stroke-width="1.5"/>
        <rect x="44" y="31" width="5" height="24" rx="1.5" fill="${c2}"/>
      `;
      skinBodyPath = `<path d="M49 35L122 23L130 33L49 47V35Z"/>`;
      mechOverlay = `
        <line x1="54" y1="39" x2="120" y2="28" stroke="#ffffff" stroke-width="1.5" opacity="0.7"/>
        <line x1="18" y1="43" x2="22" y2="52" stroke="${c2}" stroke-width="2"/>
        <line x1="28" y1="41" x2="32" y2="50" stroke="${c2}" stroke-width="2"/>
      `;
      syncX = 72; syncY = 34;
      break;

    case 'gloves': // ★ Manoplas Táticas
      mechUnderlay = `
        <rect x="42" y="56" width="44" height="12" rx="4" fill="url(#${metalId})" stroke="${c2}" stroke-width="1.6"/>
      `;
      skinBodyPath = `
        <path d="M42 56V30C42 24 50 24 50 30V22C50 16 59 16 59 22V20C59 14 68 14 68 20V25C68 19 77 19 77 25V40L87 32C93 28 98 35 92 42L78 56H42Z"/>
      `;
      mechOverlay = `
        <rect x="46" y="34" width="30" height="7" rx="2.5" fill="#12141a" stroke="${c1}" stroke-width="1.4"/>
        <circle cx="54" cy="48" r="4" fill="#12141a" stroke="${c2}" stroke-width="1.5"/>
        <circle cx="68" cy="48" r="4" fill="#12141a" stroke="${c2}" stroke-width="1.5"/>
      `;
      syncX = 52; syncY = 35;
      break;

    default: // 'rifle_heavy' — Valkyrie-47 Heavy Assault Rifle
      mechUnderlay = `
        <path d="M6 32L28 29V45L10 52L6 32Z" fill="url(#${metalId})" stroke="#2d323d" stroke-width="1.4"/>
        <path d="M40 44H52L45 68H33L40 44Z" fill="url(#${metalId})"/>
        <path d="M64 43H78C82 55 88 64 94 71L81 74C74 65 68 55 64 43Z" fill="#171a22" stroke="${c1}" stroke-width="1.4"/>
        <rect x="102" y="29" width="28" height="4" fill="#232834"/>
        <rect x="98" y="34" width="22" height="4.5" fill="#181b22"/>
        <polygon points="126,26 134,28 134,36 126,36" fill="${c2}"/>
      `;
      skinBodyPath = `<path d="M28 26H98L102 34L96 44H28V26Z"/>`;
      mechOverlay = `
        <rect x="34" y="31" width="26" height="4.5" rx="1.5" fill="#111318" opacity="0.65"/>
        <rect x="68" y="30" width="24" height="5" rx="1.5" fill="#111318" opacity="0.6"/>
        <line x1="32" y1="25" x2="88" y2="25" stroke="#9aa1b1" stroke-width="1.8" stroke-dasharray="3 2"/>
      `;
      syncX = 56; syncY = 36;
      break;
  }

  // Layer 4A: Dynamic Float / Wear visual feedback inside the clipped weapon body
  let wearOverlay = '';
  if (floatVal < 0.07) {
    // Factory New (FN): crisp diagonal specular sheen
    wearOverlay = `
      <polygon points="35,14 48,14 28,68 15,68" fill="#ffffff" opacity="0.22"/>
      <polygon points="82,14 90,14 70,68 62,68" fill="#ffffff" opacity="0.16"/>
    `;
  } else if (floatVal >= 0.38) {
    // Well-Worn / Battle-Scarred: metallic edge scratches & battle wear
    const scratchOpacity = floatVal >= 0.45 ? 0.65 : 0.42;
    wearOverlay = `
      <g stroke="#b0b8c8" stroke-width="1.3" opacity="${scratchOpacity}">
        <path d="M32 28L41 33M58 27L66 34M84 29L95 36M46 42L59 40M74 43L88 39"/>
        <path d="M38 38L44 44M92 31L86 41" stroke="#141415" stroke-width="1.8"/>
      </g>
    `;
  }

  // Layer 4B: Physical SyncTrack™ LED Digital Module mounted on the weapon/blade
  const syncDigits = String(Math.min(9999, Math.max(0, Number(item?.kills) || 0))).padStart(4, '0');
  const syncModule = isSync
    ? `
      <g transform="translate(${syncX}, ${syncY})">
        <rect x="0" y="0" width="22" height="9" rx="2" fill="#0d0f14" stroke="#ff6d00" stroke-width="1.3"/>
        <text x="11" y="6.8" text-anchor="middle" fill="#ff9100" font-family="monospace" font-size="6.5" font-weight="800">${syncDigits}</text>
      </g>
    `
    : '';

  return `
    <svg viewBox="0 0 140 82" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" x1="12" y1="16" x2="128" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <linearGradient id="${metalId}" x1="0" y1="20" x2="0" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2b303c" />
          <stop offset="100%" stop-color="#14171d" />
        </linearGradient>
        <clipPath id="${clipId}">
          ${skinBodyPath}
        </clipPath>
      </defs>

      <!-- Layer 1: Gunmetal Mechanical Underlay -->
      ${mechUnderlay}

      <!-- Layer 2: Skinned Receiver / Blade Base -->
      <g fill="url(#${gid})" stroke="#e2e8f0" stroke-width="1.6" stroke-linejoin="round">
        ${skinBodyPath}
      </g>

      <!-- Layer 3: Clipped Procedural Skin Pattern & Float Wear -->
      <g clip-path="url(#${clipId})">
        ${buildSkinPatternOverlay(pattern, c1, c2)}
        ${wearOverlay}
      </g>

      <!-- Layer 4: Mechanical Overlay & SyncTrack™ Digital Counter -->
      ${mechOverlay}
      ${syncModule}
    </svg>
  `;
}

function renderArtworkHTML(itemOrCase, isCase = false) {
  // Support custom local PNG/WebP from assets/ (ignore retired CS2 external URLs)
  if (
    itemOrCase?.image &&
    !itemOrCase.image.includes('counter-strike') &&
    !itemOrCase.image.includes('steamstatic') &&
    !itemOrCase.image.includes('bymykel')
  ) {
    const safeName = (itemOrCase.name || '').replace(/"/g, '&quot;');
    return `<img src="${itemOrCase.image}" alt="${safeName}" loading="lazy" onerror="this.style.display='none'" />`;
  }
  if (isCase) {
    return getTacticalCaseSVG(itemOrCase);
  }
  return getTacticalWeaponSVG(itemOrCase);
}

// =====================================================
// 18-CASE EXPANDED ORIGINAL CATALOG (Tiers 1–6 | 252 Skins)
// =====================================================
const CASE_DEFINITIONS = [
  // TIER 1 — Recruta ($25, $35, $45)
  { id: 'nx_t1_1', tier: 1, tierName: 'Recruta',      name: '[T1] Maleta Cyber-Vanguard',    price: 25,    c1: '#0075ff', c2: '#00e5ff', prefix: 'Vanguard',   patterns: ['carbon', 'hex', 'circuit'] },
  { id: 'nx_t1_2', tier: 1, tierName: 'Recruta',      name: '[T1] Maleta Operação Névoa',    price: 35,    c1: '#38bdf8', c2: '#6366f1', prefix: 'Névoa',      patterns: ['hex', 'tiger', 'carbon'] },
  { id: 'nx_t1_3', tier: 1, tierName: 'Recruta',      name: '[T1] Maleta Patrulha Kestrel',  price: 45,    c1: '#00b24b', c2: '#0075ff', prefix: 'Patrulha',   patterns: ['tiger', 'circuit', 'hex'] },

  // TIER 2 — Operador ($120, $165, $220)
  { id: 'nx_t2_1', tier: 2, tierName: 'Operador',     name: '[T2] Contêiner Criogênico Zero', price: 120,  c1: '#00e5ff', c2: '#3b82f6', prefix: 'Subzero',    patterns: ['circuit', 'damascus', 'hex'] },
  { id: 'nx_t2_2', tier: 2, tierName: 'Operador',     name: '[T2] Contêiner Biolumen Abissal',price: 165,  c1: '#00b24b', c2: '#00e5ff', prefix: 'Biolumen',   patterns: ['doppler', 'circuit', 'tiger'] },
  { id: 'nx_t2_3', tier: 2, tierName: 'Operador',     name: '[T2] Contêiner Reator Cobalto',  price: 220,  c1: '#6366f1', c2: '#ec4899', prefix: 'Cobalto',    patterns: ['damascus', 'hex', 'doppler'] },

  // TIER 3 — Especialista ($550, $750, $950)
  { id: 'nx_t3_1', tier: 3, tierName: 'Especialista', name: '[T3] Cofre Hexagonal Solaris',   price: 550,  c1: '#ff9100', c2: '#ff1744', prefix: 'Solaris',    patterns: ['fade', 'tiger', 'circuit'] },
  { id: 'nx_t3_2', tier: 3, tierName: 'Especialista', name: '[T3] Cofre Blindado Overdrive',  price: 750,  c1: '#d946ef', c2: '#0075ff', prefix: 'Overdrive',  patterns: ['circuit', 'fade', 'doppler'] },
  { id: 'nx_t3_3', tier: 3, tierName: 'Especialista', name: '[T3] Cofre Forja de Titânio',    price: 950,  c1: '#f43f5e', c2: '#fbbf24', prefix: 'Titânio',    patterns: ['damascus', 'tiger', 'fade'] },

  // TIER 4 — Comandante ($2.400, $3.200, $4.200)
  { id: 'nx_t4_1', tier: 4, tierName: 'Comandante',   name: '[T4] Cápsula Vórtice Nulo',      price: 2400, c1: '#a855f7', c2: '#00e5ff', prefix: 'Vórtice',    patterns: ['doppler', 'circuit', 'damascus'] },
  { id: 'nx_t4_2', tier: 4, tierName: 'Comandante',   name: '[T4] Cápsula Horizonte Astral',  price: 3200, c1: '#ec4899', c2: '#8b5cf6', prefix: 'Horizonte',  patterns: ['fade', 'doppler', 'hex'] },
  { id: 'nx_t4_3', tier: 4, tierName: 'Comandante',   name: '[T4] Cápsula Hiper-Pulso',       price: 4200, c1: '#00e5ff', c2: '#00b24b', prefix: 'Hiper-Pulso',patterns: ['circuit', 'fade', 'tiger'] },

  // TIER 5 — Mestre ($10.500, $14.000, $18.000)
  { id: 'nx_t5_1', tier: 5, tierName: 'Mestre',       name: '[T5] Relicário Chrono-Valquíria',price: 10500,c1: '#ff1744', c2: '#ffd700', prefix: 'Valquíria',  patterns: ['fade', 'damascus', 'doppler'] },
  { id: 'nx_t5_2', tier: 5, tierName: 'Mestre',       name: '[T5] Relicário Eclipse Carmesim',price: 14000,c1: '#ef4444', c2: '#a855f7', prefix: 'Carmesim',   patterns: ['doppler', 'tiger', 'fade'] },
  { id: 'nx_t5_3', tier: 5, tierName: 'Mestre',       name: '[T5] Relicário Serafim Dourado', price: 18000,c1: '#ffd700', c2: '#ff9100', prefix: 'Serafim',    patterns: ['damascus', 'fade', 'circuit'] },

  // TIER 6 — Lenda ($38.000, $50.000, $65.000)
  { id: 'nx_t6_1', tier: 6, tierName: 'Lenda',        name: '[T6] Sarcófago Quântico Ômega',  price: 38000,c1: '#00e5ff', c2: '#ffd700', prefix: 'Ômega',      patterns: ['doppler', 'fade', 'circuit'] },
  { id: 'nx_t6_2', tier: 6, tierName: 'Lenda',        name: '[T6] Sarcófago Soberano Astral', price: 50000,c1: '#ffd700', c2: '#ffffff', prefix: 'Soberano',   patterns: ['fade', 'doppler', 'damascus'] },
  { id: 'nx_t6_3', tier: 6, tierName: 'Lenda',        name: '[T6] Sarcófago Singularidade',   price: 65000,c1: '#ff1744', c2: '#00e5ff', prefix: 'Singular',   patterns: ['doppler', 'fade', 'damascus'] },
];

const SPECIAL_POOLS = [
  [
    { shape: 'karambit',  model: '★ Garra Karambit',   suffix: 'Safira',      c1: '#0075ff', c2: '#00e5ff', pattern: 'doppler' },
    { shape: 'butterfly', model: '★ Balisong Dual',    suffix: 'Rubi',        c1: '#ff1744', c2: '#ff9100', pattern: 'doppler' },
    { shape: 'bayonet',   model: '★ Baioneta M-Tática',suffix: 'Esmeralda',   c1: '#00b24b', c2: '#a7f3d0', pattern: 'doppler' },
    { shape: 'gloves',    model: '★ Manoplas Táticas', suffix: 'Overclock',   c1: '#8847ff', c2: '#00e5ff', pattern: 'circuit' },
  ],
  [
    { shape: 'tanto',     model: '★ Cyber-Tanto',      suffix: 'Fade Solar',  c1: '#ff007f', c2: '#ffd700', pattern: 'fade' },
    { shape: 'kunai',     model: '★ Adaga Kunai',      suffix: 'Ametista',    c1: '#a855f7', c2: '#ec4899', pattern: 'doppler' },
    { shape: 'karambit',  model: '★ Garra Karambit',   suffix: 'Damasco Real',c1: '#e2e8f0', c2: '#ffd700', pattern: 'damascus' },
    { shape: 'gloves',    model: '★ Manoplas Táticas', suffix: 'Carmesim',    c1: '#ef4444', c2: '#ffd700', pattern: 'hex' },
  ],
  [
    { shape: 'butterfly', model: '★ Balisong Dual',    suffix: 'Marble Fade', c1: '#0075ff', c2: '#ffd700', pattern: 'fade' },
    { shape: 'tanto',     model: '★ Cyber-Tanto',      suffix: 'Obsidiana',   c1: '#00e5ff', c2: '#6366f1', pattern: 'damascus' },
    { shape: 'kunai',     model: '★ Adaga Kunai',      suffix: 'Tigre Dourado',c1: '#ff9100', c2: '#ffd700', pattern: 'tiger' },
    { shape: 'bayonet',   model: '★ Baioneta M-Tática',suffix: 'Supernova',   c1: '#d946ef', c2: '#ffd700', pattern: 'doppler' },
  ],
];

function buildOriginalCatalog() {
  return CASE_DEFINITIONS.map((def, idx) => {
    const mult = def.price / 35;
    const [patA, patB, patC] = def.patterns;
    const specPool = SPECIAL_POOLS[idx % SPECIAL_POOLS.length];

    const weapons = [
      // 4 Blue (Padrão)
      { id: `${def.id}_b1`, name: `Kestrel-9 | ${def.prefix} Malha`,      rarity: 'blue',   shape: 'pistol_light', c1: '#3b82f6', c2: '#1d4ed8', pattern: patA, basePrice: Number((RARITIES.blue.basePrice * mult * 0.90).toFixed(2)) },
      { id: `${def.id}_b2`, name: `Viper-7 | ${def.prefix} Vetor`,        rarity: 'blue',   shape: 'smg_compact',  c1: '#0284c7', c2: '#2563eb', pattern: patB, basePrice: Number((RARITIES.blue.basePrice * mult * 0.96).toFixed(2)) },
      { id: `${def.id}_b3`, name: `Breacher-12 | ${def.prefix} Polímero`, rarity: 'blue',   shape: 'shotgun_tac',  c1: '#60a5fa', c2: '#1e40af', pattern: patC, basePrice: Number((RARITIES.blue.basePrice * mult * 1.04).toFixed(2)) },
      { id: `${def.id}_b4`, name: `Vector-X | ${def.prefix} Matriz`,      rarity: 'blue',   shape: 'pdw_vector',   c1: '#38bdf8', c2: '#1d4ed8', pattern: patA, basePrice: Number((RARITIES.blue.basePrice * mult * 1.10).toFixed(2)) },

      // 2 Purple (Tático)
      { id: `${def.id}_p1`, name: `Enforcer .50 | ${def.prefix} Cromo`,   rarity: 'purple', shape: 'pistol_heavy', c1: '#8b5cf6', c2: '#4f46e5', pattern: patB, basePrice: Number((RARITIES.purple.basePrice * mult * 0.94).toFixed(2)) },
      { id: `${def.id}_p2`, name: `Aegis-SSR | ${def.prefix} Pulso`,      rarity: 'purple', shape: 'rifle_dmr',    c1: '#a855f7', c2: '#ec4899', pattern: patC, basePrice: Number((RARITIES.purple.basePrice * mult * 1.06).toFixed(2)) },

      // 2 Pink (Protótipo)
      { id: `${def.id}_k1`, name: `Phantom-M4 | ${def.prefix} Espectro`,  rarity: 'pink',   shape: 'rifle_bullpup',c1: '#d946ef', c2: '#00e5ff', pattern: patA, basePrice: Number((RARITIES.pink.basePrice * mult * 0.95).toFixed(2)) },
      { id: `${def.id}_k2`, name: `Valkyrie-47 | ${def.prefix} Synth`,    rarity: 'pink',   shape: 'rifle_heavy',  c1: '#f43f5e', c2: '#a855f7', pattern: patB, basePrice: Number((RARITIES.pink.basePrice * mult * 1.05).toFixed(2)) },

      // 2 Red (Relíquia)
      { id: `${def.id}_r1`, name: `Titan-AWM | ${def.prefix} Soberano`,   rarity: 'red',    shape: 'sniper_bolt',  c1: '#ef4444', c2: '#ff9100', pattern: 'fade',    basePrice: Number((RARITIES.red.basePrice * mult * 0.95).toFixed(2)) },
      { id: `${def.id}_r2`, name: `Omega-Rail | ${def.prefix} Quântico`,  rarity: 'red',    shape: 'railgun',      c1: '#ff1744', c2: '#ffd700', pattern: 'doppler', basePrice: Number((RARITIES.red.basePrice * mult * 1.06).toFixed(2)) },
    ];

    const specials = specPool.map((sp, sIdx) => ({
      id: `${def.id}_g${sIdx + 1}`,
      name: `${sp.model} | ${def.prefix} ${sp.suffix}`,
      rarity: 'gold',
      shape: sp.shape,
      c1: sp.c1,
      c2: sp.c2,
      pattern: sp.pattern,
      basePrice: Number((RARITIES.gold.basePrice * mult * (0.92 + sIdx * 0.06)).toFixed(2)),
    }));

    return {
      id: def.id,
      tier: def.tier,
      tierName: def.tierName,
      name: def.name,
      desc: `Tier ${def.tier} (${def.tierName}) • 10 Armas Táticas (+25% $/s) & 4 ★ Especiais (+100% $/s no 100%).`,
      price: def.price,
      c1: def.c1,
      c2: def.c2,
      items: [...weapons, ...specials],
    };
  });
}

let ALL_CASES = buildOriginalCatalog();
let FEATURED_CASES = [
  ALL_CASES[0],  // T1 $25
  ALL_CASES[3],  // T2 $120
  ALL_CASES[6],  // T3 $550
  ALL_CASES[9],  // T4 $2,400
  ALL_CASES[12], // T5 $10,500
  ALL_CASES[16], // T6 $50,000
];

function hashStr(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Automatically migrate any old CS2 or legacy items in localStorage to our 18-case original catalog
function migrateAndRebalanceInventory() {
  if (!Array.isArray(state.inventory) || !state.inventory.length) return;

  const byId = new Map();
  const byName = new Map();
  ALL_CASES.forEach((c) => {
    c.items.forEach((it) => {
      byId.set(it.id, { item: it, caseId: c.id });
      byName.set(it.name, { item: it, caseId: c.id });
    });
  });

  state.inventory.forEach((inv, idx) => {
    let match = byId.get(inv.templateId) || byName.get(inv.name);

    // If item was from the retired CS2 API or old 6-case catalog, map it deterministically preserving Rarity & Tier
    if (!match) {
      const rarity = RARITIES[inv.rarity] ? inv.rarity : 'blue';
      // Estimate tier from old item price or distribute across Tiers 1-2
      const estBase = (inv.price || 10) / (inv.statTrak ? 1.85 : 1);
      const refBase = RARITIES[rarity].basePrice;
      const estCasePrice = Math.max(25, (estBase / refBase) * 35);

      // Find closest case by price
      let bestCase = ALL_CASES[0];
      let bestDiff = Infinity;
      ALL_CASES.forEach((c) => {
        const d = Math.abs(c.price - estCasePrice);
        if (d < bestDiff) {
          bestDiff = d;
          bestCase = c;
        }
      });

      const candidates = bestCase.items.filter((i) => i.rarity === rarity);
      const picked = candidates[hashStr(inv.name || String(idx)) % candidates.length] || bestCase.items[0];
      match = { item: picked, caseId: bestCase.id };
    }

    const tpl = match.item;
    inv.templateId = tpl.id;
    inv.name = tpl.name;
    inv.rarity = tpl.rarity;
    inv.shape = tpl.shape;
    inv.c1 = tpl.c1;
    inv.c2 = tpl.c2;
    inv.pattern = tpl.pattern;
    inv.caseId = match.caseId;
    // Remove external CS2 tracker URLs
    if (inv.image && (inv.image.includes('counter-strike') || inv.image.includes('bymykel'))) {
      delete inv.image;
    }

    const wear = getWearFromFloat(inv.float || 0.22);
    inv.wearName = wear.name;
    inv.wearShort = wear.short;
    inv.price = Number((tpl.basePrice * wear.mult * (inv.statTrak ? 1.85 : 1)).toFixed(2));
  });

  saveState();
}

function applyTierFilter(tierVal = 'ALL') {
  if (tierVal === 'ALL') {
    FEATURED_CASES = [
      ALL_CASES[0],
      ALL_CASES[3],
      ALL_CASES[6],
      ALL_CASES[9],
      ALL_CASES[12],
      ALL_CASES[16],
    ];
  } else {
    const tNum = Number(tierVal);
    FEATURED_CASES = ALL_CASES.filter((c) => c.tier === tNum);
    if (FEATURED_CASES.length > 0 && activeCase.tier !== tNum) {
      activeCase = FEATURED_CASES[0];
    }
  }
  populateCatalogDropdown(tierVal);
  renderCaseSelector();
  renderActiveCaseArena();
}

document.getElementById('tier-filter-select')?.addEventListener('change', (e) => {
  if (isSpinning) return;
  applyTierFilter(e.target.value);
});

function populateCatalogDropdown(tierFilter = document.getElementById('tier-filter-select')?.value || 'ALL') {
  const select = document.getElementById('all-cases-select');
  select.innerHTML = '';
  const visibleCases =
    tierFilter === 'ALL' ? ALL_CASES : ALL_CASES.filter((c) => c.tier === Number(tierFilter));

  visibleCases.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} — ${formatMoney(c.price)} (${c.items.length} skins)`;
    if (c.id === activeCase.id) opt.selected = true;
    select.appendChild(opt);
  });

  const invCaseSelect = document.getElementById('inv-case-select');
  if (invCaseSelect) {
    const prevVal = invCaseSelect.value || 'CURRENT';
    invCaseSelect.innerHTML = `
      <option value="CURRENT">Caixa Atual (${activeCase.name})</option>
      <option value="FEATURED">Caixas Exibidas (${FEATURED_CASES.length})</option>
      <option value="ALL">Todas as Caixas (${ALL_CASES.length})</option>
    `;
    ALL_CASES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${formatMoney(c.price)})`;
      invCaseSelect.appendChild(opt);
    });
    invCaseSelect.value = prevVal;
  }
}

document.getElementById('all-cases-select').addEventListener('change', (e) => {
  if (isSpinning) return;
  const chosen = ALL_CASES.find((c) => c.id === e.target.value);
  if (chosen) {
    activeCase = chosen;
    if (!FEATURED_CASES.some((f) => f.id === chosen.id)) {
      FEATURED_CASES[FEATURED_CASES.length - 1] = chosen;
    }
    renderCaseSelector();
    renderActiveCaseArena();
  }
});

// =====================================================
// SOUND ENGINE (Web Audio API Synthesizer)
// =====================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  tick(pitchMultiplier = 1) {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchMultiplier, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.11, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  unboxReveal(rarity) {
    if (!this.enabled) return;
    this.init();
    const chords = {
      blue:   [330, 440],
      purple: [392, 523.25],
      pink:   [440, 554.37, 659.25],
      red:    [523.25, 659.25, 783.99, 1046.5],
      gold:   [523.25, 659.25, 783.99, 987.77, 1318.5],
    };
    const notes = chords[rarity] || chords.blue;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = rarity === 'gold' || rarity === 'red' ? 'sawtooth' : 'sine';
      const start = this.ctx.currentTime + idx * 0.07;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.46);
    });
  }

  coin() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1318.5, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.23);
  }

  targetHit(isCrit = false) {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCrit ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isCrit ? 1320 : 880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 1980 : 1240, this.ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0.11, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.095);
  }

  targetMiss() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(95, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.095);
  }
}

const sfx = new SoundEngine();

// =====================================================
// STATE MANAGEMENT
// =====================================================
const defaultState = {
  playerId: 'op_' + Math.random().toString(36).slice(2, 10),
  callsign: '',
  equippedUid: null,
  balance: 500,
  lastSavedAt: Date.now(),
  prestigeLevel: 0,
  xp: 0,
  heirloomUids: [],
  inventory: [],
  stats: {
    casesOpened: 0,
    totalSpent: 0,
    totalEarned: 0,
    goldsUnboxed: 0,
    bestDropValue: 0,
    tradeUpsDone: 0,
    targetsHit: 0,
    bestGridshotScore: 0,
  },
};

let state = loadState();
let initialOfflineElapsedMs = state.lastSavedAt ? Math.max(0, Date.now() - state.lastSavedAt) : 0;
let offlineChecked = false;
let activeCase = ALL_CASES[0];
let multiCount = 1;
let isSpinning = false;
let currentUnboxedBatch = [];
let tradeUpSelection = [];

function loadState() {
  try {
    const raw = localStorage.getItem('neondrop_save_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = {
        ...defaultState,
        ...parsed,
        playerId: parsed.playerId || ('op_' + Math.random().toString(36).slice(2, 10)),
        callsign: typeof parsed.callsign === 'string' ? parsed.callsign : '',
        heirloomUids: Array.isArray(parsed.heirloomUids) ? parsed.heirloomUids : [],
        stats: {
          ...defaultState.stats,
          ...(parsed.stats || {}),
        },
      };
      // Backfill XP for existing saves that didn't have XP tracked yet
      if (typeof parsed.xp !== 'number') {
        merged.xp =
          (merged.stats.casesOpened || 0) * 35 +
          (merged.stats.goldsUnboxed || 0) * 600 +
          (merged.stats.tradeUpsDone || 0) * 180;
      }
      return merged;
    }
  } catch (e) {
    console.warn('Erro ao carregar save:', e);
  }
  const fresh = structuredClone(defaultState);
  fresh.playerId = 'op_' + Math.random().toString(36).slice(2, 10);
  return fresh;
}

function saveState() {
  state.lastSavedAt = Date.now();
  localStorage.setItem('neondrop_save_v3', JSON.stringify(state));
}

// =====================================================
// BLACK OPS / MW3 MILITARY RANK (1–55) & 10-PRESTIGE ENGINE
// =====================================================
const PRESTIGE_TIERS = [
  { level: 1,  roman: 'I',    name: 'Caçador Sombra',     reqSkins: 90,  reqPlatinums: 2,  c1: '#0075ff', c2: '#00e5ff' },
  { level: 2,  roman: 'II',   name: 'Víbora Tática',      reqSkins: 110, reqPlatinums: 3,  c1: '#00b24b', c2: '#00e5ff' },
  { level: 3,  roman: 'III',  name: 'Centurião de Cromo', reqSkins: 130, reqPlatinums: 5,  c1: '#6366f1', c2: '#38bdf8' },
  { level: 4,  roman: 'IV',   name: 'Falcão de Guerra',   reqSkins: 150, reqPlatinums: 7,  c1: '#a855f7', c2: '#ec4899' },
  { level: 5,  roman: 'V',    name: 'Caveira Fantasma',   reqSkins: 170, reqPlatinums: 9,  c1: '#ec4899', c2: '#ff9100' },
  { level: 6,  roman: 'VI',   name: 'Valquíria Carmesim', reqSkins: 185, reqPlatinums: 11, c1: '#ff1744', c2: '#d946ef' },
  { level: 7,  roman: 'VII',  name: 'Dragão de Plasma',   reqSkins: 200, reqPlatinums: 13, c1: '#ff9100', c2: '#ff1744' },
  { level: 8,  roman: 'VIII', name: 'Ceifador Abissal',   reqSkins: 215, reqPlatinums: 15, c1: '#00e5ff', c2: '#a855f7' },
  { level: 9,  roman: 'IX',   name: 'Arconte Solar',      reqSkins: 230, reqPlatinums: 16, c1: '#ffd700', c2: '#ff1744' },
  { level: 10, roman: 'X ★',  name: 'Mestre Soberano',    reqSkins: 245, reqPlatinums: 18, c1: '#ffd700', c2: '#ffffff' },
];

function getMilitaryRankTitle(lvl) {
  if (lvl >= 55) return 'Comandante Supremo ★';
  if (lvl >= 50) return 'Coronel de Divisão';
  if (lvl >= 40) return 'Capitão de Esquadrão';
  if (lvl >= 30) return 'Tenente Operacional';
  if (lvl >= 20) return 'Sargento de Arsenal';
  if (lvl >= 10) return 'Cabo Tático';
  return 'Soldado Recruta';
}

function getXPNeededForLevel(lvl) {
  // Smooth XP curve from Level 1 to 55
  return Math.round(140 + Math.pow(lvl, 1.55) * 28);
}

function getMilitaryLevelInfo() {
  let remXP = Math.max(0, Math.floor(state.xp || 0));
  let level = 1;
  while (level < 55) {
    const needed = getXPNeededForLevel(level);
    if (remXP >= needed) {
      remXP -= needed;
      level++;
    } else {
      break;
    }
  }
  const nextNeeded = level >= 55 ? getXPNeededForLevel(55) : getXPNeededForLevel(level);
  const currentXP = level >= 55 ? nextNeeded : remXP;
  const pct = level >= 55 ? 100 : Math.min(100, Math.round((currentXP / nextNeeded) * 100));

  return {
    level,
    isMaxLevel: level >= 55,
    rankTitle: getMilitaryRankTitle(level),
    currentXP,
    nextNeeded,
    pct,
  };
}

function addTacticalXP(amount) {
  const prevLvl = getMilitaryLevelInfo().level;
  state.xp = Math.max(0, (state.xp || 0) + Math.round(amount));
  const newLvl = getMilitaryLevelInfo().level;
  if (newLvl > prevLvl) {
    sfx.coin();
  }
}

function getPrestigePerks(pLevel = state.prestigeLevel || 0) {
  const clamped = Math.min(10, Math.max(0, pLevel));
  return {
    prestigeLevel: clamped,
    passiveBonusPct: clamped * 50,
    passiveMult: 1 + clamped * 0.5,
    caseDiscountPct: clamped * 1,
    caseCostMult: 1 - clamped * 0.01,
    syncTrackBonusPct: clamped * 1,
    syncTrackChance: 0.10 + clamped * 0.01,
    startingBalance: 500 + clamped * 1000,
    maxHeirloomsForNextReset: Math.min(10, clamped + 1),
  };
}

function getEffectiveCasePrice(caseObj) {
  const { caseCostMult } = getPrestigePerks();
  return Number((caseObj.price * caseCostMult).toFixed(2));
}

function getPrestigeEmblemSVG(prestigeLvl = 0, milLevel = 1) {
  const uid = ++svgCounter;
  const gid = `pr_g_${uid}`;
  const pInfo = PRESTIGE_TIERS.find((p) => p.level === prestigeLvl);
  const c1 = pInfo ? pInfo.c1 : milLevel >= 55 ? '#ffd700' : '#0075ff';
  const c2 = pInfo ? pInfo.c2 : milLevel >= 55 ? '#ff9100' : '#9aa1b1';

  let innerArt = '';
  if (prestigeLvl === 0) {
    // Military Chevrons + Star at 55
    innerArt = `
      <polygon points="32,8 56,20 56,46 32,58 8,46 8,20" fill="#181b22" stroke="url(#${gid})" stroke-width="3"/>
      <path d="M18 32L32 22L46 32" stroke="url(#${gid})" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${milLevel >= 15 ? `<path d="M18 40L32 30L46 40" stroke="url(#${gid})" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${milLevel >= 35 ? `<path d="M22 47L32 39L42 47" stroke="${c2}" stroke-width="3" stroke-linecap="round"/>` : ''}
      ${milLevel >= 55 ? `<polygon points="32,12 34.5,17 40,17.5 36,21 37,26.5 32,23.5 27,26.5 28,21 24,17.5 29.5,17" fill="#ffd700"/>` : ''}
    `;
  } else {
    // Prestige 1..10 Iconic Emblems (Shields, Wings, Skulls, Crowns, Stars)
    const wingPath =
      prestigeLvl >= 4
        ? `<path d="M4 26L16 20L12 38L4 26ZM60 26L48 20L52 38L60 26Z" fill="url(#${gid})"/>`
        : '';
    const crownPath =
      prestigeLvl >= 8
        ? `<polygon points="20,14 26,6 32,12 38,6 44,14" fill="#ffd700" stroke="#ffffff" stroke-width="1"/>`
        : '';
    const centerSymbol =
      prestigeLvl >= 5
        ? `
          <!-- Tactical Skull / Visor Core -->
          <path d="M23 26C23 20 41 20 41 26V35L37 42H27L23 35V26Z" fill="url(#${gid})" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="28" cy="30" r="2.3" fill="#141415"/>
          <circle cx="36" cy="30" r="2.3" fill="#141415"/>
          <line x1="30" y1="37" x2="30" y2="41" stroke="#141415" stroke-width="1.5"/>
          <line x1="34" y1="37" x2="34" y2="41" stroke="#141415" stroke-width="1.5"/>
        `
        : `
          <!-- Tactical Crossed Blades & Gem Star -->
          <line x1="18" y1="46" x2="46" y2="18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="46" y1="46" x2="18" y2="18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
          <polygon points="32,16 37,27 48,32 37,37 32,48 27,37 16,32 27,27" fill="url(#${gid})" stroke="#ffffff" stroke-width="1.2"/>
        `;

    innerArt = `
      ${wingPath}
      <polygon points="32,8 54,18 48,48 32,58 16,48 10,18" fill="#16181f" stroke="url(#${gid})" stroke-width="3"/>
      ${crownPath}
      ${centerSymbol}
    `;
  }

  return `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
      </defs>
      ${innerArt}
    </svg>
  `;
}

function getNextPrestigeStatus() {
  const currentP = state.prestigeLevel || 0;
  const { uniqueSkinsCount } = computePassiveIncome();
  const ownedSet = getOwnedKeySet();
  let platinumCases = 0;
  ALL_CASES.forEach((c) => {
    if (getCaseMasteryStatus(c, ownedSet).stage === 2) platinumCases++;
  });

  const milInfo = getMilitaryLevelInfo();
  const nextTier = PRESTIGE_TIERS.find((p) => p.level === currentP + 1);

  if (!nextTier) {
    return {
      isMaxPrestige: true,
      currentP,
      milInfo,
      uniqueSkinsCount,
      platinumCases,
      canPrestige: false,
    };
  }

  const okLevel = milInfo.level >= 55;
  const okSkins = uniqueSkinsCount >= nextTier.reqSkins;
  const okPlats = platinumCases >= nextTier.reqPlatinums;

  return {
    isMaxPrestige: false,
    currentP,
    nextTier,
    milInfo,
    uniqueSkinsCount,
    platinumCases,
    okLevel,
    okSkins,
    okPlats,
    canPrestige: okLevel && okSkins && okPlats,
  };
}

// =====================================================
// ITEM ROLL (NO PITY - PURE ODDS) & FLOAT/WEAR LOGIC
// =====================================================
function rollRarity() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const key of RARITY_ORDER) {
    cumulative += RARITIES[key].weight;
    if (roll <= cumulative) {
      return key;
    }
  }
  return 'blue';
}

function getWearFromFloat(f) {
  if (f < 0.07) return { name: 'Factory New', short: 'FN', mult: 1.45 };
  if (f < 0.15) return { name: 'Minimal Wear', short: 'MW', mult: 1.2 };
  if (f < 0.38) return { name: 'Field-Tested', short: 'FT', mult: 1.0 };
  if (f < 0.45) return { name: 'Well-Worn', short: 'WW', mult: 0.85 };
  return { name: 'Battle-Scarred', short: 'BS', mult: 0.72 };
}

function generateItemInstance(caseObj, forcedRarity = null) {
  const rarity = forcedRarity || rollRarity();
  let pool = caseObj.items.filter((i) => i.rarity === rarity);

  if (pool.length === 0) pool = caseObj.items;
  const template = pool[Math.floor(Math.random() * pool.length)];

  const floatVal = Number((Math.random() * 0.999 + 0.0001).toFixed(5));
  const wear = getWearFromFloat(floatVal);
  const { syncTrackChance } = getPrestigePerks();
  const statTrak = Math.random() < syncTrackChance;
  const finalPrice = Number((template.basePrice * wear.mult * (statTrak ? 1.85 : 1)).toFixed(2));

  return {
    uid: 'itm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    templateId: template.id,
    name: template.name,
    rarity: template.rarity,
    shape: template.shape,
    c1: template.c1,
    c2: template.c2,
    pattern: template.pattern,
    image: template.image,
    float: floatVal,
    wearName: wear.name,
    wearShort: wear.short,
    statTrak,
    price: finalPrice,
    caseId: caseObj.id,
    obtainedAt: Date.now(),
  };
}

// =====================================================
// CASE MASTERY, ACHIEVEMENTS & IDLE INCOME ENGINE
// =====================================================
function getOwnedKeySet() {
  const set = new Set();
  state.inventory.forEach((inv) => {
    if (inv.templateId) set.add(inv.templateId);
    if (inv.name) set.add(inv.name);
  });
  return set;
}

function getCaseMasteryStatus(caseObj, ownedSet = getOwnedKeySet()) {
  if (!caseObj || !Array.isArray(caseObj.items) || !caseObj.items.length) {
    return { stage: 0, mult: 1.0, ownedCount: 0, totalCount: 0, label: '0/0' };
  }
  const weapons = caseObj.items.filter((i) => i.rarity !== 'gold');
  const golds = caseObj.items.filter((i) => i.rarity === 'gold');

  const weaponsOwned = weapons.filter((w) => ownedSet.has(w.id) || ownedSet.has(w.name)).length;
  const goldsOwned = golds.filter((g) => ownedSet.has(g.id) || ownedSet.has(g.name)).length;
  const ownedCount = weaponsOwned + goldsOwned;
  const totalCount = caseObj.items.length;

  const allWeaponsDone = weapons.length > 0 && weaponsOwned === weapons.length;
  const allGoldsDone = golds.length > 0 && goldsOwned === golds.length;

  if (allWeaponsDone && allGoldsDone) {
    return {
      stage: 2,
      mult: 2.0,
      ownedCount,
      totalCount,
      label: `🏆 PLATINADA (${ownedCount}/${totalCount}) • +100% $/s`,
    };
  }
  if (allWeaponsDone) {
    return {
      stage: 1,
      mult: 1.25,
      ownedCount,
      totalCount,
      label: `⭐ Armas 100% (${ownedCount}/${totalCount}) • +25% $/s`,
    };
  }
  return {
    stage: 0,
    mult: 1.0,
    ownedCount,
    totalCount,
    label: `${ownedCount}/${totalCount} Coleção`,
  };
}

const ACHIEVEMENTS = [
  {
    id: 'ach_unbox_10',
    title: 'Iniciado em Suprimentos',
    desc: 'Abra 10 Caixas de Suprimento',
    bonusPct: 5,
    check: (ctx) => state.stats.casesOpened >= 10,
  },
  {
    id: 'ach_unique_25',
    title: 'Colecionador Tático',
    desc: 'Mantenha 25 skins únicas simultâneas na coleção',
    bonusPct: 10,
    check: (ctx) => ctx.uniqueSkinsCount >= 25,
  },
  {
    id: 'ach_tradeup_1',
    title: 'Alquimista de Contratos',
    desc: 'Forje pelo menos 1 Contrato de Troca (5 por 1)',
    bonusPct: 10,
    check: (ctx) => (state.stats.tradeUpsDone || 0) >= 1,
  },
  {
    id: 'ach_gold_1',
    title: 'Caçador ★ Apex Mítico',
    desc: 'Desbloqueie 1 ★ Faca ou Luva Especial',
    bonusPct: 15,
    check: (ctx) => state.stats.goldsUnboxed >= 1,
  },
  {
    id: 'ach_mastery_stage1',
    title: 'Mestre de Arsenal',
    desc: 'Complete 100% das Armas de qualquer caixa (Estágio 1)',
    bonusPct: 15,
    check: (ctx) => ctx.anyStage1,
  },
  {
    id: 'ach_mastery_stage2',
    title: 'Platinador Supremo',
    desc: 'Platine 100% de uma caixa (Armas + 4 ★ Apex)',
    bonusPct: 25,
    check: (ctx) => ctx.anyStage2,
  },
];

function evaluateAchievements(uniqueSkinsCount, ownedSet = getOwnedKeySet()) {
  let anyStage1 = false;
  let anyStage2 = false;
  ALL_CASES.forEach((c) => {
    const m = getCaseMasteryStatus(c, ownedSet);
    if (m.stage >= 1) anyStage1 = true;
    if (m.stage === 2) anyStage2 = true;
  });

  const ctx = { uniqueSkinsCount, anyStage1, anyStage2 };
  let totalBonusPct = 0;
  const list = ACHIEVEMENTS.map((ach) => {
    const unlocked = ach.check(ctx);
    if (unlocked) totalBonusPct += ach.bonusPct;
    return { ...ach, unlocked };
  });

  return { list, totalBonusPct, globalAchMult: 1 + totalBonusPct / 100 };
}

function getItemPassiveRate(item, masteryMult = 1.0) {
  // Each unique skin generates 0.04% of its value per second, multiplied by Case Mastery (1.25x or 2.0x)
  const raw = Math.max(0.005, (item.price || 5) * 0.0004) * masteryMult;
  return Number(raw.toFixed(3));
}

function computePassiveIncome() {
  const { kept } = getDuplicatesPartition();
  const ownedSet = getOwnedKeySet();

  // Map each case's current mastery multiplier
  const caseMultMap = new Map();
  ALL_CASES.forEach((c) => {
    caseMultMap.set(c.id, getCaseMasteryStatus(c, ownedSet).mult);
  });

  const skinsRate = kept.reduce((sum, item) => {
    const mMult = caseMultMap.get(item.caseId) || 1.0;
    return sum + getItemPassiveRate(item, mMult);
  }, 0);

  const { globalAchMult, totalBonusPct } = evaluateAchievements(kept.length, ownedSet);
  const prestigeMult = 1 + (state.prestigeLevel || 0) * 0.5;
  const combinedGlobalMult = globalAchMult * prestigeMult;

  const totalRate = Number(((0.15 + skinsRate) * combinedGlobalMult).toFixed(2));
  return {
    ratePerSec: totalRate,
    uniqueSkinsCount: kept.length,
    achBonusPct: totalBonusPct,
    prestigeMult,
  };
}

function checkOfflineEarnings() {
  if (offlineChecked) return;
  offlineChecked = true;
  // Require at least 60 seconds away to show the offline modal, capped at 12 hours
  const elapsedSec = Math.min(12 * 3600, Math.floor(initialOfflineElapsedMs / 1000));
  if (elapsedSec < 60) return;

  const { ratePerSec, uniqueSkinsCount } = computePassiveIncome();
  if (uniqueSkinsCount === 0) return;

  const earned = Number((ratePerSec * elapsedSec).toFixed(2));
  if (earned <= 0) return;

  state.balance = Number((state.balance + earned).toFixed(2));
  saveState();
  updateTopBar();

  const hours = Math.floor(elapsedSec / 3600);
  const mins = Math.floor((elapsedSec % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`;

  const timeEl = document.getElementById('offline-time-text');
  const earnedEl = document.getElementById('offline-earned-price');
  const modal = document.getElementById('offline-modal');
  if (timeEl) timeEl.textContent = timeStr;
  if (earnedEl) earnedEl.textContent = `+${formatMoney(earned)}`;
  if (modal) modal.classList.remove('hidden');
}

document.getElementById('offline-claim-btn')?.addEventListener('click', () => {
  sfx.coin();
  document.getElementById('offline-modal')?.classList.add('hidden');
});

// =====================================================
// UI RENDERING
// =====================================================
function formatMoney(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let lastRenderedRankKey = '';

function updateTopBar() {
  document.getElementById('balance-display').textContent = formatMoney(state.balance);

  const { ratePerSec, uniqueSkinsCount } = computePassiveIncome();
  const passiveRateEl = document.getElementById('passive-rate-text');
  const passiveSkinsEl = document.getElementById('passive-skins-count');
  if (passiveRateEl) passiveRateEl.textContent = `+${formatMoney(ratePerSec)} /s`;
  if (passiveSkinsEl) passiveSkinsEl.textContent = uniqueSkinsCount;

  // Military Rank & Prestige Top HUD
  const mil = getMilitaryLevelInfo();
  const pLvl = state.prestigeLevel || 0;
  const pTier = PRESTIGE_TIERS.find((p) => p.level === pLvl);
  const rankKey = `${pLvl}_${mil.level}`;

  const emblemEl = document.getElementById('top-rank-emblem');
  if (emblemEl && lastRenderedRankKey !== rankKey) {
    lastRenderedRankKey = rankKey;
    emblemEl.innerHTML = getPrestigeEmblemSVG(pLvl, mil.level);
  }

  const titleEl = document.getElementById('top-rank-title');
  const xpTextEl = document.getElementById('top-xp-text');
  const xpFillEl = document.getElementById('top-xp-fill');
  if (titleEl) {
    titleEl.textContent = pTier
      ? `Prestígio ${pTier.roman} • Nv. ${mil.level}`
      : `Nv. ${mil.level} • ${mil.rankTitle}`;
  }
  if (xpTextEl) {
    xpTextEl.textContent = mil.isMaxLevel ? 'NÍVEL MÁX (55)' : `${mil.currentXP} / ${mil.nextNeeded} XP`;
  }
  if (xpFillEl) {
    xpFillEl.style.width = `${mil.pct}%`;
  }

  const heirloomCountEl = document.getElementById('top-heirloom-count');
  if (heirloomCountEl) {
    const { maxHeirloomsForNextReset } = getPrestigePerks(pLvl);
    const lockedCount = (state.heirloomUids || []).filter((u) =>
      state.inventory.some((i) => i.uid === u)
    ).length;
    heirloomCountEl.textContent = `🔒 ${lockedCount}/${maxHeirloomsForNextReset} Herança`;
  }

  document.getElementById('inv-count').textContent = state.inventory.length;
  document.getElementById('trade-count').textContent = tradeUpSelection.length;
}

function renderCaseSelector() {
  const grid = document.getElementById('cases-grid');
  grid.innerHTML = '';
  const ownedSet = getOwnedKeySet();
  const { caseDiscountPct } = getPrestigePerks();
  FEATURED_CASES.forEach((c) => {
    const mastery = getCaseMasteryStatus(c, ownedSet);
    const effPrice = getEffectiveCasePrice(c);
    const div = document.createElement('div');
    div.className = `case-card ${c.id === activeCase.id ? 'active' : ''}`;
    div.innerHTML = `
      <div class="case-icon">${renderArtworkHTML(c, true)}</div>
      <div class="case-meta">
        <h3>${c.name} ${mastery.stage === 2 ? '🏆' : mastery.stage === 1 ? '⭐' : ''}</h3>
        <span class="case-price-tag">${formatMoney(effPrice)}${caseDiscountPct > 0 ? ` <small style="color:var(--muted);font-weight:600">(-${caseDiscountPct}%)</small>` : ''}</span>
      </div>
    `;
    div.addEventListener('click', () => {
      if (isSpinning) return;
      activeCase = c;
      document.getElementById('all-cases-select').value = c.id;
      renderCaseSelector();
      renderActiveCaseArena();
    });
    grid.appendChild(div);
  });
}

function updateOpenButtonLabel() {
  const totalCost = Number((getEffectiveCasePrice(activeCase) * multiCount).toFixed(2));
  document.getElementById('open-case-count-label').textContent = `${multiCount}x`;
  document.getElementById('open-case-price').textContent = formatMoney(totalCost);
}

function buildRouletteLanes() {
  const stack = document.getElementById('roulette-stack');
  stack.className = `roulette-stack ${multiCount > 1 ? 'compact' : ''}`;
  stack.innerHTML = '';

  for (let lane = 0; lane < multiCount; lane++) {
    const viewport = document.createElement('div');
    viewport.className = 'roulette-viewport';
    viewport.id = `roulette-viewport-${lane}`;
    viewport.innerHTML = `
      <div class="center-marker"></div>
      <div class="roulette-fade-left"></div>
      <div class="roulette-fade-right"></div>
      <div class="roulette-strip" id="roulette-strip-${lane}"></div>
    `;
    stack.appendChild(viewport);

    const strip = viewport.querySelector('.roulette-strip');
    for (let i = 0; i < 16; i++) {
      const sample = activeCase.items[(i + lane * 2) % activeCase.items.length];
      strip.appendChild(createRouletteTile(sample));
    }
  }
}

function renderActiveCaseArena() {
  document.getElementById('active-case-title').textContent = activeCase.name;
  document.getElementById('active-case-desc').textContent = activeCase.desc;

  const mastery = getCaseMasteryStatus(activeCase);
  const mBadge = document.getElementById('active-case-mastery-badge');
  if (mBadge) {
    mBadge.textContent = mastery.label;
    mBadge.className = `mastery-badge ${
      mastery.stage === 2 ? 'stage-2' : mastery.stage === 1 ? 'stage-1' : ''
    }`;
  }

  const thumb = document.getElementById('active-case-thumb');
  if (thumb) {
    thumb.innerHTML = renderArtworkHTML(activeCase, true);
  }

  updateOpenButtonLabel();
  buildRouletteLanes();

  // Render Case Contents
  const contentsGrid = document.getElementById('case-items-grid');
  contentsGrid.innerHTML = '';
  const sortedItems = [...activeCase.items].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );
  document.getElementById('case-items-count').textContent = sortedItems.length;

  sortedItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = `item-card rarity-${item.rarity}`;
    card.innerHTML = `
      <div class="item-art-wrap">${renderArtworkHTML(item)}</div>
      <div class="item-title">${item.name}</div>
      <div class="item-price">Base: ${formatMoney(item.basePrice)}</div>
    `;
    contentsGrid.appendChild(card);
  });
}

function createRouletteTile(item) {
  const div = document.createElement('div');
  div.className = `r-tile rarity-${item.rarity}`;
  div.innerHTML = `
    <div class="tile-art">${renderArtworkHTML(item)}</div>
    <div class="tile-name">${item.name}</div>
  `;
  return div;
}

// =====================================================
// MULTI-ROULETTE SPIN ENGINE
// =====================================================
function spinRoulette() {
  if (isSpinning) return;
  const totalCost = Number((getEffectiveCasePrice(activeCase) * multiCount).toFixed(2));
  if (state.balance < totalCost) {
    alert(`Saldo insuficiente para abrir ${multiCount}x (${formatMoney(totalCost)})! Aguarde sua Renda Passiva ($/s) ou venda itens duplicados.`);
    return;
  }

  state.balance = Number((state.balance - totalCost).toFixed(2));
  state.stats.casesOpened += multiCount;
  state.stats.totalSpent = Number((state.stats.totalSpent + totalCost).toFixed(2));
  isSpinning = true;
  document.getElementById('open-case-btn').disabled = true;

  const xpByRarity = { blue: 25, purple: 60, pink: 150, red: 400, gold: 1200 };
  const tierXpMult = 1 + ((activeCase.tier || 1) - 1) * 0.35;
  let earnedBatchXP = 0;

  currentUnboxedBatch = [];
  for (let lane = 0; lane < multiCount; lane++) {
    const winner = generateItemInstance(activeCase);
    if (winner.rarity === 'gold') state.stats.goldsUnboxed++;
    if (winner.price > state.stats.bestDropValue) state.stats.bestDropValue = winner.price;
    earnedBatchXP += (xpByRarity[winner.rarity] || 25) * tierXpMult;
    currentUnboxedBatch.push(winner);
  }

  addTacticalXP(earnedBatchXP);
  updateTopBar();
  saveState();

  const TOTAL_TILES = 60;
  const WIN_INDEX = 48;
  const TILE_WIDTH = 140;
  const TILE_GAP = 10;
  const STEP = TILE_WIDTH + TILE_GAP;
  const PADDING_LEFT = 12;

  const isFast = document.getElementById('fast-mode-checkbox').checked;
  const baseDurationMs = isFast ? 1500 : 5000;
  let maxDuration = baseDurationMs;

  currentUnboxedBatch.forEach((winner, lane) => {
    const viewport = document.getElementById(`roulette-viewport-${lane}`);
    const strip = document.getElementById(`roulette-strip-${lane}`);
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';
    strip.innerHTML = '';

    for (let i = 0; i < TOTAL_TILES; i++) {
      if (i === WIN_INDEX) {
        strip.appendChild(createRouletteTile(winner));
      } else {
        const fillerRarity = rollVisualFillerRarity();
        let pool = activeCase.items.filter((x) => x.rarity === fillerRarity);
        if (!pool.length) pool = activeCase.items;
        const randItem = pool[Math.floor(Math.random() * pool.length)];
        strip.appendChild(createRouletteTile(randItem));
      }
    }

    void strip.offsetWidth;

    const viewportWidth = viewport.clientWidth;
    const jitter = (Math.random() - 0.5) * (TILE_WIDTH * 0.72);
    const winTileCenter = PADDING_LEFT + WIN_INDEX * STEP + TILE_WIDTH / 2 + jitter;
    const targetTranslateX = -(winTileCenter - viewportWidth / 2);

    const laneDuration = baseDurationMs + lane * 180;
    if (laneDuration > maxDuration) maxDuration = laneDuration;

    strip.style.transition = `transform ${laneDuration}ms cubic-bezier(0.1, 0.82, 0.14, 1)`;
    strip.style.transform = `translateX(${targetTranslateX}px)`;

    if (lane === 0) {
      let lastTickIndex = 0;
      const startTime = performance.now();
      function trackTicks(now) {
        if (!isSpinning) return;
        const matrix = new WebKitCSSMatrix(window.getComputedStyle(strip).transform);
        const currentX = Math.abs(matrix.m41);
        const currentCenterIndex = Math.floor((currentX + viewportWidth / 2) / STEP);

        if (currentCenterIndex > lastTickIndex) {
          lastTickIndex = currentCenterIndex;
          const progress = Math.min(1, (now - startTime) / laneDuration);
          sfx.tick(0.85 + (1 - progress) * 0.35);
        }

        if (now - startTime < laneDuration) {
          requestAnimationFrame(trackTicks);
        }
      }
      requestAnimationFrame(trackTicks);
    }
  });

  setTimeout(() => {
    isSpinning = false;
    document.getElementById('open-case-btn').disabled = false;
    showRewardModal(currentUnboxedBatch);
  }, maxDuration + 140);
}

function rollVisualFillerRarity() {
  const r = Math.random() * 100;
  if (r < 72) return 'blue';
  if (r < 89) return 'purple';
  if (r < 96) return 'pink';
  if (r < 99) return 'red';
  return 'gold';
}

// =====================================================
// MULTI-REWARD MODAL
// =====================================================
function showRewardModal(items) {
  let highestRarity = 'blue';
  items.forEach((it) => {
    if (RARITY_ORDER.indexOf(it.rarity) > RARITY_ORDER.indexOf(highestRarity)) {
      highestRarity = it.rarity;
    }
  });

  sfx.unboxReveal(highestRarity);

  const modal = document.getElementById('reward-modal');
  const rInfo = RARITIES[highestRarity];
  document.getElementById('reward-modal-glow').style.background = rInfo.color;
  document.getElementById('reward-modal-title').textContent =
    items.length > 1 ? `${items.length} ITENS DESBLOQUEADOS!` : 'ITEM DESBLOQUEADO!';

  const showcase = document.getElementById('rewards-showcase');
  showcase.innerHTML = '';

  let totalVal = 0;
  items.forEach((item) => {
    totalVal += item.price;
    const card = document.createElement('div');
    card.className = `showcase-item item-card rarity-${item.rarity}`;
    card.innerHTML = `
      ${item.statTrak ? `<span class="stattrak-badge">🔥 Sync™</span>` : ''}
      <span class="wear-mini">${item.wearShort}</span>
      <div class="item-art-wrap">${renderArtworkHTML(item)}</div>
      <div class="item-title">${item.name}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Float: ${item.float}</div>
      <div class="item-price">${formatMoney(item.price)}</div>
    `;
    showcase.appendChild(card);
  });

  document.getElementById('reward-total-price').textContent = formatMoney(totalVal);
  document.getElementById('modal-sell-val').textContent = formatMoney(totalVal);
  modal.classList.remove('hidden');
}

document.getElementById('modal-keep-btn').addEventListener('click', () => {
  if (currentUnboxedBatch.length) {
    state.inventory.push(...currentUnboxedBatch);
    currentUnboxedBatch = [];
    saveState();
    updateTopBar();
    renderCaseSelector();
    renderActiveCaseArena();
    renderInventory();
    publishMyScoreToCloud(false);
  }
  document.getElementById('reward-modal').classList.add('hidden');
});

document.getElementById('modal-sell-btn').addEventListener('click', () => {
  if (currentUnboxedBatch.length) {
    const sum = currentUnboxedBatch.reduce((acc, i) => acc + i.price, 0);
    state.balance = Number((state.balance + sum).toFixed(2));
    state.stats.totalEarned = Number((state.stats.totalEarned + sum).toFixed(2));
    currentUnboxedBatch = [];
    sfx.coin();
    saveState();
    updateTopBar();
    publishMyScoreToCloud(false);
  }
  document.getElementById('reward-modal').classList.add('hidden');
});

// =====================================================
// INVENTORY & COLLECTION SYSTEM (Owned / Not Owned / All)
// =====================================================
let collectionFilter = 'owned'; // 'owned' | 'not-owned' | 'all'

function getScopedCases() {
  const scopeVal = document.getElementById('inv-case-select')?.value || 'CURRENT';
  if (scopeVal === 'CURRENT') return [activeCase];
  if (scopeVal === 'FEATURED') return FEATURED_CASES;
  if (scopeVal === 'ALL') return ALL_CASES;
  const found = ALL_CASES.find((c) => c.id === scopeVal);
  return found ? [found] : [activeCase];
}

function getScopedCatalogItems() {
  const cases = getScopedCases();
  const seen = new Set();
  const list = [];

  cases.forEach((c) => {
    c.items.forEach((item) => {
      const key = item.id || item.name;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          ...item,
          sourceCaseId: c.id,
          sourceCaseName: c.name,
        });
      }
    });
  });

  return list;
}

function updateCollectionProgressUI() {
  const scopeVal = document.getElementById('inv-case-select')?.value || 'CURRENT';
  const scopeLabel =
    scopeVal === 'CURRENT'
      ? activeCase.name
      : scopeVal === 'FEATURED'
      ? 'Destaques'
      : scopeVal === 'ALL'
      ? 'Global'
      : ALL_CASES.find((c) => c.id === scopeVal)?.name || 'Caixa';

  const catalog = getScopedCatalogItems();
  const ownedSet = new Set();
  state.inventory.forEach((invItem) => {
    ownedSet.add(invItem.templateId);
    ownedSet.add(invItem.name);
  });

  const ownedUniqueCount = catalog.filter(
    (catItem) => ownedSet.has(catItem.id) || ownedSet.has(catItem.name)
  ).length;
  const totalCount = catalog.length;
  const pct = totalCount > 0 ? Math.round((ownedUniqueCount / totalCount) * 100) : 0;

  const scopeEl = document.getElementById('collection-scope-name');
  const textEl = document.getElementById('collection-progress-text');
  const barEl = document.getElementById('collection-progress-bar');

  if (scopeEl) scopeEl.textContent = scopeLabel;
  if (textEl) textEl.textContent = `${ownedUniqueCount} / ${totalCount} (${pct}%)`;
  if (barEl) barEl.style.width = `${pct}%`;
}

function jumpToCaseAndOpenTab(caseId) {
  const target = ALL_CASES.find((c) => c.id === caseId);
  if (target) {
    activeCase = target;
    if (!FEATURED_CASES.some((f) => f.id === target.id)) {
      FEATURED_CASES[FEATURED_CASES.length - 1] = target;
    }
    const allSelect = document.getElementById('all-cases-select');
    if (allSelect) allSelect.value = target.id;
    renderCaseSelector();
    renderActiveCaseArena();
  }
  document.querySelector('.tab-btn[data-tab="cases"]')?.click();
}

function isHeirloom(uid) {
  return Array.isArray(state.heirloomUids) && state.heirloomUids.includes(uid);
}

function toggleHeirloomUid(uid) {
  if (!Array.isArray(state.heirloomUids)) state.heirloomUids = [];
  // Clean up any stale UIDs not in inventory
  state.heirloomUids = state.heirloomUids.filter((u) =>
    state.inventory.some((i) => i.uid === u)
  );

  if (state.heirloomUids.includes(uid)) {
    state.heirloomUids = state.heirloomUids.filter((u) => u !== uid);
  } else {
    const { maxHeirloomsForNextReset } = getPrestigePerks();
    if (state.heirloomUids.length >= maxHeirloomsForNextReset) {
      alert(
        `Limite de Herança Permanente atingido (${maxHeirloomsForNextReset}/${maxHeirloomsForNextReset})!\n\nSuba seu Nível de Prestígio para desbloquear mais slots de Herança Permanente (até 10 slots no Prestígio X).`
      );
      return;
    }
    state.heirloomUids.push(uid);
  }
  saveState();
  updateTopBar();
  renderInventory();
  renderStats();
}

function getDuplicatesPartition() {
  const groups = new Map();
  state.inventory.forEach((item) => {
    const key = item.templateId || item.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const kept = [];
  const duplicates = [];

  groups.forEach((list) => {
    // Prioritize Heirloom-locked items first, then highest value (best Wear / SyncTrack™)
    list.sort((a, b) => {
      const aH = isHeirloom(a.uid) ? 1 : 0;
      const bH = isHeirloom(b.uid) ? 1 : 0;
      if (bH !== aH) return bH - aH;
      return b.price - a.price;
    });
    kept.push(list[0]);
    if (list.length > 1) {
      list.slice(1).forEach((extra) => {
        if (isHeirloom(extra.uid)) {
          kept.push(extra);
        } else {
          duplicates.push(extra);
        }
      });
    }
  });

  return { kept, duplicates };
}

function updateDuplicatesUI() {
  const { duplicates } = getDuplicatesPartition();
  const countEl = document.getElementById('dupes-count');
  const btnEl = document.getElementById('sell-dupes-btn');
  if (countEl) countEl.textContent = duplicates.length;
  if (btnEl) {
    const dupesVal = duplicates.reduce((sum, i) => sum + i.price, 0);
    btnEl.disabled = duplicates.length === 0;
    btnEl.title =
      duplicates.length > 0
        ? `Vender ${duplicates.length} itens repetidos por ${formatMoney(dupesVal)} (mantém a cópia mais valiosa e itens de Herança)`
        : 'Nenhuma skin duplicada no inventário';
  }
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';

  const totalVal = state.inventory.reduce((acc, i) => acc + i.price, 0);
  document.getElementById('inv-total-value').textContent = formatMoney(totalVal);

  updateCollectionProgressUI();
  updateDuplicatesUI();

  const sortMode = document.getElementById('inv-sort-select').value;
  const scopeVal = document.getElementById('inv-case-select')?.value || 'CURRENT';
  const scopedCases = getScopedCases();
  const scopedCaseIds = new Set(scopedCases.map((c) => c.id));

  // MODE 1: OWNED (Shows player's actual owned items)
  if (collectionFilter === 'owned') {
    let items = [...state.inventory];
    if (scopeVal !== 'ALL') {
      const scopedItemKeys = new Set();
      scopedCases.forEach((c) =>
        c.items.forEach((it) => {
          scopedItemKeys.add(it.id);
          scopedItemKeys.add(it.name);
        })
      );
      items = items.filter(
        (i) =>
          scopedCaseIds.has(i.caseId) ||
          scopedItemKeys.has(i.templateId) ||
          scopedItemKeys.has(i.name)
      );
    }

    items.sort((a, b) => {
      if (sortMode === 'value-desc') return b.price - a.price;
      if (sortMode === 'rarity-desc') return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      return b.obtainedAt - a.obtainedAt;
    });

    if (items.length === 0) {
      grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align:center; padding: 32px;">Nenhum item "Owned" neste filtro. Abra caixas ou mude para "Not Owned" / "All"!</p>`;
      return;
    }

    const ownedSet = getOwnedKeySet();
    const caseMultMap = new Map();
    ALL_CASES.forEach((c) => caseMultMap.set(c.id, getCaseMasteryStatus(c, ownedSet).mult));
    const { kept } = getDuplicatesPartition();
    const keptUids = new Set(kept.map((k) => k.uid));

    items.forEach((item) => {
      const isTitular = keptUids.has(item.uid);
      const lockedHeirloom = isHeirloom(item.uid);
      const isEquipped = getEquippedWeaponItem()?.uid === item.uid;
      const mMult = caseMultMap.get(item.caseId) || 1.0;
      const itemRate = getItemPassiveRate(item, mMult);
      const card = document.createElement('div');
      card.className = `item-card rarity-${item.rarity}`;
      card.innerHTML = `
        ${
          lockedHeirloom
            ? `<span class="stattrak-badge">🔒 HERANÇA</span>`
            : item.statTrak
            ? `<span class="stattrak-badge">🔥 Sync™ (${item.kills || 0})</span>`
            : `<span class="owned-badge">${isTitular ? '✓ TITULAR' : 'DUPLICADA'}</span>`
        }
        <span class="wear-mini">${item.wearShort === 'FN' ? '✨ FN' : item.wearShort}</span>
        <div class="item-art-wrap">${renderArtworkHTML(item)}</div>
        <div class="item-title">${item.name}</div>
        <div class="passive-mini-tag">${isTitular ? `+${formatMoney(itemRate)}/s` : 'Duplicada (+$0/s)'}</div>
        <div class="item-price">${formatMoney(item.price)}</div>
        <div class="item-card-actions dual">
          <button class="btn-heirloom equip-aim-btn ${isEquipped ? 'locked' : ''}" title="Equipar esta arma/faca no Treino 2D (Aim Lab)">${isEquipped ? '🎯 Equipada' : '🎯 Equipar'}</button>
          ${
            isTitular
              ? `<button class="btn-heirloom toggle-heirloom-btn ${lockedHeirloom ? 'locked' : ''}" title="Proteger esta skin com Token de Herança Permanente (sobrevive ao reset de Prestígio)">${lockedHeirloom ? '🔒' : '🔓'}</button>`
              : ''
          }
          <button class="btn-danger sell-single-btn" ${lockedHeirloom ? 'disabled title="Desbloqueie a Herança antes de vender"' : ''}>Vender</button>
        </div>
      `;
      card.querySelector('.equip-aim-btn')?.addEventListener('click', () => {
        state.equippedUid = item.uid;
        sfx.coin();
        saveState();
        renderInventory();
        renderAimLabLoadout();
      });
      card.querySelector('.toggle-heirloom-btn')?.addEventListener('click', () => {
        toggleHeirloomUid(item.uid);
      });
      card.querySelector('.sell-single-btn').addEventListener('click', () => {
        sellItemByUid(item.uid);
      });
      grid.appendChild(card);
    });
    return;
  }

  // MODE 2 & 3: NOT OWNED or ALL (Collection Catalog View)
  const catalogItems = getScopedCatalogItems();
  const ownedSet = getOwnedKeySet();
  const caseMultMap = new Map();
  ALL_CASES.forEach((c) => caseMultMap.set(c.id, getCaseMasteryStatus(c, ownedSet).mult));

  // Map owned counts and best owned instance per catalog item
  const ownedMap = new Map();
  state.inventory.forEach((inv) => {
    const key = inv.templateId || inv.name;
    const prev = ownedMap.get(key) || { count: 0, instances: [] };
    prev.count++;
    prev.instances.push(inv);
    ownedMap.set(key, prev);
  });

  // Sort instances inside ownedMap highest price / heirloom first so index 0 is always the best copy
  ownedMap.forEach((rec) =>
    rec.instances.sort((a, b) => {
      const aH = isHeirloom(a.uid) ? 1 : 0;
      const bH = isHeirloom(b.uid) ? 1 : 0;
      if (bH !== aH) return bH - aH;
      return b.price - a.price;
    })
  );

  let filteredCatalog = catalogItems.map((catItem) => {
    const byId = ownedMap.get(catItem.id);
    const byName = ownedMap.get(catItem.name);
    const record = byId || byName || { count: 0, instances: [] };
    return {
      ...catItem,
      ownedCount: record.count,
      instances: record.instances,
    };
  });

  if (collectionFilter === 'not-owned') {
    filteredCatalog = filteredCatalog.filter((c) => c.ownedCount === 0);
  }

  filteredCatalog.sort((a, b) => {
    if (sortMode === 'value-desc') return b.basePrice - a.basePrice;
    if (sortMode === 'rarity-desc') return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    return b.ownedCount - a.ownedCount;
  });

  if (filteredCatalog.length === 0) {
    grid.innerHTML = `<p style="color: var(--accent-green); grid-column: 1/-1; text-align:center; padding: 32px; font-weight:700;">🎉 Parabéns! Você já possui todos os itens desta coleção!</p>`;
    return;
  }

  filteredCatalog.forEach((catItem) => {
    const isOwned = catItem.ownedCount > 0;
    const card = document.createElement('div');
    card.className = `item-card rarity-${catItem.rarity} ${isOwned ? 'owned' : 'not-owned'}`;

    if (isOwned) {
      const bestInst = catItem.instances[0];
      const worstInst = catItem.instances[catItem.instances.length - 1];
      const lockedHeirloom = isHeirloom(bestInst.uid);
      const isEquipped = getEquippedWeaponItem()?.uid === bestInst.uid;
      const mMult = caseMultMap.get(catItem.sourceCaseId) || 1.0;
      const passiveRate = getItemPassiveRate(bestInst, mMult);
      const perfectionBadges = [
        bestInst.wearShort === 'FN' ? '<span class="perfection-badge">✨ FN</span>' : '',
        bestInst.statTrak ? '<span class="perfection-badge">🔥 Sync™</span>' : '',
      ].join('');

      card.innerHTML = `
        <span class="owned-badge">${lockedHeirloom ? '🔒 HERANÇA' : `✓ OWNED ×${catItem.ownedCount}`}</span>
        <span class="wear-mini">${bestInst.wearShort}${perfectionBadges}</span>
        <div class="item-art-wrap">${renderArtworkHTML(bestInst)}</div>
        <div class="item-title">${catItem.name}</div>
        <div class="case-source-label">📦 ${catItem.sourceCaseName}</div>
        <div class="passive-mini-tag">+${formatMoney(passiveRate)} /s</div>
        <div class="item-price">${formatMoney(bestInst.price)}</div>
        <div class="item-card-actions dual">
          <button class="btn-heirloom equip-aim-btn ${isEquipped ? 'locked' : ''}" title="Equipar no Treino 2D">${isEquipped ? '🎯 Equipada' : '🎯 Equipar'}</button>
          <button class="btn-heirloom toggle-heirloom-btn ${lockedHeirloom ? 'locked' : ''}" title="Proteger como Herança Permanente">${lockedHeirloom ? '🔒' : '🔓'}</button>
          <button class="btn-danger sell-one-col-btn" ${catItem.ownedCount === 1 && lockedHeirloom ? 'disabled' : ''}>Vender</button>
        </div>
      `;
      card.querySelector('.equip-aim-btn')?.addEventListener('click', () => {
        state.equippedUid = bestInst.uid;
        sfx.coin();
        saveState();
        renderInventory();
        renderAimLabLoadout();
      });
      card.querySelector('.toggle-heirloom-btn')?.addEventListener('click', () => {
        toggleHeirloomUid(bestInst.uid);
      });
      card.querySelector('.sell-one-col-btn').addEventListener('click', () => {
        sellItemByUid(worstInst.uid);
      });
    } else {
      card.innerHTML = `
        <span class="not-owned-badge">🔒 NOT OWNED</span>
        <div class="item-art-wrap">${renderArtworkHTML(catItem)}</div>
        <div class="item-title">${catItem.name}</div>
        <div class="case-source-label">📦 ${catItem.sourceCaseName}</div>
        <div class="item-price">Base: ${formatMoney(catItem.basePrice)}</div>
        <div class="item-card-actions">
          <button class="btn-secondary hunt-case-btn">Ir para Caixa</button>
        </div>
      `;
      card.querySelector('.hunt-case-btn').addEventListener('click', () => {
        jumpToCaseAndOpenTab(catItem.sourceCaseId);
      });
    }

    grid.appendChild(card);
  });
}

function sellItemByUid(uid) {
  if (isHeirloom(uid)) return;
  const idx = state.inventory.findIndex((i) => i.uid === uid);
  if (idx === -1) return;
  const [removed] = state.inventory.splice(idx, 1);
  state.balance = Number((state.balance + removed.price).toFixed(2));
  state.stats.totalEarned = Number((state.stats.totalEarned + removed.price).toFixed(2));
  tradeUpSelection = tradeUpSelection.filter((i) => i.uid !== uid);
  sfx.coin();
  saveState();
  updateTopBar();
  renderCaseSelector();
  renderActiveCaseArena();
  renderInventory();
  renderTradeUp();
}

// Collection Filter Buttons (Owned, Not Owned, All)
document.querySelectorAll('#collection-filter-group .col-filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#collection-filter-group .col-filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    collectionFilter = btn.getAttribute('data-filter');
    renderInventory();
  });
});

document.getElementById('inv-case-select')?.addEventListener('change', renderInventory);
document.getElementById('inv-sort-select').addEventListener('change', renderInventory);

document.getElementById('sell-dupes-btn')?.addEventListener('click', () => {
  const { kept, duplicates } = getDuplicatesPartition();
  if (!duplicates.length) return;
  const gain = duplicates.reduce((sum, i) => sum + i.price, 0);
  state.inventory = kept;
  state.balance = Number((state.balance + gain).toFixed(2));
  state.stats.totalEarned = Number((state.stats.totalEarned + gain).toFixed(2));
  tradeUpSelection = [];
  sfx.coin();
  saveState();
  updateTopBar();
  renderInventory();
  renderTradeUp();
});

// =====================================================
// TRADE-UP CONTRACT (5 items -> 1 Higher Rarity)
// =====================================================
function getBatchOf5Duplicates() {
  const { duplicates } = getDuplicatesPartition();
  for (const r of ['blue', 'purple', 'pink', 'red']) {
    const list = duplicates.filter((d) => d.rarity === r);
    if (list.length >= 5) {
      return list.slice(0, 5);
    }
  }
  return null;
}

function renderTradeUp() {
  const slotsContainer = document.getElementById('tradeup-slots');
  slotsContainer.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const item = tradeUpSelection[i];
    const slot = document.createElement('div');
    if (item) {
      slot.className = `trade-slot filled item-card rarity-${item.rarity}`;
      slot.innerHTML = `
        <div class="item-art-wrap" style="width:92px;height:62px;margin:2px 0">${renderArtworkHTML(item)}</div>
        <div style="font-size:10.5px; font-weight:700; margin-top:4px">${item.name}</div>
      `;
      slot.addEventListener('click', () => {
        tradeUpSelection.splice(i, 1);
        updateTopBar();
        renderTradeUp();
      });
    } else {
      slot.className = 'trade-slot';
      slot.innerHTML = `<span style="color:var(--text-muted); font-size:12px">Slot ${i + 1}</span>`;
    }
    slotsContainer.appendChild(slot);
  }

  document.getElementById('execute-tradeup-btn').disabled = tradeUpSelection.length !== 5;

  const autoFillBtn = document.getElementById('autofill-dupes-btn');
  if (autoFillBtn) {
    const batch5 = getBatchOf5Duplicates();
    autoFillBtn.disabled = !batch5;
  }

  const targetRarity = tradeUpSelection.length > 0 ? tradeUpSelection[0].rarity : null;
  const eligibleGrid = document.getElementById('tradeup-eligible-grid');
  eligibleGrid.innerHTML = '';

  const eligible = state.inventory.filter((item) => {
    if (item.rarity === 'gold') return false;
    if (isHeirloom(item.uid)) return false;
    if (tradeUpSelection.some((s) => s.uid === item.uid)) return false;
    if (targetRarity && item.rarity !== targetRarity) return false;
    return true;
  });

  eligible.forEach((item) => {
    const card = document.createElement('div');
    card.className = `item-card rarity-${item.rarity}`;
    card.innerHTML = `
      <span class="wear-mini">${item.wearShort}</span>
      <div class="item-art-wrap">${renderArtworkHTML(item)}</div>
      <div class="item-title">${item.name}</div>
      <div class="item-price">${formatMoney(item.price)}</div>
      <div class="item-card-actions">
        <button class="btn-secondary add-trade-btn">+ Selecionar</button>
      </div>
    `;
    card.querySelector('.add-trade-btn').addEventListener('click', () => {
      if (tradeUpSelection.length < 5) {
        tradeUpSelection.push(item);
        updateTopBar();
        renderTradeUp();
      }
    });
    eligibleGrid.appendChild(card);
  });
}

document.getElementById('autofill-dupes-btn')?.addEventListener('click', () => {
  const batch5 = getBatchOf5Duplicates();
  if (batch5) {
    tradeUpSelection = [...batch5];
    updateTopBar();
    renderTradeUp();
  }
});

document.getElementById('clear-tradeup-btn').addEventListener('click', () => {
  tradeUpSelection = [];
  updateTopBar();
  renderTradeUp();
});

document.getElementById('execute-tradeup-btn').addEventListener('click', () => {
  if (tradeUpSelection.length !== 5) return;
  const currentRarity = tradeUpSelection[0].rarity;
  const nextRarity = RARITIES[currentRarity].next;
  if (!nextRarity) return;

  const usedUids = new Set(tradeUpSelection.map((i) => i.uid));
  state.inventory = state.inventory.filter((i) => !usedUids.has(i.uid));
  tradeUpSelection = [];
  state.stats.tradeUpsDone = (state.stats.tradeUpsDone || 0) + 1;
  addTacticalXP(180);

  const forged = generateItemInstance(activeCase, nextRarity);
  currentUnboxedBatch = [forged];
  saveState();
  updateTopBar();
  renderTradeUp();
  renderInventory();
  showRewardModal(currentUnboxedBatch);
});

// =====================================================
// PRESTIGE BARRACKS (BLACK OPS / MW3), ACHIEVEMENTS & STATS
// =====================================================
function renderStats() {
  const { uniqueSkinsCount, achBonusPct } = computePassiveIncome();
  const { list: achList } = evaluateAchievements(uniqueSkinsCount);
  const status = getNextPrestigeStatus();
  const perks = getPrestigePerks(status.currentP);
  const curPInfo = PRESTIGE_TIERS.find((p) => p.level === status.currentP);

  // 1. Render Prestige Barracks Header & Perks
  const emblemBox = document.getElementById('barracks-emblem');
  if (emblemBox) {
    emblemBox.innerHTML = getPrestigeEmblemSVG(status.currentP, status.milInfo.level);
  }

  const pTag = document.getElementById('barracks-prestige-tag');
  if (pTag) {
    pTag.textContent = curPInfo
      ? `PRESTÍGIO ${curPInfo.roman} — ${curPInfo.name.toUpperCase()}`
      : 'PATENTE MILITAR PADRÃO';
  }

  const rTitle = document.getElementById('barracks-rank-title');
  if (rTitle) {
    rTitle.textContent = `Nível ${status.milInfo.level} • ${status.milInfo.rankTitle}`;
  }

  const xpText = document.getElementById('barracks-xp-text');
  const xpFill = document.getElementById('barracks-xp-fill');
  if (xpText) {
    xpText.textContent = status.milInfo.isMaxLevel
      ? 'NÍVEL MÁXIMO ALCANÇADO (55 / 55)'
      : `${status.milInfo.currentXP} / ${status.milInfo.nextNeeded} XP (${status.milInfo.pct}%)`;
  }
  if (xpFill) {
    xpFill.style.width = `${status.milInfo.pct}%`;
  }

  const perksPills = document.getElementById('barracks-perks-pills');
  if (perksPills) {
    perksPills.innerHTML = `
      <span class="pill-outline" style="border-color: var(--primary); color: var(--primary);">+${perks.passiveBonusPct}% Renda $/s</span>
      <span class="pill-outline">-${perks.caseDiscountPct}% Custo Caixas</span>
      <span class="pill-outline">+${perks.syncTrackBonusPct}% Chance SyncTrack™</span>
      <span class="pill-outline">Saldo Inicial: ${formatMoney(perks.startingBalance)}</span>
      <span class="pill-outline" style="border-color: var(--secondary); color: var(--secondary);">🔒 ${perks.maxHeirloomsForNextReset} Slots Herança</span>
    `;
  }

  // 2. Render 3-Point Checklist & Prestige Button
  const checklistEl = document.getElementById('prestige-checklist');
  const pBtn = document.getElementById('prestige-btn');
  const heirloomText = document.getElementById('heirloom-status-text');
  const activeHeirlooms = (state.heirloomUids || []).filter((u) =>
    state.inventory.some((i) => i.uid === u)
  );

  if (heirloomText) {
    heirloomText.innerHTML = `🔒 <strong>Herança Permanente:</strong> ${activeHeirlooms.length} / ${perks.maxHeirloomsForNextReset} skins protegidas na aba Coleção`;
  }

  if (status.isMaxPrestige) {
    if (checklistEl) {
      checklistEl.innerHTML = `
        <div class="check-row done"><span>🎖️ Patente Máxima Alcançada</span><strong>PRESTÍGIO X ★ MESTRE SOBERANO</strong></div>
      `;
    }
    if (pBtn) {
      pBtn.disabled = true;
      pBtn.textContent = '★ MESTRE DE PRESTÍGIO ALCANÇADO';
    }
  } else {
    const nt = status.nextTier;
    if (checklistEl) {
      checklistEl.innerHTML = `
        <div class="check-row ${status.okLevel ? 'done' : 'pending'}">
          <span>${status.okLevel ? '✓' : '🔒'} 1. Patente Militar Nível 55</span>
          <strong>Nv. ${status.milInfo.level} / 55</strong>
        </div>
        <div class="check-row ${status.okSkins ? 'done' : 'pending'}">
          <span>${status.okSkins ? '✓' : '🔒'} 2. Skins Únicas na Coleção</span>
          <strong>${status.uniqueSkinsCount} / ${nt.reqSkins}</strong>
        </div>
        <div class="check-row ${status.okPlats ? 'done' : 'pending'}">
          <span>${status.okPlats ? '✓' : '🔒'} 3. Caixas Platinadas (100%)</span>
          <strong>${status.platinumCases} / ${nt.reqPlatinums}</strong>
        </div>
      `;
    }
    if (pBtn) {
      pBtn.disabled = !status.canPrestige;
      pBtn.textContent = `🎖️ ENTRAR NO PRESTÍGIO ${nt.roman} (${nt.name}) • +${nt.level * 50}% $/s`;
    }
  }

  // 3. Render 10-Emblem Prestige Gallery
  const galleryGrid = document.getElementById('prestige-emblems-grid');
  if (galleryGrid) {
    galleryGrid.innerHTML = PRESTIGE_TIERS.map((pt) => {
      const isUnlocked = status.currentP >= pt.level;
      const isCurrent = status.currentP === pt.level;
      return `
        <div class="prestige-card ${isCurrent ? 'current' : isUnlocked ? 'unlocked' : 'locked'}">
          <div class="prestige-card-emblem">${getPrestigeEmblemSVG(pt.level, 55)}</div>
          <span class="pill-badge" style="background-color: ${isUnlocked ? 'var(--primary)' : 'var(--canvas)'};">
            Prestígio ${pt.roman}
          </span>
          <strong style="font-size: 14px; color: var(--ink);">${pt.name}</strong>
          <span style="font-size: 11px; color: var(--muted);">
            Req: Nv.55 • ${pt.reqSkins} Skins • ${pt.reqPlatinums} Plat.
          </span>
          <span style="font-size: 11px; color: var(--primary); font-weight: 800;">
            +${pt.level * 50}% $/s • -${pt.level}% Caixas • 🔒 ${pt.level} Herança
          </span>
        </div>
      `;
    }).join('');
  }

  // 4. Render Account Stats & Achievements
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card"><span>Caixas Abertas</span><strong>${state.stats.casesOpened}</strong></div>
    <div class="stat-card"><span>Total Gasto</span><strong>${formatMoney(state.stats.totalSpent)}</strong></div>
    <div class="stat-card"><span>Total Obtido em Vendas</span><strong>${formatMoney(state.stats.totalEarned)}</strong></div>
    <div class="stat-card"><span>★ Apex Míticos Desbloqueados</span><strong>${state.stats.goldsUnboxed}</strong></div>
    <div class="stat-card"><span>Contratos Forjados</span><strong>${state.stats.tradeUpsDone || 0}</strong></div>
    <div class="stat-card"><span>Melhor Drop Único</span><strong>${formatMoney(state.stats.bestDropValue)}</strong></div>
    <div class="stat-card"><span>Bônus de Conquistas</span><strong style="color:var(--primary)">+${achBonusPct}% $/s</strong></div>
    <div class="stat-card"><span>Bônus de Prestígio</span><strong style="color:var(--secondary)">+${perks.passiveBonusPct}% $/s</strong></div>
  `;

  const achGrid = document.getElementById('achievements-grid');
  if (achGrid) {
    achGrid.innerHTML = achList
      .map(
        (a) => `
      <div class="stat-card" style="border-color: ${a.unlocked ? 'var(--primary)' : 'var(--hairline)'}; opacity: ${a.unlocked ? '1' : '0.6'};">
        <span style="color: ${a.unlocked ? 'var(--primary)' : 'var(--muted)'}; font-weight:800;">
          ${a.unlocked ? '✓ DESBLOQUEADA' : '🔒 BLOQUEADA'} • +${a.bonusPct}% $/s
        </span>
        <strong style="font-size:16px; margin-top:4px;">${a.title}</strong>
        <span style="font-size:12px; margin-top:4px;">${a.desc}</span>
      </div>
    `
      )
      .join('');
  }
}

document.getElementById('prestige-btn')?.addEventListener('click', () => {
  const status = getNextPrestigeStatus();
  if (!status.canPrestige || !status.nextTier) return;

  const nt = status.nextTier;
  const nextPerks = getPrestigePerks(nt.level);
  const currentMaxHeirlooms = getPrestigePerks(status.currentP).maxHeirloomsForNextReset;

  // Keep locked Heirloom skins (or auto-pick top valuable skins if player forgot to lock)
  let heirloomItems = state.inventory.filter((i) => isHeirloom(i.uid));
  if (heirloomItems.length === 0 && state.inventory.length > 0) {
    const sortedBest = [...state.inventory].sort((a, b) => b.price - a.price);
    heirloomItems = sortedBest.slice(0, currentMaxHeirlooms);
  } else {
    heirloomItems = heirloomItems.slice(0, currentMaxHeirlooms);
  }

  const heirloomNames = heirloomItems.map((h) => `• ${h.name} (${formatMoney(h.price)})`).join('\n');

  if (
    confirm(
      `🎖️ ATIVAR PRESTÍGIO ${nt.roman} — ${nt.name.toUpperCase()}?\n\n` +
        `BÔNUS PERMANENTES DESBLOQUEADOS:\n` +
        `• +${nextPerks.passiveBonusPct}% de Renda Passiva ($/s) Global\n` +
        `• -${nextPerks.caseDiscountPct}% de Desconto em todas as Caixas\n` +
        `• +${nextPerks.syncTrackBonusPct}% de Chance SyncTrack™\n` +
        `• Saldo Inicial de Veterano: ${formatMoney(nextPerks.startingBalance)}\n\n` +
        `SKINS PROTEGIDAS POR HERANÇA PERMANENTE (${heirloomItems.length}/${currentMaxHeirlooms}):\n` +
        `${heirloomNames || '• Nenhuma'}\n\n` +
        `Sua Patente Militar voltará ao Nível 1 e as demais skins serão convertidas na sua nova Insígnia de Prestígio.`
    )
  ) {
    state.prestigeLevel = nt.level;
    state.xp = 0;
    state.balance = nextPerks.startingBalance;
    state.inventory = heirloomItems;
    state.heirloomUids = heirloomItems.map((i) => i.uid);
    tradeUpSelection = [];
    lastRenderedRankKey = '';
    sfx.unboxReveal('gold');
    saveState();
    populateCatalogDropdown();
    updateTopBar();
    renderCaseSelector();
    renderActiveCaseArena();
    renderInventory();
    renderTradeUp();
    renderStats();
    publishMyScoreToCloud(true);
  }
});

// =====================================================
// GLOBAL LEADERBOARD ENGINE (CLOUD REAL-TIME SYNC)
// =====================================================
const LB_TOPIC = 'neondrop_lb_v3_noskan';
const LB_CACHE_KEY = 'neondrop_lb_cache_v3';
let lbSortBy = 'prestige'; // 'prestige' | 'networth' | 'collection' | 'bestdrop'
let lastCloudPublishAt = 0;
let lbPlayersMap = loadLeaderboardCache();

function loadLeaderboardCache() {
  try {
    const raw = localStorage.getItem(LB_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        delete parsed.test_init;
        return parsed;
      }
    }
  } catch (e) {
    // ignore cache error
  }
  return {};
}

function saveLeaderboardCache() {
  try {
    localStorage.setItem(LB_CACHE_KEY, JSON.stringify(lbPlayersMap));
  } catch (e) {
    // ignore quota error
  }
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch] || ch;
  });
}

function buildMyLeaderboardEntry() {
  const { ratePerSec, uniqueSkinsCount } = computePassiveIncome();
  const ownedSet = getOwnedKeySet();
  let platinumCases = 0;
  ALL_CASES.forEach((c) => {
    if (getCaseMasteryStatus(c, ownedSet).stage === 2) platinumCases++;
  });
  const invTotal = state.inventory.reduce((acc, i) => acc + (i.price || 0), 0);
  const netWorth = Number((state.balance + invTotal).toFixed(2));
  const mil = getMilitaryLevelInfo();
  const cleanCallsign =
    (state.callsign || '').trim().slice(0, 18) ||
    'Operador-' + String(state.playerId || '0000').slice(-4).toUpperCase();

  return {
    playerId: state.playerId,
    callsign: cleanCallsign,
    prestigeLevel: state.prestigeLevel || 0,
    milLevel: mil.level,
    xp: state.xp || 0,
    netWorth,
    passiveRate: ratePerSec,
    uniqueSkins: uniqueSkinsCount,
    platinumCases,
    bestGridshotScore: state.stats.bestGridshotScore || 0,
    bestDropValue: state.stats.bestDropValue || 0,
    goldsUnboxed: state.stats.goldsUnboxed || 0,
    casesOpened: state.stats.casesOpened || 0,
    updatedAt: Date.now(),
  };
}

function mergeLeaderboardEntry(entry) {
  if (!entry || !entry.playerId || entry.playerId === 'test_init') return;
  const prev = lbPlayersMap[entry.playerId];
  if (!prev || (entry.updatedAt || 0) >= (prev.updatedAt || 0)) {
    lbPlayersMap[entry.playerId] = {
      playerId: String(entry.playerId),
      callsign: String(entry.callsign || 'Operador').slice(0, 18),
      prestigeLevel: Number(entry.prestigeLevel) || 0,
      milLevel: Math.min(55, Math.max(1, Number(entry.milLevel) || 1)),
      xp: Number(entry.xp) || 0,
      netWorth: Number(entry.netWorth) || 0,
      passiveRate: Number(entry.passiveRate) || 0.15,
      uniqueSkins: Number(entry.uniqueSkins) || 0,
      platinumCases: Number(entry.platinumCases) || 0,
      bestGridshotScore: Math.max(Number(prev?.bestGridshotScore) || 0, Number(entry.bestGridshotScore) || 0),
      bestDropValue: Number(entry.bestDropValue) || 0,
      goldsUnboxed: Number(entry.goldsUnboxed) || 0,
      casesOpened: Number(entry.casesOpened) || 0,
      updatedAt: Number(entry.updatedAt) || Date.now(),
    };
  }
}

async function fetchGlobalLeaderboard() {
  const statusEl = document.getElementById('lb-sync-status');
  if (statusEl) statusEl.textContent = '🔄 Sincronizando placar global...';

  try {
    const res = await fetch(`https://ntfy.sh/${LB_TOPIC}/json?poll=1&since=all`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      lines.forEach((line) => {
        try {
          const envelope = JSON.parse(line);
          if (envelope && envelope.event === 'message' && envelope.message) {
            const payload = JSON.parse(envelope.message);
            mergeLeaderboardEntry(payload);
          }
        } catch (err) {
          // ignore malformed line
        }
      });
      saveLeaderboardCache();
      if (statusEl) {
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        statusEl.textContent = `🟢 Placar Online • Atualizado às ${timeStr}`;
      }
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '🟡 Modo Cache Local (Offline)';
  }

  renderLeaderboard();
}

async function publishMyScoreToCloud(force = false) {
  const now = Date.now();
  const myEntry = buildMyLeaderboardEntry();
  mergeLeaderboardEntry(myEntry);
  saveLeaderboardCache();

  // Only auto-publish if player has set a Callsign or opened at least 1 case, and throttle unless forced
  if (!force && now - lastCloudPublishAt < 25000) return;
  if (!force && !state.callsign && (state.stats.casesOpened || 0) < 1) return;

  lastCloudPublishAt = now;
  const statusEl = document.getElementById('lb-sync-status');
  if (force && statusEl) statusEl.textContent = '📡 Enviando dados para o placar...';

  try {
    await fetch(`https://ntfy.sh/${LB_TOPIC}`, {
      method: 'POST',
      body: JSON.stringify(myEntry),
    });
    if (statusEl) {
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.textContent = `🟢 Sincronizado como "${myEntry.callsign}" (${timeStr})`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '🟡 Salvo localmente';
  }

  renderLeaderboard();
}

function initLeaderboardLiveStream() {
  try {
    const es = new EventSource(`https://ntfy.sh/${LB_TOPIC}/sse`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data && data.message) {
          const payload = JSON.parse(data.message);
          mergeLeaderboardEntry(payload);
          saveLeaderboardCache();
          if (document.getElementById('tab-leaderboard')?.classList.contains('active')) {
            renderLeaderboard();
          }
        }
      } catch (e) {
        // ignore parse error
      }
    };
  } catch (e) {
    // EventSource optional
  }
}

function getSortedLeaderboardEntries() {
  // Always ensure current player's live stats are up-to-date in the map
  const myEntry = buildMyLeaderboardEntry();
  mergeLeaderboardEntry(myEntry);

  const list = Object.values(lbPlayersMap).filter((p) => p && p.playerId !== 'test_init');

  list.sort((a, b) => {
    if (lbSortBy === 'networth') {
      return b.netWorth - a.netWorth || b.prestigeLevel - a.prestigeLevel;
    }
    if (lbSortBy === 'collection') {
      return (
        b.platinumCases - a.platinumCases ||
        b.uniqueSkins - a.uniqueSkins ||
        b.netWorth - a.netWorth
      );
    }
    if (lbSortBy === 'aimlab') {
      return (b.bestGridshotScore || 0) - (a.bestGridshotScore || 0) || b.netWorth - a.netWorth;
    }
    if (lbSortBy === 'bestdrop') {
      return b.bestDropValue - a.bestDropValue || b.netWorth - a.netWorth;
    }
    // Default: 'prestige'
    return (
      b.prestigeLevel - a.prestigeLevel ||
      b.milLevel - a.milLevel ||
      b.netWorth - a.netWorth
    );
  });

  return list;
}

function formatRankLabelForEntry(p) {
  const pInfo = PRESTIGE_TIERS.find((t) => t.level === p.prestigeLevel);
  if (pInfo) {
    return `Prestígio ${pInfo.roman} (${pInfo.name}) • Nv. ${p.milLevel}`;
  }
  return `Nv. ${p.milLevel} • ${getMilitaryRankTitle(p.milLevel)}`;
}

function renderLeaderboard() {
  const callsignInput = document.getElementById('lb-callsign-input');
  if (callsignInput && document.activeElement !== callsignInput) {
    callsignInput.value = state.callsign || '';
  }

  const entries = getSortedLeaderboardEntries();
  const podiumGrid = document.getElementById('lb-podium-grid');
  const tbody = document.getElementById('lb-table-body');
  if (!podiumGrid || !tbody) return;

  // Render Top 3 Podium
  const top3 = entries.slice(0, 3);
  const medals = ['🥇 #1 LÍDER GLOBAL', '🥈 #2 VICE-LÍDER', '🥉 #3 TOP 3'];
  podiumGrid.innerHTML = top3
    .map((p, idx) => {
      const isMe = p.playerId === state.playerId;
      return `
        <div class="lb-podium-card rank-${idx + 1} ${isMe ? 'is-me' : ''}">
          <span class="lb-podium-medal">${medals[idx]}</span>
          <div class="lb-podium-emblem">${getPrestigeEmblemSVG(p.prestigeLevel, p.milLevel)}</div>
          <strong style="font-size: 16px; color: var(--ink);">
            ${escapeHTML(p.callsign)} ${isMe ? '<span class="pill-badge" style="margin-left:4px;">VOCÊ</span>' : ''}
          </strong>
          <span style="font-size: 12px; color: var(--secondary); font-weight: 800;">
            ${formatRankLabelForEntry(p)}
          </span>
          <div style="font-size: 18px; font-weight: 800; color: var(--primary); margin-top: 4px;">
            ${formatMoney(p.netWorth)}
          </div>
          <span style="font-size: 11px; color: var(--muted);">
            🎯 ${p.bestGridshotScore || 0} pts • 🎒 ${p.uniqueSkins}/252 • 🏆 ${p.platinumCases}/18 Plat.
          </span>
        </div>
      `;
    })
    .join('');

  // Render Full Table
  tbody.innerHTML = entries
    .map((p, idx) => {
      const isMe = p.playerId === state.playerId;
      return `
        <tr class="${isMe ? 'is-me-row' : ''}">
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <div class="lb-op-cell">
              <div class="lb-mini-emblem">${getPrestigeEmblemSVG(p.prestigeLevel, p.milLevel)}</div>
              <div>
                <strong>${escapeHTML(p.callsign)}</strong>
                ${isMe ? '<span class="pill-badge" style="margin-left:6px;">VOCÊ</span>' : ''}
                <div style="font-size: 11px; color: var(--muted);">${p.casesOpened} caixas • ${p.goldsUnboxed} ★ Apex</div>
              </div>
            </div>
          </td>
          <td>
            <span style="color: ${p.prestigeLevel > 0 ? 'var(--secondary)' : 'var(--ink)'}; font-weight: 800;">
              ${formatRankLabelForEntry(p)}
            </span>
          </td>
          <td style="color: var(--primary); font-weight: 800;">${formatMoney(p.netWorth)}</td>
          <td>+${formatMoney(p.passiveRate)}/s</td>
          <td>
            <strong>${p.uniqueSkins} / 252</strong>
            <span style="color: var(--muted); font-size: 11px; margin-left: 4px;">(🏆 ${p.platinumCases}/18)</span>
          </td>
          <td style="color: var(--secondary); font-weight: 800;">🎯 ${(p.bestGridshotScore || 0).toLocaleString('en-US')} pts</td>
          <td style="color: #ffd700; font-weight: 800;">${formatMoney(p.bestDropValue)}</td>
        </tr>
      `;
    })
    .join('');
}

document.getElementById('lb-sync-btn')?.addEventListener('click', () => {
  const input = document.getElementById('lb-callsign-input');
  if (input) {
    state.callsign = input.value.trim().slice(0, 18);
    saveState();
  }
  sfx.coin();
  publishMyScoreToCloud(true);
});

document.getElementById('lb-refresh-btn')?.addEventListener('click', () => {
  fetchGlobalLeaderboard();
});

document.querySelectorAll('#lb-sort-group .col-filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#lb-sort-group .col-filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    lbSortBy = btn.getAttribute('data-lbsort') || 'prestige';
    renderLeaderboard();
  });
});

// =====================================================
// 2D TACTICAL AIM LAB ENGINE (GRIDSHOT 30s ONLY — ANTI-INFLATION)
// =====================================================
const AIM_RARITY_MULTS = {
  blue: 1.10,
  purple: 1.25,
  pink: 1.45,
  red: 1.75,
  gold: 2.20,
};

let aimStreak = 0;
let aimSessionHits = 0;
let aimSessionShots = 0;
let gridshotActive = false;
let gridshotScore = 0;
let gridshotTimeLeft = 30;
let gridshotTimerId = null;
let gridshotCooldownUntil = 0;
let gridshotCooldownIntervalId = null;

function getEquippedWeaponItem() {
  if (!state.inventory.length) return null;
  if (state.equippedUid) {
    const found = state.inventory.find((i) => i.uid === state.equippedUid);
    if (found) return found;
  }
  const best = [...state.inventory].sort((a, b) => b.price - a.price)[0];
  if (best) {
    state.equippedUid = best.uid;
  }
  return best || null;
}

function getAimWeaponMultiplierInfo() {
  const item = getEquippedWeaponItem();
  if (!item) {
    return {
      item: null,
      rarityMult: 1.0,
      syncMult: 1.0,
      totalWeaponMult: 1.0,
    };
  }
  const rarityMult = AIM_RARITY_MULTS[item.rarity] || 1.1;
  const syncMult = item.statTrak ? 1.15 : 1.0;
  const totalWeaponMult = Number((rarityMult * syncMult).toFixed(2));
  return {
    item,
    rarityMult,
    syncMult,
    totalWeaponMult,
  };
}

function getAimComboMultiplier() {
  return Math.min(2.0, Number((1 + Math.floor(aimStreak / 3) * 0.1).toFixed(2)));
}

function getGridshotRankAndReward(score = gridshotScore) {
  const { ratePerSec } = computePassiveIncome();
  const { totalWeaponMult } = getAimWeaponMultiplierInfo();
  let rank = 'C';
  let secondsEquiv = 0;
  let minFloor = 0;

  if (score >= 6000) {
    rank = 'S ★';
    secondsEquiv = 22;
    minFloor = 35;
  } else if (score >= 4000) {
    rank = 'A';
    secondsEquiv = 15;
    minFloor = 25;
  } else if (score >= 2000) {
    rank = 'B';
    secondsEquiv = 9;
    minFloor = 15;
  } else if (score > 0) {
    rank = 'C';
    secondsEquiv = 4 * (score / 2000);
    minFloor = Number((5 * (score / 2000)).toFixed(2));
  }

  const reward =
    score > 0
      ? Number((Math.max(minFloor, ratePerSec * secondsEquiv) * totalWeaponMult).toFixed(2))
      : 0;
  return { rank, reward };
}

function renderAimLabLoadout() {
  const { item, totalWeaponMult } = getAimWeaponMultiplierInfo();
  const thumbEl = document.getElementById('aimlab-weapon-art');
  const hudGunEl = document.getElementById('aimlab-hud-gun');
  const multBadge = document.getElementById('aimlab-mult-badge');
  const syncPill = document.getElementById('aimlab-synctrack-pill');
  const nameEl = document.getElementById('aimlab-weapon-name');
  const subEl = document.getElementById('aimlab-weapon-sub');
  const selectEl = document.getElementById('aimlab-weapon-select');

  const fallbackGun = {
    shape: 'carbine_s',
    rarity: 'blue',
    c1: '#0075ff',
    c2: '#2e3035',
    pattern: 'carbon',
    float: 0.04,
    statTrak: false,
  };

  const svgArt = getTacticalWeaponSVG(item || fallbackGun);
  if (thumbEl) thumbEl.innerHTML = svgArt;
  if (hudGunEl) hudGunEl.innerHTML = svgArt;

  if (multBadge) {
    multBadge.textContent = `${totalWeaponMult.toFixed(2)}x BÔNUS DE ARMA`;
  }

  if (item) {
    if (nameEl) nameEl.textContent = `${item.name} (${item.wearShort})`;
    if (subEl) {
      const rName = RARITIES[item.rarity]?.name || 'Padrão';
      subEl.textContent = `Raridade ${rName} • Valor: ${formatMoney(item.price)}${item.statTrak ? ' • SyncTrack™ +15% Bônus de Rodada!' : ''}`;
    }
    if (syncPill) {
      if (item.statTrak) {
        syncPill.style.display = 'inline-flex';
        syncPill.textContent = `🔥 SyncTrack™: ${item.kills || 0} alvos`;
      } else {
        syncPill.style.display = 'none';
      }
    }
  } else {
    if (nameEl) nameEl.textContent = 'Carabina Tática de Treino (Padrão)';
    if (subEl) subEl.textContent = 'Abra caixas e guarde uma skin no inventário para multiplicar a recompensa do Gridshot!';
    if (syncPill) syncPill.style.display = 'none';
  }

  if (selectEl) {
    if (!state.inventory.length) {
      selectEl.innerHTML = `<option value="">Carabina Padrão (1.00x)</option>`;
    } else {
      const sortedInv = [...state.inventory].sort((a, b) => {
        const mA = (AIM_RARITY_MULTS[a.rarity] || 1.1) * (a.statTrak ? 1.15 : 1);
        const mB = (AIM_RARITY_MULTS[b.rarity] || 1.1) * (b.statTrak ? 1.15 : 1);
        return mB - mA || b.price - a.price;
      });
      selectEl.innerHTML = sortedInv
        .map((inv) => {
          const wMult = ((AIM_RARITY_MULTS[inv.rarity] || 1.1) * (inv.statTrak ? 1.15 : 1)).toFixed(2);
          return `<option value="${inv.uid}" ${inv.uid === item?.uid ? 'selected' : ''}>[${wMult}x] ${inv.name} ${inv.statTrak ? '🔥Sync™' : ''} (${formatMoney(inv.price)})</option>`;
        })
        .join('');
    }
  }

  updateAimLabHUD();
}

function updateAimLabHUD() {
  const comboEl = document.getElementById('aimlab-combo-text');
  const payoutEl = document.getElementById('aimlab-payout-text');
  const accEl = document.getElementById('aimlab-accuracy-text');
  const modeLabelEl = document.getElementById('aimlab-mode-label');
  const scoreEl = document.getElementById('aimlab-score-text');

  const comboMult = getAimComboMultiplier();
  if (comboEl) {
    comboEl.textContent = `${comboMult.toFixed(2)}x (${aimStreak} seguidos)`;
  }

  const { rank, reward } = getGridshotRankAndReward(gridshotScore);
  if (payoutEl) {
    payoutEl.textContent = gridshotActive
      ? `Rank ${rank} • +${formatMoney(reward)}`
      : `Rank S = +${formatMoney(getGridshotRankAndReward(6500).reward)}`;
  }

  const accPct = aimSessionShots > 0 ? Math.round((aimSessionHits / aimSessionShots) * 100) : 100;
  if (accEl) {
    accEl.textContent = `${accPct}% (${aimSessionHits} alvos)`;
  }

  if (modeLabelEl) {
    modeLabelEl.textContent = gridshotActive
      ? `⏱️ TEMPO RESTANTE: ${gridshotTimeLeft}s`
      : '🏆 RECORDE GRIDSHOT 30s';
  }
  if (scoreEl) {
    scoreEl.textContent = gridshotActive
      ? `${gridshotScore.toLocaleString('en-US')} pts`
      : `${(state.stats.bestGridshotScore || 0).toLocaleString('en-US')} pts`;
  }
}

function triggerHudGunRecoil() {
  const gunEl = document.getElementById('aimlab-hud-gun');
  if (!gunEl) return;
  gunEl.classList.add('recoil');
  setTimeout(() => gunEl.classList.remove('recoil'), 75);
}

function spawnFloatingHitText(x, y, text, type = 'normal') {
  const stage = document.getElementById('aimlab-stage');
  if (!stage) return;
  const floatEl = document.createElement('div');
  floatEl.className = `aimlab-hit-float ${type}`;
  floatEl.style.left = `${x}px`;
  floatEl.style.top = `${y}px`;
  floatEl.textContent = text;
  stage.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 650);
}

function spawnSingleAimTarget() {
  if (!gridshotActive) return;
  const layer = document.getElementById('aimlab-targets-layer');
  const stage = document.getElementById('aimlab-stage');
  if (!layer || !stage) return;

  const rect = stage.getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 500;

  const size = 66;
  const padX = 70;
  const padY = 65;

  let x = width / 2;
  let y = height / 2;
  const existing = Array.from(layer.querySelectorAll('.aimlab-target'));

  for (let attempt = 0; attempt < 8; attempt++) {
    const candX = Math.floor(padX + Math.random() * Math.max(120, width - padX * 2));
    const candY = Math.floor(padY + Math.random() * Math.max(120, height - padY * 2 - 40));
    const tooClose = existing.some((el) => {
      const ex = parseFloat(el.dataset.x || '0');
      const ey = parseFloat(el.dataset.y || '0');
      return Math.hypot(candX - ex, candY - ey) < size * 1.15;
    });
    x = candX;
    y = candY;
    if (!tooClose) break;
  }

  const target = document.createElement('div');
  target.className = 'aimlab-target';
  target.style.width = `${size}px`;
  target.style.height = `${size}px`;
  target.style.left = `${x}px`;
  target.style.top = `${y}px`;
  target.dataset.x = String(x);
  target.dataset.y = String(y);

  const bullseye = document.createElement('div');
  bullseye.className = 'aimlab-bullseye';
  target.appendChild(bullseye);

  // Target expires after 1.35s if not clicked, resetting combo!
  const expireTimer = setTimeout(() => {
    if (!target.isConnected) return;
    target.remove();
    if (gridshotActive) {
      aimStreak = 0;
      spawnFloatingHitText(x, y, '⏱️ EXPIROU (Combo 1.0x)', 'miss');
      updateAimLabHUD();
      ensureAimTargetsCount(3);
    }
  }, 1350);

  target.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    clearTimeout(expireTimer);
    const isCrit = e.target === bullseye;
    handleAimTargetHit(target, x, y, isCrit);
  });

  layer.appendChild(target);
}

function ensureAimTargetsCount(count = 3) {
  const layer = document.getElementById('aimlab-targets-layer');
  if (!layer) return;
  if (!gridshotActive) {
    layer.innerHTML = '';
    return;
  }
  while (layer.querySelectorAll('.aimlab-target').length < count) {
    spawnSingleAimTarget();
  }
}

function handleAimTargetHit(targetEl, x, y, isCrit) {
  if (!gridshotActive) return;

  targetEl.remove();
  triggerHudGunRecoil();

  aimStreak++;
  aimSessionHits++;
  aimSessionShots++;
  state.stats.targetsHit = (state.stats.targetsHit || 0) + 1;

  const xpGain = isCrit ? 4 : 2;
  addTacticalXP(xpGain);

  // Increment real SyncTrack™ kill counter on the equipped weapon!
  const equipped = getEquippedWeaponItem();
  if (equipped && equipped.statTrak) {
    equipped.kills = (equipped.kills || 0) + 1;
    const syncPill = document.getElementById('aimlab-synctrack-pill');
    if (syncPill) syncPill.textContent = `🔥 SyncTrack™: ${equipped.kills} alvos`;
    const svgArt = getTacticalWeaponSVG(equipped);
    const thumbEl = document.getElementById('aimlab-weapon-art');
    const hudGunEl = document.getElementById('aimlab-hud-gun');
    if (thumbEl) thumbEl.innerHTML = svgArt;
    if (hudGunEl) hudGunEl.innerHTML = svgArt;
  }

  const comboMult = getAimComboMultiplier();
  const pts = Math.round((isCrit ? 150 : 100) * comboMult);
  gridshotScore += pts;
  spawnFloatingHitText(
    x,
    y,
    `${isCrit ? '🎯 BULLSEYE! ' : ''}+${pts} pts (+${xpGain} XP)`,
    isCrit ? 'crit' : 'normal'
  );

  sfx.targetHit(isCrit);
  updateTopBar();
  updateAimLabHUD();
  ensureAimTargetsCount(3);
}

// Background click on stage = missed shot (resets combo streak & penalizes -50 pts)
document.getElementById('aimlab-stage')?.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.aimlab-banner-overlay') || e.target.closest('.aimlab-target')) return;
  if (!gridshotActive) return;

  triggerHudGunRecoil();
  aimStreak = 0;
  aimSessionShots++;
  gridshotScore = Math.max(0, gridshotScore - 50);
  const rect = e.currentTarget.getBoundingClientRect();
  spawnFloatingHitText(e.clientX - rect.left, e.clientY - rect.top, '✕ ERROU (-50 pts • Combo 1.0x)', 'miss');
  sfx.targetMiss();
  updateAimLabHUD();
});

function updateCooldownButtonsUI() {
  const remSec = Math.ceil((gridshotCooldownUntil - Date.now()) / 1000);
  const startBtn = document.getElementById('aimlab-start-gridshot-btn');
  const bannerBtn = document.getElementById('aimlab-banner-btn');

  if (remSec > 0) {
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = `⏳ RECARREGANDO (${remSec}s)`;
    }
    if (bannerBtn) {
      bannerBtn.disabled = true;
      bannerBtn.textContent = `⏳ RECARREGANDO ESTANDE (${remSec}s)`;
    }
  } else {
    if (gridshotCooldownIntervalId) {
      clearInterval(gridshotCooldownIntervalId);
      gridshotCooldownIntervalId = null;
    }
    if (startBtn) {
      startBtn.disabled = gridshotActive;
      startBtn.textContent = '⚡ INICIAR GRIDSHOT (30s)';
    }
    if (bannerBtn) {
      bannerBtn.disabled = false;
      bannerBtn.textContent = '⚡ JOGAR GRIDSHOT (30s)';
    }
  }
}

function startGridshotChallenge() {
  if (gridshotActive) return;
  if (Date.now() < gridshotCooldownUntil) return;

  gridshotActive = true;
  gridshotScore = 0;
  gridshotTimeLeft = 30;
  aimStreak = 0;
  aimSessionHits = 0;
  aimSessionShots = 0;

  const startBtn = document.getElementById('aimlab-start-gridshot-btn');
  if (startBtn) startBtn.disabled = true;

  const banner = document.getElementById('aimlab-banner-overlay');
  if (banner) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
  }

  const layer = document.getElementById('aimlab-targets-layer');
  if (layer) layer.innerHTML = '';

  updateAimLabHUD();
  ensureAimTargetsCount(3);

  if (gridshotTimerId) clearInterval(gridshotTimerId);
  gridshotTimerId = setInterval(() => {
    gridshotTimeLeft--;
    updateAimLabHUD();
    if (gridshotTimeLeft <= 0) {
      endGridshotChallenge();
    }
  }, 1000);
}

function endGridshotChallenge() {
  if (gridshotTimerId) {
    clearInterval(gridshotTimerId);
    gridshotTimerId = null;
  }
  gridshotActive = false;
  const layer = document.getElementById('aimlab-targets-layer');
  if (layer) layer.innerHTML = '';

  const isNewRecord = gridshotScore > (state.stats.bestGridshotScore || 0);
  if (isNewRecord) {
    state.stats.bestGridshotScore = gridshotScore;
  }

  const { rank, reward } = getGridshotRankAndReward(gridshotScore);
  if (reward > 0) {
    state.balance = Number((state.balance + reward).toFixed(2));
    state.stats.totalEarned = Number((state.stats.totalEarned + reward).toFixed(2));
    sfx.coin();
  }

  // 15-second cooldown between rounds to prevent macro farming
  gridshotCooldownUntil = Date.now() + 15000;
  if (gridshotCooldownIntervalId) clearInterval(gridshotCooldownIntervalId);
  gridshotCooldownIntervalId = setInterval(updateCooldownButtonsUI, 500);
  updateCooldownButtonsUI();

  saveState();
  updateTopBar();
  updateAimLabHUD();
  publishMyScoreToCloud(true);

  const accPct = aimSessionShots > 0 ? Math.round((aimSessionHits / aimSessionShots) * 100) : 100;
  const banner = document.getElementById('aimlab-banner-overlay');
  const titleEl = document.getElementById('aimlab-banner-title');
  const descEl = document.getElementById('aimlab-banner-desc');

  if (titleEl) {
    titleEl.textContent = isNewRecord
      ? `🏆 NOVO RECORDE (RANK ${rank}): ${gridshotScore.toLocaleString('en-US')} PTS!`
      : `⚡ FIM DO GRIDSHOT (RANK ${rank}): ${gridshotScore.toLocaleString('en-US')} PTS`;
  }
  if (descEl) {
    descEl.textContent = `Alvos Abatidos: ${aimSessionHits} • Precisão: ${accPct}% • Pagamento da Rodada: +${formatMoney(reward)} (Sincronizado no Ranking Global!)`;
  }
  if (banner) {
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }
}

document.getElementById('aimlab-weapon-select')?.addEventListener('change', (e) => {
  state.equippedUid = e.target.value || null;
  saveState();
  renderAimLabLoadout();
});

document.getElementById('aimlab-start-gridshot-btn')?.addEventListener('click', startGridshotChallenge);
document.getElementById('aimlab-banner-btn')?.addEventListener('click', startGridshotChallenge);

// Multi-Open Count Selector (1x, 2x, 3x, 5x)
document.querySelectorAll('.multi-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isSpinning) return;
    document.querySelectorAll('.multi-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    multiCount = Number(btn.getAttribute('data-count'));
    updateOpenButtonLabel();
    buildRouletteLanes();
  });
});

// Idle Passive Income Loop (runs every 250ms = 4 ticks/sec)
let idleTickCounter = 0;
setInterval(() => {
  const { ratePerSec } = computePassiveIncome();
  if (ratePerSec > 0) {
    state.balance = Number((state.balance + ratePerSec * 0.25).toFixed(2));
  }

  updateTopBar();

  // Persist to localStorage every 3 seconds
  idleTickCounter++;
  if (idleTickCounter % 12 === 0) {
    saveState();
  }
}, 250);

document.getElementById('sound-toggle').addEventListener('click', (e) => {
  sfx.enabled = !sfx.enabled;
  e.currentTarget.textContent = sfx.enabled ? '🔊' : '🔇';
});

document.getElementById('open-case-btn').addEventListener('click', spinRoulette);

document.getElementById('reset-save-btn').addEventListener('click', () => {
  if (confirm('Tem certeza que deseja resetar todo o seu saldo e inventário?')) {
    state = structuredClone(defaultState);
    tradeUpSelection = [];
    saveState();
    updateTopBar();
    renderInventory();
    renderTradeUp();
    renderStats();
  }
});

// Tab Switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'aimlab') {
      renderAimLabLoadout();
      setTimeout(() => ensureAimTargetsCount(3), 30);
    }
    if (tabId === 'inventory') {
      populateCatalogDropdown();
      renderInventory();
    }
    if (tabId === 'tradeup') renderTradeUp();
    if (tabId === 'stats') renderStats();
    if (tabId === 'leaderboard') {
      renderLeaderboard();
      fetchGlobalLeaderboard();
    }
  });
});

// Initialize 100% Original Tactical Arsenal & Migrate Legacy Saves
migrateAndRebalanceInventory();
populateCatalogDropdown();
updateTopBar();
renderCaseSelector();
renderActiveCaseArena();
renderInventory();
renderAimLabLoadout();
checkOfflineEarnings();
fetchGlobalLeaderboard();
initLeaderboardLiveStream();
