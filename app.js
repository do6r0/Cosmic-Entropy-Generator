const SPACE_APIS = {
  solar_wind: {
    name: "NOAA DSCOVR Solar Wind (L1)",
    url: "https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json"
  },
  mag_field: {
    name: "NOAA DSCOVR Magnetic Field (L1)",
    url: "https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json"
  },
  xray: {
    name: "NOAA GOES X-Ray Flux",
    url: "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json"
  },
  protons: {
    name: "NOAA GOES Integral Protons",
    url: "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json"
  },
  iss: {
    name: "ISS Orbital Telemetry",
    url: "https://api.wheretheiss.at/v1/satellites/25544"
  }
};

const TRANSLATIONS = {
  en: {
    title: "🛰️ Cosmic Entropy Generator",
    subtitle: "A browser-based cryptographic key generator powered by live orbital telemetry (NOAA SWPC, GOES, DSCOVR, and ISS). Runs entirely client-side with zero backend dependencies.",
    selectLabel: "Select a cosmic data source:",
    optAll: "0. [Multi-Stream] Combine all 5 space APIs simultaneously (Max entropy)",
    optSolarWind: "1. NOAA DSCOVR — Solar Wind (Plasma at Lagrange Point L1)",
    optMagField: "2. NOAA DSCOVR — Interplanetary Magnetic Field (Bx, By, Bz vectors)",
    optXray: "3. NOAA GOES — Solar Corona X-Ray Flux",
    optProtons: "4. NOAA GOES — High-Energy Cosmic Proton Flux",
    optIss: "5. ISS Orbital Telemetry — Coordinates, Velocity & Solar Angles",
    btnGenerate: "Harvest Cosmic Entropy",
    metaSourcesLabel: "Active Sources",
    metaBytesLabel: "Telemetry Processed",
    hashLabel: "256-Bit Cryptographic Key (SHA-256)",
    btnCopy: "Copy Key",
    btnCopied: "Copied to clipboard!",
    statusRequesting: "📡 Requesting telemetry from orbital satellites...",
    statusSuccess: "✅ Cosmic entropy successfully harvested and whitened.",
    statusErrorPrefix: "❌ Error: ",
    errNoApis: "Unable to retrieve data from any cosmic API. Please check your network connection.",
    bytesUnit: "bytes",
    samplesUnit: "samples",
    rawPreviewPrefix: "Sample raw sensor measurements: "
  },
  ru: {
    title: "🛰️ Генератор космической энтропии",
    subtitle: "Генератор криптографических ключей на основе живой космической телеметрии (NOAA SWPC, спутники GOES, DSCOVR и МКС). Работает полностью в браузере без бэкенда.",
    selectLabel: "Выберите космический источник данных:",
    optAll: "0. [Мульти-поток] Объединить все 5 космических API сразу (Макс. энтропия)",
    optSolarWind: "1. NOAA DSCOVR — Солнечный ветер (плазма в точке Лагранжа L1)",
    optMagField: "2. NOAA DSCOVR — Межпланетное магнитное поле (векторы Bx, By, Bz)",
    optXray: "3. NOAA GOES — Рентгеновское излучение солнечной короны",
    optProtons: "4. NOAA GOES — Потоки высокоэнергетических космических протонов",
    optIss: "5. Орбитальная телеметрия МКС — Координаты, скорость и солнечные углы",
    btnGenerate: "Собрать энтропию из космоса",
    metaSourcesLabel: "Активные источники",
    metaBytesLabel: "Обработано байт телеметрии",
    hashLabel: "256-битный криптографический ключ (SHA-256)",
    btnCopy: "Скопировать ключ",
    btnCopied: "Скопировано в буфер обмена!",
    statusRequesting: "📡 Запрос телеметрии с орбитальных спутников...",
    statusSuccess: "✅ Космическая энтропия успешно собрана и отбелена.",
    statusErrorPrefix: "❌ Ошибка: ",
    errNoApis: "Не удалось получить данные ни от одного космического API. Проверьте сеть.",
    bytesUnit: "байт",
    samplesUnit: "замеров",
    rawPreviewPrefix: "Фрагмент сырых замеров с датчиков: "
  }
};

let currentLang = "en";
let lastResultState = null;

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;

  document.getElementById("langEn").classList.toggle("active", lang === "en");
  document.getElementById("langRu").classList.toggle("active", lang === "ru");

  const dict = TRANSLATIONS[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  if (lastResultState) {
    renderDynamicResult();
  }
}

function renderDynamicResult() {
  if (!lastResultState) return;
  const dict = TRANSLATIONS[currentLang];
  document.getElementById("metaBytes").textContent =
    `${lastResultState.byteCount} ${dict.bytesUnit} (${lastResultState.sampleCount} ${dict.samplesUnit})`;
  document.getElementById("rawPreview").textContent =
    dict.rawPreviewPrefix + lastResultState.previewNumbers.join(", ") + "...";
  document.getElementById("statusLog").textContent = dict.statusSuccess;
}

function extractNumericChaos(obj, acc = []) {
  if (typeof obj === "number" && !Number.isNaN(obj)) {
    acc.push(obj);
  } else if (typeof obj === "string") {
    const num = parseFloat(obj);
    if (!Number.isNaN(num) && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(obj.trim())) {
      acc.push(num);
    }
  } else if (Array.isArray(obj)) {
    const slice = obj.slice(-25);
    for (const item of slice) {
      extractNumericChaos(item, acc);
    }
  } else if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) {
      extractNumericChaos(val, acc);
    }
  }
  return acc;
}

function extractLSBBytes(numbers) {
  const buffer = new ArrayBuffer(numbers.length * 8);
  const floatView = new Float64Array(buffer);
  const byteView = new Uint8Array(buffer);

  for (let i = 0; i < numbers.length; i++) {
    floatView[i] = numbers[i];
  }

  const lsbArray = new Uint8Array(numbers.length * 2);
  for (let i = 0; i < numbers.length; i++) {
    lsbArray[i * 2] = byteView[i * 8];
    lsbArray[i * 2 + 1] = byteView[i * 8 + 1];
  }
  return lsbArray;
}

async function sha256Hex(uint8Array) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchApiData(key) {
  const api = SPACE_APIS[key];
  const separator = api.url.includes("?") ? "&" : "?";
  const response = await fetch(`${api.url}${separator}_t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${api.name}: HTTP ${response.status}`);
  }
  const json = await response.json();
  const numbers = extractNumericChaos(json);
  if (numbers.length === 0) {
    throw new Error(`${api.name}: empty numeric payload`);
  }
  return { name: api.name, numbers };
}

async function harvestEntropy() {
  const dict = TRANSLATIONS[currentLang];
  const btn = document.getElementById("generateBtn");
  const log = document.getElementById("statusLog");
  const resultBox = document.getElementById("resultBox");
  const selected = document.getElementById("sourceSelect").value;

  btn.disabled = true;
  resultBox.style.display = "none";
  log.textContent = dict.statusRequesting;

  try {
    const keysToFetch = selected === "all" ? Object.keys(SPACE_APIS) : [selected];
    const results = await Promise.allSettled(keysToFetch.map(k => fetchApiData(k)));

    const successful = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    if (successful.length === 0) {
      throw new Error(dict.errNoApis);
    }

    let allNumbers = [];
    const activeNames = [];

    for (const item of successful) {
      allNumbers = allNumbers.concat(item.numbers);
      activeNames.push(item.name);
    }

    allNumbers.push(performance.now(), Date.now() * Math.random());

    const lsbBytes = extractLSBBytes(allNumbers);
    const finalHash = await sha256Hex(lsbBytes);

    lastResultState = {
      byteCount: lsbBytes.length,
      sampleCount: allNumbers.length,
      previewNumbers: allNumbers.slice(0, 12)
    };

    document.getElementById("metaSource").textContent = activeNames.join(" + ");
    document.getElementById("hashOutput").textContent = finalHash;
    renderDynamicResult();

    resultBox.style.display = "block";
  } catch (err) {
    log.textContent = dict.statusErrorPrefix + err.message;
  } finally {
    btn.disabled = false;
  }
}

function copyHash() {
  const dict = TRANSLATIONS[currentLang];
  const hashText = document.getElementById("hashOutput").textContent;
  const copyBtn = document.getElementById("copyBtn");
  navigator.clipboard.writeText(hashText);
  copyBtn.textContent = dict.btnCopied;
  setTimeout(() => {
    copyBtn.textContent = TRANSLATIONS[currentLang].btnCopy;
  }, 2000);
}
