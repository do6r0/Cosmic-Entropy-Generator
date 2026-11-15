let currentLang = "en";
let lastMetaStats = null;

const I18N = {
  en: {
    subtitle: "Cryptographic key generator powered by live orbital telemetry (NOAA SWPC, GOES, DSCOVR, and ISS) combined with hardware CSPRNG seeding. Runs entirely in your browser with zero backend.",
    selectLabel: "Select cosmic telemetry source:",
    opt_all: "0. [Multi-Stream] Combine all 5 cosmic APIs simultaneously (Max Entropy)",
    opt_sw: "1. NOAA DSCOVR — Solar Wind (Plasma at Lagrange Point L1)",
    opt_mag: "2. NOAA DSCOVR — Interplanetary Magnetic Field (Bx, By, Bz vectors)",
    opt_xray: "3. NOAA GOES — Solar Corona X-Ray Flux",
    opt_protons: "4. NOAA GOES — High-Energy Cosmic Proton Flux",
    opt_iss: "5. ISS Orbital Telemetry — Coordinates, velocity, and solar angles",
    btnGenerate: "Harvest Cosmic Entropy",
    btnFetching: "Fetching telemetry from orbital satellites...",
    metaSourceLabel: "Active Sources",
    metaBytesLabel: "Entropy Bytes Processed",
    hashLabel: "256-Bit Cryptographic Key (SHA-256)",
    btnCopy: "Copy Key",
    btnCopied: "Copied to clipboard!",
    statusRequest: "📡 Requesting telemetry from orbital satellites...",
    statusSuccess: "✅ Cosmic entropy harvested, CSPRNG-seeded, and whitened.",
    statusErrorPrefix: "❌ Error: ",
    errNoData: "Failed to retrieve data from any cosmic API. Please check your connection.",
    bytesUnit: "bytes",
    samplesUnit: "samples + 128-bit CSPRNG",
    rawPrefix: "Raw sensor sample excerpt: "
  },
  ru: {
    subtitle: "Генератор криптографических ключей на основе живой космической телеметрии (NOAA SWPC, спутники GOES, DSCOVR и МКС) с подмешиванием аппаратного CSPRNG. Работает полностью в браузере без бэкенда.",
    selectLabel: "Выберите космический источник данных:",
    opt_all: "0. [Мульти-поток] Объединить все 5 космических API сразу (Макс. энтропия)",
    opt_sw: "1. NOAA DSCOVR — Солнечный ветер (плазма в точке Лагранжа L1)",
    opt_mag: "2. NOAA DSCOVR — Межпланетное магнитное поле (векторы Bx, By, Bz)",
    opt_xray: "3. NOAA GOES — Рентгеновское излучение солнечной короны",
    opt_protons: "4. NOAA GOES — Потоки высокоэнергетических космических протонов",
    opt_iss: "5. Орбитальная телеметрия МКС — Координаты, скорость и солнечные углы",
    btnGenerate: "Собрать энтропию из космоса",
    btnFetching: "Запрос телеметрии с орбитальных спутников...",
    metaSourceLabel: "Активные источники",
    metaBytesLabel: "Обработано байт энтропии",
    hashLabel: "256-битный криптографический ключ (SHA-256)",
    btnCopy: "Скопировать ключ",
    btnCopied: "Скопировано в буфер обмена!",
    statusRequest: "📡 Запрос телеметрии с орбитальных спутников...",
    statusSuccess: "✅ Космическая энтропия собрана, усилена CSPRNG и отбелена.",
    statusErrorPrefix: "❌ Ошибка: ",
    errNoData: "Не удалось получить данные ни от одного космического API. Проверьте сеть.",
    bytesUnit: "байт",
    samplesUnit: "замеров + 128-бит CSPRNG",
    rawPrefix: "Фрагмент сырых замеров с датчиков: "
  }
};

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

function setLanguage(lang) {
  currentLang = lang;
  const dict = I18N[lang];
  document.documentElement.lang = lang;

  document.getElementById("langEn").classList.toggle("active", lang === "en");
  document.getElementById("langRu").classList.toggle("active", lang === "ru");

  document.getElementById("subtitleText").textContent = dict.subtitle;
  document.getElementById("selectLabel").textContent = dict.selectLabel;
  document.getElementById("generateBtn").textContent = dict.btnGenerate;
  document.getElementById("metaSourceLabel").textContent = dict.metaSourceLabel;
  document.getElementById("metaBytesLabel").textContent = dict.metaBytesLabel;
  document.getElementById("hashLabel").textContent = dict.hashLabel;
  document.getElementById("copyBtn").textContent = dict.btnCopy;

  const options = document.querySelectorAll("#sourceSelect option");
  options.forEach(opt => {
    const key = opt.getAttribute("data-i18n");
    if (key && dict[key]) {
      opt.textContent = dict[key];
    }
  });

  if (lastMetaStats) {
    document.getElementById("metaBytes").textContent =
      `${lastMetaStats.byteCount} ${dict.bytesUnit} (${lastMetaStats.sampleCount} ${dict.samplesUnit})`;
    document.getElementById("rawPreview").textContent =
      dict.rawPrefix + lastMetaStats.previewSlice.join(", ") + "...";
    document.getElementById("statusLog").textContent = dict.statusSuccess;
  }
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
    for (const item of slice) extractNumericChaos(item, acc);
  } else if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) extractNumericChaos(val, acc);
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

  // Extract 2 least significant mantissa bytes per Float64 sample
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
  if (!response.ok) throw new Error(`${api.name}: HTTP ${response.status}`);
  const json = await response.json();
  const numbers = extractNumericChaos(json);
  if (numbers.length === 0) throw new Error(`${api.name}: no numeric telemetry`);
  return { name: api.name, numbers };
}

async function harvestEntropy() {
  const dict = I18N[currentLang];
  const btn = document.getElementById("generateBtn");
  const log = document.getElementById("statusLog");
  const resultBox = document.getElementById("resultBox");
  const selected = document.getElementById("sourceSelect").value;

  btn.disabled = true;
  btn.textContent = dict.btnFetching;
  resultBox.style.display = "none";
  log.textContent = dict.statusRequest;

  try {
    const keysToFetch = selected === "all" ? Object.keys(SPACE_APIS) : [selected];
    const results = await Promise.allSettled(keysToFetch.map(k => fetchApiData(k)));

    const successful = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    if (successful.length === 0) {
      throw new Error(dict.errNoData);
    }

    let allNumbers = [];
    const activeNames = [];

    for (const item of successful) {
      allNumbers = allNumbers.concat(item.numbers);
      activeNames.push(item.name);
    }

    // Add high-resolution local timing jitter
    allNumbers.push(performance.now(), Date.now());

    // Extract LSB bytes from cosmic telemetry
    const cosmicLsbBytes = extractLSBBytes(allNumbers);

    // Generate 128 bits (16 bytes) of cryptographically secure local seed via Web Crypto CSPRNG
    const localCsprngSeed = new Uint8Array(new Uint32Array(4).buffer);
    crypto.getRandomValues(localCsprngSeed);

    // Combine cosmic LSB entropy + hardware CSPRNG seed into a single buffer
    const combinedPool = new Uint8Array(cosmicLsbBytes.length + localCsprngSeed.length);
    combinedPool.set(cosmicLsbBytes, 0);
    combinedPool.set(localCsprngSeed, cosmicLsbBytes.length);

    // Final cryptographic whitening with SHA-256
    const finalHash = await sha256Hex(combinedPool);

    lastMetaStats = {
      byteCount: combinedPool.length,
      sampleCount: allNumbers.length,
      previewSlice: allNumbers.slice(0, 12)
    };

    document.getElementById("metaSource").textContent = activeNames.join(" + ");
    document.getElementById("metaBytes").textContent =
      `${combinedPool.length} ${dict.bytesUnit} (${allNumbers.length} ${dict.samplesUnit})`;
    document.getElementById("hashOutput").textContent = finalHash;
    document.getElementById("rawPreview").textContent =
      dict.rawPrefix + lastMetaStats.previewSlice.join(", ") + "...";

    log.textContent = dict.statusSuccess;
    resultBox.style.display = "block";
  } catch (err) {
    log.textContent = dict.statusErrorPrefix + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = dict.btnGenerate;
  }
}

function copyHash() {
  const dict = I18N[currentLang];
  const hashText = document.getElementById("hashOutput").textContent;
  const copyBtn = document.getElementById("copyBtn");
  navigator.clipboard.writeText(hashText);
  copyBtn.textContent = dict.btnCopied;
  setTimeout(() => {
    copyBtn.textContent = I18N[currentLang].btnCopy;
  }, 2000);
}
