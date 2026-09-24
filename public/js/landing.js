let allRestaurants = [];

    // Landing Page 3 tilli tarjima tizimi (UZ / RU / EN)
    const landingTranslations = {
      uz: {
        nav_restaurants: "Restoranlar",
        nav_how_it_works: "Qanday ishlaydi?",
        nav_comparison: "Taqqoslash",
        nav_kitchen: "Oshxona & KDS",
        nav_benefits: "Afzalliklar",
        nav_calculator: "Kalkulyator",
        nav_pricing: "Tariflar",
        nav_faq: "FAQ",
        nav_contact: "Bizga bog'lanish",
        nav_quick_contact: "Ariza qoldirish",
        nav_admin: "Admin",
        hero_badge: "<i class=\"fa-solid fa-sparkles\"></i> Ko'p Tarmoqli SaaS Platformasi",
        hero_title: "Restoran va Kafelar uchun<br><span>Zamonaviy Elektron QR Menyu</span>",
        hero_desc: "Mijozlar stol ustidagi QR kodni skanerlab menyuni ko'rishadi va buyurtma berishadi. Har bir restoran uchun mustaqil kabinet, oshpazlar uchun oshxona ekrani va chop etishga tayyor QR stikerlar.",
        hero_btn_menu: "<i class=\"fa-solid fa-utensils\"></i> Restoranlar Menyusi",
        hero_btn_demo: "<i class=\"fa-solid fa-paper-plane\"></i> Ariza qoldirish",
        quick_demo_title: "<i class=\"fa-solid fa-play\"></i> Jonli Demo:",
        demo_customer: "<i class=\"fa-solid fa-mobile-screen\"></i> Mijoz menyusi",
        demo_kitchen: "<i class=\"fa-solid fa-fire-burner\"></i> Oshxona ekrani",
        demo_admin: "<i class=\"fa-solid fa-gear\"></i> Admin panel",
        stat_rest: "Faol Restoranlar",
        stat_dishes: "Mazali Taomlar",
        stat_paperless: "Qog'ozsiz Tezkor Xizmat",
        sec_partners_sub: "Hamkorlarimiz",
        sec_partners_title: "Bizning Tizimdan Foydalanayotgan Restoranlar",
        sec_partners_desc: "Quyidagi restoranlarning menyusini onlayn ko'rishingiz yoki stol QR kodini skanerlab buyurtma berish jarayonini sinab ko'rishingiz mumkin.",
        search_placeholder: "Restoran nomi bo'yicha qidirish...",
        no_rest_found: "Restoranlar topilmadi",
        tables_label: "ta stol",
        btn_view_menu: "Menyuni Ko'rish",
        btn_scan_qr: "QR Kodni telefonda skanerlash",
        sec_how_sub: "Oson va Tez",
        sec_how_title: "Tizim Qanday Ishlaydi?",
        sec_how_desc: "Mijozlar uchun ham, restoran ma'muriyati uchun ham maksimal darajada sodda",
        step1_title: "QR Kodni Skanerlash",
        step1_desc: "Mijoz stol ustida turgan chiroyli stikerdagi QR kodni telefon kamerasi bilan skanerlaydi. Hech qanday ilova o'rnatish shart emas.",
        step2_title: "Menyuni Tanlash & Savat",
        step2_desc: "Telefon ekranida qulay menyu ochiladi. Rasmlar, narxlar, tavsiflar bilan tanishib, taomlar savatga qo'shiladi.",
        step3_title: "Buyurtma & Ofitsiant",
        step3_desc: "Mijoz \"Buyurtma berish\" yoki \"Ofitsiant chaqirish\" tugmasini bosadi. Buyurtma darhol admin panelda stol raqami bilan aks etadi.",
        
        // Taqqoslash
        sec_comp_sub: "Yangi avlod yondashuvi",
        sec_comp_title: "Qog'oz Menyu vs Bizning QR Menyu",
        sec_comp_desc: "Nega an'anaviy qog'oz menyulardan elektron QR menyuga o'tish restoraningiz daromadini oshiradi?",
        comp_old_badge: "Eskirgan usul",
        comp_old_title: "An'anaviy Qog'oz Menyu",
        comp_old_desc: "Katta xarajatlar, sekin xizmat va cheklangan imkoniyatlar",
        comp_old_1_title: "Qimmat bosma xarajatlar:",
        comp_old_1_desc: "Har safar narx yoki taom o'zgarganda butun menyuni qayta chop etish kerak.",
        comp_old_2_title: "Eskiradi va yirtiladi:",
        comp_old_2_desc: "Yog' dog'lari, eskirgan sahifalar mijozda salbiy taassurot qoldiradi.",
        comp_old_3_title: "Faqat 1 ta tilda:",
        comp_old_3_desc: "Xorijiy sayyohlar va mehmonlar taom tarkibini tushunishga qiynaladi.",
        comp_old_4_title: "Ofitsiantni kutish:",
        comp_old_4_desc: "Mijoz menyu olish va buyurtma berish uchun ofitsiantni 10-15 daqiqa kutadi.",
        comp_new_badge: "Zamonaviy yechim",
        comp_new_title: "Bizning Zamonaviy QR Menyu",
        comp_new_desc: "0 so'm qayta chop etish, tezkor yangilash va 2 barobar tezroq xizmat",
        comp_new_1_title: "0 so'm bosma xarajati:",
        comp_new_1_desc: "Stikerlar 1 marta chop etiladi, narxlar va taomlar esa admin paneldan 1 soniyada o'zgartiriladi.",
        comp_new_2_title: "Doim toza va jozibador:",
        comp_new_2_desc: "Har bir taomning ishtahani ochuvchi yuqori sifatli fotosurati va batafsil tavsifi.",
        comp_new_3_title: "3 ta tilda (UZ / RU / EN):",
        comp_new_3_desc: "Xorijlik mehmonlar bemalol o'z ona tilida menyuni ko'rib buyurtma bera oladi.",
        comp_new_4_title: "2x tezkor xizmat va chaqiruv:",
        comp_new_4_desc: "Mijoz ofitsiantni kutmaydi, to'g'ridan-to'g'ri buyurtma beradi yoki 1 tugma bilan chaqiradi.",

        // Oshxona (KDS)
        kds_badge: "<i class=\"fa-solid fa-fire-burner\"></i> Oshxona & Boshqaruv",
        kds_title: "Oshxona Ekrani (KDS) va<br><span style=\"color: var(--primary);\">Qulay Boshqaruv Paneli</span>",
        kds_desc: "Ofitsiantlar oshxonaga yugurib qog'oz chek tashishiga hojat yo'q. Mijoz stoldan buyurtma berishi bilan oshxonadagi monitor yoki planshetda yangi buyurtma darhol ovozli signal bilan ko'rinadi.",
        kds_f1_title: "Real-vaqtda bildirishnoma",
        kds_f1_desc: "Yangi buyurtma va ofitsiant chaqiruvlari darhol ekranda porlaydi",
        kds_f2_title: "Tayyorlash holatlari nazorati",
        kds_f2_desc: "\"Yangi\" -> \"Tayyorlanmoqda\" -> \"Tayyor\" statuslarini 1 bosishda o'zgartirish",
        kds_f3_title: "Statistika va tushumlar",
        kds_f3_desc: "Eng ko'p sotilgan taomlar va kunlik savdo ko'rsatkichlari",
        kds_btn_kitchen: "<i class=\"fa-solid fa-tv\"></i> Oshxona Ekrani (Demo)",
        kds_btn_admin: "<i class=\"fa-solid fa-sliders\"></i> Admin Panel",

        // Afzalliklar
        sec_benefits_sub: "Nega aynan biz?",
        sec_benefits_title: "Restoran Egasiga Beradigan Afzalliklari",
        sec_benefits_desc: "Xarajatlarni kamaytiring, xizmat ko'rsatish tezligini va mijozlar oqimini oshiring",
        benefit1_title: "Menyu chop etishga chek",
        benefit1_desc: "Qog'oz menyular eskirsa yoki narxlar o'zgarsa qayta chop etishga pul sarflamaysiz. Admin paneldan 1 soniyada o'zgartirasiz.",
        benefit2_title: "2x Tezroq Xizmat",
        benefit2_desc: "Mijozlar ofitsiantni kutmasdan menyu bilan tanishishadi. Ofitsiant faqat tayyor buyurtmani yetkazib berishga ulguradi.",
        benefit3_title: "Ko'p Tillilik (3 tilda)",
        benefit3_desc: "O'zbek, rus va ingliz tillarida interfeys mavjud. Xorijiy sayyohlar va mehmonlar bemalol o'z tilida buyurtma bera oladi.",
        benefit4_title: "Tayyor QR Stikerlar",
        benefit4_desc: "Tizim avtomatik ravishda restoraningiz logotipi va stol raqamlari bilan chiroyli stikerlarni generatsiya qiladi. Printerdan chop eting va stolga yopishtiring!",

        // Kalkulyator
        sec_calc_sub: "Foydani hisoblang",
        sec_calc_title: "QR Menyu Bilan Qancha Mablag' Tejay Olasiz?",
        sec_calc_desc: "Stollaringiz sonini tanlang va an'anaviy qog'oz menyulardan elektron tizimga o'tish orqali yillik tejovni hisoblang",
        calc_table_count_title: "Restorandagi stollar soni:",
        calc_note: "Hisob-kitob 1 ta stol uchun qog'oz menyuni yil davomida chop etish, yangilash va yirtilganlarini almashtirish o'rtacha 250,000 so'm xarajatiga asoslangan.",
        calc_res_title: "Yillik O'rtacha Tejamkorlik:",
        calc_res_desc: "Qog'oz menyular chop etishdan tejalgan pul",
        calc_time_title: "Vaqt tejalishi / yil",
        calc_speed_title: "Xizmat tezligi",
        calc_btn: "<i class=\"fa-solid fa-arrow-down\"></i> Tejamkorlikni Boshlash",

        // Tariflar
        sec_price_sub: "Shaffof narxlar",
        sec_price_title: "O'z Restoraningiz Uchun Qulay Tarifni Tanlang",
        sec_price_desc: "Yashirin to'lovlarsiz. Istalgan vaqtda bekor qilish yoki boshqa tarifga o'tish imkoniyati",
        price_popular_badge: "Eng Ko'p Tanlangan",
        price_start_title: "Start (Sinov)",
        price_start_desc: "Yangi boshlovchi kichik kafelar va sinab ko'rish uchun",
        price_start_amount: "7 kun bepul",
        price_start_period: "so'ngra 99 000 so'm / oy",
        price_start_f1: "1 ta restoran / filial",
        price_start_f2: "30 tagacha taom va toifalar",
        price_start_f3: "10 tagacha stol QR stikerlari",
        price_start_f4: "3 ta til (UZ, RU, EN)",
        price_start_f5: "Elektron mobil menyu",
        price_start_btn: "Sinab ko'rish",
        price_standart_title: "Standart (Ommabop)",
        price_standart_desc: "Rivojlanayotgan restoran, kafe va choyxonalar uchun to'liq to'plam",
        price_standart_amount: "190 000 so'm",
        price_standart_period: "oyiga to'lov",
        price_standart_f1: "Cheksiz taomlar va toifalar",
        price_standart_f2: "50 tagacha stollar soni",
        price_standart_f3: "Ofitsiant chaqirish va hisob so'rash",
        price_standart_f4: "Savat va stol bo'yicha jonli buyurtma",
        price_standart_f5: "Chop etishga tayyor QR stikerlar",
        price_standart_f6: "3 ta til (UZ, RU, EN)",
        price_standart_btn: "Tarifni Tanlash",
        price_prem_title: "Premium (Pro)",
        price_prem_desc: "Katta restoranlar va tarmoqlar uchun to'liq avtomatlashtirish",
        price_prem_amount: "350 000 so'm",
        price_prem_period: "oyiga to'lov",
        price_prem_f1: "Standart tarifidagi barcha imkoniyatlar",
        price_prem_f2: "Barcha stollar cheksiz",
        price_prem_f3: "Shaxsiy brending va domen",
        price_prem_f4: "Batafsil sotuv va tushum statistikasi",
        price_prem_f5: "Mijozlar bahosi va sharhlari boshqaruvi",
        price_prem_f6: "24/7 shaxsiy menejer yordami",
        price_prem_btn: "Tarifni Tanlash",

        // FAQ
        sec_faq_sub: "Ko'p so'raladigan savollar",
        sec_faq_title: "Tez-tez Beriladigan Savollar (FAQ)",
        sec_faq_desc: "QR Menyu platformasi haqida eng muhim savollarga ochiq va tushunarli javoblar",
        faq1_q: "Mijozlar telefoniga biror ilova (app) yuklab olishi shartmi?",
        faq1_a: "Yo'q, mutlaqo shart emas! Mijoz oddiy smartfon kamerasini stol ustidagi QR kodga qaratadi va darhol brauzerda restoraningiz menyusi ochiladi. Hech qanday ro'yxatdan o'tish yoki yuklab olish talab qilinmaydi.",
        faq2_q: "Internet sekinlashsa yoki vaqtincha uzilsa menyu ishlaydimi?",
        faq2_a: "Ha, tizim zamonaviy PWA (Progressive Web App) texnologiyasida yaratilgan. Menyu bir marta ochilgach ma'lumotlar avtomatik keshlanadi va hatto internet sekin bo'lganda ham juda tez va uzluksiz ishlaydi.",
        faq3_q: "Taomlar narxini yoki yangi taom qo'shishni o'zim qila olamanmi?",
        faq3_a: "Albatta! Sizga maxsus qulay Admin panel taqdim etiladi. O'z telefoningiz yoki kompyuteringiz orqali istalgan soniyada yangi taom qo'shishingiz, narxlarni o'zgartirishingiz yoki tugab qolgan taomlarni 1 tugma bilan vaqtincha o'chirib qo'yishingiz mumkin.",
        faq4_q: "Stollar uchun QR stikerlarni qayerdan olamiz?",
        faq4_a: "Admin paneldan 1 bosish orqali barcha stollaringiz uchun restoraningiz logotipi va stol raqami yozilgan tayyor, chiroyli dizayndagi QR kodlarni PDF / rasm sifatida yuklab olib printerdan chop etishingiz mumkin. Shuningdek, jamoamiz tayyor stikerlarni tayyorlab berishda ham yordam beradi.",
        faq5_q: "Ofitsiant chaqirish va hisob so'rash tizimi qanday ishlaydi?",
        faq5_a: "Mijoz telefonida \"Ofitsiant chaqirish\" yoki \"Hisob so'rash\" tugmasini bosganda, admin panelda va ofitsiantlar ekranida stol raqami va vaqti bilan darhol ovozli signal va bildirishnoma aks etadi.",
        faq6_q: "Tizimni restoranimizga ulash qancha vaqt oladi?",
        faq6_a: "Odatda bor-yo'g'i 1 kun! Siz bizga menyuingizni (rasm yoki fayl ko'rinishida) yuborasiz, mutaxassislarimiz barcha ma'lumotlarni kiritib, stikerlarni tayyorlab beradi va xodimlaringizga qisqa vaqtda o'rgatadi.",

        // Bog'lanish va Forma
        sec_contact_sub: "Hamkorlikni boshlaymiz",
        sec_contact_title: "Biz Bilan Bog'laning yoki Ariza Qoldiring",
        sec_contact_desc: "O'z restoraningizga tizimni ulash, bepul sinovdan foydalanish yoki batafsil ma'lumot olish uchun ma'lumotlaringizni qoldiring",
        contact_phone_title: "Telefon bilan bog'lanish",
        contact_phone_call: "<span>Qo'ng'iroq qilish</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_tg_title: "Telegram bilan bog'lanish",
        contact_tg_write: "<span>Yozish (Chat)</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_bonus_title: "7 kunlik bepul sinov",
        contact_bonus_desc: "Arizangizni qoldiring, mutaxassisimiz 15 daqiqa ichida siz bilan bog'lanib barcha savollaringizga javob beradi va test kabinetini ochib beradi.",
        form_title: "Restoranni ulash uchun ariza",
        form_desc: "Ma'lumotlaringizni qoldiring, biz sizga tezda qaytib chiqamiz",
        form_rest_name: "Restoran yoki kafe nomi *",
        form_owner_name: "Sizning ismingiz *",
        form_phone: "Telefon raqamingiz *",
        form_plan: "Qiziqtirgan tarif",
        form_msg: "Qo'shimcha xabar yoki savolingiz (ixtiyoriy)",
        form_submit: "Arizani Yuborish",
        form_success_msg: "Arizangiz muvaffaqiyatli qabul qilindi! Tez orada mutaxassisimiz siz bilan bog'lanadi.",
        footer_text: "© 2026 Barcha huquqlar himoyalangan. Restoran va kafelar uchun zamonaviy elektron menyu.",
        modal_scan: "Telefoningiz kamerasi orqali skanerlang:",
        modal_table: "<i class=\"fa-solid fa-chair\"></i> 1-stol menyusi",
        modal_close: "Yopish"
      },
      ru: {
        nav_restaurants: "Рестораны",
        nav_how_it_works: "Как это работает?",
        nav_comparison: "Сравнение",
        nav_kitchen: "Кухня & KDS",
        nav_benefits: "Преимущества",
        nav_calculator: "Калькулятор",
        nav_pricing: "Тарифы",
        nav_faq: "FAQ",
        nav_contact: "Связаться с нами",
        nav_quick_contact: "Оставить заявку",
        nav_admin: "Кабинет",
        hero_badge: "<i class=\"fa-solid fa-sparkles\"></i> Мульти-ресторанная SaaS Платформа",
        hero_title: "Современное Электронное QR-Меню<br><span>для Ресторанов и Кафе</span>",
        hero_desc: "Гости сканируют QR-код на столе, смотрят меню и оформляют заказ за секунды. Личный кабинет для заведения, экран кухни и готовые стикеры.",
        hero_btn_menu: "<i class=\"fa-solid fa-utensils\"></i> Каталог Меню",
        hero_btn_demo: "<i class=\"fa-solid fa-paper-plane\"></i> Оставить заявку",
        quick_demo_title: "<i class=\"fa-solid fa-play\"></i> Демо-доступ:",
        demo_customer: "<i class=\"fa-solid fa-mobile-screen\"></i> Меню гостя",
        demo_kitchen: "<i class=\"fa-solid fa-fire-burner\"></i> Экран кухни",
        demo_admin: "<i class=\"fa-solid fa-gear\"></i> Панель админа",
        stat_rest: "Активных Ресторанов",
        stat_dishes: "Вкусных Блюд",
        stat_paperless: "100% Безбумажный Сервис",
        sec_partners_sub: "Наши Партнёры",
        sec_partners_title: "Рестораны, использующие нашу платформу",
        sec_partners_desc: "Вы можете ознакомиться с онлайн-меню или отсканировать QR-код для тестирования заказа.",
        search_placeholder: "Поиск по названию ресторана...",
        no_rest_found: "Рестораны не найдены",
        tables_label: "столов",
        btn_view_menu: "Открыть Меню",
        btn_scan_qr: "Сканировать QR на телефоне",
        sec_how_sub: "Просто и Быстро",
        sec_how_title: "Как работает система?",
        sec_how_desc: "Максимально удобно как для гостей, так и для персонала заведения",
        step1_title: "Сканирование QR-кода",
        step1_desc: "Гость сканирует QR-код на столе камерой смартфона. Установка приложений не требуется.",
        step2_title: "Выбор Блюд и Корзина",
        step2_desc: "На экране смартфона открывается стильное меню с фото, ценами и описанием блюд.",
        step3_title: "Заказ и Официант",
        step3_desc: "Гость нажимает \"Оформить заказ\" или \"Вызов официанта\". Заказ моментально поступает в систему.",
        
        // Сравнение
        sec_comp_sub: "Подход нового поколения",
        sec_comp_title: "Бумажное Меню vs Наше QR-Меню",
        sec_comp_desc: "Почему сотни ресторанов отказываются от бумаги в пользу электронного сервиса?",
        comp_old_badge: "Устаревший способ",
        comp_old_title: "Традиционное Бумажное Меню",
        comp_old_desc: "Постоянные расходы на полиграфию и медленный сервис",
        comp_old_1_title: "Дорогая печать:",
        comp_old_1_desc: "При любом изменении цен или блюд приходится перепечатывать весь тираж.",
        comp_old_2_title: "Изнашивается и пачкается:",
        comp_old_2_desc: "Жирные пятна и потрепанные страницы портят впечатление гостей.",
        comp_old_3_title: "Только 1 язык:",
        comp_old_3_desc: "Иностранным туристам сложно понять состав и особенности блюд.",
        comp_old_4_title: "Ожидание официанта:",
        comp_old_4_desc: "Гость ждет меню и оформление заказа по 10-15 минут.",
        comp_new_badge: "Современное решение",
        comp_new_title: "Наше Современное QR-Меню",
        comp_new_desc: "0 сум на перепечатку, мгновенные правки и в 2 раза быстрее сервис",
        comp_new_1_title: "0 сум затрат на печать:",
        comp_new_1_desc: "Стикеры печатаются 1 раз, а цены меняются из панели за 1 секунду.",
        comp_new_2_title: "Всегда чисто и аппетитно:",
        comp_new_2_desc: "Сочные фотографии высокого разрешения и подробные описания.",
        comp_new_3_title: "3 языка (UZ / RU / EN):",
        comp_new_3_desc: "Иностранные гости с комфортом выбирают блюда на родном языке.",
        comp_new_4_title: "Обслуживание в 2 раза быстрее:",
        comp_new_4_desc: "Гость делает заказ мгновенно или вызывает персонал одной кнопкой.",

        // Кухня
        kds_badge: "<i class=\"fa-solid fa-fire-burner\"></i> Кухня и Управление",
        kds_title: "Экран Кухни (KDS) и<br><span style=\"color: var(--primary);\">Удобная Панель Управления</span>",
        kds_desc: "Официантам не нужно бегать на кухню с бумажками. Как только гость делает заказ, он мгновенно отображается на экране поваров со звуковым сигналом.",
        kds_f1_title: "Оповещения в реальном времени",
        kds_f1_desc: "Новые заказы и вызовы официанта подсвечиваются на экране",
        kds_f2_title: "Контроль статусов приготовления",
        kds_f2_desc: "Смена статусов \"Новый\" -> \"Готовится\" -> \"Готов\" в один клик",
        kds_f3_title: "Статистика и отчеты",
        kds_f3_desc: "Топ популярных блюд и динамика выручки в реальном времени",
        kds_btn_kitchen: "<i class=\"fa-solid fa-tv\"></i> Экран кухни (Демо)",
        kds_btn_admin: "<i class=\"fa-solid fa-sliders\"></i> Панель админа",

        // Преимущества
        sec_benefits_sub: "Почему мы?",
        sec_benefits_title: "Преимущества для Владельца Ресторана",
        sec_benefits_desc: "Снижайте расходы на полиграфию, ускоряйте обслуживание и увеличивайте средний чек",
        benefit1_title: "Экономия на печати меню",
        benefit1_desc: "Забудьте о расходах на повторную печать меню при смене цен или блюд. Изменения вносятся за 1 секунду.",
        benefit2_title: "Обслуживание в 2 раза быстрее",
        benefit2_desc: "Гости не ждут официанта, чтобы сделать заказ. Персонал успевает обслужить больше столов.",
        benefit3_title: "Мультиязычность (3 языка)",
        benefit3_desc: "Поддержка узбекского, русского и английского языков. Иностранные туристы чувствуют себя комфортно.",
        benefit4_title: "Готовые QR-стикеры",
        benefit4_desc: "Система автоматически формирует брендированные стикеры с вашим логотипом и номерами столов для печати.",

        // Калькулятор
        sec_calc_sub: "Рассчитайте выгоду",
        sec_calc_title: "Сколько вы сэкономите с QR-Меню?",
        sec_calc_desc: "Укажите количество столов и узнайте вашу ежегодную экономию на полиграфии и времени",
        calc_table_count_title: "Количество столов в заведении:",
        calc_note: "Расчет основан на средней стоимости печати, обновления и замены бумажных меню (~250 000 сум на 1 стол в год).",
        calc_res_title: "Средняя экономия в год:",
        calc_res_desc: "Сэкономленные деньги на печати меню",
        calc_time_title: "Экономия времени / год",
        calc_speed_title: "Скорость обслуживания",
        calc_btn: "<i class=\"fa-solid fa-arrow-down\"></i> Начать экономить",

        // Тарифы
        sec_price_sub: "Прозрачные тарифы",
        sec_price_title: "Выберите подходящий тариф для вашего заведения",
        sec_price_desc: "Без скрытых комиссий. Отмена или смена тарифа в любое время",
        price_popular_badge: "Самый Популярный",
        price_start_title: "Старт (Тест)",
        price_start_desc: "Для небольших кафе и бесплатного тестирования возможностей",
        price_start_amount: "7 дней бесплатно",
        price_start_period: "далее 99 000 сум / мес",
        price_start_f1: "1 заведение / филиал",
        price_start_f2: "До 30 блюд и категорий",
        price_start_f3: "До 10 QR-стикеров столов",
        price_start_f4: "3 языка (UZ, RU, EN)",
        price_start_f5: "Электронное мобильное меню",
        price_start_btn: "Попробовать",
        price_standart_title: "Стандарт (Хит)",
        price_standart_desc: "Полный набор для растущих ресторанов, кафе и чайхан",
        price_standart_amount: "190 000 сум",
        price_standart_period: "оплата в месяц",
        price_standart_f1: "Неограниченно блюд и категорий",
        price_standart_f2: "До 50 столов",
        price_standart_f3: "Вызов официанта и запрос счета",
        price_standart_f4: "Корзина и онлайн-заказ со стола",
        price_standart_f5: "Готовые QR-стикеры для печати",
        price_standart_f6: "3 языка (UZ, RU, EN)",
        price_standart_btn: "Выбрать тариф",
        price_prem_title: "Премиум (Про)",
        price_prem_desc: "Полная автоматизация для крупных ресторанов и сетей",
        price_prem_amount: "350 000 сум",
        price_prem_period: "оплата в месяц",
        price_prem_f1: "Все возможности тарифа Стандарт",
        price_prem_f2: "Безлимитное количество столов",
        price_prem_f3: "Персональный брендинг и домен",
        price_prem_f4: "Подробная статистика продаж",
        price_prem_f5: "Управление отзывами и рейтингом",
        price_prem_f6: "24/7 персональный менеджер",
        price_prem_btn: "Выбрать тариф",

        // FAQ
        sec_faq_sub: "Частые вопросы",
        sec_faq_title: "Часто Задаваемые Вопросы (FAQ)",
        sec_faq_desc: "Ответы на самые важные вопросы о платформе электронного QR-меню",
        faq1_q: "Нужно ли гостям скачивать специальное приложение?",
        faq1_a: "Нет, абсолютно ничего скачивать не нужно! Гость наводит камеру смартфона на QR-код стола, и меню мгновенно открывается в браузере.",
        faq2_q: "Будет ли работать меню при слабом интернете?",
        faq2_a: "Да, система построена по стандарту PWA. Меню кэшируется при первом открытии и быстро работает даже при слабом мобильном интернете.",
        faq3_q: "Могу ли я сам менять цены и добавлять блюда?",
        faq3_a: "Конечно! В панели администратора со смартфона или компьютера вы можете за 1 секунду обновить цену, добавить фото или скрыть закончившееся блюдо.",
        faq4_q: "Где взять брендированные QR-стикеры для столов?",
        faq4_a: "В личном кабинете доступна генерация стикеров с вашим логотипом и номерами столов в один клик. Вы можете сразу распечатать их на любом принтере.",
        faq5_q: "Как работает вызов официанта и запрос счета?",
        faq5_a: "При нажатии кнопки на смартфоне гостя в панели заведения раздается звуковой сигнал и появляется номер столика.",
        faq6_q: "Сколько времени занимает подключение?",
        faq6_a: "Обычно всего 1 рабочий день! Вы отправляете меню, наши специалисты вносят данные и обучают ваших сотрудников.",

        // Контакты
        sec_contact_sub: "Начнем сотрудничество",
        sec_contact_title: "Свяжитесь с Нами или Оставьте Заявку",
        sec_contact_desc: "Оставьте заявку на подключение заведения или бесплатный 7-дневный тестовый доступ",
        contact_phone_title: "Связаться по телефону",
        contact_phone_call: "<span>Позвонить</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_tg_title: "Связаться в Telegram",
        contact_tg_write: "<span>Написать в Telegram</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_bonus_title: "7 дней бесплатного теста",
        contact_bonus_desc: "Оставьте заявку, наш специалист свяжется с вами в течение 15 минут и откроет тестовый кабинет.",
        form_title: "Заявка на подключение ресторана",
        form_desc: "Заполните форму, и мы оперативно свяжемся с вами",
        form_rest_name: "Название заведения *",
        form_owner_name: "Ваше имя *",
        form_phone: "Номер телефона *",
        form_plan: "Интересующий тариф",
        form_msg: "Комментарий или вопрос (необязательно)",
        form_submit: "Отправить заявку",
        form_success_msg: "Ваша заявка успешно принята! Наш специалист скоро свяжется с вами.",
        footer_text: "© 2026 Все права защищены. Современное электронное QR-меню для ресторанов и кафе.",
        modal_scan: "Отсканируйте камерой вашего телефона:",
        modal_table: "<i class=\"fa-solid fa-chair\"></i> Меню стола №1",
        modal_close: "Закрыть"
      },
      en: {
        nav_restaurants: "Restaurants",
        nav_how_it_works: "How it works?",
        nav_comparison: "Comparison",
        nav_kitchen: "Kitchen & KDS",
        nav_benefits: "Benefits",
        nav_calculator: "Calculator",
        nav_pricing: "Pricing",
        nav_faq: "FAQ",
        nav_contact: "Contact Us",
        nav_quick_contact: "Get Started",
        nav_admin: "Admin",
        hero_badge: "<i class=\"fa-solid fa-sparkles\"></i> Multi-Restaurant SaaS Platform",
        hero_title: "Modern Digital QR Menu<br><span>for Restaurants & Cafes</span>",
        hero_desc: "Guests scan the table QR code to explore the menu and place orders in seconds. Independent dashboard, kitchen display system, and print-ready stickers.",
        hero_btn_menu: "<i class=\"fa-solid fa-utensils\"></i> Browse Menus",
        hero_btn_demo: "<i class=\"fa-solid fa-paper-plane\"></i> Get Started",
        quick_demo_title: "<i class=\"fa-solid fa-play\"></i> Live Demo:",
        demo_customer: "<i class=\"fa-solid fa-mobile-screen\"></i> Customer menu",
        demo_kitchen: "<i class=\"fa-solid fa-fire-burner\"></i> Kitchen display",
        demo_admin: "<i class=\"fa-solid fa-gear\"></i> Admin panel",
        stat_rest: "Active Restaurants",
        stat_dishes: "Delicious Dishes",
        stat_paperless: "100% Paperless Fast Service",
        sec_partners_sub: "Our Partners",
        sec_partners_title: "Restaurants Using Our Platform",
        sec_partners_desc: "Explore live digital menus or scan table QR codes to experience instant ordering.",
        search_placeholder: "Search by restaurant name...",
        no_rest_found: "No restaurants found",
        tables_label: "tables",
        btn_view_menu: "View Menu",
        btn_scan_qr: "Scan QR on phone",
        sec_how_sub: "Fast & Simple",
        sec_how_title: "How Does It Work?",
        sec_how_desc: "Effortless experience for both guests and restaurant management",
        step1_title: "Scan Table QR Code",
        step1_desc: "Guests scan the stylish table sticker with their smartphone camera. No app download needed.",
        step2_title: "Select Dishes & Cart",
        step2_desc: "A mobile-optimized menu opens with photos, prices, descriptions, and dietary options.",
        step3_title: "Order & Call Waiter",
        step3_desc: "Guests tap \"Place Order\" or \"Call Waiter\". Tickets instantly appear on the kitchen & admin screens.",
        
        // Comparison
        sec_comp_sub: "Next-gen approach",
        sec_comp_title: "Paper Menu vs Our Digital QR Menu",
        sec_comp_desc: "Why hundreds of venues are switching from paper menus to smart digital ordering?",
        comp_old_badge: "Outdated way",
        comp_old_title: "Traditional Paper Menu",
        comp_old_desc: "High printing costs, slow service, and limited features",
        comp_old_1_title: "Expensive printing:",
        comp_old_1_desc: "Every time a price or recipe changes, you must reprint the entire batch.",
        comp_old_2_title: "Wears out and stains:",
        comp_old_2_desc: "Grease stains and damaged pages leave a negative impression on guests.",
        comp_old_3_title: "Only 1 language:",
        comp_old_3_desc: "International tourists struggle to understand meal ingredients.",
        comp_old_4_title: "Waiting for a waiter:",
        comp_old_4_desc: "Guests wait 10-15 minutes just to get a menu and place an order.",
        comp_new_badge: "Modern solution",
        comp_new_title: "Our Smart Digital QR Menu",
        comp_new_desc: "$0 reprint costs, instant updates, and 2x faster table turnover",
        comp_new_1_title: "Zero printing fees:",
        comp_new_1_desc: "Stickers are printed once, and prices are updated from your phone in 1 second.",
        comp_new_2_title: "Always clean & appetizing:",
        comp_new_2_desc: "High-definition appetizing photos and detailed allergen descriptions.",
        comp_new_3_title: "3 Languages (UZ / RU / EN):",
        comp_new_3_desc: "Foreign tourists order comfortably in their native language.",
        comp_new_4_title: "2x faster service & call waiter:",
        comp_new_4_desc: "Guests don't wait; they order directly or summon staff with a single tap.",

        // Kitchen
        kds_badge: "<i class=\"fa-solid fa-fire-burner\"></i> Kitchen & Operations",
        kds_title: "Kitchen Display (KDS) &<br><span style=\"color: var(--primary);\">Effortless Dashboard</span>",
        kds_desc: "Waiters don't need to run to the kitchen with paper tickets. Orders instantly ring on the kitchen tablet or TV screen with sound alerts.",
        kds_f1_title: "Real-time alerts",
        kds_f1_desc: "New order tickets and waiter call alerts flash immediately",
        kds_f2_title: "Cooking status management",
        kds_f2_desc: "One-tap transitions from \"New\" -> \"Cooking\" -> \"Ready\"",
        kds_f3_title: "Sales analytics & revenue",
        kds_f3_desc: "Real-time tracking of popular dishes and daily turnover",
        kds_btn_kitchen: "<i class=\"fa-solid fa-tv\"></i> Kitchen Display (Demo)",
        kds_btn_admin: "<i class=\"fa-solid fa-sliders\"></i> Admin Panel",

        // Benefits
        sec_benefits_sub: "Why Choose Us?",
        sec_benefits_title: "Benefits for Restaurant Owners",
        sec_benefits_desc: "Cut printing costs, boost table turnover, and increase average check size",
        benefit1_title: "Zero Menu Printing Costs",
        benefit1_desc: "Never reprint paper menus when prices or dishes change. Update everything in 1 second from your dashboard.",
        benefit2_title: "2x Faster Table Service",
        benefit2_desc: "Guests don't wait for a paper menu. Waiters spend time delivering fresh food instead of taking orders.",
        benefit3_title: "Multilingual Support (3 Languages)",
        benefit3_desc: "Uzbek, Russian, and English interfaces. International tourists order easily in their native language.",
        benefit4_title: "Print-Ready QR Stickers",
        benefit4_desc: "The platform automatically generates branded QR stickers with your logo and table numbers.",

        // Calculator
        sec_calc_sub: "Calculate your savings",
        sec_calc_title: "How Much Will You Save with QR Menu?",
        sec_calc_desc: "Select your table count and calculate annual cost reductions compared to traditional paper menus",
        calc_table_count_title: "Number of tables in your venue:",
        calc_note: "Calculation is based on average annual printing, updating, and replacement costs of ~250,000 UZS per table.",
        calc_res_title: "Average Annual Savings:",
        calc_res_desc: "Money saved on paper menu printing",
        calc_time_title: "Time saved / year",
        calc_speed_title: "Service speed",
        calc_btn: "<i class=\"fa-solid fa-arrow-down\"></i> Start Saving Today",

        // Pricing
        sec_price_sub: "Transparent pricing",
        sec_price_title: "Choose the Perfect Plan for Your Venue",
        sec_price_desc: "No hidden charges. Cancel or switch plans anytime",
        price_popular_badge: "Most Popular",
        price_start_title: "Start (Trial)",
        price_start_desc: "Best for small cafes and testing out the system",
        price_start_amount: "7 days free",
        price_start_period: "then 99,000 UZS / mo",
        price_start_f1: "1 restaurant / branch",
        price_start_f2: "Up to 30 dishes and categories",
        price_start_f3: "Up to 10 table QR stickers",
        price_start_f4: "3 languages (UZ, RU, EN)",
        price_start_f5: "Digital mobile menu",
        price_start_btn: "Try for Free",
        price_standart_title: "Standard (Best Value)",
        price_standart_desc: "Full-featured suite for busy restaurants, cafes, and tea houses",
        price_standart_amount: "190,000 UZS",
        price_standart_period: "per month",
        price_standart_f1: "Unlimited dishes & categories",
        price_standart_f2: "Up to 50 tables",
        price_standart_f3: "Call waiter & request bill",
        price_standart_f4: "Live table cart & ordering",
        price_standart_f5: "Print-ready QR stickers",
        price_standart_f6: "3 languages (UZ, RU, EN)",
        price_standart_btn: "Choose Plan",
        price_prem_title: "Premium (Pro)",
        price_prem_desc: "End-to-end automation for large dining venues and chains",
        price_prem_amount: "350,000 UZS",
        price_prem_period: "per month",
        price_prem_f1: "All Standard features included",
        price_prem_f2: "Unlimited table count",
        price_prem_f3: "Custom branding & domain",
        price_prem_f4: "Advanced sales & revenue analytics",
        price_prem_f5: "Review & rating management",
        price_prem_f6: "24/7 dedicated account manager",
        price_prem_btn: "Choose Plan",

        // FAQ
        sec_faq_sub: "Frequently asked questions",
        sec_faq_title: "Frequently Asked Questions (FAQ)",
        sec_faq_desc: "Clear answers to the most common questions about digital QR menus",
        faq1_q: "Do guests need to download an app?",
        faq1_a: "No, absolutely not! Guests simply aim their smartphone camera at the table QR sticker, and the menu opens instantly in their web browser.",
        faq2_q: "Will the menu work with slow or offline internet?",
        faq2_a: "Yes, our platform is built as a Progressive Web App (PWA). Once loaded, menu data is cached locally and runs smoothly even on weak mobile connections.",
        faq3_q: "Can I update prices and add new dishes myself?",
        faq3_a: "Yes! You get an easy-to-use Admin dashboard. From your smartphone or computer, you can update prices, upload photos, or hide sold-out dishes in 1 second.",
        faq4_q: "Where do we get table QR stickers?",
        faq4_a: "With one click in your dashboard, you can generate ready-to-print branded PDF/image stickers with your logo and table numbers.",
        faq5_q: "How does the Call Waiter and Request Bill feature work?",
        faq5_a: "When a guest taps 'Call Waiter' or 'Request Bill', an instant sound alert and table notification appears on the admin panel and waiter screens.",
        faq6_q: "How long does setup take?",
        faq6_a: "Usually just 1 business day! You send us your current menu, and our team uploads the items, generates stickers, and trains your team.",

        // Contact
        sec_contact_sub: "Get started",
        sec_contact_title: "Contact Us or Request a Demo",
        sec_contact_desc: "Get in touch to connect your venue, start a 7-day free trial, or ask any questions",
        contact_phone_title: "Contact via Phone",
        contact_phone_call: "<span>Call Now</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_tg_title: "Contact via Telegram",
        contact_tg_write: "<span>Send Message</span> <i class=\"fa-solid fa-arrow-right\"></i>",
        contact_bonus_title: "7-Day Free Trial",
        contact_bonus_desc: "Submit your details, and our specialist will reach out within 15 minutes to set up your test dashboard.",
        form_title: "Request Venue Onboarding",
        form_desc: "Leave your contact details and our team will get back to you shortly",
        form_rest_name: "Restaurant / Cafe Name *",
        form_owner_name: "Your Name *",
        form_phone: "Phone Number *",
        form_plan: "Selected Plan",
        form_msg: "Additional message or questions (optional)",
        form_submit: "Submit Request",
        form_success_msg: "Your request was received successfully! Our team will contact you shortly.",
        footer_text: "© 2026 All rights reserved. Modern digital QR menu platform for restaurants and cafes.",
        modal_scan: "Scan with your phone camera:",
        modal_table: "<i class=\"fa-solid fa-chair\"></i> Table #1 Menu",
        modal_close: "Close"
      }
    };

    let currentLandingLang = localStorage.getItem('landing_lang') || 'uz';

    function lt(key) {
      if (landingTranslations[currentLandingLang] && landingTranslations[currentLandingLang][key]) {
        return landingTranslations[currentLandingLang][key];
      }
      return landingTranslations.uz[key] || key;
    }

    function setLandingLang(lang) {
      if (landingTranslations[lang]) {
        currentLandingLang = lang;
        localStorage.setItem('landing_lang', lang);
        applyLandingLang();
        renderRestaurants(allRestaurants);
      }
    }
    window.setLandingLang = setLandingLang;

    function applyLandingLang() {
      document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang') === currentLandingLang);
      });

      const map = {
        lblNavRestaurants: 'nav_restaurants',
        lblNavHow: 'nav_how_it_works',
        lblNavComparison: 'nav_comparison',
        lblNavKitchen: 'nav_kitchen',
        lblNavBenefits: 'nav_benefits',
        lblNavCalculator: 'nav_calculator',
        lblNavPricing: 'nav_pricing',
        lblNavFaq: 'nav_faq',
        lblNavContact: 'nav_contact',
        lblNavQuickContact: 'nav_quick_contact',
        lblNavAdmin: 'nav_admin',
        lblHeroBadge: 'hero_badge',
        lblHeroTitle: 'hero_title',
        lblHeroDesc: 'hero_desc',
        lblHeroBtnMenu: 'hero_btn_menu',
        lblHeroBtnDemo: 'hero_btn_demo',
        lblQuickDemoTitle: 'quick_demo_title',
        lblDemoCustomer: 'demo_customer',
        lblDemoKitchen: 'demo_kitchen',
        lblDemoAdmin: 'demo_admin',
        lblStatRest: 'stat_rest',
        lblStatDishes: 'stat_dishes',
        lblStatPaperless: 'stat_paperless',
        lblSecPartnersSub: 'sec_partners_sub',
        lblSecPartnersTitle: 'sec_partners_title',
        lblSecPartnersDesc: 'sec_partners_desc',
        lblSecHowSub: 'sec_how_sub',
        lblSecHowTitle: 'sec_how_title',
        lblSecHowDesc: 'sec_how_desc',
        lblStep1Title: 'step1_title',
        lblStep1Desc: 'step1_desc',
        lblStep2Title: 'step2_title',
        lblStep2Desc: 'step2_desc',
        lblStep3Title: 'step3_title',
        lblStep3Desc: 'step3_desc',
        
        // Taqqoslash
        lblSecCompSub: 'sec_comp_sub',
        lblSecCompTitle: 'sec_comp_title',
        lblSecCompDesc: 'sec_comp_desc',
        lblCompOldBadge: 'comp_old_badge',
        lblCompOldTitle: 'comp_old_title',
        lblCompOldDesc: 'comp_old_desc',
        lblCompOld1Title: 'comp_old_1_title',
        lblCompOld1Desc: 'comp_old_1_desc',
        lblCompOld2Title: 'comp_old_2_title',
        lblCompOld2Desc: 'comp_old_2_desc',
        lblCompOld3Title: 'comp_old_3_title',
        lblCompOld3Desc: 'comp_old_3_desc',
        lblCompOld4Title: 'comp_old_4_title',
        lblCompOld4Desc: 'comp_old_4_desc',
        lblCompNewBadge: 'comp_new_badge',
        lblCompNewTitle: 'comp_new_title',
        lblCompNewDesc: 'comp_new_desc',
        lblCompNew1Title: 'comp_new_1_title',
        lblCompNew1Desc: 'comp_new_1_desc',
        lblCompNew2Title: 'comp_new_2_title',
        lblCompNew2Desc: 'comp_new_2_desc',
        lblCompNew3Title: 'comp_new_3_title',
        lblCompNew3Desc: 'comp_new_3_desc',
        lblCompNew4Title: 'comp_new_4_title',
        lblCompNew4Desc: 'comp_new_4_desc',

        // Oshxona (KDS)
        lblKdsBadge: 'kds_badge',
        lblKdsTitle: 'kds_title',
        lblKdsDesc: 'kds_desc',
        lblKdsF1Title: 'kds_f1_title',
        lblKdsF1Desc: 'kds_f1_desc',
        lblKdsF2Title: 'kds_f2_title',
        lblKdsF2Desc: 'kds_f2_desc',
        lblKdsF3Title: 'kds_f3_title',
        lblKdsF3Desc: 'kds_f3_desc',
        lblKdsBtnKitchen: 'kds_btn_kitchen',
        lblKdsBtnAdmin: 'kds_btn_admin',

        // Afzalliklar
        lblSecBenefitsSub: 'sec_benefits_sub',
        lblSecBenefitsTitle: 'sec_benefits_title',
        lblSecBenefitsDesc: 'sec_benefits_desc',
        lblBen1Title: 'benefit1_title',
        lblBen1Desc: 'benefit1_desc',
        lblBen2Title: 'benefit2_title',
        lblBen2Desc: 'benefit2_desc',
        lblBen3Title: 'benefit3_title',
        lblBen3Desc: 'benefit3_desc',
        lblBen4Title: 'benefit4_title',
        lblBen4Desc: 'benefit4_desc',

        // Kalkulyator
        lblSecCalcSub: 'sec_calc_sub',
        lblSecCalcTitle: 'sec_calc_title',
        lblSecCalcDesc: 'sec_calc_desc',
        lblCalcTableCountTitle: 'calc_table_count_title',
        lblCalcNote: 'calc_note',
        lblCalcResTitle: 'calc_res_title',
        lblCalcResDesc: 'calc_res_desc',
        lblCalcTimeTitle: 'calc_time_title',
        lblCalcSpeedTitle: 'calc_speed_title',
        lblCalcBtn: 'calc_btn',

        // Tariflar
        lblSecPriceSub: 'sec_price_sub',
        lblSecPriceTitle: 'sec_price_title',
        lblSecPriceDesc: 'sec_price_desc',
        lblPricePopularBadge: 'price_popular_badge',
        lblPriceStartTitle: 'price_start_title',
        lblPriceStartDesc: 'price_start_desc',
        lblPriceStartAmount: 'price_start_amount',
        lblPriceStartPeriod: 'price_start_period',
        lblPriceStartF1: 'price_start_f1',
        lblPriceStartF2: 'price_start_f2',
        lblPriceStartF3: 'price_start_f3',
        lblPriceStartF4: 'price_start_f4',
        lblPriceStartF5: 'price_start_f5',
        lblPriceStartBtn: 'price_start_btn',
        lblPriceStandartTitle: 'price_standart_title',
        lblPriceStandartDesc: 'price_standart_desc',
        lblPriceStandartAmount: 'price_standart_amount',
        lblPriceStandartPeriod: 'price_standart_period',
        lblPriceStandartF1: 'price_standart_f1',
        lblPriceStandartF2: 'price_standart_f2',
        lblPriceStandartF3: 'price_standart_f3',
        lblPriceStandartF4: 'price_standart_f4',
        lblPriceStandartF5: 'price_standart_f5',
        lblPriceStandartF6: 'price_standart_f6',
        lblPriceStandartBtn: 'price_standart_btn',
        lblPricePremTitle: 'price_prem_title',
        lblPricePremDesc: 'price_prem_desc',
        lblPricePremAmount: 'price_prem_amount',
        lblPricePremPeriod: 'price_prem_period',
        lblPricePremF1: 'price_prem_f1',
        lblPricePremF2: 'price_prem_f2',
        lblPricePremF3: 'price_prem_f3',
        lblPricePremF4: 'price_prem_f4',
        lblPricePremF5: 'price_prem_f5',
        lblPricePremF6: 'price_prem_f6',
        lblPricePremBtn: 'price_prem_btn',

        // FAQ
        lblSecFaqSub: 'sec_faq_sub',
        lblSecFaqTitle: 'sec_faq_title',
        lblSecFaqDesc: 'sec_faq_desc',
        lblFaq1Q: 'faq1_q',
        lblFaq1A: 'faq1_a',
        lblFaq2Q: 'faq2_q',
        lblFaq2A: 'faq2_a',
        lblFaq3Q: 'faq3_q',
        lblFaq3A: 'faq3_a',
        lblFaq4Q: 'faq4_q',
        lblFaq4A: 'faq4_a',
        lblFaq5Q: 'faq5_q',
        lblFaq5A: 'faq5_a',
        lblFaq6Q: 'faq6_q',
        lblFaq6A: 'faq6_a',

        // Bog'lanish va Forma
        lblSecContactSub: 'sec_contact_sub',
        lblSecContactTitle: 'sec_contact_title',
        lblSecContactDesc: 'sec_contact_desc',
        lblContactPhoneTitle: 'contact_phone_title',
        lblContactPhoneCall: 'contact_phone_call',
        lblContactTgTitle: 'contact_tg_title',
        lblContactTgWrite: 'contact_tg_write',
        lblContactBonusTitle: 'contact_bonus_title',
        lblContactBonusDesc: 'contact_bonus_desc',
        lblFormTitle: 'form_title',
        lblFormDesc: 'form_desc',
        lblFormRestName: 'form_rest_name',
        lblFormOwnerName: 'form_owner_name',
        lblFormPhone: 'form_phone',
        lblFormPlan: 'form_plan',
        lblFormMsg: 'form_msg',
        lblFormSubmit: 'form_submit',
        leadSuccessMsg: 'form_success_msg',
        lblFooterText: 'footer_text',
        modal_scan: 'modal_scan',
        modal_table: 'modal_table',
        modal_close: 'modal_close'
      };

      for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = lt(key);
        }
      }

      const searchInput = document.getElementById('restSearchInput');
      if (searchInput) {
        searchInput.placeholder = lt('search_placeholder');
      }
    }


    // FAQ Accordion ochish/yopish
    function toggleFaq(btn) {
      const item = btn.closest('.faq-item');
      if (item) {
        item.classList.toggle('active');
      }
    }
    window.toggleFaq = toggleFaq;

    // Tarifdan formaga o'tish
    function scrollToForm(plan) {
      const formCard = document.getElementById('contactForm');
      if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth' });
        const planSelect = document.getElementById('leadPlan');
        if (planSelect) {
          planSelect.value = plan;
        }
        formCard.style.outline = '3px solid var(--primary)';
        formCard.style.transition = 'outline 0.3s';
        setTimeout(() => {
          formCard.style.outline = 'none';
        }, 2000);
      }
    }
    window.scrollToForm = scrollToForm;

    // Ariza qoldirish formasi
    async function submitLeadForm(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitLead');
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...`;

      const data = {
        restaurantName: document.getElementById('leadRestName').value.trim(),
        ownerName: document.getElementById('leadOwnerName').value.trim(),
        phone: document.getElementById('leadPhone').value.trim(),
        plan: document.getElementById('leadPlan').value,
        message: document.getElementById('leadMessage').value.trim()
      };

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
          const successBox = document.getElementById('leadSuccessBox');
          successBox.style.display = 'block';
          document.getElementById('leadForm').reset();
          successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(() => {
            successBox.style.display = 'none';
          }, 8000);
        } else {
          alert(json.message || "Xatolik yuz berdi");
        }
      } catch (err) {
        alert("Server bilan bog'lanishda xatolik: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
    window.submitLeadForm = submitLeadForm;

    async function loadData() {
      applyLandingLang();
      try {
        // Statistika
        const statsRes = await fetch('/api/public/stats');
        const statsData = await statsRes.json();
        if (statsData.success) {
          document.getElementById('heroRestCount').innerText = `${statsData.totalRestaurants}+`;
          document.getElementById('heroMenuCount').innerText = `${statsData.totalMenuItems}+`;
        }

        // Restoranlar
        const res = await fetch('/api/public/restaurants');
        const data = await res.json();
        if (data.success) {
          allRestaurants = data.restaurants;
          renderRestaurants(data.restaurants);
        }
      } catch (e) {
        console.error("Xatolik:", e);
      }
    }

    function filterRestaurants() {
      const q = document.getElementById('restSearchInput').value.toLowerCase().trim();
      const filtered = allRestaurants.filter(r => 
        r.name.toLowerCase().includes(q) || 
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
      );
      renderRestaurants(filtered);
    }

    function renderRestaurants(list) {
      const grid = document.getElementById('restaurantsGrid');
      if (list.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--gray-400);">
            <i class="fa-solid fa-utensils" style="font-size: 40px; margin-bottom: 12px; display: block;"></i>
            <h4>${lt('no_rest_found')}</h4>
          </div>
        `;
        return;
      }

      let html = '';
      list.forEach(rest => {
        html += `
          <div class="rest-showcase-card">
            <div class="card-banner">
              <img src="${rest.banner || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}" alt="${rest.name}">
            </div>
            <div class="card-body">
              <img src="${rest.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200'}" class="card-logo" alt="${rest.name}">
              <h3 class="card-title">${rest.name}</h3>
              <p class="card-desc">${rest.description || 'Mazali taomlar, yoqimli muhit va a\'lo darajadagi servis.'}</p>
              
              <div class="card-meta">
                ${rest.phone ? `<div class="card-meta-item"><i class="fa-solid fa-phone"></i> <span>${rest.phone}</span></div>` : ''}
                ${rest.address ? `<div class="card-meta-item"><i class="fa-solid fa-location-dot"></i> <span>${rest.address}</span></div>` : ''}
                <div class="card-meta-item"><i class="fa-solid fa-chair"></i> <span>${rest.tablesCount || 10} ${lt('tables_label')}</span></div>
              </div>

              <div class="card-buttons">
                <a href="/r/${rest.slug}?table=1" class="btn-view-menu" target="_blank">
                  <i class="fa-solid fa-book-open"></i> ${lt('btn_view_menu')}
                </a>
                <button class="btn-scan-qr" title="${lt('btn_scan_qr')}" onclick="openQRModal('${rest.id}')">
                  <i class="fa-solid fa-qrcode"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      grid.innerHTML = html;
    }

    // QR Kodni kattalashtirib ko'rsatish
    async function openQRModal(restId) {
      const rest = allRestaurants.find(r => r.id === restId);
      if (!rest) return;

      try {
        const res = await fetch(`/api/public/qr-codes/${rest.id}`);
        const data = await res.json();
        if (data.success && data.qrCodes.length > 0) {
          document.getElementById('qrModalRestName').innerText = rest.name;
          document.getElementById('qrModalImg').src = data.qrCodes[0].qrDataUrl;
          document.getElementById('qrModal').classList.add('active');
        }
      } catch (e) {
        alert("QR kodni yuklashda xatolik: " + e.message);
      }
    }

    function closeQRModal(e) {
      if (e.target.id === 'qrModal') {
        document.getElementById('qrModal').classList.remove('active');
      }
    }

    loadData();

    // PWA Service Worker ro'yxatdan o'tkazish
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
      });
    }