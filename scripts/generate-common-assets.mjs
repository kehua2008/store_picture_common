import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const out = async (file, svg, width, height) => {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(file);
};

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7fbff"/>
      <stop offset=".42" stop-color="#dfeeff"/>
      <stop offset="1" stop-color="#8dbbf2"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".72"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".88"/>
      <stop offset=".58" stop-color="#e9f7ff" stop-opacity=".48"/>
      <stop offset="1" stop-color="#b8dbff" stop-opacity=".26"/>
    </linearGradient>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".45" stop-color="#bfe4ff"/>
      <stop offset="1" stop-color="#1979dc"/>
    </linearGradient>
    <linearGradient id="aqua" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eaffff"/>
      <stop offset=".52" stop-color="#61cdf0"/>
      <stop offset="1" stop-color="#117ed7"/>
    </linearGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7e6"/>
      <stop offset=".58" stop-color="#ffc46a"/>
      <stop offset="1" stop-color="#ff8a35"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#0b6fc5" flood-opacity=".16"/>
    </filter>
    <filter id="glow" x="-30%" y="-40%" width="160%" height="180%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;

const studio = (w, h) => `
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <path d="M0 ${h * .16} C ${w * .24} ${h * .05}, ${w * .34} ${h * .34}, ${w * .55} ${h * .18} S ${w * .84} ${h * .03}, ${w} ${h * .16}" fill="none" stroke="#fff" stroke-width="18" opacity=".62"/>
  <path d="M${w * .08} ${h * .05} V${h * .96}" stroke="#fff" stroke-width="8" opacity=".32"/>
  <path d="M${w * .15} ${h * .02} V${h * .9}" stroke="#ffffff" stroke-width="3" opacity=".38"/>
  <path d="M${w * .84} ${h * .02} V${h * .96}" stroke="#ffffff" stroke-width="8" opacity=".26"/>
  <path d="M0 ${h * .72} C ${w * .24} ${h * .66}, ${w * .38} ${h * .82}, ${w * .58} ${h * .72} S ${w * .82} ${h * .6}, ${w} ${h * .68} V${h} H0 Z" fill="url(#floor)"/>
  <ellipse cx="${w * .58}" cy="${h * .86}" rx="${w * .32}" ry="${h * .08}" fill="#ffffff" opacity=".32"/>
`;

const cup = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
    <ellipse cx="68" cy="216" rx="66" ry="18" fill="#2a77c8" opacity=".12"/>
    <path d="M24 36 h86 c11 0 19 9 17 20 l-19 145 c-1 11-11 19-22 19 H50 c-12 0-22-8-23-20 L8 56 C7 45 15 36 24 36Z" fill="url(#blue)" stroke="#fff" stroke-width="6"/>
    <path d="M19 72 h103" stroke="#ffffff" stroke-width="12" opacity=".66"/>
    <path d="M34 26 h66" stroke="#195fb0" stroke-width="12" stroke-linecap="round"/>
    <path d="M112 92 c35 1 44 58 5 69" fill="none" stroke="#f7fbff" stroke-width="14" stroke-linecap="round"/>
  </g>`;

const fan = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
    <ellipse cx="120" cy="230" rx="92" ry="18" fill="#286fbc" opacity=".1"/>
    <circle cx="120" cy="92" r="80" fill="url(#glass)" stroke="#fff" stroke-width="8"/>
    <circle cx="120" cy="92" r="26" fill="url(#aqua)" stroke="#fff" stroke-width="5"/>
    <path d="M120 66 c58-48 82 22 26 31 c-26 5-34-8-26-31Z" fill="#dff6ff" opacity=".92"/>
    <path d="M144 106 c70 6 30 69-15 35 c-20-15-10-31 15-35Z" fill="#c6eaff" opacity=".92"/>
    <path d="M94 111 c-43 58-78-10-25-32 c24-10 36 8 25 32Z" fill="#eefbff" opacity=".92"/>
    <path d="M116 170 h10 l16 50 H100 Z" fill="url(#blue)" stroke="#fff" stroke-width="4"/>
    <rect x="66" y="216" width="108" height="24" rx="12" fill="#ffffff" stroke="#cae6ff" stroke-width="4"/>
  </g>`;

const textile = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
    <ellipse cx="126" cy="190" rx="112" ry="18" fill="#1c6ab8" opacity=".1"/>
    <rect x="28" y="88" width="154" height="86" rx="22" fill="#eef8ff" stroke="#fff" stroke-width="8"/>
    <path d="M48 98 c34 32 76 32 114 0" fill="none" stroke="#bddfff" stroke-width="5"/>
    <path d="M42 134 h120" stroke="#c8e8ff" stroke-width="5"/>
    <rect x="88" y="44" width="138" height="92" rx="20" fill="#ffffff" stroke="#d5ebff" stroke-width="7"/>
    <path d="M102 66 h92 M102 88 h78 M102 110 h102" stroke="#b8dfff" stroke-width="6" stroke-linecap="round"/>
    <path d="M82 154 c58 14 110 10 158-13 v44 c-55 28-109 29-158 9 Z" fill="url(#blue)" opacity=".78"/>
  </g>`;

const storage = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
    <ellipse cx="114" cy="178" rx="86" ry="16" fill="#1c6ab8" opacity=".1"/>
    <path d="M24 58 h180 l-18 110 H42 Z" fill="url(#glass)" stroke="#fff" stroke-width="7"/>
    <path d="M42 42 h144 l22 34 H20 Z" fill="#ffffff" stroke="#cce7ff" stroke-width="6"/>
    <path d="M62 94 h104 M58 122 h112" stroke="#7fcaff" stroke-width="7" stroke-linecap="round" opacity=".86"/>
    <circle cx="58" cy="151" r="10" fill="#ffb85e"/>
    <circle cx="168" cy="151" r="10" fill="#0f7cff"/>
  </g>`;

const bottle = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
    <ellipse cx="68" cy="204" rx="56" ry="14" fill="#1c6ab8" opacity=".1"/>
    <rect x="46" y="28" width="44" height="28" rx="8" fill="#0f74d8"/>
    <path d="M40 56 h56 v24 c22 16 30 34 30 61 v46 c0 17-14 31-31 31 H41 c-17 0-31-14-31-31 v-46 c0-27 8-45 30-61Z" fill="url(#aqua)" stroke="#fff" stroke-width="7"/>
    <rect x="28" y="112" width="80" height="54" rx="14" fill="#ffffff" opacity=".78"/>
    <path d="M43 132 h50 M50 150 h34" stroke="#86cfff" stroke-width="6" stroke-linecap="round"/>
  </g>`;

const film = (x, y, w, h) => `
  <g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="26" fill="#ffffff" opacity=".34" stroke="#fff" stroke-width="4"/>
    <rect x="34" y="18" width="${w - 68}" height="${h - 58}" rx="18" fill="#d9efff" opacity=".7"/>
    <path d="M0 ${h - 34} H${w}" stroke="#ffffff" stroke-width="8" opacity=".72"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${28 + i * ((w - 76) / 7)}" y="${h - 24}" width="22" height="12" rx="3" fill="#7fcaff" opacity=".55"/>`).join("")}
    <circle cx="58" cy="${h - 34}" r="24" fill="#fff" opacity=".86"/>
    <path d="M51 ${h - 48} L51 ${h - 20} L73 ${h - 34} Z" fill="#1881df"/>
  </g>`;

const panel = (x, y, w, h, content = "") => `
  <g transform="translate(${x} ${y})" filter="url(#softShadow)">
    <rect width="${w}" height="${h}" rx="30" fill="url(#glass)" stroke="#fff" stroke-width="5"/>
    ${content}
  </g>`;

const lightTrails = (w, h) => `
  <g filter="url(#glow)" opacity=".82">
    <path d="M${w * .25} ${h * .58} C ${w * .38} ${h * .43}, ${w * .52} ${h * .76}, ${w * .71} ${h * .5} S ${w * .88} ${h * .42}, ${w * .98} ${h * .56}" fill="none" stroke="#75dfff" stroke-width="7"/>
    <path d="M${w * .28} ${h * .62} C ${w * .44} ${h * .48}, ${w * .54} ${h * .85}, ${w * .76} ${h * .58} S ${w * .9} ${h * .52}, ${w} ${h * .68}" fill="none" stroke="#ffd17a" stroke-width="5"/>
  </g>`;

function heroPoster() {
  const w = 1672;
  const h = 941;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}${studio(w, h)}
    <g opacity=".38">
      <rect x="116" y="118" width="240" height="620" rx="120" fill="#fff"/>
      <rect x="1320" y="74" width="220" height="716" rx="110" fill="#fff"/>
    </g>
    ${panel(1130, 130, 450, 470, `
      <rect x="32" y="34" width="190" height="168" rx="22" fill="#f8fdff"/>
      <rect x="244" y="34" width="166" height="168" rx="22" fill="#eff8ff"/>
      <rect x="32" y="224" width="378" height="198" rx="24" fill="#fff" opacity=".72"/>
      <path d="M260 258 h96 M260 286 h112 M260 314 h82" stroke="#b8cde2" stroke-width="10" stroke-linecap="round"/>
      <circle cx="270" cy="360" r="13" fill="#7bbdf7"/><circle cx="310" cy="360" r="13" fill="#b5d7ef"/><circle cx="350" cy="360" r="13" fill="#ffbd63"/>
    `)}
    ${film(1050, 664, 540, 148)}
    ${panel(94, 600, 170, 170, `<path d="M52 100 v-40 m0 0 L34 78 m18-18 18 18" stroke="#3978bd" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 112 h72" stroke="#3978bd" stroke-width="10" stroke-linecap="round"/>`)}
    <path d="M284 686 h104" stroke="#1681df" stroke-width="20" stroke-linecap="round"/><path d="M386 686 l34 26 v-52 Z" fill="#1681df"/>
    ${panel(438, 596, 170, 170, `<rect x="47" y="52" width="76" height="76" rx="16" fill="none" stroke="#56cfff" stroke-width="8"/><path d="M85 28 v132 M28 85 h114" stroke="#56cfff" stroke-width="5" opacity=".62"/>`)}
    <path d="M632 686 h104" stroke="#1681df" stroke-width="20" stroke-linecap="round"/><path d="M734 686 l34 26 v-52 Z" fill="#1681df"/>
    ${panel(794, 596, 180, 170, `<rect x="24" y="28" width="56" height="50" rx="9" fill="#fff"/><rect x="100" y="28" width="56" height="50" rx="9" fill="#e5f5ff"/><rect x="24" y="92" width="56" height="50" rx="9" fill="#e1f4ff"/><rect x="100" y="92" width="56" height="50" rx="9" fill="#fff"/>`)}
    <ellipse cx="840" cy="794" rx="250" ry="44" fill="#fff" opacity=".52"/>
    <ellipse cx="840" cy="758" rx="190" ry="34" fill="#ffffff" stroke="#b7dcff" stroke-width="8"/>
    ${textile(565, 395, 1.28)}
    ${cup(838, 390, 1.38)}
    ${fan(688, 265, 1.35)}
    ${bottle(1022, 480, 1.05)}
    ${storage(472, 550, .92)}
    ${lightTrails(w, h)}
  </svg>`;
}

function imageChoice() {
  const w = 1672;
  const h = 941;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}${studio(w, h)}
    <g opacity=".44"><path d="M0 160 C250 20 392 318 650 178 S1018 44 1226 156" stroke="#fff" stroke-width="22" fill="none"/><rect x="100" y="0" width="160" height="941" rx="80" fill="#fff"/></g>
    <ellipse cx="470" cy="760" rx="320" ry="70" fill="#fff" opacity=".48"/>
    <ellipse cx="470" cy="718" rx="250" ry="42" fill="#ffffff" stroke="#b6dcff" stroke-width="9"/>
    ${fan(300, 260, 1.55)}
    ${cup(540, 360, 1.42)}
    ${textile(120, 500, 1.1)}
    ${panel(770, 222, 258, 454, `${cup(72, 86, .82)}`)}
    ${panel(1066, 132, 312, 616, `${fan(48, 128, .96)}`)}
    ${panel(1410, 280, 210, 392, `<path d="M38 250 h132 M54 278 h92" stroke="#b8cde2" stroke-width="9" stroke-linecap="round"/>${bottle(58, 50, .72)}`)}
    <circle cx="980" cy="522" r="50" fill="#ffffff" opacity=".86" filter="url(#glow)"/>
    <text x="980" y="540" font-size="46" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" fill="#4d98e6">AI</text>
    ${lightTrails(w, h)}
  </svg>`;
}

function videoChoice() {
  const w = 1672;
  const h = 941;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}${studio(w, h)}
    ${panel(142, 172, 336, 650, `${cup(82, 138, 1.22)}<circle cx="168" cy="330" r="46" fill="#fff" opacity=".86"/><path d="M154 304 L154 356 L194 330 Z" fill="#1681df"/>`)}
    ${panel(726, 116, 812, 640, `${textile(446, 108, 1.16)}${fan(130, 90, 1.05)}${film(70, 480, 672, 104)}`)}
    <g filter="url(#glow)">
      <path d="M486 468 C560 414 620 408 704 448" stroke="#ffffff" stroke-width="9" fill="none"/>
      <path d="M520 468 h136" stroke="#58cfff" stroke-width="11" stroke-linecap="round"/>
      <path d="M656 468 l42 30 v-60 Z" fill="#1681df"/>
    </g>
    <circle cx="646" cy="468" r="48" fill="#fff" opacity=".7"/>
    <path d="M630 438 L630 498 L678 468 Z" fill="#1681df" opacity=".82"/>
  </svg>`;
}

function videoReference() {
  const w = 655;
  const h = 325;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}<rect width="${w}" height="${h}" fill="#fbfdff"/>
    ${panel(2, 3, 246, 286, `${cup(78, 38, .76)}<circle cx="122" cy="143" r="27" fill="#162b3f" opacity=".62"/><path d="M113 127 L113 159 L138 143 Z" fill="#fff"/><rect x="196" y="238" width="42" height="22" rx="7" fill="#263b51" opacity=".7"/><text x="217" y="254" text-anchor="middle" font-size="13" font-family="Arial" fill="#fff">00:15</text>`)}
    <g transform="translate(296 72)">
      <path d="M20 40 h70" stroke="#1681df" stroke-width="18" stroke-linecap="round"/><path d="M88 40 l36 25 v-50 Z" fill="#1681df"/>
      <path d="M38 4 h34 M38 22 h34 M38 78 h34" stroke="#b7e6d6" stroke-width="5" stroke-linecap="round"/>
      <text x="62" y="115" text-anchor="middle" font-size="15" font-family="'PingFang SC', Arial" fill="#6e7f91">AI 风格识别</text>
      <text x="62" y="142" text-anchor="middle" font-size="15" font-family="'PingFang SC', Arial" fill="#6e7f91">智能生成</text>
    </g>
    ${panel(406, 3, 246, 286, `${fan(44, 40, .78)}<circle cx="122" cy="143" r="27" fill="#162b3f" opacity=".62"/><path d="M113 127 L113 159 L138 143 Z" fill="#fff"/><rect x="196" y="238" width="42" height="22" rx="7" fill="#263b51" opacity=".7"/><text x="217" y="254" text-anchor="middle" font-size="13" font-family="Arial" fill="#fff">00:15</text>`)}
    <text x="124" y="316" text-anchor="middle" font-size="17" font-family="'PingFang SC', Arial" font-weight="800" fill="#334">参考视频</text>
    <text x="530" y="316" text-anchor="middle" font-size="17" font-family="'PingFang SC', Arial" font-weight="800" fill="#0076bd">AI 生成视频</text>
  </svg>`;
}

function videoPrompt() {
  const w = 672;
  const h = 304;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}<rect width="${w}" height="${h}" fill="#fbfdff"/>
    ${panel(1, 1, 214, 286, `
      <text x="34" y="52" font-size="40" fill="#d5dce5" font-family="Georgia">“</text>
      <text x="30" y="96" font-size="13" font-family="'PingFang SC', Arial" font-weight="700" fill="#2d3b4b">把这只水杯做成</text>
      <text x="30" y="124" font-size="13" font-family="'PingFang SC', Arial" font-weight="700" fill="#2d3b4b">厨房台面清爽短片，</text>
      <text x="30" y="152" font-size="13" font-family="'PingFang SC', Arial" font-weight="700" fill="#2d3b4b">展示容量、材质、手持感。</text>
      <text x="166" y="230" font-size="40" fill="#d5dce5" font-family="Georgia">”</text>
    `)}
    <g transform="translate(224 120)">
      <path d="M0 30 h62" stroke="#1681df" stroke-width="14" stroke-linecap="round"/><path d="M60 30 l28 20 v-40 Z" fill="#1681df"/>
    </g>
    ${[0,1,2,3].map((i) => {
      const x = 298 + i * 82;
      const fill = i === 0 ? "#d9efff" : i === 1 ? "#fff2dc" : i === 2 ? "#e7f8ff" : "#b9d8f6";
      return `<g transform="translate(${x} 42)" filter="url(#softShadow)">
        <rect width="68" height="206" rx="14" fill="${fill}" stroke="#fff" stroke-width="4"/>
        ${i % 2 ? textile(5, 70, .26) : cup(11, 70, .3)}
        <circle cx="34" cy="100" r="23" fill="#1b2f43" opacity=".42"/><path d="M26 86 L26 114 L48 100 Z" fill="#fff"/>
        <rect x="18" y="178" width="34" height="17" rx="6" fill="#263b51" opacity=".72"/><text x="35" y="190" font-size="10" text-anchor="middle" font-family="Arial" fill="#fff">00:10</text>
      </g>`;
    }).join("")}
    <text x="108" y="295" text-anchor="middle" font-size="17" font-family="'PingFang SC', Arial" font-weight="800" fill="#0076bd">示例描述</text>
    <text x="430" y="295" text-anchor="middle" font-size="17" font-family="'PingFang SC', Arial" font-weight="800" fill="#0076bd">多种风格视频生成</text>
  </svg>`;
}

await out("public/homepage-assets/common-home-entry-poster.png", heroPoster(), 1672, 941);
await out("public/homepage-assets/common-choice-image.png", imageChoice(), 1672, 941);
await out("public/homepage-assets/common-choice-video.png", videoChoice(), 1672, 941);
await out("public/video-choice-assets/common-video-choice-reference-blue.png", videoReference(), 655, 325);
await out("public/video-choice-assets/common-video-choice-prompt-blue.png", videoPrompt(), 672, 304);
