let currentLang = "en";

const I18N = {
  en: {
    subtitle: "Cryptographic key generator powered by live space telemetry (NOAA SWPC, GOES, SOLAR-1/ACE, and ISS). Runs entirely in your browser with hybrid hardware CSPRNG seeding.",
    sourceLabel: "Select cosmic data source:",
    generateBtn: "Harvest Cosmic Entropy",
    metaSourceLabel: "Active Sources",
    metaBytesLabel: "Entropy Pool Size",
    hashLabel: "256-Bit Cryptographic Key (SHA-256)",
    copyBtn: "Copy Key",
    copiedBtn: "Copied to clipboard!",
    fetching: "📡 Requesting telemetry from orbital spacecraft...",
    success: "✅ Cosmic entropy successfully harvested and whitened.",
    errPrefix: "❌ Error: ",
    errNoApis: "Unable to retrieve data from any cosmic API. Please check your network connection.",
    bytesFmt: (totalBytes, cosmicBytes, count) => `${totalBytes} bytes (${cosmicBytes} B space + 16 B CSPRNG, ${count} readings)`,
    rawFmt: (sample) => `Sample raw sensor readings: ${sample}...`
  },
  ru: {
    subtitle: "Генератор криптографических ключей на основе живой космической телеметрии (NOAA SWPC, GOES, SOLAR-1/ACE и МКС). Работает полностью в браузере с гибридным аппаратным CSPRNG.",
    sourceLabel: "Выберите космический источник данных:",
    generateBtn: "Собрать энтропию из космоса",
    metaSourceLabel: "Активные источники",
    metaBytesLabel: "Размер пула энтропии",
    hashLabel: "256-битный криптографический ключ (SHA-256)",
    copyBtn: "Скопировать ключ",
    copiedBtn: "Скопировано в буфер обмена!",
    fetching: "📡 Запрос телеметрии с орбитальных спутников...",
    success: "✅ Космическая энтропия успешно собрана и отбелена.",
    errPrefix: "❌ Ошибка: ",
    errNoApis: "Не удалось получить данные ни от одного космического API. Проверьте сеть.",
    bytesFmt: (totalBytes, cosmicBytes, count) => `${totalBytes} байт (${cosmicBytes} Б космос + 16 Б CSPRNG, ${count} замеров)`,
    rawFmt: (sample) => `Фрагмент сырых замеров с датчиков: ${sample}...`
  }
};

// Updated to active NOAA SWPC RTSW endpoints (SOLAR-1 / ACE / DSCOVR) + primary/fallback URLs
const SPACE_APIS = {
  solar_wind: {
    name: "NOAA RTSW Solar Wind (L1)",
    urls: [
      "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
      "https://noaa-swpc-pds.s3.amazonaws.com/json/rtsw/rtsw_wind_1m.json",
      "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"
    ]
  },
  mag_field: {
    name: "NOAA RTSW Magnetic Field (L1)",
    urls: [
      "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
      "https://noaa-swpc-pds.s3.amazonaws.com/json/rtsw/rtsw_mag_1m.json",
      "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json"
    ]
  },
  xray: {
    name: "NOAA GOES X-Ray Flux",
    urls: [
      "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json",
      "https://services.swpc.noaa.gov/json/goes/secondary/xrays-6-hour.json"
    ]
  },
  protons: {
    name: "NOAA GOES Integral Protons",
    urls: [
      "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json",
      "https://services.swpc.noaa.gov/json/goes/secondary/integral-protons-6-hour.json"
    ]
  },
  iss: {
    name: "ISS Orbital Telemetry",
    urls: [
      "https://api.wheretheiss.at/v1/satellites/25544"
    ]
  }
};

function toggleLanguage() {
  currentLang = currentLang === "en" ? "ru" : "en";
  document.documentElement.lang = currentLang;
  document.getElementById("langToggle").textContent = currentLang === "en" ? "RU" : "EN";

  const t = I18N[currentLang];
  document.getElementById("subtitle").textContent = t.subtitle;
  document.getElementById("sourceLabel").textContent = t.sourceLabel;
  document.getElementById("generateBtn").textContent = t.generateBtn;
  document.getElementById("metaSourceLabel").textContent = t.metaSourceLabel;
  document.getElementById("metaBytesLabel").textContent = t.metaBytesLabel;
  document.getElementById("hashLabel").textContent = t.hashLabel;
  document.getElementById("copyBtn").textContent = t.copyBtn;

  const options = document.querySelectorAll("#sourceSelect option");
  options.forEach(opt => {
    opt.textContent = opt.getAttribute(`data-${currentLang}`);
  });
}

// Extract numeric measurements from spacecraft JSON telemetry (supports both arrays and object records)
function extractNumericChaos(obj, acc = []) {
  if (typeof obj === "number" && Number.isFinite(obj)) {
    acc.push(obj);
  } else if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) {
      const num = parseFloat(trimmed);
      if (Number.isFinite(num)) acc.push(num);
    }
  } else if (Array.isArray(obj)) {
    // Take the most recent 25 telemetry records (handles both chronological and reverse-chronological arrays)
    const slice = obj.length > 25 ? obj.slice(0, 15).concat(obj.slice(-15)) : obj;
    for (const item of slice) extractNumericChaos(item, acc);
  } else if (obj && typeof obj === "object") {
    for (const [k, val] of Object.entries(obj)) {
      // Skip purely categorical flags like "active" booleans if needed, keep all numeric sensor fields
      if (k !== "active") {
        extractNumericChaos(val, acc);
      }
    }
  }
  return acc;
}

// Convert Float64 measurements into a byte array of their least significant mantissa bits (LSB)
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

// Cryptographic whitening via Web Crypto API (SHA-256)
async function sha256Hex(uint8Array) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApiData(key) {
  const api = SPACE_APIS[key];
  let lastError = null;

  for (const url of api.urls) {
    try {
      const json = await fetchJsonWithTimeout(url, 8000);
      const numbers = extractNumericChaos(json);
      if (numbers.length > 0) {
        return { name: api.name, numbers };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`${api.name}: no numeric data`);
}

async function harvestEntropy() {
  const t = I18N[currentLang];
  const btn = document.getElementById("generateBtn");
  const log = document.getElementById("statusLog");
  const resultBox = document.getElementById("resultBox");
  const selected = document.getElementById("sourceSelect").value;

  btn.disabled = true;
  resultBox.style.display = "none";
  log.textContent = t.fetching;

  try {
    const keysToFetch = selected === "all" ? Object.keys(SPACE_APIS) : [selected];
    const results = await Promise.allSettled(keysToFetch.map(k => fetchApiData(k)));

    const successful = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    if (successful.length === 0) {
      throw new Error(t.errNoApis);
    }

    let allNumbers = [];
    const activeNames = [];

    for (const item of successful) {
      allNumbers = allNumbers.concat(item.numbers);
      activeNames.push(item.name);
    }

    // Mix high-resolution browser timer jitter
    allNumbers.push(performance.now(), Date.now());

    // Extract LSBs from cosmic telemetry
    const cosmicBytes = extractLSBBytes(allNumbers);

    // Generate 128-bit (16 bytes) local hardware CSPRNG seed
    const hardwareSeed = new Uint8Array(16);
    crypto.getRandomValues(hardwareSeed);

    // Combine cosmic telemetry LSBs + local hardware CSPRNG seed into a single pool
    const combinedPool = new Uint8Array(cosmicBytes.length + hardwareSeed.length);
    combinedPool.set(cosmicBytes, 0);
    combinedPool.set(hardwareSeed, cosmicBytes.length);

    const finalHash = await sha256Hex(combinedPool);

    document.getElementById("metaSource").textContent = activeNames.join(" + ");
    document.getElementById("metaBytes").textContent = t.bytesFmt(
      combinedPool.length,
      cosmicBytes.length,
      allNumbers.length
    );
    document.getElementById("hashOutput").textContent = finalHash;
    document.getElementById("rawPreview").textContent = t.rawFmt(
      allNumbers.slice(0, 12).join(", ")
    );

    log.textContent = t.success;
    resultBox.style.display = "block";
  } catch (err) {
    log.textContent = t.errPrefix + err.message;
  } finally {
    btn.disabled = false;
  }
}

function copyHash() {
  const t = I18N[currentLang];
  const hashText = document.getElementById("hashOutput").textContent;
  const copyBtn = document.getElementById("copyBtn");
  navigator.clipboard.writeText(hashText);
  copyBtn.textContent = t.copiedBtn;
  setTimeout(() => {
    copyBtn.textContent = t.copyBtn;
  }, 2000);
}
