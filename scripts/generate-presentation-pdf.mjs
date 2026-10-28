import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(process.cwd(), '.chrome-pdf-profile');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const MOBILE_DIR = path.join(SCREENSHOTS_DIR, 'mobile_flow');
const PDF_PATH = path.join(process.cwd(), 'MENUREST_UZ_LOYIHA_TAQDIMOTI.pdf');
const HTML_PATH = path.join(process.cwd(), 'screenshots', 'presentation.html');

function getBase64Image(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('File not found:', filePath);
    return '';
  }
  const ext = path.extname(filePath).replace('.', '') || 'png';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:image/${ext};base64,${data}`;
}

const img01 = getBase64Image(path.join(MOBILE_DIR, '01_asosiy_qr_menyu.png'));
const img02 = getBase64Image(path.join(MOBILE_DIR, '02_taom_tafsiloti_modifikator.png'));
const img03 = getBase64Image(path.join(MOBILE_DIR, '03_savatcha_va_buyurtma.png'));
const img04 = getBase64Image(path.join(MOBILE_DIR, '04_buyurtmalar_holati.png'));
const img05 = getBase64Image(path.join(MOBILE_DIR, '05_ofitsiantni_chaqirish.png'));
const img06 = getBase64Image(path.join(MOBILE_DIR, '06_joriy_hisob_chek.png'));
const img07 = getBase64Image(path.join(SCREENSHOTS_DIR, '02_kassa_pos_tizimi.png'));
const img08 = getBase64Image(path.join(SCREENSHOTS_DIR, '03_boss_analitika_boshqaruv.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <title>MENUREST.UZ — Tijorat Taqdimoti</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 18mm;
      margin: 0 auto;
      background: #ffffff;
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Header & Footer */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 16px;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 800;
      color: #064e3b;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .badge-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      margin-top: 16px;
      font-size: 10px;
      color: #64748b;
    }

    /* Cover Page */
    .cover-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 40px 20px;
      background: radial-gradient(circle at 50% 30%, #ecfdf5 0%, #ffffff 70%);
      border-radius: 20px;
      border: 1px solid #d1fae5;
    }

    .cover-title {
      font-size: 38px;
      font-weight: 800;
      color: #064e3b;
      line-height: 1.15;
      margin-top: 14px;
      margin-bottom: 12px;
      letter-spacing: -1px;
    }

    .cover-subtitle {
      font-size: 16px;
      color: #047857;
      font-weight: 600;
      max-width: 580px;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    .cover-desc {
      font-size: 13px;
      color: #475569;
      max-width: 520px;
      line-height: 1.6;
      margin-bottom: 30px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      width: 100%;
      max-width: 540px;
      margin-bottom: 30px;
    }

    .stat-box {
      background: #ffffff;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 10px rgba(0,0,0,0.03);
    }

    .stat-number {
      font-size: 20px;
      font-weight: 800;
      color: #059669;
    }

    .stat-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-top: 4px;
    }

    /* Content Layout */
    .flow-card {
      display: flex;
      gap: 22px;
      align-items: center;
      flex: 1;
    }

    .mobile-mockup {
      width: 250px;
      flex-shrink: 0;
      background: #0f172a;
      padding: 8px;
      border-radius: 34px;
      box-shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0,0,0,0.1);
    }

    .mobile-screen {
      width: 100%;
      border-radius: 26px;
      overflow: hidden;
      display: block;
      background: #fff;
    }

    .desktop-mockup {
      width: 100%;
      background: #0f172a;
      padding: 8px;
      border-radius: 14px;
      box-shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.25);
      margin-bottom: 16px;
    }

    .desktop-screen {
      width: 100%;
      border-radius: 8px;
      display: block;
      background: #fff;
    }

    .details-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #064e3b;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      width: fit-content;
    }

    .card-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.25;
    }

    .card-desc {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
    }

    .action-box {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 12px 14px;
      border-radius: 0 10px 10px 0;
    }

    .action-title {
      font-size: 12px;
      font-weight: 700;
      color: #064e3b;
      margin-bottom: 4px;
    }

    .action-text {
      font-size: 12px;
      color: #166534;
      line-height: 1.5;
    }

    .feature-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 12px;
      color: #334155;
      line-height: 1.45;
    }

    .feature-icon {
      color: #059669;
      font-weight: bold;
      font-size: 14px;
      line-height: 1;
    }

    .benefit-tag {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 11px;
      color: #475569;
    }

    .benefit-tag strong {
      color: #0f172a;
    }

    /* Two Mobile Columns */
    .two-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      flex: 1;
      align-items: center;
    }

    .col-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
    }

    .col-mockup {
      width: 200px;
      background: #0f172a;
      padding: 6px;
      border-radius: 28px;
      box-shadow: 0 10px 24px -6px rgba(15, 23, 42, 0.2);
    }

    .col-screen {
      width: 100%;
      border-radius: 22px;
      display: block;
    }
  </style>
</head>
<body>

  <!-- ================= PAGE 1: MUQOVA ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">TIJORAT TAQDIMOTI • V2.0</div>
    </div>

    <div class="cover-container">
      <div style="font-size: 42px;">📱✨</div>
      <h1 class="cover-title">MENUREST.UZ</h1>
      <p class="cover-subtitle">Restoranlar Uchun Multi-Tenant QR Menyu, Jonli Zakazlar va Boshqaruv SaaS Platformasi</p>
      
      <p class="cover-desc">
        Mijozlar hech qanday ilova yuklab olmasdan to'g'ridan-to'g'ri brauzer orqali stolga ulanadi, taomlarni tanlaydi, zakaz beradi, ofitsiantni chaqiradi va hisobni ko'radi. Barcha ma'lumotlar real vaqtda oshxona va kassada aks etadi.
      </p>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-number">0 ilova</div>
          <div class="stat-label">O'rnatish shart emas</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">&lt; 1 soniya</div>
          <div class="stat-label">Jonli buyurtma uzatish</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">+35%</div>
          <div class="stat-label">O'rtacha chek o'sishi</div>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 24px; font-size: 11px; color: #475569;">
        ✅ <strong>Monorepo Arxitektura:</strong> Express.js API • PostgreSQL • React + Vite • TailwindCSS • Realtime SSE
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — Restoran boshqaruv platformasi</span>
      <span>1-sahifa / Taqdimot</span>
    </div>
  </div>

  <!-- ================= PAGE 2: STEP 1 - ASOSIY QR MENYU ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">1-BOSQICH • MIJOZ TAJRIBASI</div>
    </div>

    <div class="flow-card">
      <div class="mobile-mockup">
        <img class="mobile-screen" src="${img01}" alt="QR Menyu">
      </div>

      <div class="details-pane">
        <div class="step-badge">1-QADAM • QR KOD VA MENYU</div>
        <h2 class="card-title">Mijoz Telefonda Ko'radigan Zamonaviy QR Menyu</h2>
        <p class="card-desc">
          Mehmon stoldagi QR kodni telefon kamerasida skaner qilishi bilan ushbu sahifa ochiladi. Mehmon hech narsa ro'yxatdan o'tkazmaydi, darhol menyuni ko'rishni boshlaydi.
        </p>

        <div class="action-box">
          <div class="action-title">👉 BUNI BOSSA NIMA BO'LADI?</div>
          <div class="action-text">
            <strong>«Toifalar» (Milliy, Kabob, Sho'rva...):</strong> Bir zumda kerakli bo'limga silliq o'tadi.<br>
            <strong>«+ Qo'shish» tugmasi:</strong> Tanlangan taomning porsiyasi va qo'shimchalarini tanlash oynasini ochadi.
          </div>
        </div>

        <ul class="feature-list">
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Ishtahani ochuvchi yuqori sifatli fotosuratlar:</strong> Har bir taom professional ko'rinishda taqdim etiladi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Stol raqami avtomatik bog'langan:</strong> Mehmon aynan qaysi stolda o'tirgani yuqorida (Stol #1) ko'rinib turadi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Ko'p tillilik:</strong> O'zbek va rus tillari orasida 1 bosishda o'tish imkoniyati (UZ / RU).</span>
          </li>
        </ul>

        <div class="benefit-tag">
          💡 <strong>Restoran uchun foyda:</strong> Qog'oz menyu chop etish xarajatlari 0 ga tushadi, taom narxi va rasmlarini istalgan payt admin paneldan o'zgartirish mumkin.
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 1-Bosqich: QR Menyu</span>
      <span>2-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 3: STEP 2 - TAOM TAFSILOTI ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">2-BOSQICH • QO'SHIMCHA SOTUV (UPSELL)</div>
    </div>

    <div class="flow-card">
      <div class="mobile-mockup">
        <img class="mobile-screen" src="${img02}" alt="Taom tafsiloti">
      </div>

      <div class="details-pane">
        <div class="step-badge">2-QADAM • MODIFIKATOR VA PORSIYA</div>
        <h2 class="card-title">Taom Tafsiloti, Porsiya va Qo'shimchalar</h2>
        <p class="card-desc">
          Mehmon taom kartochkasi yoki «+ Qo'shish» tugmasini bosganda ushbu tafsilotlar oynasi ochiladi. Taom tarkibi, ingrediyentlari va modifikatorlari to'liq ko'rsatiladi.
        </p>

        <div class="action-box">
          <div class="action-title">👉 BUNI BOSSA NIMA BO'LADI?</div>
          <div class="action-text">
            <strong>«- 1 +» hisoblagich:</strong> Taom miqdorini oshiradi yoki kamaytiradi.<br>
            <strong>«Savatchaga qo'shish»:</strong> Tanlangan barcha variantlar bilan taomni savatga soladi va pastda buyurtma tugmasini faollashtiradi.
          </div>
        </div>

        <ul class="feature-list">
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Porsiya tanlash:</strong> To'liq porsiya yoki Yarim porsiya narxini avtomatik qayta hisoblash.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Qo'shimchalar (Add-ons):</strong> Qazi, bedana tuxumi, qo'shimcha sous yoki nonlarni 1 bosishda qo'shish.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Allergenlar va izoh:</strong> Mehmonning maxsus xohish-istaklari (masalan: piyozsiz, achchiqsiz) qayd etiladi.</span>
          </li>
        </ul>

        <div class="benefit-tag">
          💡 <strong>Restoran uchun foyda:</strong> Har bir buyurtmada qo'shimchalar (qazi, sous) orqali o'rtacha chek summasi 20-30% ga oshadi.
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 2-Bosqich: Modifikatorlar</span>
      <span>3-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 4: STEP 3 - SAVATCHA VA ZAKAZ BERISH ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">3-BOSQICH • BUYURTMANI RASMIYLASHTIRISH</div>
    </div>

    <div class="flow-card">
      <div class="mobile-mockup">
        <img class="mobile-screen" src="${img03}" alt="Savatcha">
      </div>

      <div class="details-pane">
        <div class="step-badge">3-QADAM • SAVATCHA VA TO'LOV HISOBI</div>
        <h2 class="card-title">Savatcha va Buyurtmani Yuborish</h2>
        <p class="card-desc">
          Mehmon tanlagan taomlarini qulay ko'rinishda tekshiradi. Restoran servis xizmat haqi (10%) shaffof tarzda avtomatik hisoblanib, aniq summa ko'rsatiladi.
        </p>

        <div class="action-box">
          <div class="action-title">👉 BUNI BOSSA NIMA BO'LADI?</div>
          <div class="action-text">
            <strong>«Buyurtmani Yuborish» yashil tugmasi:</strong> Bosilishi bilan buyurtma real vaqtda (1 soniyada) oshxona KDS ekraniga va ofitsiant paneliga boradi.
          </div>
        </div>

        <ul class="feature-list">
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Shaffof hisob-kitob:</strong> Taomlar summasi + 10% xizmat haqi = Jami to'lov. Mehmonda hech qanday yashirin to'lov savollari tug'ilmaydi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Tiyin aniqligidagi moliya:</strong> Tizim minor unit (1 UZS = 100 tiyin) asosida yaxlitlash xatolikisiz ishlaydi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Ikki marta bosishdan himoya (Idempotency):</strong> Mehmon tugmani shoshib 2 marta bossa ham, zakaz 2 marta takrorlanmaydi.</span>
          </li>
        </ul>

        <div class="benefit-tag">
          💡 <strong>Restoran uchun foyda:</strong> Ofitsiantning stoldan buyurtma yozib olish vaqti tejaladi, inson omili sababli adashishlar bartaraf etiladi.
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 3-Bosqich: Savatcha</span>
      <span>4-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 5: STEP 4 - JONLI BUYURTMALAR STATUSI ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">4-BOSQICH • REAL VAQTDA STATUSLAR</div>
    </div>

    <div class="flow-card">
      <div class="mobile-mockup">
        <img class="mobile-screen" src="${img04}" alt="Buyurtmalar statusi">
      </div>

      <div class="details-pane">
        <div class="step-badge">4-QADAM • «BUYURTMALAR» TABI</div>
        <h2 class="card-title">Buyurtmalar Qanday Tushadi va Kuzatiladi?</h2>
        <p class="card-desc">
          Pastki menyudagi <strong>«Buyurtmalar»</strong> tugmasi bosilganda (yashil nuqta bilan belgilanadi), mehmon o'zining stol bo'yicha barcha bergan zakazlarini jonli monitoring qilib turadi.
        </p>

        <div class="action-box">
          <div class="action-title">👉 BUNI BOSSA NIMA BO'LADI?</div>
          <div class="action-text">
            Mehmon taomning tayyor bo'lish jarayonini xuddi taksi chaqirgandek jonli ko'radi: <strong>Tasdiqlandi ➔ Pishirilmoqda ➔ Yetkazildi</strong>.
          </div>
        </div>

        <ul class="feature-list">
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Holatlar mashinasi (State Machine):</strong> Oshxona oshpazi taomni boshlaganda «Pishirilmoqda», ofitsiant olib kelganda «Yetkazildi» deb o'zgaradi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Buyurtma vaqti va summasi:</strong> Har bir yuborilgan partiya (masalan: 11:20 AM, 12:46 PM) alohida ajratib ko'rsatiladi.</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">✔</span>
            <span><strong>Sessiya xavfsizligi:</strong> Mehmon faqat o'z stolining buyurtmalarini ko'radi, qo'shni stollar ma'lumotlari qat'iy izolyatsiya qilingan.</span>
          </li>
        </ul>

        <div class="benefit-tag">
          💡 <strong>Mijoz tajribasi:</strong> «Ovqatim qachon chiqadi?» deb ofitsiantni qidirib asabiylashish yo'qoladi. Mijoz rozi bo'ladi.
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 4-Bosqich: Jonli Buyurtmalar</span>
      <span>5-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 6: STEP 5 & 6 - OFITSIANT VA HISOB ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">5-6 BOSQICHLAR • XIZMAT VA CHEK</div>
    </div>

    <div class="two-cols">
      <!-- 5-Qadam: Ofitsiant -->
      <div class="col-card">
        <div class="step-badge">5-QADAM • OFITSIANT CHAQIRISH</div>
        <div class="col-mockup">
          <img class="col-screen" src="${img05}" alt="Ofitsiant">
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">«Ofitsiant» Tabi</div>
        <p style="font-size: 11px; color: #475569; line-height: 1.45; text-align: left;">
          👉 <strong>Buni bossa:</strong> «Ofitsiantni Chaqirish» tugmasi bosilishi bilan xizmat ko'rsatuvchi ofitsiant (Sardor Rustamov) telefoniga zudlik bilan ovozli va vibratsiyali signal boradi. Mehmon baqirib ofitsiant chaqirishi shart emas.
        </p>
      </div>

      <!-- 6-Qadam: Joriy Hisob -->
      <div class="col-card">
        <div class="step-badge">6-QADAM • CHEK VA TO'LOV</div>
        <div class="col-mockup">
          <img class="col-screen" src="${img06}" alt="Hisob">
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">«Joriy Hisob» Tabi</div>
        <p style="font-size: 11px; color: #475569; line-height: 1.45; text-align: left;">
          👉 <strong>Buni bossa:</strong> Mehmon stolning to'liq chekini ko'radi. «Ofitsiantdan Chekni So'rash» tugmasi orqali hisob varaqasini so'raydi. Naqd pul, UzCard/Humo yoki Click/Payme orqali to'lov qilishi mumkin.
        </p>
      </div>
    </div>

    <div class="benefit-tag" style="margin-top: 14px;">
      💡 <strong>Stol aylanish tezligi (Table Turnover):</strong> Hisob-kitob va chaqiruv 2 barobar tezlashishi hisobiga bir stolda kun davomida 30-40% ko'proq mehmonga xizmat ko'rsatish mumkin.
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 5-6 Bosqichlar: Xizmat va To'lov</span>
      <span>6-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 7: STEP 7 - KASSA (POS) VA STOLLAR ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">7-BOSQICH • RESTORAN KASSA (POS) TIZIMI</div>
    </div>

    <div>
      <div class="step-badge" style="margin-bottom: 8px;">7-QADAM • KASSA VA TO'LOV OPERATSIYALARI</div>
      <h2 class="card-title" style="margin-bottom: 8px;">Kassir va Administrator Paneli (POS)</h2>
      <p class="card-desc" style="margin-bottom: 14px;">
        Mijozlar yuborgan barcha zakazlar kassada markazlashgan tarzda ko'rinadi. Stol bo'yicha to'lovlar, xizmat haqi, chek chop etish va stolni yopish operatsiyalari amalga oshiriladi.
      </p>

      <div class="desktop-mockup">
        <img class="desktop-screen" src="${img07}" alt="Kassa POS Tizimi">
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px;">
        <div class="action-box">
          <div class="action-title">👉 KUTILAYOTGAN TO'LOVLAR</div>
          <div class="action-text">
            Barcha faol stollar (Stol #1, Stol #5, Stol #3) buyurtma qilingan taomlari va vaqti bilan kartochkalarda turadi.
          </div>
        </div>

        <div class="action-box">
          <div class="action-title">👉 TO'LOVNI TASDIQLASH VA YOPISH</div>
          <div class="action-text">
            Naqd pul, Plastik karta yoki Aralash to'lov usulini tanlab, 1 bosishda to'lov qabul qilinadi va stol bo'shatiladi.
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 7-Bosqich: Kassa POS</span>
      <span>7-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 8: STEP 8 - BOSS VA MENEJER DASHBOARD ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">8-BOSQICH • RAHBAR VA MENEJER PANELI</div>
    </div>

    <div>
      <div class="step-badge" style="margin-bottom: 8px;">8-QADAM • ZALLAR, STOLLAR VA ANALITIKA</div>
      <h2 class="card-title" style="margin-bottom: 8px;">Restoran Boshqaruv & Analitika Paneli (Boss Dashboard)</h2>
      <p class="card-desc" style="margin-bottom: 14px;">
        Restoran rahbari va menejeri uchun stollar xaritasi, band/bo'sh ko'rsatkichlar, kunlik savdo tushumlari, ofitsiantlar samaradorligi va to'liq audit monitoringi.
      </p>

      <div class="desktop-mockup">
        <img class="desktop-screen" src="${img08}" alt="Boshqaruv Paneli">
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 10px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #064e3b;">🗺️ Stollar Xaritasi</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Qaysi stol band (sariq), qaysi biri bo'sh (yashil) ekanligini real vaqtda ko'rsatadi.</div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #064e3b;">📊 Kunlik Moliya</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Server darajasidagi PostgreSQL agregatsiyalari, soxta raqamlarsiz sof tushum.</div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #064e3b;">👥 Xodimlar Nazorati</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Ofitsiantlar, kassirlar va oshpazlar faoliyatini bir joydan boshqarish.</div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>MENUREST.UZ — 8-Bosqich: Boshqaruv Paneli</span>
      <span>8-sahifa</span>
    </div>
  </div>

  <!-- ================= PAGE 9: XULOSA VA SOTUV TAKLIFI ================= -->
  <div class="page">
    <div class="header-bar">
      <div class="logo-text">🍽️ MENUREST.UZ</div>
      <div class="badge-tag">TIJORAT TAKLIFI • XULOSA</div>
    </div>

    <div style="display: flex; flex-direction: column; justify-content: space-between; flex: 1; padding: 10px 0;">
      <div>
        <h2 class="card-title" style="font-size: 26px; color: #064e3b; margin-bottom: 8px;">Nega Aynan MENUREST.UZ Tizimi?</h2>
        <p class="card-desc" style="margin-bottom: 20px;">
          MENUREST.UZ shunchaki rasm ko'rsatadigan oddiy veb-sayt emas. Bu restoran biznesini to'liq raqamlashtiruvchi, xarajatlarni qisqartiruvchi va savdo hajmini oshiruvchi tayyor korxona darajasidagi (Enterprise SaaS) dasturiy ta'minotdir.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">🚀 Texnik Afzalliklari:</div>
            <ul class="feature-list">
              <li class="feature-item"><span class="feature-icon">✔</span><strong>Crash Recovery Outbox:</strong> Server yoki internet uzilsa ham zakazlar yo'qolmaydi.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>Minor-unit tiyin hisobi:</strong> 1 tiyingacha aniq moliyaviy balans, yaxlitlash xatolarisiz.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>Poyga holatlaridan himoya:</strong> Ikki kassir bir vaqtda to'lov qilsa ham hisob buzilmaydi.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>Multi-tenant:</strong> Bitta serverda 100 lab mustaqil restoranlarni ulash imkoniyati.</li>
            </ul>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px;">
            <div style="font-size: 14px; font-weight: 800; color: #064e3b; margin-bottom: 8px;">💼 Biznes Uchun Foydasi:</div>
            <ul class="feature-list">
              <li class="feature-item"><span class="feature-icon">✔</span><strong>Ofitsiant xarajatini 40% qisqartirish:</strong> Kamroq xodim bilan ko'proq mijozga xizmat.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>O'rtacha chekni oshirish:</strong> Chiroyli rasmlar va modifikatorlar ko'proq buyurtma oladi.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>O'g'rilik va kamomadni to'xtatish:</strong> Har bir buyurtma va to'lov server auditida saqlanadi.</li>
              <li class="feature-item"><span class="feature-icon">✔</span><strong>100% tayyor mahsulot:</strong> Darhol ishga tushirish va sotishga tayyor.</li>
            </ul>
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #ffffff; padding: 22px; border-radius: 16px; text-align: center;">
          <div style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Loyiha Barcha Kodlari va Huquqlari Bilan Sotiladi</div>
          <div style="font-size: 13px; color: #a7f3d0; margin-bottom: 14px;">Frontend (React) + Backend (Node.js/Prisma) + PostgreSQL + Barcha hujjatlar va skriptlar to'liq topshiriladi.</div>
          <div style="font-size: 14px; font-weight: 700; background: rgba(255,255,255,0.15); display: inline-block; padding: 6px 18px; border-radius: 20px;">
            📞 Savollar va Sotib Olish Bo'yicha Aloqa: +998 97 622 00 34
          </div>
        </div>
      </div>

      <div class="footer-bar">
        <span>MENUREST.UZ — Tijorat Taqdimoti</span>
        <span>9-sahifa / Yakun</span>
      </div>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(HTML_PATH, htmlContent);
console.log('Generated presentation HTML at:', HTML_PATH);

async function generatePdf() {
  console.log('Starting Chrome headless to render PDF...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9227',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1200,1000',
    'about:blank',
  ]);

  try {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9227/json/list');
        if (res.ok) {
          const list = await res.json();
          const page = list.find((t) => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            const ws = new WebSocket(page.webSocketDebuggerUrl);
            await new Promise((resolve, reject) => {
              ws.onopen = resolve;
              ws.onerror = reject;
            });

            let reqId = 1;
            const send = (method, params = {}) =>
              new Promise((resolve) => {
                const id = reqId++;
                const handler = (ev) => {
                  const m = JSON.parse(ev.data);
                  if (m.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(m.result);
                  }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
              });

            await send('Page.enable');
            const fileUrl = 'file:///' + HTML_PATH.replace(/\\/g, '/');
            console.log('Navigating to HTML file:', fileUrl);
            await send('Page.navigate', { url: fileUrl });
            await new Promise((r) => setTimeout(r, 2500));

            console.log('Printing to PDF...');
            const pdfResult = await send('Page.printToPDF', {
              printBackground: true,
              paperWidth: 8.27, // A4 inches
              paperHeight: 11.69,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              preferCSSPageSize: true,
            });

            if (pdfResult && pdfResult.data) {
              const buffer = Buffer.from(pdfResult.data, 'base64');
              fs.writeFileSync(PDF_PATH, buffer);
              console.log(`PDF successfully generated at: ${PDF_PATH} (${Math.round(buffer.length / 1024)} KB)`);

              // Also copy to desktop if accessible
              const desktopPath = 'C:\\Users\\user\\OneDrive\\Desktop\\MENUREST_UZ_LOYIHA_TAQDIMOTI.pdf';
              try {
                fs.copyFileSync(PDF_PATH, desktopPath);
                console.log(`Also copied directly to Desktop: ${desktopPath}`);
              } catch (e) {
                console.warn('Could not copy to desktop path:', e.message);
              }
            }

            ws.close();
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
}

generatePdf();
