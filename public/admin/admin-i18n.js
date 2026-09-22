// Admin Paneli uchun 3 tilli tarjima tizimi (UZ / RU / EN)
const adminTranslations = {
  uz: {
    // Rollar
    role_manager: "Restoran Menejeri",
    role_boss: "Restoran Boshlig'i",
    role_cashier: "Kassa (POS Kassir)",
    role_waiter: "Restoran Ofitsiant",
    role_label: "Rol:",

    // Sidebar
    nav_roles: "Xodimlar & Rollar",
    nav_boss: "Boshliq (Moliya)",
    nav_cashier: "Kassa (To'lovlar)",
    nav_waiter: "Ofitsiant (Chaqiruvlar)",
    nav_manager: "Menejer Bo'limlari",
    nav_orders: "Jonli Buyurtmalar",
    nav_menu: "Taomlar (Menyu)",
    nav_categories: "Kategoriyalar",
    nav_qr: "Stollar & QR Kodlar",
    nav_kitchen: "Oshxona (KDS)",
    nav_settings: "Sozlamalar",
    nav_logout: "Chiqish",
    view_live_menu: "Menyuni ko'rish",

    // Sahifa sarlavhalari
    title_boss: "Boshliq - Moliya va Savdo Tahlili",
    title_cashier: "Kassa - To'lovlar va Chek Chiqarish",
    title_waiter: "Ofitsiant - Chaqiruvlar va Yetkazish",
    title_orders: "Jonli Buyurtmalar & Stollar",
    title_menu: "Taomlar Menyusi",
    title_categories: "Kategoriyalar Boshqaruvi",
    title_qr: "Stollar & QR Kodlar Stikerlari",
    title_settings: "Restoran Sozlamalari",

    // Boshliq paneli
    boss_header_title: "Restoran Boshlig'i Paneli",
    boss_header_desc: "Moliyaviy tushumlar, o'rtacha chek, vizual grafiklar va xodimlar ish unumdorligi",
    boss_btn_copy: "Qisqa Xulosa Nusxalash",
    boss_btn_excel: "Excel (CSV) Yuklab Olish",
    boss_btn_print: "Moliyaviy Hisobotni Chop Etish",
    boss_period_label: "Davr:",
    boss_p_today: "Bugun",
    boss_p_yesterday: "Kecha",
    boss_p_week: "Oxirgi 7 kun",
    boss_p_month: "Shu oy",
    boss_p_all: "Barcha vaqt",

    kpi_today_revenue: "Bugungi Tushum",
    kpi_period_revenue: "Tanlangan Davr Tushumi",
    kpi_avg_check: "O'rtacha Chek",
    kpi_avg_check_desc: "Bitta buyurtmaga to'g'ri keladigan summa",
    kpi_peak_hour: "Eng Qizg'in Soat (Rush Hour)",
    kpi_peak_desc: "Maksimal tushumli vaqt",
    kpi_total_orders: "Jami Buyurtmalar",
    kpi_orders_desc: "Tanlangan davrdagi cheklar soni",
    kpi_service_fee: "Xizmat Haqidan Tushum",
    kpi_service_desc: "Xodimlar fondi",
    kpi_cancelled_loss: "Bekor Qilinganlar (Zarar)",

    chart_sales_title: "Savdo Dinamikasi Grafigi",
    chart_sales_sub: "Kunbay tushum",
    chart_peak_title: "Eng Qizg'in Soatlar (Peak Hours)",
    chart_peak_sub: "00:00 - 23:00 soatlar",
    chart_waiters_title: "Ofitsiantlar Ish Unumdorligi",
    chart_waiters_sub: "Xodimlar natijalari",
    chart_payments_title: "To'lov Usullari Taqsimoti",
    chart_payments_sub: "Ulashuvi (%)",

    th_waiter: "Ofitsiant / Kassir",
    th_orders_count: "Buyurtmalar",
    th_total_revenue: "Jami Savdo",
    th_avg_check: "O'rtacha Chek",

    dishes_analysis_title: "Taomlar Savdosi Tahlili",
    btn_top_dishes: "🏆 Top 5",
    btn_least_dishes: "⚠️ Kam sotilganlar",
    reviews_title: "Bugungi Fikr-Mulohazalar (NPS)",
    no_reviews_today: "Bugun hali mijozlar tomonidan yangi fikr-mulohaza qoldirilmadi",

    // Kassa
    cashier_unpaid_title: "To'lov Kutilayotgan Stollar:",
    cashier_all_paid: "Barcha stollar hisob-kitob qilingan!",
    cashier_all_paid_desc: "Hozirda to'lov kutilayotgan stollar mavjud emas.",
    cashier_paid_history: "Bugun To'langan Cheklar (Kassa Jurnali):",
    btn_z_report: "Z-Hisobot (Smena Yopish)",
    btn_accept_pay: "To'lovni qabul qilish",

    // Ofitsiant
    waiter_banner_title: "Ofitsiant Ishchi Stansiyasi",
    waiter_banner_desc: "Stollardan chaqiruvlar, oshxonadan tayyor taomlar va qo'lda yangi buyurtma olish.",
    waiter_calls_title: "Stollardan Kelgan Chaqiruvlar:",
    waiter_ready_title: "Oshxonadan Yetkazilishi Kerak Bo'lgan Taomlar:",

    // Umumiy
    currency: "so'm",
    copied_alert: "✅ Qisqa hisobot nusxalandi! Endi uni Telegram yoki xabarlarga tashlashingiz mumkin.",
    cancel_reason_prompt: "Buyurtmani bekor qilish sababini kiriting (masalan: Mijoz rad etdi, Taom tugagan, Oshxona kechikdi):"
  },

  ru: {
    // Роли
    role_manager: "Менеджер ресторана",
    role_boss: "Директор ресторана",
    role_cashier: "Кассир (POS)",
    role_waiter: "Официант",
    role_label: "Роль:",

    // Боковое меню
    nav_roles: "Сотрудники и Роли",
    nav_boss: "Директор (Финансы)",
    nav_cashier: "Касса (Платежи)",
    nav_waiter: "Официант (Вызовы)",
    nav_manager: "Разделы Менеджера",
    nav_orders: "Онлайн Заказы",
    nav_menu: "Меню блюд",
    nav_categories: "Категории",
    nav_qr: "Столы и QR-коды",
    nav_kitchen: "Кухня (KDS)",
    nav_settings: "Настройки",
    nav_logout: "Выйти",
    view_live_menu: "Просмотр меню",

    // Заголовки страниц
    title_boss: "Директор - Финансовый и Торговый Анализ",
    title_cashier: "Касса - Платежи и Печать Чеков",
    title_waiter: "Официант - Вызовы и Доставка",
    title_orders: "Текущие Заказы и Столы",
    title_menu: "Меню Блюд",
    title_categories: "Управление Категориями",
    title_qr: "Столы и Стикеры QR-кодов",
    title_settings: "Настройки Ресторана",

    // Панель директора
    boss_header_title: "Панель Директора Ресторана",
    boss_header_desc: "Финансовая выручка, средний чек, визуальные графики и продуктивность персонала",
    boss_btn_copy: "Скопировать Сводку",
    boss_btn_excel: "Скачать Excel (CSV)",
    boss_btn_print: "Печать Финансового Отчёта",
    boss_period_label: "Период:",
    boss_p_today: "Сегодня",
    boss_p_yesterday: "Вчера",
    boss_p_week: "Последние 7 дней",
    boss_p_month: "Этот месяц",
    boss_p_all: "Всё время",

    kpi_today_revenue: "Выручка за сегодня",
    kpi_period_revenue: "Выручка за период",
    kpi_avg_check: "Средний Чек",
    kpi_avg_check_desc: "Сумма, приходящаяся на один заказ",
    kpi_peak_hour: "Пиковый Час (Rush Hour)",
    kpi_peak_desc: "Время максимальных продаж",
    kpi_total_orders: "Всего Заказов",
    kpi_orders_desc: "Количество чеков за выбранный период",
    kpi_service_fee: "Доход от Обслуживания",
    kpi_service_desc: "Фонд персонала",
    kpi_cancelled_loss: "Отменено (Убыток)",

    chart_sales_title: "Динамика Продаж",
    chart_sales_sub: "Выручка по дням",
    chart_peak_title: "Пиковые Часы (Rush Hours)",
    chart_peak_sub: "Часы с 00:00 до 23:00",
    chart_waiters_title: "Продуктивность Официантов",
    chart_waiters_sub: "Результаты сотрудников",
    chart_payments_title: "Способы Оплаты",
    chart_payments_sub: "Доля в процентах (%)",

    th_waiter: "Официант / Кассир",
    th_orders_count: "Заказов",
    th_total_revenue: "Выручка",
    th_avg_check: "Средний чек",

    dishes_analysis_title: "Анализ Продаж Блюд",
    btn_top_dishes: "🏆 Топ 5",
    btn_least_dishes: "⚠️ Менее популярные",
    reviews_title: "Отзывы Гостей за Сегодня (NPS)",
    no_reviews_today: "Сегодня гости пока не оставили отзывов",

    // Касса
    cashier_unpaid_title: "Столы, ожидающие оплаты:",
    cashier_all_paid: "Все столы рассчитаны!",
    cashier_all_paid_desc: "На данный момент нет столов, ожидающих оплаты.",
    cashier_paid_history: "Оплаченные чеки за сегодня (Журнал кассы):",
    btn_z_report: "Z-Отчёт (Закрыть смену)",
    btn_accept_pay: "Принять оплату",

    // Официант
    waiter_banner_title: "Рабочая Станция Официанта",
    waiter_banner_desc: "Вызовы от столов, готовые блюда из кухни и ручной приём заказов.",
    waiter_calls_title: "Вызовы со столов:",
    waiter_ready_title: "Блюда, готовые к подаче из кухни:",

    // Общее
    currency: "сум",
    copied_alert: "✅ Краткий отчёт скопирован! Теперь вы можете отправить его в Telegram или SMS.",
    cancel_reason_prompt: "Укажите причину отмены заказа (например: Гость отказался, Блюдо закончилось, Задержка кухни):"
  },

  en: {
    // Roles
    role_manager: "Restaurant Manager",
    role_boss: "Restaurant Director",
    role_cashier: "Cashier (POS)",
    role_waiter: "Waiter",
    role_label: "Role:",

    // Sidebar
    nav_roles: "Staff & Roles",
    nav_boss: "Director (Finance)",
    nav_cashier: "Cashier (Payments)",
    nav_waiter: "Waiter (Calls)",
    nav_manager: "Manager Sections",
    nav_orders: "Live Orders",
    nav_menu: "Dishes (Menu)",
    nav_categories: "Categories",
    nav_qr: "Tables & QR Codes",
    nav_kitchen: "Kitchen (KDS)",
    nav_settings: "Settings",
    nav_logout: "Logout",
    view_live_menu: "View Menu",

    // Page titles
    title_boss: "Director - Financial & Sales Analytics",
    title_cashier: "Cashier - Payments & Receipt Printing",
    title_waiter: "Waiter - Calls & Delivery",
    title_orders: "Live Orders & Tables",
    title_menu: "Dishes Menu",
    title_categories: "Category Management",
    title_qr: "Tables & QR Code Stickers",
    title_settings: "Restaurant Settings",

    // Boss panel
    boss_header_title: "Restaurant Director Dashboard",
    boss_header_desc: "Financial revenue, average check, visual charts and staff productivity",
    boss_btn_copy: "Copy Quick Summary",
    boss_btn_excel: "Export Excel (CSV)",
    boss_btn_print: "Print Financial Report",
    boss_period_label: "Period:",
    boss_p_today: "Today",
    boss_p_yesterday: "Yesterday",
    boss_p_week: "Last 7 days",
    boss_p_month: "This month",
    boss_p_all: "All time",

    kpi_today_revenue: "Today's Revenue",
    kpi_period_revenue: "Selected Period Revenue",
    kpi_avg_check: "Average Check",
    kpi_avg_check_desc: "Average amount per single order",
    kpi_peak_hour: "Peak Hour (Rush Hour)",
    kpi_peak_desc: "Highest revenue sales hour",
    kpi_total_orders: "Total Orders",
    kpi_orders_desc: "Number of completed checks in period",
    kpi_service_fee: "Service Fee Revenue",
    kpi_service_desc: "Staff bonus fund",
    kpi_cancelled_loss: "Cancelled (Loss)",

    chart_sales_title: "Sales Trend Dynamics",
    chart_sales_sub: "Daily revenue",
    chart_peak_title: "Peak Hours (Rush Hours)",
    chart_peak_sub: "00:00 - 23:00 hours",
    chart_waiters_title: "Waiter Productivity",
    chart_waiters_sub: "Staff performance",
    chart_payments_title: "Payment Methods Breakdown",
    chart_payments_sub: "Share percentage (%)",

    th_waiter: "Waiter / Cashier",
    th_orders_count: "Orders",
    th_total_revenue: "Total Sales",
    th_avg_check: "Avg Check",

    dishes_analysis_title: "Dishes Sales Performance",
    btn_top_dishes: "🏆 Top 5",
    btn_least_dishes: "⚠️ Least Selling",
    reviews_title: "Today's Guest Feedback (NPS)",
    no_reviews_today: "No guest reviews submitted today yet",

    // Cashier
    cashier_unpaid_title: "Tables Awaiting Payment:",
    cashier_all_paid: "All tables are settled!",
    cashier_all_paid_desc: "There are currently no tables awaiting payment.",
    cashier_paid_history: "Today's Paid Receipts (Register Log):",
    btn_z_report: "Z-Report (Close Shift)",
    btn_accept_pay: "Accept Payment",

    // Waiter
    waiter_banner_title: "Waiter Workstation",
    waiter_banner_desc: "Table call alerts, kitchen ready orders, and manual order taking.",
    waiter_calls_title: "Incoming Table Calls:",
    waiter_ready_title: "Dishes Ready for Table Delivery:",

    // General
    currency: "UZS",
    copied_alert: "✅ Summary copied to clipboard! You can now paste and send it.",
    cancel_reason_prompt: "Enter cancellation reason (e.g., Guest changed mind, Out of stock, Kitchen delay):"
  }
};

let currentAdminLang = localStorage.getItem('admin_lang') || 'uz';

function at(key) {
  if (adminTranslations[currentAdminLang] && adminTranslations[currentAdminLang][key]) {
    return adminTranslations[currentAdminLang][key];
  }
  return adminTranslations.uz[key] || key;
}

function setAdminLanguage(lang) {
  if (adminTranslations[lang]) {
    currentAdminLang = lang;
    localStorage.setItem('admin_lang', lang);
    applyAdminLanguage();
  }
}
window.setAdminLanguage = setAdminLanguage;
window.at = at;
