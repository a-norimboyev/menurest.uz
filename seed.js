const db = require('./database');

function seed() {
  console.log("Boshlang'ich ma'lumotlarni kiritish boshlandi...");

  // Agar allaqachon restoranlar mavjud bo'lsa qayta kiritmaymiz
  const existing = db.getRestaurants();
  if (existing.length > 0) {
    console.log("Ma'lumotlar bazasida allaqachon restoranlar mavjud.");
    return;
  }

  // 1-RESTORAN: Rayhon Milliy Taomlar
  const rayhon = db.createRestaurant({
    name: "Rayhon Milliy Taomlar",
    slug: "rayhon",
    logo: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80",
    phone: "+998 71 200-11-22",
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 15-uy",
    description: "Haqiqiy o'zbekona mehmondo'stlik va tansiq milliy taomlar maskani.",
    password: "123",
    serviceFeePercent: 10,
    currency: "so'm",
    tablesCount: 15
  });

  // Rayhon kategoriyalari
  const catMilliy = db.createCategory({
    restaurantId: rayhon.id,
    nameUz: "Milliy Taomlar",
    nameRu: "Национальные блюда",
    nameEn: "National Dishes",
    icon: "fa-solid fa-bowl-rice",
    sortOrder: 1
  });

  const catKabob = db.createCategory({
    restaurantId: rayhon.id,
    nameUz: "Shashlik & Kaboblar",
    nameRu: "Шашлыки",
    nameEn: "Barbecue & Kebabs",
    icon: "fa-solid fa-fire-burner",
    sortOrder: 2
  });

  const catSalad = db.createCategory({
    restaurantId: rayhon.id,
    nameUz: "Salatlar",
    nameRu: "Салаты",
    nameEn: "Salads",
    icon: "fa-solid fa-carrot",
    sortOrder: 3
  });

  const catDrinks = db.createCategory({
    restaurantId: rayhon.id,
    nameUz: "Ichimliklar",
    nameRu: "Напитки",
    nameEn: "Drinks",
    icon: "fa-solid fa-mug-hot",
    sortOrder: 4
  });

  // Rayhon taomlari
  db.createMenuItem({
    restaurantId: rayhon.id,
    categoryId: catMilliy.id,
    nameUz: "To'y Oshi (Choyxona Palov)",
    nameRu: "Праздничный Плов",
    nameEn: "Uzbek Wedding Plov",
    price: 38000,
    image: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Devzira guruch, barra qo'y go'shti, sariq sabzi, noxat va mayiz bilan damlangan to'y oshi.",
    descriptionRu: "Традиционный узбекский плов с нежной бараниной, желтой морковью, нутом и изюмом.",
    descriptionEn: "Traditional Uzbek plov with tender lamb, yellow carrots, chickpeas and raisins.",
    weight: "350g",
    isPopular: true
  });

  db.createMenuItem({
    restaurantId: rayhon.id,
    categoryId: catMilliy.id,
    nameUz: "Uyg'ur Lag'mon",
    nameRu: "Уйгурский Лагман",
    nameEn: "Uyghur Lagman",
    price: 36000,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Qo'lda cho'zilgan xamir, shirali mol go'shti va maxsus say bilan tayyorlangan shohona taom.",
    descriptionRu: "Тянутая вручную лапша с сочной говядиной и овощным соусом сай.",
    descriptionEn: "Hand-pulled noodles served with seasoned beef and sautéed vegetables.",
    weight: "400g",
    isPopular: true
  });

  db.createMenuItem({
    restaurantId: rayhon.id,
    categoryId: catKabob.id,
    nameUz: "Qiyma Shashlik (Lyulya)",
    nameRu: "Люля-Кебаб",
    nameEn: "Minced Meat Kebab",
    price: 18000,
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Yumshoq mol va qo'y go'shti qiymasidan ko'mir cho'g'ida pishirilgan xushbo'y shashlik.",
    descriptionRu: "Сочный шашлык из рубленой говядины и баранины на углях.",
    descriptionEn: "Succulent minced beef and lamb kebab grilled over charcoal.",
    weight: "120g",
    isPopular: true
  });

  db.createMenuItem({
    restaurantId: rayhon.id,
    categoryId: catSalad.id,
    nameUz: "Achichuk Salati",
    nameRu: "Салат Ачик-чучук",
    nameEn: "Achichuk Salad",
    price: 12000,
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Yupqa to'g'ralgan shirin pomidor, piyoz va rayhon barglari.",
    descriptionRu: "Тонко нарезанные помидоры, сладкий лук и свежий базилик.",
    descriptionEn: "Thinly sliced ripe tomatoes, onions and fragrant basil.",
    weight: "200g"
  });

  db.createMenuItem({
    restaurantId: rayhon.id,
    categoryId: catDrinks.id,
    nameUz: "Ko'k Choy (Choynakda)",
    nameRu: "Зеленый чай (чайник)",
    nameEn: "Green Tea (Pot)",
    price: 6000,
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Limon va novvot bilan damlangan xushbo'y 95-ko'k choy.",
    descriptionRu: "Ароматный зелёный чай с лимоном и наватом.",
    descriptionEn: "Aromatic green tea served with lemon and rock sugar.",
    weight: "800ml"
  });

  // 2-RESTORAN: Max Burger & Fast Food
  const maxBurger = db.createRestaurant({
    name: "Max Burger & Fast Food",
    slug: "max-burger",
    logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&auto=format&fit=crop&q=80",
    phone: "+998 90 999-88-77",
    address: "Toshkent sh., Amir Temur shoh ko'chasi 42-uy",
    description: "Eng shirin burgerlar, qarsildoq kartoshka fri va muzdek ichimliklar!",
    password: "123",
    serviceFeePercent: 5,
    currency: "so'm",
    tablesCount: 20
  });

  // Max Burger kategoriyalari
  const catBurger = db.createCategory({
    restaurantId: maxBurger.id,
    nameUz: "Burgerlar & Sendvichlar",
    nameRu: "Бургеры и Сэндвичи",
    nameEn: "Burgers & Sandwiches",
    icon: "fa-solid fa-burger",
    sortOrder: 1
  });

  const catLavash = db.createCategory({
    restaurantId: maxBurger.id,
    nameUz: "Lavash & Doner",
    nameRu: "Лаваш и Донер",
    nameEn: "Lavash & Shawarma",
    icon: "fa-solid fa-bread-slice",
    sortOrder: 2
  });

  const catFastDrinks = db.createCategory({
    restaurantId: maxBurger.id,
    nameUz: "Muzdek Ichimliklar",
    nameRu: "Прохладительные напитки",
    nameEn: "Cold Drinks",
    icon: "fa-solid fa-bottle-water",
    sortOrder: 3
  });

  // Max Burger taomlari
  db.createMenuItem({
    restaurantId: maxBurger.id,
    categoryId: catBurger.id,
    nameUz: "Double Cheeseburger",
    nameRu: "Двойной Чизбургер",
    nameEn: "Double Cheeseburger",
    price: 39000,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Ikkita barra mol go'shti kotleti, erigan Cheddar pishlog'i, maxsus sous va marinadlangan bodring.",
    descriptionRu: "Две сочные говяжьи котлеты, сыр Чеддер, фирменный соус и соленые огурчики.",
    descriptionEn: "Two juicy beef patties, melted Cheddar cheese, signature sauce and pickles.",
    weight: "320g",
    isPopular: true
  });

  db.createMenuItem({
    restaurantId: maxBurger.id,
    categoryId: catLavash.id,
    nameUz: "Klassik Mol Go'shtli Lavash",
    nameRu: "Классический Лаваш с говядиной",
    nameEn: "Classic Beef Lavash",
    price: 32000,
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Yupqa lavash xamirida marinadlangan mol go'shti, pomidor, bodring, chipslar va oq sous.",
    descriptionRu: "Нежная говядина в тонком лаваше, помидоры, огурчики, чипсы и фирменный соус.",
    descriptionEn: "Tender beef wrapped in thin lavash with tomatoes, cucumbers, chips and creamy sauce.",
    weight: "300g",
    isPopular: true
  });

  db.createMenuItem({
    restaurantId: maxBurger.id,
    categoryId: catBurger.id,
    nameUz: "Kartoshka Fri (Katta)",
    nameRu: "Картофель Фри (Большой)",
    nameEn: "French Fries (Large)",
    price: 16000,
    image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Qarsildoq va oltinrang kartoshka fri, ketchup bilan.",
    descriptionRu: "Хрустящий золотистый картофель фри с кетчупом.",
    descriptionEn: "Crispy golden french fries served with ketchup.",
    weight: "180g"
  });

  db.createMenuItem({
    restaurantId: maxBurger.id,
    categoryId: catFastDrinks.id,
    nameUz: "Coca-Cola 0.5L",
    nameRu: "Coca-Cola 0.5L",
    nameEn: "Coca-Cola 0.5L",
    price: 8000,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80",
    descriptionUz: "Muzdek tetiklashtiruvchi klassik Coca-Cola.",
    descriptionRu: "Освежающая классическая Кока-Кола со льдом.",
    descriptionEn: "Refreshing ice-cold classic Coca-Cola.",
    weight: "500ml"
  });

  console.log("Namunaviy restoranlar va taomlar muvaffaqiyatli kiritildi!");
}

seed();
