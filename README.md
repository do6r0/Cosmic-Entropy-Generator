# Cosmic Entropy Generator (Browser Edition)

A client-side True Random Number Generator (TRNG) web application built with vanilla HTML, CSS, and JavaScript.  It harvests live orbital telemetry from public space weather and satellite APIs—including solar wind plasma, interplanetary magnetic field vectors, solar X-ray flux, high-energy cosmic protons, and International Space Station (ISS) coordinates—to generate cryptographically whitened 256-bit keys directly inside your browser.

---

## Key Features

* **Zero Backend Required:**  Operates completely client-side using standard browser `fetch()` requests and the native **Web Crypto API** (`crypto.subtle.digest`).
* **Multi-Source Orbital Telemetry:**  Pulls live measurements from five CORS-enabled space endpoints operated by **NOAA SWPC** (DSCOVR and GOES satellites) and **Where The ISS At**.
* **Bilingual Interface (EN / RU):**  Defaults to English with an instant one-click toggle to switch the entire interface into Russian without reloading the page.
* **Cryptographic Whitening:**  Extracts the least significant bytes (LSB) of 64-bit floating-point sensor measurements, mixes them with high-resolution browser jitter (`performance.now()`), and hashes the stream via **SHA-256**.

---

## Integrated Space APIs

| Option | Source & Satellite | Telemetry Data Harvested |
| :--- | :--- | :--- |
| **0** | **Multi-Stream Mode** | Queries all five orbital APIs concurrently for maximum entropy |
| **1** | **NOAA DSCOVR (L1)** | Solar wind plasma density, speed, and temperature at Lagrange Point L1 |
| **2** | **NOAA DSCOVR (L1)** | Interplanetary magnetic field components (`Bx`, `By`, `Bz`) |
| **3** | **NOAA GOES Primary** | Short- and long-wavelength solar corona X-ray flux |
| **4** | **NOAA GOES Primary** | Integral flux of high-energy cosmic protons |
| **5** | **ISS Telemetry** | Real-time latitude, longitude, altitude, velocity, and solar angles |

---

## Quick Start

### Local Usage

1. **Clone or download the repository**

2. **Open in your browser:**

   Double-click `index.html` to launch the application directly in any modern web browser, or serve it locally via Python:

   ```bash
   python -m http.server 8080
   ```

   Then navigate to `http://localhost:8080`.

---

## How It Works

1. **Telemetry Acquisition:**  When triggered, `app.js` queries the selected satellite API(s) with cache-busting timestamps (`_t=Date.now()`) to retrieve the latest sensor readings.
2. **Chaos Extraction:**  Numeric values are recursively parsed from the JSON payloads and packed into a `Float64Array`.  The script isolates the two least significant bytes of each 64-bit mantissa, capturing subtle physical fluctuations while discarding predictable macro-trends.
3. **CSPRNG & Jitter Seeding:**  The cosmic byte pool is concatenated with 16 bytes (128 bits) generated via `window.crypto.getRandomValues(new Uint32Array(4))` alongside high-resolution `performance.now()` timestamps.
4. **SHA-256 Whitening:**  The combined byte buffer is passed through `window.crypto.subtle.digest("SHA-256", ...)` to yield a uniformly distributed 64-character hexadecimal key.
