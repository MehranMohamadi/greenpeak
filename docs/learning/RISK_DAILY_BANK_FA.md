# بانک سؤال‌وجواب روزانهٔ مدیریت ریسک

نسخه: `risk-daily-1` · بررسی منابع: 2026-11-16

۳۰ پرسش تألیفی، در شش بخشِ پنج‌تایی. پاسخ، درس کوتاه و نکتهٔ پایانی برای قرارگرفتن در اسپویلر آماده شده‌اند.

این فایل نسخهٔ خواندنی بانک JSON است؛ برنامهٔ ارسال یا اتصال به تلگرام نیست. همهٔ مثال‌های عددی فرضی‌اند.

موارد «تکمیلی» به موضوع درس مرتبط‌اند، اما جزئیاتشان الزاماً در متن فعلی سایت نیست. دکمهٔ مطالعه فعلاً صفحهٔ کل دوره را باز می‌کند.

## ریسک و بازده مورد انتظار

### 1. ریسک بیشتر، سود حتمی؟

`risk-001` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اگر سرمایه‌گذاری پرریسک‌تری انتخاب کنیم، حتماً سود بیشتری می‌گیریم؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ بازده بیشتر تضمین نمی‌شود.

**درس کوتاه:** سرمایه‌گذار معمولاً برای پذیرش ریسک بیشتر، بازده بالاتری مطالبه می‌کند؛ اما نتیجهٔ واقعی می‌تواند زیان باشد. انتظار بازده با نتیجهٔ قطعی فرق دارد.

**یادت بماند:** ریسک بیشتر را با سود بیشترِ قطعی اشتباه نگیریم.

</details>

منبع: [SEC / Investor.gov — What is Risk?](https://www.investor.gov/introduction-investing/investing-basics/what-risk)؛ عدم قطعیت، احتمال زیان و مطالبهٔ بازده در برابر ریسک.

### 2. میانگینی که شاید رخ ندهد

`risk-002` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** در یک مثال فرضی، احتمال سود ۲۰٪ و زیان ۱۰٪ هرکدام نصف است. بازده مورد انتظار چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۵٪؛ اما این عدد قولِ سود نیست.

**درس کوتاه:** میانگین وزنی برابر است با نصفِ ۲۰٪ به‌علاوهٔ نصفِ منفی ۱۰٪. در همین مثال، نتیجهٔ واقعی فقط یکی از دو سناریوست و حتی ممکن است هرگز دقیقاً ۵٪ نباشد.

**یادت بماند:** احتمال سناریوها وزن محاسبه است.

</details>

منبع: [OpenStax — Principles of Finance — 13.5 Probability Distributions](https://openstax.org/books/principles-finance/pages/13-5-probability-distributions)؛ امید ریاضی به‌عنوان میانگین وزنی احتمالات.

### 3. قیمت، همهٔ بازده نیست

`risk-003` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** فرض کن سهمی را ۱۰۰ بخریم، آخر دوره ۱۰۶ بفروشیم و ۴ واحد سود نقدی بگیریم. بدون هزینه و مالیات، بازده چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۱۰٪؛ نه فقط ۶٪ رشد قیمت.

**درس کوتاه:** بازده کل از تغییر قیمت و وجه نقد دریافتی به دست می‌آید: (۱۰۶ − ۱۰۰ + ۴) ÷ ۱۰۰ = ۱۰٪. در این مثال، سود نقدی دوباره سرمایه‌گذاری نشده است.

**یادت بماند:** برای مقایسهٔ بازده، جریان نقدی را هم حساب کنیم.

</details>

منبع: [OpenStax — Principles of Finance — 15.1 Risk and Return to an Individual Asset](https://openstax.org/books/principles-finance/pages/15-1-risk-and-return-to-an-individual-asset)؛ فرمول بازده کل یک دوره با سود نقدی.

### 4. مثبت و منفی مساوی، نتیجهٔ صفر؟

`risk-004` · تکمیلی · سطح میانی

**سؤال:** در مثال فرضی، سرمایه یک دوره ۲۰٪ رشد و دورهٔ بعد ۲۰٪ افت می‌کند. آیا به مبلغ اول برمی‌گردد؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ بازده تجمعی منفی ۴٪ است.

**درس کوتاه:** بدون واریز، برداشت و هزینه، سرمایهٔ ۱۰۰ ابتدا ۱۲۰ و سپس ۹۶ می‌شود. میانگین حسابیِ دو درصد صفر است، ولی رشد سرمایه با ضربِ ضریب‌های بازده محاسبه می‌شود.

**یادت بماند:** جمع درصدها، بازده تجمعی را نشان نمی‌دهد.

</details>

منبع: [OpenStax — Principles of Finance — 15.1 Risk and Return to an Individual Asset](https://openstax.org/books/principles-finance/pages/15-1-risk-and-return-to-an-individual-asset)؛ تفاوت میانگین حسابی با رشد مرکب سرمایه.

### 5. یک سبد برای دو نفر؟

`risk-005` · تکمیلی · سطح مقدماتی

**سؤال:** دو نفر سرمایهٔ یکسان دارند؛ یکی سه ماه دیگر به پولش نیاز دارد و دیگری ده سال بعد. آیا سبد مناسبشان الزاماً یکسان است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ مبلغ سرمایه به‌تنهایی کافی نیست.

**درس کوتاه:** افق زمانی و توان و تمایل تحمل زیان، در انتخاب ترکیب دارایی مؤثرند. نیاز نزدیک به وجه نقد می‌تواند تحمل نوسان را محدود کند؛ حتی اگر فرد از نظر روحی ریسک‌پذیر باشد.

**یادت بماند:** هدف و زمان نیاز به پول را پیش از انتخاب دارایی روشن کنیم.

</details>

منبع: [SEC / Investor.gov — Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)؛ نقش افق زمانی و توان و تمایل پذیرش زیان در تخصیص دارایی.

## شناخت انواع ریسک

### 6. اوراق دولتی هم افت می‌کند؟

`risk-006` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اگر نرخ بهرهٔ بازار بالا برود، قیمت یک اوراق خزانهٔ نرخ‌ثابتِ موجود می‌تواند پایین بیاید؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** بله؛ این ریسک نرخ بهره است.

**درس کوتاه:** با ثابت‌بودن سایر عوامل، اوراق قدیمی با کوپن ثابت در برابر اوراق جدیدِ پربازده‌تر جذابیت کمتری دارد و قیمتش پایین می‌آید. پایین‌بودن ریسک نکول، نوسان قیمت پیش از سررسید را حذف نمی‌کند.

**یادت بماند:** ریسک نکول و ریسک قیمت، دو موضوع متفاوت‌اند.

</details>

منبع: [SEC / Investor.gov — Fixed Income Investments — When Interest Rates Go Up, Prices of Fixed-Rate Bonds Fall](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-86)؛ رابطهٔ معکوس نرخ بازار و قیمت اوراق نرخ‌ثابت، حتی اوراق خزانه.

### 7. کوپن بالاتر چه چیزی می‌گوید؟

`risk-007` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اوراق شرکتی با سود اسمی بالاتر می‌بینیم. آیا همین عدد برای نتیجه‌گیری دربارهٔ بهتر بودنش کافی است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ توان بازپرداخت ناشر هم باید بررسی شود.

**درس کوتاه:** بهرهٔ بالاتر می‌تواند جبران ریسک نکول بیشتر باشد. نکول یعنی ناشر پرداخت سود یا اصل بدهی را به‌موقع انجام ندهد. سررسید و سایر ویژگی‌های اوراق هم در مقایسه مهم‌اند.

**یادت بماند:** وعدهٔ پرداخت بیشتر، جای بررسی ریسک اعتباری را نمی‌گیرد.

</details>

منبع: [SEC / Investor.gov — Corporate Bonds](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products)؛ تعریف نکول و رابطهٔ ریسک اعتباری با بهرهٔ اوراق شرکتی.

### 8. قیمت هست؛ خریدار چطور؟

`risk-008` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** قیمت اوراق در حسابمان ثبت شده، اما هنگام نیاز فوری خریدار پیدا نمی‌شود. کدام ریسک آشکار شده است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ریسک نقدشوندگی.

**درس کوتاه:** ارزش نمایش‌داده‌شده، امکان فروش سریع را تضمین نمی‌کند. ممکن است فروش زمان ببرد یا فقط با تخفیف قابل‌توجه ممکن باشد. این مشکل با ناتوانی ناشر در بازپرداخت بدهی یکسان نیست.

**یادت بماند:** قابلیت خروج را جدا از قیمت دارایی بررسی کنیم.

</details>

منبع: [SEC / Investor.gov — Bonds — FAQs](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds)؛ ریسک نبود بازار برای خرید یا فروش در زمان دلخواه.

منبع: [FINRA — Concentrate on Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)؛ دشواری فروش سریع برخی سرمایه‌گذاری‌ها در قیمت مناسب.

### 9. تحلیل درست، اجرای اشتباه

`risk-009` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** تحلیل درست بوده، اما سفارش به علت خطای ثبت یا خرابی سامانه اشتباه اجرا شده است. منشأ مستقیم این زیان چیست؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ریسک عملیاتی.

**درس کوتاه:** خطای افراد، فرایند ناقص یا شکست سامانه می‌تواند زیان بسازد؛ حتی بدون اشتباه در پیش‌بینی بازار. تعریف بازل این دسته را از منشأ فرایند، افراد، سامانه و رویداد بیرونی توضیح می‌دهد.

**یادت بماند:** کیفیت اجرا هم بخشی از مدیریت ریسک است.

</details>

منبع: [BIS / Basel Committee — Operational risk — ORR 10](https://www.bis.org/committees/bcbs/basel-consolidated-guidelines/module/orr/10)؛ تعریف ریسک عملیاتی؛ سناریوی معامله تألیفی است.

### 10. سود دلاری، زیان در ارز مبنا؟

`risk-010` · محتوای اصلی دوره · سطح میانی

**سؤال:** در مثال فرضی، دارایی دلاری ۱۰٪ رشد می‌کند ولی ارزش هر دلار در ارز مبنای ما ۱۵٪ کم می‌شود. بازده در ارز مبنا مثبت است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ با فرض نبود پوشش و هزینه، منفی ۶٫۵٪ است.

**درس کوتاه:** ارزش نهایی با ضریب ۱٫۱۰ × ۰٫۸۵ = ۰٫۹۳۵ محاسبه می‌شود. سودِ خود دارایی می‌تواند با تغییر نرخ تبدیل ارز خنثی یا معکوس شود.

**یادت بماند:** بازده را در ارزِ هدف مالی خودمان هم بسنجیم.

</details>

منبع: [SEC / Investor.gov — International Investing](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/international-investing)؛ امکان کاهش یا معکوس‌شدن بازده با تغییر نرخ تبدیل؛ محاسبه تألیفی است.

## واریانس و انحراف معیار

### 11. واریانس یا انحراف معیار؟

`risk-011` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اگر بازده به‌صورت اعشاری نوشته شود و واریانس آن ۰٫۰۰۹ باشد، آیا انحراف معیار ۰٫۹٪ است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ تقریباً ۹٫۴۹٪ است.

**درس کوتاه:** انحراف معیار، ریشهٔ دوم واریانس است: ریشهٔ ۰٫۰۰۹ تقریباً ۰٫۰۹۴۹ است. واریانس واحدِ مربع‌شده دارد؛ انحراف معیار به واحد اصلی بازده برمی‌گردد.

**یادت بماند:** واریانس را مستقیماً درصد نخوانیم.

</details>

منبع: [NIST — Engineering Statistics Handbook — 1.3.5.6 Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm)؛ ریشهٔ واریانس و تفاوت واحد واریانس و انحراف معیار.

### 12. اندازه‌گیری نوسان یک سناریو

`risk-012` · محتوای اصلی دوره · سطح میانی

**سؤال:** فقط دو نتیجهٔ فرضی داریم: بازده صفر و ۲۰٪، هرکدام با احتمال نصف. انحراف معیار این توزیع چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۱۰ واحد درصد؛ یعنی انحراف معیار بازده ۱۰٪.

**درس کوتاه:** میانگین ۱۰٪ است. فاصلهٔ هر نتیجه از میانگین ۱۰ واحد درصد و واریانس در مقیاس اعشاری ۰٫۰۱ است. این توزیعِ کاملِ فرض‌شده است؛ فرمول نمونه با مخرج n−1 را به آن تحمیل نمی‌کنیم.

**یادت بماند:** نوع داده را قبل از انتخاب فرمول مشخص کنیم.

</details>

منبع: [OpenStax — Principles of Finance — 13.2 Measures of Spread](https://openstax.org/books/principles-finance/pages/13-2-measures-of-spread)؛ تفاوت واریانس جامعه و نمونه.

منبع: [OpenStax — Principles of Finance — 13.5 Probability Distributions](https://openstax.org/books/principles-finance/pages/13-5-probability-distributions)؛ وزن احتمالات در میانگین سناریوها.

### 13. چرا گاهی n−1؟

`risk-013` · محتوای اصلی دوره · سطح میانی

**سؤال:** برای برآورد واریانس جامعه از چند مشاهدهٔ نمونه، مجموع مربع فاصله‌ها از میانگین نمونه را بر n تقسیم می‌کنیم یا n−1؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** در برآورد متعارف واریانس نمونه، بر n−1.

**درس کوتاه:** وقتی میانگین هم از همان نمونه برآورد شده، این تصحیح در شرایط استاندارد نمونه‌گیری، برآورد واریانس را بی‌تورش می‌کند. این ویژگی مستقیماً به ریشهٔ آن، یعنی انحراف معیار نمونه، منتقل نمی‌شود.

**یادت بماند:** واریانس نمونه و واریانس توزیع احتمالی یک فرمول یکسان ندارند.

</details>

منبع: [NIST — Engineering Statistics Handbook — 1.3.5.6 Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm)؛ فرمول واریانس و انحراف معیار نمونه.

منبع: [OpenStax — Principles of Finance — 13.2 Measures of Spread](https://openstax.org/books/principles-finance/pages/13-2-measures-of-spread)؛ تفکیک فرمول نمونه از جامعه.

منبع: [ISO / JCGM — GUM — Annex C: Basic statistical terms and concepts](https://www.iso.org/sites/JCGM/GUM/JCGM100/C045315e-html/C045315e_FILES/MAIN_C045315e/AC_e.html)؛ بی‌تورش‌بودن واریانس نمونه و بی‌تورش‌نبودن ریشهٔ آن.

### 14. نوسان یکسان، احتمال زیان یکسان؟

`risk-014` · محتوای اصلی دوره · سطح میانی

**سؤال:** در مثال فرضی، الف با احتمال برابر منفی ۱۰٪ یا مثبت ۱۰٪ می‌دهد؛ ب مثبت ۱۰٪ یا مثبت ۳۰٪. آیا نوسان یکسان یعنی احتمال زیان یکسان؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ انحراف معیار هر دو ۱۰٪ است، ولی احتمال زیانشان فرق دارد.

**درس کوتاه:** در همین سناریوها، احتمال بازده منفیِ الف ۵۰٪ و ب صفر است. میانگین‌هایشان هم متفاوت است. انحراف معیار، پراکندگی حول میانگین را می‌سنجد؛ نه به‌تنهایی احتمال زیان را.

**یادت بماند:** نوسان را همراه میانگین و سناریوهای زیان بخوانیم.

</details>

منبع: [CFA Institute — 2026 Portfolio Mathematics](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-mathematics)؛ تفکیک معیار واریانس از ریسک بازده کمتر از آستانه؛ مقایسه و استنتاج تألیفی است.

### 15. قانون ۹۵٪ همیشه برقرار است؟

`risk-015` · تکمیلی · سطح میانی

**سؤال:** آیا برای هر نوع بازدهی می‌توان گفت حدود ۹۵٪ نتایج در فاصلهٔ دو انحراف معیار از میانگین قرار می‌گیرند؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ این تقریب به شکل توزیع وابسته است.

**درس کوتاه:** برای توزیع نرمال، این سهم حدود ۹۵٫۴۵٪ است. تعمیم آن به هر بازده مالی، بدون بررسی شکل توزیع و اعتبار پارامترها، درست نیست؛ رخدادهای شدید ممکن است بیشتر باشند.

**یادت بماند:** عدد دقیقِ مدل جای بررسی فرض‌های آن را نمی‌گیرد.

</details>

منبع: [NIST — Engineering Statistics Handbook — 1.3.6.6.1 Normal Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm)؛ توزیع نرمال و تابع احتمال؛ درصد با انتگرال مستقل محاسبه شده است.

منبع: [CFA Institute — 2026 Measuring and Managing Market Risk](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/measuring-managing-market-risk)؛ محدودیت مدل‌های ریسک هنگام نرمال‌نبودن بازده.

## همبستگی و تنوع‌بخشی

### 16. سه صندوق، یک ریسک؟

`risk-016` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** سه صندوق مختلف خریده‌ایم، اما دارایی‌های اصلی هر سه همان چند شرکت فناوری‌اند. آیا تعداد صندوق‌ها تنوع کافی را ثابت می‌کند؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ ممکن است همچنان تمرکز زیادی داشته باشیم.

**درس کوتاه:** نام‌های متفاوت می‌توانند دارایی‌های مشابهی را پنهان کنند. هم‌پوشانی سهم‌ها و وزن یک صنعت باید در کل سبد بررسی شود.

**یادت بماند:** تنوع را از روی دارایی‌های زیرین بسنجیم، نه تعداد نام‌ها.

</details>

منبع: [FINRA — Concentrate on Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)؛ هم‌پوشانی صندوق‌ها و تمرکز در دارایی‌های همبسته.

### 17. تنوع، همهٔ ریسک را حذف می‌کند؟

`risk-017` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اگر سهام شرکت‌های زیادی از صنایع مختلف داشته باشیم، آیا دیگر از افت عمومی بازار زیان نمی‌بینیم؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ ریسک عمومی بازار باقی می‌ماند.

**درس کوتاه:** تنوع می‌تواند اثر مشکلاتِ مختص یک شرکت را کم کند، اما شوک‌های فراگیر اقتصاد و بازار ممکن است هم‌زمان بر بخش بزرگی از سبد اثر بگذارند. کاهش ریسک با حذف کامل آن فرق دارد.

**یادت بماند:** تنوع‌بخشی، تضمینِ نبودِ زیان نیست.

</details>

منبع: [OpenStax — Principles of Finance — 15.2 Risk and Return to Multiple Assets](https://openstax.org/books/principles-finance/pages/15-2-risk-and-return-to-multiple-assets)؛ تمایز ریسک خاص شرکت و ریسک سیستماتیک.

### 18. وزنِ پول مهم است

`risk-018` · محتوای اصلی دوره · سطح میانی

**سؤال:** در مثال فرضی، ۶۰٪ ارزش سبد در دارایی با بازده مورد انتظار ۸٪ و ۴۰٪ در دارایی با بازده مورد انتظار ۳٪ است. انتظار بازده سبد چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۶٪ برای همان دوره.

**درس کوتاه:** با وزن‌های ابتدای دوره و بدون هزینه، ۰٫۶ × ۸٪ + ۰٫۴ × ۳٪ = ۶٪. وزن بر اساس ارزش سرمایه است، نه تعداد سهم‌ها. این خروجی همچنان یک انتظار است.

**یادت بماند:** میانگین ساده فقط وقتی درست است که وزن‌ها برابر باشند.

</details>

منبع: [CFA Institute — 2026 Portfolio Mathematics](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-mathematics)؛ بازده مورد انتظار سبد، میانگین موزون بازده اجزاست.

### 19. چرا نوسان سبد میانگین ساده نیست؟

`risk-019` · محتوای اصلی دوره · سطح میانی

**سؤال:** دو دارایی فرضی، هرکدام انحراف معیار ۱۰٪ و همبستگی صفر دارند. در سبد نصف‌نصف، انحراف معیار باز هم ۱۰٪ است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ تقریباً ۷٫۰۷٪ است.

**درس کوتاه:** برای همین دوره و وزن‌ها، واریانس سبد برابر ۰٫۵² × ۰٫۱² + ۰٫۵² × ۰٫۱² = ۰٫۰۰۵ است. ریشهٔ آن تقریباً ۷٫۰۷٪ می‌شود. همبستگی صفر فرض این مثال است، نه تضمین آینده.

**یادت بماند:** ریسک سبد به همبستگی هم وابسته است.

</details>

منبع: [CFA Institute — 2026 Portfolio Risk and Return: Part I](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-risk-return-part-1)؛ وابستگی نوسان سبد دو دارایی به وزن، نوسان و همبستگی.

### 20. سبد بدون معامله هم عوض می‌شود

`risk-020` · تکمیلی · سطح مقدماتی

**سؤال:** در مثال فرضی، سبدی ۶۰۰ واحد سهام و ۴۰۰ واحد نقد دارد. سهام دو برابر می‌شود و نقد ثابت می‌ماند. آیا وزن سهام هنوز ۶۰٪ است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ به ۷۵٪ رسیده است.

**درس کوتاه:** ارزش سهام ۱۲۰۰ و کل سبد ۱۶۰۰ شده است. بدون هیچ معامله‌ای، ترکیب و ریسک سبد تغییر کرده‌اند. بازتنظیم وزن‌ها باید با هدف و هزینه‌های معامله سنجیده شود.

**یادت بماند:** رشد دارایی‌ها می‌تواند سبد را از برنامهٔ اولیه دور کند.

</details>

منبع: [SEC / Investor.gov — Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)؛ تغییر وزن و ریسک بر اثر رشد نامتوازن دارایی‌ها و مفهوم بازتنظیم.

## ریسک سیستماتیک، بتا و CAPM

### 21. بتای یک یعنی نسخهٔ شاخص؟

`risk-021` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** اگر بتای سهمی نسبت به S&P 500 برابر یک باشد، آیا نوسان کل آن حتماً با شاخص برابر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ بتا و نوسان کل یکی نیستند.

**درس کوتاه:** بتا حساسیت بازده به حرکت شاخص مبنا را توصیف می‌کند. سهم می‌تواند علاوه بر آن، نوسان مختص شرکت داشته باشد؛ بنابراین بتای یک، رفتار کاملاً مشابه شاخص را ثابت نمی‌کند.

**یادت بماند:** بتا را جای انحراف معیار نگذاریم.

</details>

منبع: [CFA Institute — Deborah Kidd — Measures of Risk-Adjusted Return: Let's Not Forget Treynor and Jensen (2011)](https://rpc.cfainstitute.org/-/media/documents/code/gips/measures-risk-adjusted-return.pdf)؛ بتا به‌عنوان حساسیت به شاخص، با وجود ریسک خاص و تفاوت بازده.

### 22. بتا، ماشین پیش‌گویی روزانه؟

`risk-022` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** بتای سهمی ۱٫۵ است. اگر شاخص امروز ۲٪ رشد کند، آیا رشد ۳٪ سهم قطعی است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ بتا ضریب قطعیِ بازده هر روز نیست.

**درس کوتاه:** بتا از رابطهٔ آماری بازده سهم با شاخص برآورد می‌شود. خبر مختص شرکت و عوامل دیگر هم اثر دارند. انتخاب شاخص، بازهٔ زمانی و تناوب داده‌ها می‌تواند بتای گزارش‌شده را تغییر دهد.

**یادت بماند:** بتا را همراه مبنای محاسبه بخوانیم.

</details>

منبع: [OpenStax — Principles of Finance — 15.3 The Capital Asset Pricing Model (CAPM)](https://openstax.org/books/principles-finance/pages/15-3-the-capital-asset-pricing-model-capm)؛ بتا به‌عنوان شیب رگرسیون و تفاوت برآورد با بازه، تناوب و شاخص.

### 23. بتا چطور حساب می‌شود؟

`risk-023` · محتوای اصلی دوره · سطح میانی

**سؤال:** در مثال فرضی، کوواریانس بازده سهم و بازار ۰٫۰۱۸ و واریانس بازده بازار ۰٫۰۱۲ است. با داده‌های هم‌دوره و اعشاری، بتا چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۱٫۵ و بدون واحد.

**درس کوتاه:** بتا برابر کوواریانس با بازار تقسیم بر واریانس بازار است: ۰٫۰۱۸ ÷ ۰٫۰۱۲ = ۱٫۵. تقسیم بر انحراف معیار بازار، فرمول بتا نیست.

**یادت بماند:** در مخرج فرمول بتا، واریانس بازار قرار دارد.

</details>

منبع: [CFA Institute — Deborah Kidd — Measures of Risk-Adjusted Return: Let's Not Forget Treynor and Jensen (2011)](https://rpc.cfainstitute.org/-/media/documents/code/gips/measures-risk-adjusted-return.pdf)؛ تعریف صریح بتا به‌صورت کوواریانس تقسیم بر واریانس شاخص مبنا.

### 24. بتا در کدام عدد ضرب می‌شود؟

`risk-024` · محتوای اصلی دوره · سطح میانی

**سؤال:** در مثال فرضیِ CAPM، نرخ بدون ریسک ۳٪، بازده مورد انتظار بازار ۸٪ و بتا ۱٫۲ است. خروجی مدل چقدر است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۹٪؛ با فرض نرخ‌های مربوط به یک دوره.

**درس کوتاه:** ابتدا صرف ریسک بازار: ۸٪ − ۳٪ = ۵ واحد درصد. سپس ۳٪ + ۱٫۲ × ۵٪ = ۹٪. این بازده مورد انتظارِ مدل است و سود واقعی را تضمین نمی‌کند.

**یادت بماند:** بتا در صرف ریسک بازار ضرب می‌شود، نه کل بازده بازار.

</details>

منبع: [OpenStax — Principles of Finance — 15.3 The Capital Asset Pricing Model (CAPM)](https://openstax.org/books/principles-finance/pages/15-3-the-capital-asset-pricing-model-capm)؛ فرمول CAPM و تعریف صرف ریسک بازار.

### 25. آیا تمرکز، پاداش تضمینی دارد؟

`risk-025` · محتوای اصلی دوره · سطح میانی

**سؤال:** طبق CAPM، اگر تمام پول را در یک شرکت بگذاریم و ریسک خاص آن را بپذیریم، آیا بابت همین ریسک بازده مورد انتظار بیشتری می‌گیریم؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** در چارچوب مدل، پاداش مستقلی برای ریسک قابل‌تنوع‌بخشی منظور نمی‌شود.

**درس کوتاه:** CAPM صرف بازده را به ریسک سیستماتیک پیوند می‌دهد. ریسک خاص شرکت را می‌توان با تنوع کاهش داد؛ پس صرفِ متمرکزشدن، دلیل افزایش بازده مورد انتظار در این مدل نیست.

**یادت بماند:** هر ریسکی در مدل مالی پاداش ندارد.

</details>

منبع: [CFA Institute — 2026 Portfolio Risk and Return: Part II](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-risk-return-part-2)؛ قیمت‌گذاری ریسک سیستماتیک در برابر ریسک غیرسیستماتیک در CAPM.

## انتخاب روش مواجهه با ریسک

### 26. اول ابزار یا اول هدف؟

`risk-026` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** می‌خواهیم ریسک را مدیریت کنیم. اول ابزار پوشش بخریم یا مشخص کنیم کدام هدف و چه میزان زیان برایمان قابل تحمل است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ابتدا هدف، محدودیت‌ها و میزان ریسک قابل تحمل را روشن کنیم.

**درس کوتاه:** پس از شناخت مواجهه، روش مناسب را با توجه به هزینه و اثرش انتخاب می‌کنیم. مدیریت ریسک با خرید ابزار تمام نمی‌شود؛ تغییر مواجهه و نتیجهٔ تصمیم باید پایش شوند.

**یادت بماند:** ابزار باید در خدمت هدف مشخص باشد.

</details>

منبع: [CFA Institute — 2026 Introduction to Risk Management](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/introduction-risk-management)؛ هم‌راستایی هدف و تحمل ریسک، سنجش هزینه و منفعت، و پایش مستمر.

### 27. کاهش با انتقال فرق دارد؟

`risk-027` · محتوای اصلی دوره · سطح مقدماتی

**سؤال:** در یک مثال فرضی، سرمایه‌گذار حجم موقعیت را کمتر می‌کند؛ فرد دیگری برای یک خطرِ قابل‌بیمه، بیمه می‌خرد. روش مواجههٔ هرکدام چیست؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** اولی کاهش مواجهه؛ دومی انتقال بخشی از پیامد طبق قرارداد بیمه.

**درس کوتاه:** واردنشدن به فعالیت، اجتناب است. نگه‌داشتن آگاهانهٔ ریسک در حد قابل تحمل، پذیرش است. هیچ‌کدام را نباید با حذف خودکار همهٔ پیامدها یکی دانست.

**یادت بماند:** روش مواجهه را از روی اثر واقعی تصمیم تشخیص دهیم.

</details>

منبع: [CFA Institute — 2026 Introduction to Risk Management](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/introduction-risk-management)؛ پیشگیری و اجتناب، انتقال با بیمه و تعدیل مواجهه؛ طبقه‌بندی مثال تألیفی است.

### 28. پوشش یعنی حذف همهٔ ریسک‌ها؟

`risk-028` · محتوای اصلی دوره · سطح میانی

**سؤال:** شرکتی برای کم‌کردن ریسک قیمت کالای موردنیازش قرارداد آتی می‌گیرد. آیا حالا تمام ریسک قیمت حذف شده است؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** الزاماً نه؛ ممکن است ریسک مبنا باقی بماند.

**درس کوتاه:** هدف پوشش، تعدیل یک مواجههٔ موجود است. اگر فاصلهٔ قیمت نقدیِ کالای شرکت و قرارداد آتی تغییر کند، پوشش دقیقاً جبران‌کننده نخواهد بود؛ به این عدم قطعیت ریسک مبنا می‌گویند.

**یادت بماند:** تناسب ابزار پوشش با مواجهه را بررسی کنیم.

</details>

منبع: [CME Group — Understanding the Role of Hedgers](https://www.cmegroup.com/education/courses/introduction-to-futures/understanding-the-role-of-hedgers)؛ هدف پوشش در برابر پذیرش ریسک برای سود.

منبع: [CME Group — Education Glossary](https://www.cmegroup.com/education/glossary)؛ تعریف مبنا و ریسک مبنا.

### 29. حد ضرر، قیمت تضمینی؟

`risk-029` · تکمیلی · سطح مقدماتی

**سؤال:** در مثال فرضی، برای سهم حد ضررِ معمولی روی ۹۵ گذاشته‌ایم. اگر قیمت با شکاف به ۹۰ برسد، فروش حتماً روی ۹۵ انجام می‌شود؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** خیر؛ قیمت فعال‌سازی، قیمت تضمین‌شدهٔ اجرا نیست.

**درس کوتاه:** سفارش Stop پس از فعال‌شدن به سفارش بازار تبدیل می‌شود و ممکن است در قیمت پایین‌تری اجرا شود. Stop-Limit قیمت را محدود می‌کند، اما ممکن است اصلاً اجرا نشود. قواعد کارگزار هم مهم‌اند.

**یادت بماند:** کنترل قیمت و اطمینان از اجرا، دو مسئلهٔ جدا هستند.

</details>

منبع: [SEC / Investor.gov — Stop, Stop-Limit, and Trailing Stop Orders — Investor Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15)؛ ریسک قیمت اجرای Stop و ریسک عدم اجرای Stop-Limit برای سهام.

### 30. افت کوچک‌تر دارایی، زیان بزرگ‌تر سرمایه؟

`risk-030` · تکمیلی · سطح میانی

**سؤال:** فرض کن با ۱۰۰ واحد پول خودمان و ۱۰۰ واحد وام، ۲۰۰ واحد سهم خریده‌ایم. افت ۱۰٪ سهم، پیش از بهره و هزینه، چند درصد از سرمایهٔ خودمان را کم می‌کند؟

<details>
<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>

**پاسخ:** ۲۰٪؛ دو برابر افت قیمت سهم.

**درس کوتاه:** ارزش سهم ۱۸۰ و بدهی همچنان ۱۰۰ است؛ خالص سرمایه به ۸۰ می‌رسد. اهرم زیان را تشدید می‌کند و ممکن است اخطار تأمین وجه یا فروش اجباری ایجاد شود؛ زیان حتی می‌تواند از سرمایهٔ اولیه بیشتر شود.

**یادت بماند:** ریسک را نسبت به سرمایهٔ خودمان بسنجیم، نه فقط ارزش دارایی.

</details>

منبع: [SEC / Investor.gov — Investor Bulletin: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)؛ اثر وام خرید سهام بر بازده سرمایهٔ شخصی، فروش اجباری و زیان بیش از سرمایه.

## فهرست منابع بررسی‌شده

- `sec_risk` — [SEC / Investor.gov: What is Risk?](https://www.investor.gov/introduction-investing/investing-basics/what-risk). بخش: Introduction; Volatility Risk. بررسی: 2026-11-16.
- `os_probability` — [OpenStax: Principles of Finance — 13.5 Probability Distributions](https://openstax.org/books/principles-finance/pages/13-5-probability-distributions). بخش: Calculate and Interpret Expected Values. بررسی: 2026-11-16.
- `os_asset` — [OpenStax: Principles of Finance — 15.1 Risk and Return to an Individual Asset](https://openstax.org/books/principles-finance/pages/15-1-risk-and-return-to-an-individual-asset). بخش: Individual Investment Realized Return; Measuring Historical Returns. بررسی: 2026-11-16.
- `sec_allocation` — [SEC / Investor.gov: Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation). بخش: Time Horizon; Risk Tolerance; Rebalancing. بررسی: 2026-11-16.
- `sec_rates` — [SEC / Investor.gov: Fixed Income Investments — When Interest Rates Go Up, Prices of Fixed-Rate Bonds Fall](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-86). بخش: The Effect of Market Interest Rates on Bond Prices and Yield. بررسی: 2026-11-16.
- `sec_credit` — [SEC / Investor.gov: Corporate Bonds](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products). بخش: Introduction; What are the basic types of corporate bonds?. بررسی: 2026-11-16.
- `sec_bonds` — [SEC / Investor.gov: Bonds — FAQs](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds). بخش: What are the benefits and risks of bonds? — Liquidity risk. بررسی: 2026-11-16.
- `bis_operational` — [BIS / Basel Committee: Operational risk — ORR 10](https://www.bis.org/committees/bcbs/basel-consolidated-guidelines/module/orr/10). بخش: Key terms — 10.3(1). بررسی: 2026-11-16.
- `sec_international` — [SEC / Investor.gov: International Investing](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/international-investing). بخش: Changes in currency exchange rates and currency controls. بررسی: 2026-11-16.
- `nist_scale` — [NIST: Engineering Statistics Handbook — 1.3.5.6 Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm). بخش: Definitions of Variability — variance and standard deviation. بررسی: 2026-11-16.
- `os_spread` — [OpenStax: Principles of Finance — 13.2 Measures of Spread](https://openstax.org/books/principles-finance/pages/13-2-measures-of-spread). بخش: Standard Deviation; Variance — sample versus population. بررسی: 2026-11-16.
- `nist_normal` — [NIST: Engineering Statistics Handbook — 1.3.6.6.1 Normal Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm). بخش: Probability Density Function; Comments — assumptions. بررسی: 2026-11-16.
- `finra_concentration` — [FINRA: Concentrate on Concentration Risk](https://www.finra.org/investors/insights/concentration-risk). بخش: Concentration due to correlated assets; Tips to Manage Concentration Risk — 3. بررسی: 2026-11-16.
- `os_portfolio` — [OpenStax: Principles of Finance — 15.2 Risk and Return to Multiple Assets](https://openstax.org/books/principles-finance/pages/15-2-risk-and-return-to-multiple-assets). بخش: Diversification; Firm-Specific Risk versus Systematic Risk. بررسی: 2026-11-16.
- `cfa_math` — [CFA Institute: 2026 Portfolio Mathematics](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-mathematics). بخش: Introduction; Learning Outcomes. بررسی: 2026-11-16.
- `cfa_portfolio1` — [CFA Institute: 2026 Portfolio Risk and Return: Part I](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-risk-return-part-1). بخش: Learning Outcomes; Summary — two-asset portfolio and correlation. بررسی: 2026-11-16.
- `os_capm` — [OpenStax: Principles of Finance — 15.3 The Capital Asset Pricing Model (CAPM)](https://openstax.org/books/principles-finance/pages/15-3-the-capital-asset-pricing-model-capm). بخش: Interpreting Beta; Calculating Betas; CAPM Equation. بررسی: 2026-11-16.
- `cfa_portfolio2` — [CFA Institute: 2026 Portfolio Risk and Return: Part II](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-risk-return-part-2). بخش: Learning Outcomes — beta; Summary — systematic and nonsystematic risk. بررسی: 2026-11-16.
- `cfa_framework` — [CFA Institute: 2026 Introduction to Risk Management](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/introduction-risk-management). بخش: Summary — tolerance, monitoring, prevention, transfer and diversification. بررسی: 2026-11-16.
- `cme_hedgers` — [CME Group: Understanding the Role of Hedgers](https://www.cmegroup.com/education/courses/introduction-to-futures/understanding-the-role-of-hedgers). بخش: What is a Hedger?; Corn Hedger Example. بررسی: 2026-11-16.
- `cme_glossary` — [CME Group: Education Glossary](https://www.cmegroup.com/education/glossary). بخش: Basis; Basis Risk. بررسی: 2026-11-16.
- `sec_stops` — [SEC / Investor.gov: Stop, Stop-Limit, and Trailing Stop Orders — Investor Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15). بخش: Stop Order; Stop-Limit Order. بررسی: 2026-11-16.
- `sec_margin` — [SEC / Investor.gov: Investor Bulletin: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29). بخش: Understand How Margin Works; Recognize the Risks. بررسی: 2026-11-16.
- `cfa_beta_note` — [CFA Institute: Deborah Kidd — Measures of Risk-Adjusted Return: Let's Not Forget Treynor and Jensen (2011)](https://rpc.cfainstitute.org/-/media/documents/code/gips/measures-risk-adjusted-return.pdf). بخش: Page 1 — beta definition and idiosyncratic risk. بررسی: 2026-11-16.
- `iso_statistics` — [ISO / JCGM: GUM — Annex C: Basic statistical terms and concepts](https://www.iso.org/sites/JCGM/GUM/JCGM100/C045315e-html/C045315e_FILES/MAIN_C045315e/AC_e.html). بخش: C.2.20 — variance; Note 1; C.2.21 — standard deviation; Note. بررسی: 2026-11-16.
- `cfa_market_risk` — [CFA Institute: 2026 Measuring and Managing Market Risk](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/measuring-managing-market-risk). بخش: Summary — normality assumptions and model limitations. بررسی: 2026-11-16.
