# ⁧راهنمای ایمیل روی سرور GreenPeak

⁧سرویس ایمیل روی سرور فعلی با Ubuntu 24.04 و آدرس `91.228.186.184` نصب شده است. آدرس وب‌میل: <https://mail.greenpeak.ir>؛ صندوق ایمیل: `info@greenpeak.ir`.

## ⁧تنظیمات اتصال و ورود

| ⁧کاربرد | ⁧آدرس سرور | ⁧پورت | ⁧امنیت اتصال |
| --- | --- | --- | --- |
| ⁧دریافت ایمیل با IMAP | `mail.greenpeak.ir` | 993 | SSL/TLS |
| ⁧ارسال ایمیل با SMTP | `mail.greenpeak.ir` | 587 | ⁧STARTTLS اجباری |
| ⁧ارسال ایمیل با SMTP، روش جایگزین | `mail.greenpeak.ir` | 465 | SSL/TLS |

⁧برای ورود به وب‌میل یا نرم‌افزار ایمیل، نام کاربری را کامل وارد کنید: `info@greenpeak.ir`.

⁧رمز تولیدشده فقط در فایل `/root/greenpeak-mail-info-credentials.json` روی سرور ذخیره شده است. سطح دسترسی فایل `0600` است؛ یعنی فقط کاربر root اجازهٔ خواندن و نوشتن آن را دارد. برای دیدن رمز، این دستور را در ترمینال کامپیوتر خودتان اجرا کنید:

```powershell
ssh greenpeak-server "cat /root/greenpeak-mail-info-credentials.json"
```

⁧محتوای این فایل را در گیت، لاگ‌ها یا چت قرار ندهید.

## ⁧کارهای باقی‌مانده در DNS و PTR

⁧نصب و تنظیم سرویس‌ها روی سرور انجام شده است. ثبت رکوردهای زیر به دسترسی پنل DNS دامنه و بخش تنظیم PTR ارائه‌دهندهٔ IP نیاز دارد. دسترسی SSH سرور به‌تنهایی اجازهٔ تغییر این دو بخش را نمی‌دهد. هنگام راه‌اندازی، DNS و PTR تغییر داده نشدند.

⁧رکوردهای زیر از قبل وجود داشتند و صحت آن‌ها بررسی شد؛ نیازی به ساخت دوبارهٔ آن‌ها نیست:

| ⁧نوع رکورد | ⁧نام | ⁧مقدار |
| --- | --- | --- |
| A | `mail` | `91.228.186.184` |
| MX | `@` | ⁧اولویت `10`، مقصد `mail.greenpeak.ir` |

### ⁧۱. ثبت SPF و DMARC

⁧دو رکورد TXT زیر در پنل DNS دامنهٔ `greenpeak.ir` ثبت شده‌اند. نام‌ها نسبت به همین دامنه نوشته شده‌اند؛ `@` یعنی خود دامنه و `_dmarc` یعنی `_dmarc.greenpeak.ir`.

⁧اگر بعد از بررسی اولیه، رکورد SPF دیگری اضافه شده است، فرستنده‌های مجاز را در همان رکورد ادغام کنید؛ برای یک نام، دو رکورد SPF جدا نسازید.

| ⁧نوع رکورد | ⁧نام | ⁧مقدار |
| --- | --- | --- |
| TXT | `@` | `v=spf1 ip4:91.228.186.184 ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@greenpeak.ir; adkim=r; aspf=r` |

### ⁧۲. ثبت DKIM

⁧رکورد TXT با نام `mail._domainkey` ثبت شده است؛ نام کامل آن `mail._domainkey.greenpeak.ir` است. مقدار آن به شکل زیر است. پنل DNS ممکن است این مقدار طولانی را در داخل سامانه به چند رشته تقسیم کند؛ این رفتار طبیعی است.

```text
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAri+Q8OW4L/AaTowiHWxPb/7Kuc5QfcLQZsDFNqpzEKLFBtbQ2zl+nH5Tn+QRb7TAyurSQZjHkoQwYe4ZxLq2wy0OEl1GwEMMra0ieIA27hlskQILAsEcSDZ8gEk8DlhEZiJhGB77stWOEcmVxHMYzum382N63geFy3a8tzRj/tmT0DB7j9pzsKi7ry6GgdrlVEH24U/ERLzsHv//5B/w6IGXgiXSB/aTFODcTKe4pOlhLZ8R31tAlsativrpU461K1RwL+fJidMWYub9bz2kKuVBkS4bIX80/aeI18PjCJyZRfCD78ggsq0JasqOruuxUS1xgfE3YgKUNQfRaG+bxQIDAQAB
```

### ⁧۳. تنظیم PTR یا DNS معکوس

⁧در پنل ارائه‌دهندهٔ IP سرور، بخش Reverse DNS یا PTR، مقدار زیر را تنظیم کنید. اگر این گزینه در پنل وجود ندارد، از پشتیبانی همان ارائه‌دهنده بخواهید آن را ثبت کند:

```text
91.228.186.184 -> mail.greenpeak.ir
```

⁧PTR از پنل عادی رکوردهای دامنهٔ `greenpeak.ir` قابل تنظیم نیست؛ اختیار آن با صاحب IP است. برای این کار نیازی به خرید صندوق ایمیل میزبانی‌شده ندارید.

⁧DMARC فعلاً با `p=none` فقط گزارش‌گیری می‌کند. پیش از تغییر سیاست به قرنطینه یا رد پیام، نتیجهٔ احراز اصالت ایمیل‌ها باید بررسی شود.

### ⁧۴. بررسی پس از انتشار رکوردها

⁧پس از انتشار تغییرات DNS، برای بررسی کلید DKIM دستور زیر را روی سرور اجرا کنید:

```bash
opendkim-testkey -d greenpeak.ir -s mail -vvv
```

⁧رکوردهای SPF، DMARC و DKIM در DNS عمومی بررسی شدند؛ کلید DKIM با کلید سرور مطابقت دارد. رکورد PTR نیز به `mail.greenpeak.ir` اشاره می‌کند و در DNS عمومی بررسی شده است. ارسال به یک صندوق خارجی و دریافت از آن هنوز آزمایش نشده است.

## ⁧جزئیات تنظیمات سرور

- ⁧Postfix پیام‌ها را فقط به صندوق و نام‌های مستعار تعریف‌شده تحویل می‌دهد. ارسال به مقصد خارجی به احراز هویت و اتصال رمزگذاری‌شده نیاز دارد. آدرس فرستنده در پاکت SMTP نیز به صندوق احرازهویت‌شده محدود شده است.
- ⁧Dovecot دریافت امن با IMAPS را با حساب مجازی `vmail` فراهم می‌کند. هش رمزها در `/etc/dovecot/users` و پیام‌ها در `/var/vmail/greenpeak.ir/info/Maildir/` نگهداری می‌شوند.
- ⁧آدرس‌های `postmaster`، `abuse`، `dmarc` و `root` در دامنهٔ `greenpeak.ir` نام مستعار صندوق `info` هستند؛ پیام‌های آن‌ها به همین صندوق می‌رسند.
- ⁧OpenDKIM پیام‌ها را با انتخابگر `mail` امضا می‌کند. کلید خصوصی در `/etc/opendkim/keys/greenpeak.ir/mail.private` باقی می‌ماند.
- ⁧وب‌میل Roundcube از یک مجموعهٔ پردازشی اختصاصی PHP-FPM با حداکثر دو پردازش و پایگاه دادهٔ SQLite در `/var/lib/roundcube/greenpeak.sqlite` استفاده می‌کند.
- ⁧تنظیمات میزبان وب‌میل در `/etc/nginx/greenpeak-mail.d/mail.conf` است. تنها تغییر فایل اصلی nginx، اضافه‌شدن دستور بارگذاری فایل‌های این پوشه است.
- ⁧گواهی TLS در `/etc/letsencrypt/live/mail.greenpeak.ir/` قرار دارد و زمان‌بند موجود Certbot آن را تمدید می‌کند. اسکریپت `/etc/letsencrypt/renewal-hooks/deploy/greenpeak-mail` پس از تمدید، تنظیمات nginx، Postfix و Dovecot را دوباره بارگذاری می‌کند. مسیر پاسخ‌گویی به چالش ACME، پوشهٔ `/var/www/greenpeak-mail-acme` است.
- ⁧Fail2ban از ورود Dovecot و احراز هویت SMTP محافظت می‌کند. فیلتر Postfix، لاگ واحد واقعی اوبونتو یعنی `postfix@-.service` را نیز بررسی می‌کند. محافظت SSH هم فعال است.
- ⁧پیش از تغییر تنظیمات، از فایل اصلی nginx و تنظیمات اولیهٔ بسته‌های تازه‌نصب‌شده در `/root/greenpeak-mail-backup-20261101T192324Z` نسخهٔ پشتیبان تهیه شد.

## ⁧آزمایش‌های انجام‌شده

- ⁧اعتبار گواهی HTTPS و ورود موفق به صندوق از طریق Roundcube بررسی شد.
- ⁧پورت‌های 25، 465، 587 و 993 از کامپیوتر توسعه قابل دسترسی بودند.
- ⁧ارسال با احراز هویت روی STARTTLS/587 و TLS/465 و دریافت روی TLS/993 موفق بود.
- ⁧یک پیام به همین صندوق محلی ارسال، تحویل و دوباره خوانده شد؛ پیام دارای امضای DKIM بود. هیچ پیامی به گیرندهٔ خارجی ارسال نشد.
- ⁧ارسال بدون رمزگذاری، ارسال به مقصد خارجی بدون احراز هویت، فرستندهٔ غیرمجاز در پاکت SMTP و گیرندهٔ محلی ناموجود رد شدند.
- ⁧دسترسی به مسیرهای خصوصی وب مسدود بود. بررسی تنظیمات nginx، PHP-FPM، Dovecot، Postfix، OpenDKIM و Fail2ban موفق بود. سرویس‌ها پس از روشن‌شدن سرور خودکار اجرا می‌شوند.
- ⁧سایت و وب‌میل پاسخ HTTP 200 دادند. مسیرهای `/health` و `/api/v1/system/health` بک‌اند از داخل سرور پاسخ 200 دادند. آدرس عمومی `/api/v1/system/health` پاسخ 403 داد؛ قوانین قبلی مسیرهای سایت و API تغییر نکردند.
- ⁧صدور گواهی و شبیه‌سازی تمدید آن همراه با اجرای اسکریپت بارگذاری مجدد سرویس‌ها موفق بود.

⁧تحویل ایمیل خارجی و نتیجهٔ احراز اصالت در سرویس گیرنده هنوز تأیید نشده‌اند؛ این موارد به آزمایش ارسال‌ودریافت خارجی وابسته‌اند.

⁧آزمایش‌های برنامهٔ فرانت‌اند و بک‌اند اجرا نشدند، چون کد برنامه تغییر نکرده بود.

⁧منابع: [راهنمای Postfix در اوبونتو](https://ubuntu.com/server/docs/how-to/mail-services/install-postfix/)، [راهنمای Dovecot در اوبونتو](https://ubuntu.com/server/docs/how-to/mail-services/install-dovecot/) و [تنظیمات Roundcube](https://github.com/roundcube/roundcubemail/wiki/Configuration).
