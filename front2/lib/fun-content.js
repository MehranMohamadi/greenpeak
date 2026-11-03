export const mashhadEventsCheckedOn = "2026-11-03";

export const mashhadEventCategories = {
  cultural: { label: "رویدادهای فرهنگی", description: "کارگاه‌ها و برنامه‌های هنری و فرهنگی آیندهٔ مشهد" },
  financial: { label: "رویدادهای مالی", description: "برنامه‌های آیندهٔ مشهد در زمینهٔ سواد مالی و حسابداری" },
};

// Announcements checked on 2026-11-03. Courses without a published end date
// expire after their first day, so an old enrollment notice is never kept live.
export const mashhadEvents = [
  {
    id: "financial-literacy-1405-08",
    section: "financial",
    title: "کارگاه سواد مالی و هوش اقتصادی",
    category: "سواد مالی کودکان",
    startDate: "2026-11-05",
    endDate: "2026-11-05",
    date: "پنجشنبه ۱۴ آبان ۱۴۰۵",
    time: "۱۰ تا ۱۲",
    venue: "دانشگاه فردوسی مشهد، پژوهشکده مطالعات اسلامی در علوم انسانی",
    description: "ویژهٔ کودکان ۸ تا ۱۱ سال؛ آموزش انتخاب آگاهانه، هزینه و فایده و پس‌انداز با بازی‌های اقتصادی. مهلت ثبت‌نام: ۱۲ آبان؛ برای ظرفیت باقی‌مانده با برگزارکننده هماهنگ کنید.",
    price: "۸۰۰ هزار تومان؛ خانوادهٔ دانشگاه فردوسی: ۶۰۰ هزار تومان",
    sourceLabel: "بازنشر اطلاعیهٔ کالج فردوسی در List.tg",
    sourceUrl: "https://list.tg/uz/channel/collegefum",
  },
  {
    id: "iranian-music-1405-08",
    section: "cultural",
    title: "کارگاه درنگ در آواز و موسیقی ایرانی",
    category: "موسیقی و شعر فارسی",
    startDate: "2026-11-07",
    endDate: "2026-11-07",
    date: "نخستین جلسه: شنبه ۱۶ آبان ۱۴۰۵",
    time: "۱۷:۰۰",
    venue: "مشهد، سه‌راه ادبیات، مجتمع شریعتی جهاددانشگاهی، فرهنگسرا",
    description: "با تدریس مهدی سالاری؛ آشنایی با دستگاه‌ها، تصنیف‌ها و پیوند شعر و موسیقی ایرانی، ویژهٔ عموم علاقه‌مندان.",
    price: "جلسهٔ اول: ۳۰۰ هزار تومان",
    sourceLabel: "فرهنگسرای جهاددانشگاهی مشهد",
    sourceUrl: "https://t.me/farhangsarajahad/3819",
    registrationUrl: "https://razavi.jdereg.ir/?regin=551186",
  },
  {
    id: "patina-workshop-1405-08",
    section: "cultural",
    title: "کارگاه پتینهٔ دیوار؛ بخش اول",
    category: "هنرهای تجسمی و کاربردی",
    startDate: "2026-11-11",
    endDate: "2026-11-13",
    date: "۲۰ تا ۲۲ آبان ۱۴۰۵",
    time: "۱۴ تا ۱۹",
    venue: "مشهد، سه‌راه ادبیات، مجتمع شریعتی جهاددانشگاهی، فرهنگسرا",
    description: "آموزش ابزار و مواد، زیرسازی و اجرای تکنیک‌های پتینه با هدف ورود به بازار کار؛ امکان پرداخت چندمرحله‌ای اعلام شده است.",
    price: "۸ میلیون تومان",
    sourceLabel: "فرهنگسرای جهاددانشگاهی مشهد",
    sourceUrl: "https://t.me/farhangsarajahad/3818",
    registrationUrl: "https://razavi.jdereg.ir/?regin=550396",
  },
  {
    id: "santur-tuning-1405-08",
    section: "cultural",
    title: "کارگاه آموزش کوک سنتور",
    category: "کارگاه موسیقی",
    startDate: "2026-11-13",
    endDate: "2026-11-13",
    date: "جمعه ۲۲ آبان ۱۴۰۵",
    time: "۱۰ تا ۱۳",
    venue: "مشهد، سه‌راه ادبیات، مجتمع شریعتی جهاددانشگاهی، فرهنگسرا",
    description: "با تدریس امیر غلامحسینیان؛ آشنایی با ساختار ساز، تعویض سیم، جایگاه خرک‌ها و کوک سنتور.",
    sourceLabel: "فرهنگسرای جهاددانشگاهی مشهد",
    sourceUrl: "https://t.me/farhangsarajahad/3823",
    registrationUrl: "https://razavi.jdereg.ir/?regin=551580",
  },
  {
    id: "accp-11-autumn-1405",
    section: "financial",
    title: "یازدهمین دورهٔ ورود به حرفهٔ حسابداری ACCP",
    category: "حسابداری و مهارت مالی",
    startDate: "2026-11-14",
    endDate: "2026-11-14",
    date: "شروع دوره: ۲۳ آبان ۱۴۰۵",
    venue: "مشهد، کالج دانشکدهٔ علوم اداری و اقتصادی دانشگاه فردوسی؛ محل دقیق کلاس در ثبت‌نام مشخص می‌شود",
    description: "دورهٔ پاییز ۱۴۰۵ با گواهینامهٔ فارسی و انگلیسی دانشگاه فردوسی؛ تخفیف برای خانوادهٔ دانشگاه، دانشجویان و شرکت‌های دانش‌بنیان اعلام شده است.",
    price: "شهریهٔ آزاد: ۱۲ میلیون و ۹۰۰ هزار تومان",
    sourceLabel: "بازنشر اطلاعیهٔ کالج فردوسی در Telemetr",
    sourceUrl: "https://telemetr.io/en/channels/1439938474-ferdowsiuniversity_college",
    registrationUrl: "https://feacollege.um.ac.ir/index.php/fa/current/2246-accp05-08",
  },
];

export function getMashhadEventSection(selectedItem) {
  if (!selectedItem?.trail?.some((item) => item.label === "در شهر")) return null;
  return Object.entries(mashhadEventCategories).find(([, category]) => category.label === selectedItem.label)?.[0] ?? null;
}

export function getTehranDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function getUpcomingMashhadEvents(section, today) {
  return mashhadEvents
    .filter((event) => (!section || event.section === section) && event.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
