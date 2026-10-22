"""Explicit instrument identities; source substitutions are never implicit."""
DEFINITIONS = {
    "sp500": dict(label="S&P 500", provider="yahoo", series="^GSPC", kind="asset", currency="USD", return_basis="price", unit="واحد شاخص", note="شاخص قیمت؛ بدون احتساب سود نقدی"),
    "nasdaq100": dict(label="نزدک ۱۰۰", provider="yahoo", series="^NDX", kind="asset", currency="USD", return_basis="price", unit="واحد شاخص", note="شاخص قیمت؛ بدون احتساب سود نقدی"),
    "russell2000": dict(label="راسل ۲۰۰۰", provider="yahoo", series="^RUT", kind="asset", currency="USD", return_basis="price", unit="واحد شاخص", note="شاخص قیمت؛ بدون احتساب سود نقدی"),
    "gold": dict(label="طلا · آتی COMEX", provider="yahoo", series="GC=F", kind="asset", currency="USD", return_basis="price", unit="دلار / اونس تروا", note="قیمت قرارداد آتی پیوسته؛ شامل اثر جابه‌جایی قرارداد، بدون سود نقدی؛ بازده سرمایه‌گذاری یا طلای نقدی نیست"),
    "silver": dict(label="نقره · آتی COMEX", provider="yahoo", series="SI=F", kind="asset", currency="USD", return_basis="price", unit="دلار / اونس تروا", note="قیمت قرارداد آتی پیوسته؛ شامل اثر جابه‌جایی قرارداد، بدون سود نقدی"),
    "wti": dict(label="نفت WTI · آتی NYMEX", provider="yahoo", series="CL=F", kind="asset", currency="USD", return_basis="price", unit="دلار / بشکه", note="قیمت قرارداد آتی پیوسته؛ شامل اثر جابه‌جایی قرارداد؛ قیمت‌های غیرمثبت برای محاسبه بازده حذف نمی‌شوند و همبستگی را نامعتبر می‌کنند"),
    "iran_total": dict(label="شاخص کل بورس ایران", provider="tsetmc", series="32097828799138957", kind="asset", currency="IRR", return_basis="total_return", unit="واحد شاخص", note="شاخص قیمت و بازده نقدی (TEDPIX)؛ سود نقدی در شاخص منظور شده است"),
    "iran_equal": dict(label="شاخص هم‌وزن بورس ایران", provider="tsetmc", series="67130298613737946", kind="asset", currency="IRR", return_basis="total_return", unit="واحد شاخص", note="شاخص کل هم‌وزن با احتساب سود نقدی؛ با شاخص قیمت هم‌وزن متفاوت است"),
    "iran_price": dict(label="شاخص قیمت بورس ایران", provider="tsetmc", series="5798407779416661", kind="asset", currency="IRR", return_basis="price", unit="واحد شاخص", note="شاخص قیمت وزنی–ارزشی (TEPIX)، بدون سود نقدی؛ برای مقایسه با طلا استفاده می‌شود"),
    "broad_dollar": dict(label="شاخص گسترده دلار آمریکا", provider="fred", series="DTWEXBGS", kind="fx_index", currency=None, return_basis="not_applicable", unit="شاخص؛ ژانویه ۲۰۰۶ = ۱۰۰", note="شاخص اسمی گسترده و تجاری فدرال رزرو؛ DXY نیست"),
    "real_yield_10y": dict(label="بازده واقعی اوراق ۱۰ساله آمریکا", provider="fred", series="DFII10", kind="rate", currency=None, return_basis="not_applicable", unit="درصد سالانه", note="بازده واقعی TIPS؛ مقدار به درصد و تغییر به واحد پایه؛ خارج از رتبه‌بندی دارایی‌ها"),
}

PRESETS = [
    dict(id="sp_gold", label="S&P و طلا", symbols=["sp500", "gold"], currency="USD"),
    dict(id="gold_dollar", label="طلا و دلار گسترده", symbols=["gold", "broad_dollar"], currency="USD"),
    dict(id="gold_real", label="طلا و بازده واقعی ۱۰ساله", symbols=["gold", "real_yield_10y"], currency="USD"),
    dict(id="gold_silver", label="طلا و نقره", symbols=["gold", "silver"], currency="USD"),
    dict(id="iran_indices", label="شاخص کل و هم‌وزن ایران", symbols=["iran_total", "iran_equal"], currency="IRR"),
    dict(id="iran_gold", label="بورس ایران و طلا · مبنای دلاری", symbols=["iran_price", "gold"], currency="USD"),
]
