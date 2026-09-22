const translations = {
  uz: {
    table: "Stol",
    search_placeholder: "Taom yoki ichimlik qidirish...",
    all: "Barchasi",
    popular: "Mashhur",
    add_to_cart: "Qo'shish",
    view_cart: "Savatcha",
    cart_title: "Sizning buyurtmangiz",
    empty_cart: "Savatchangiz bo'sh",
    empty_cart_desc: "Menyudan o'zingizga yoqqan taomlarni tanlang",
    subtotal: "Taomlar summasi",
    service_fee: "Xizmat haqi",
    total: "Jami to'lov",
    order_now: "Buyurtma berish",
    call_waiter: "Ofitsiant",
    request_bill: "Hisob",
    notes_placeholder: "Buyurtmaga izoh (masalan: piyozsiz, achchiq bo'lmasin...)",
    order_success: "Buyurtmangiz qabul qilindi!",
    order_success_desc: "Oshpazlarimiz taomlarni tayyorlashga kirishdi.",
    waiter_called: "Ofitsiant chaqirildi!",
    waiter_called_desc: "Xodimimiz tez orada stolingizga yetib keladi.",
    bill_requested: "Hisob so'raldi!",
    bill_requested_desc: "Xodimimiz chekni stolingizga olib keladi.",
    close: "Yopish",
    currency: "so'm",
    out_of_stock: "Mavjud emas",
    portion: "Porsiya",
    status_new: "Qabul qilindi",
    status_preparing: "Tayyorlanmoqda",
    status_ready: "Tayyor",
    status_delivered: "Yetkazildi",
    live_tracking: "Jonli buyurtmalar",
    table_bill_total: "Stol jami to'lovi",
    pay_online: "Onlayn to'lash",
    rate_restaurant: "Baholash"
  },
  ru: {
    table: "Стол",
    search_placeholder: "Поиск блюда или напитка...",
    all: "Все",
    popular: "Популярное",
    add_to_cart: "Добавить",
    view_cart: "Корзина",
    cart_title: "Ваш заказ",
    empty_cart: "Корзина пуста",
    empty_cart_desc: "Выберите понравившиеся блюда из меню",
    subtotal: "Сумма блюд",
    service_fee: "За обслуживание",
    total: "Итого к оплате",
    order_now: "Оформить заказ",
    call_waiter: "Официант",
    request_bill: "Счёт",
    notes_placeholder: "Комментарий к заказу (например: без лука, не острое...)",
    order_success: "Ваш заказ принят!",
    order_success_desc: "Наши повара уже приступили к приготовлению.",
    waiter_called: "Официант вызван!",
    waiter_called_desc: "Наш сотрудник скоро подойдёт к вашему столу.",
    bill_requested: "Счёт запрошен!",
    bill_requested_desc: "Официант принесёт вам чек к столу.",
    close: "Закрыть",
    currency: "сум",
    out_of_stock: "Нет в наличии",
    portion: "Порция",
    status_new: "Принят",
    status_preparing: "Готовится",
    status_ready: "Готово",
    status_delivered: "Доставлено",
    live_tracking: "Статус заказа",
    table_bill_total: "Общий счёт стола",
    pay_online: "Оплатить онлайн",
    rate_restaurant: "Оценить"
  },
  en: {
    table: "Table",
    search_placeholder: "Search for food or drinks...",
    all: "All",
    popular: "Popular",
    add_to_cart: "Add",
    view_cart: "Cart",
    cart_title: "Your Order",
    empty_cart: "Your cart is empty",
    empty_cart_desc: "Select your favorite dishes from the menu",
    subtotal: "Subtotal",
    service_fee: "Service fee",
    total: "Total",
    order_now: "Place Order",
    call_waiter: "Call Waiter",
    request_bill: "Bill",
    notes_placeholder: "Order notes (e.g. no onions, not spicy...)",
    order_success: "Order received!",
    order_success_desc: "Our chefs have started preparing your meal.",
    waiter_called: "Waiter called!",
    waiter_called_desc: "Our staff will be at your table shortly.",
    bill_requested: "Bill requested!",
    bill_requested_desc: "A waiter will bring your check shortly.",
    close: "Close",
    currency: "UZS",
    out_of_stock: "Out of stock",
    portion: "Portion",
    status_new: "Received",
    status_preparing: "Preparing",
    status_ready: "Ready",
    status_delivered: "Delivered",
    live_tracking: "Live Order Tracking",
    table_bill_total: "Table Total",
    pay_online: "Pay Online",
    rate_restaurant: "Rate Us"
  }
};

let currentLang = localStorage.getItem('qr_menu_lang') || 'uz';

function t(key) {
  if (translations[currentLang] && translations[currentLang][key]) {
    return translations[currentLang][key];
  }
  return translations.uz[key] || key;
}

function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('qr_menu_lang', lang);
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  }
}
