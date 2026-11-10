/* i18n.js — English, Persian (RTL) and Spanish. Keep every key present in all three (tests check this). */
const I18n = (() => {
  'use strict';

  const en = {
    'title1': 'BASKETBALL', 'title2': 'ARCADE', 'tag': 'FLICK • SHOOT • SCORE',
    'play': 'PLAY', 'shop': 'SHOP', 'trophies': 'TROPHIES', 'settings': 'SETTINGS', 'back': 'BACK',
    'best': 'BEST', 'high': 'HIGH SCORE', 'coins': 'coins',
    'modes.title': 'CHOOSE MODE',
    'mode.classic.name': 'CLASSIC', 'mode.classic.desc': '60 seconds. The last 10 are double points.',
    'mode.rush.name': 'BEAT THE CLOCK', 'mode.rush.desc': 'Start with 30 s. Every basket adds time.',
    'mode.sudden.name': 'SUDDEN DEATH', 'mode.sudden.desc': '3 misses and it is over. The hoop gets wilder.',
    'mode.moving.name': 'MOVING HOOP', 'mode.moving.desc': '60 seconds, hoop moves from the start. 50% more coins.',
    'hud.score': 'SCORE', 'hud.time': 'TIME', 'hud.bonus': 'BONUS x2', 'hud.strikes': 'STRIKES',
    'streak': 'STREAK x{n}', 'fire': 'ON FIRE x{n}',
    'pop.swish': 'SWISH!', 'pop.bank': 'BANK SHOT!', 'pop.rim': 'RATTLED IN!',
    'pop.s3': 'HEATING UP!', 'pop.s5': 'ON FIRE!', 'pop.s8': 'UNSTOPPABLE!', 'pop.miss': 'MISS!', 'pop.time': '+{n}s',
    'ban.bonus': 'BONUS TIME x2', 'ban.time': "TIME'S UP!", 'ban.over': 'GAME OVER',
    'ban.move': 'HOOP ON THE MOVE!', 'ban.fast': 'HOOP GOING WILD!',
    'hint': 'DRAG A BALL AND FLICK IT UP!',
    'count.ready': 'GET READY', 'count.go': 'GO!',
    'pause.title': 'PAUSED', 'pause.resume': 'RESUME', 'pause.restart': 'RESTART', 'pause.quit': 'MAIN MENU',
    'over.time': "TIME'S UP!", 'over.lives': 'GAME OVER', 'over.final': 'FINAL SCORE', 'over.new': '★ NEW HIGH SCORE ★',
    'over.coins': '+{n} coins', 'over.again': 'PLAY AGAIN', 'over.share': 'SHARE', 'over.menu': 'MENU',
    'over.t0': 'KEEP PRACTISING', 'over.t1': 'NOT BAD', 'over.t2': 'NICE SHOOTING', 'over.t3': 'ARCADE LEGEND',
    'stat.baskets': 'BASKETS', 'stat.accuracy': 'ACCURACY', 'stat.streak': 'BEST STREAK',
    'stat.games': 'GAMES', 'stat.swishes': 'SWISHES',
    'share.text': 'I scored {score} in Basketball Arcade ({mode})! Can you beat me?', 'copied': 'Copied to clipboard',
    'shop.title': 'SHOP', 'shop.balls': 'BALLS', 'shop.courts': 'COURTS', 'shop.owned': 'OWNED', 'shop.equipped': 'EQUIPPED',
    'shop.need': 'NOT ENOUGH COINS', 'shop.unlocked': 'UNLOCKED!',
    'ball.classic': 'Classic', 'ball.neon': 'Neon', 'ball.bubble': 'Bubblegum', 'ball.gold': 'Gold',
    'ball.galaxy': 'Galaxy', 'ball.chrome': 'Chrome', 'ball.lava': 'Lava',
    'court.neon': 'Neon Night', 'court.sunset': 'Sunset Beach', 'court.arctic': 'Arctic Ice', 'court.matrix': 'Matrix',
    'tro.title': 'TROPHIES', 'tro.unlocked': 'Trophy unlocked: {name}',
    'ach.first': 'First Bucket', 'ach.first.d': 'Score your first basket.',
    'ach.swish10': 'Clean Hands', 'ach.swish10.d': 'Hit 10 swishes.',
    'ach.swish100': 'Net Ripper', 'ach.swish100.d': 'Hit 100 swishes.',
    'ach.streak5': 'Heating Up', 'ach.streak5.d': 'Make 5 in a row.',
    'ach.streak10': 'On Fire', 'ach.streak10.d': 'Make 10 in a row.',
    'ach.score40': 'Buckets', 'ach.score40.d': 'Score 40 in one game.',
    'ach.score80': 'Superstar', 'ach.score80.d': 'Score 80 in one game.',
    'ach.games10': 'Regular', 'ach.games10.d': 'Play 10 games.',
    'ach.sharp': 'Sharpshooter', 'ach.sharp.d': '70% accuracy with 10+ shots.',
    'ach.rush40': 'Time Lord', 'ach.rush40.d': 'Score 40 in Beat the Clock.',
    'ach.sudden25': 'Nerves of Steel', 'ach.sudden25.d': 'Score 25 in Sudden Death.',
    'ach.moving30': 'Moving Target', 'ach.moving30.d': 'Score 30 in Moving Hoop.',
    'set.title': 'SETTINGS', 'set.sound': 'SOUND', 'set.vibration': 'VIBRATION', 'set.lang': 'LANGUAGE',
    'on': 'ON', 'off': 'OFF', 'set.how': 'HOW TO PLAY',
    'set.how1': 'Drag a ball and flick it up at the hoop.', 'set.how2': 'A faster flick throws harder. Aim where you flick.',
    'set.how3': 'Swishes and streaks score more. Earn coins to unlock balls and courts.',
    'set.reset': 'RESET PROGRESS', 'set.reset.q': 'Delete all coins, unlocks and records?', 'set.delete': 'DELETE', 'set.cancel': 'CANCEL',
    'daily': 'Daily bonus +{n} coins!',
    'pause.aria': 'Pause',
  };

  const fa = {
    'title1': 'بسکتبال', 'title2': 'آرکید', 'tag': 'پرتاب کن • بزن • امتیاز بگیر',
    'play': 'بازی', 'shop': 'فروشگاه', 'trophies': 'جام‌ها', 'settings': 'تنظیمات', 'back': 'بازگشت',
    'best': 'بهترین', 'high': 'رکورد', 'coins': 'سکه',
    'modes.title': 'انتخاب حالت',
    'mode.classic.name': 'کلاسیک', 'mode.classic.desc': '۶۰ ثانیه. ۱۰ ثانیهٔ آخر امتیاز دو برابر است.',
    'mode.rush.name': 'مسابقه با زمان', 'mode.rush.desc': 'با ۳۰ ثانیه شروع کن. هر سبد زمان اضافه می‌کند.',
    'mode.sudden.name': 'مرگ ناگهانی', 'mode.sudden.desc': 'با ۳ خطا بازی تمام می‌شود. حلقه هر لحظه دیوانه‌تر می‌شود.',
    'mode.moving.name': 'حلقهٔ متحرک', 'mode.moving.desc': '۶۰ ثانیه، حلقه از همان اول حرکت می‌کند. ۵۰٪ سکهٔ بیشتر.',
    'hud.score': 'امتیاز', 'hud.time': 'زمان', 'hud.bonus': 'امتیاز ×۲', 'hud.strikes': 'خطاها',
    'streak': 'پشت‌سرهم ×{n}', 'fire': 'آتش ×{n}',
    'pop.swish': 'سوییش!', 'pop.bank': 'ضربهٔ تخته!', 'pop.rim': 'از لبهٔ حلقه!',
    'pop.s3': 'داغ شدی!', 'pop.s5': 'آتش گرفتی!', 'pop.s8': 'مهارنشدنی!', 'pop.miss': 'خطا!', 'pop.time': '+{n} ثانیه',
    'ban.bonus': 'زمان طلایی ×۲', 'ban.time': 'وقت تمام!', 'ban.over': 'باختی!',
    'ban.move': 'حلقه حرکت می‌کند!', 'ban.fast': 'حلقه دیوانه شد!',
    'hint': 'توپ را بگیر و رو به بالا پرتاب کن!',
    'count.ready': 'آماده باش', 'count.go': 'برو!',
    'pause.title': 'توقف', 'pause.resume': 'ادامه', 'pause.restart': 'شروع دوباره', 'pause.quit': 'منوی اصلی',
    'over.time': 'وقت تمام!', 'over.lives': 'بازی تمام شد', 'over.final': 'امتیاز نهایی', 'over.new': '★ رکورد جدید ★',
    'over.coins': '+{n} سکه', 'over.again': 'دوباره بازی کن', 'over.share': 'اشتراک‌گذاری', 'over.menu': 'منو',
    'over.t0': 'بیشتر تمرین کن', 'over.t1': 'بد نیست', 'over.t2': 'شوت عالی', 'over.t3': 'افسانهٔ آرکید',
    'stat.baskets': 'سبدها', 'stat.accuracy': 'دقت', 'stat.streak': 'بیشترین پیاپی',
    'stat.games': 'بازی‌ها', 'stat.swishes': 'سوییش‌ها',
    'share.text': 'من در بسکتبال آرکید ({mode}) {score} امتیاز گرفتم! می‌تونی رکوردم رو بشکنی؟', 'copied': 'کپی شد',
    'shop.title': 'فروشگاه', 'shop.balls': 'توپ‌ها', 'shop.courts': 'زمین‌ها', 'shop.owned': 'خریداری شده', 'shop.equipped': 'انتخاب شده',
    'shop.need': 'سکه کافی نیست', 'shop.unlocked': 'باز شد!',
    'ball.classic': 'کلاسیک', 'ball.neon': 'نئون', 'ball.bubble': 'آدامسی', 'ball.gold': 'طلایی',
    'ball.galaxy': 'کهکشان', 'ball.chrome': 'کروم', 'ball.lava': 'گدازه',
    'court.neon': 'شب نئونی', 'court.sunset': 'غروب ساحل', 'court.arctic': 'یخ قطبی', 'court.matrix': 'ماتریکس',
    'tro.title': 'جام‌ها', 'tro.unlocked': 'جام جدید: {name}',
    'ach.first': 'اولین سبد', 'ach.first.d': 'اولین سبدت را بزن.',
    'ach.swish10': 'دست تمیز', 'ach.swish10.d': '۱۰ سوییش بزن.',
    'ach.swish100': 'تورپاره‌کن', 'ach.swish100.d': '۱۰۰ سوییش بزن.',
    'ach.streak5': 'داغ شدی', 'ach.streak5.d': '۵ سبد پشت سر هم بزن.',
    'ach.streak10': 'آتش‌بازی', 'ach.streak10.d': '۱۰ سبد پشت سر هم بزن.',
    'ach.score40': 'سبدساز', 'ach.score40.d': 'در یک بازی ۴۰ امتیاز بگیر.',
    'ach.score80': 'ابرستاره', 'ach.score80.d': 'در یک بازی ۸۰ امتیاز بگیر.',
    'ach.games10': 'همیشگی', 'ach.games10.d': '۱۰ بازی انجام بده.',
    'ach.sharp': 'تیرانداز', 'ach.sharp.d': 'با حداقل ۱۰ شوت، دقت ۷۰٪ داشته باش.',
    'ach.rush40': 'ارباب زمان', 'ach.rush40.d': 'در «مسابقه با زمان» ۴۰ امتیاز بگیر.',
    'ach.sudden25': 'اعصاب فولادی', 'ach.sudden25.d': 'در «مرگ ناگهانی» ۲۵ امتیاز بگیر.',
    'ach.moving30': 'هدف متحرک', 'ach.moving30.d': 'در «حلقهٔ متحرک» ۳۰ امتیاز بگیر.',
    'set.title': 'تنظیمات', 'set.sound': 'صدا', 'set.vibration': 'لرزش', 'set.lang': 'زبان',
    'on': 'روشن', 'off': 'خاموش', 'set.how': 'راهنمای بازی',
    'set.how1': 'توپ را بگیر و رو به حلقه به بالا پرتاب کن.', 'set.how2': 'پرتاب سریع‌تر یعنی قدرت بیشتر. جهت پرتاب همان جهت نشانه‌گیری است.',
    'set.how3': 'سوییش و سبدهای پیاپی امتیاز بیشتری دارند. با سکه‌ها توپ و زمین جدید باز کن.',
    'set.reset': 'حذف پیشرفت', 'set.reset.q': 'همهٔ سکه‌ها، آیتم‌ها و رکوردها پاک شود؟', 'set.delete': 'حذف', 'set.cancel': 'انصراف',
    'daily': 'پاداش روزانه +{n} سکه!',
    'pause.aria': 'توقف',
  };

  const es = {
    'title1': 'BALONCESTO', 'title2': 'ARCADE', 'tag': 'LANZA • ENCESTA • GANA',
    'play': 'JUGAR', 'shop': 'TIENDA', 'trophies': 'LOGROS', 'settings': 'AJUSTES', 'back': 'ATRÁS',
    'best': 'MEJOR', 'high': 'RÉCORD', 'coins': 'monedas',
    'modes.title': 'ELIGE MODO',
    'mode.classic.name': 'CLÁSICO', 'mode.classic.desc': '60 segundos. Los últimos 10, puntos dobles.',
    'mode.rush.name': 'CONTRARRELOJ', 'mode.rush.desc': 'Empiezas con 30 s. Cada canasta suma tiempo.',
    'mode.sudden.name': 'MUERTE SÚBITA', 'mode.sudden.desc': '3 fallos y se acabó. El aro se vuelve loco.',
    'mode.moving.name': 'ARO MÓVIL', 'mode.moving.desc': '60 segundos con el aro en movimiento. +50% de monedas.',
    'hud.score': 'PUNTOS', 'hud.time': 'TIEMPO', 'hud.bonus': 'BONUS x2', 'hud.strikes': 'FALLOS',
    'streak': 'RACHA x{n}', 'fire': 'EN LLAMAS x{n}',
    'pop.swish': '¡LIMPIA!', 'pop.bank': '¡TABLERO!', 'pop.rim': '¡POR POCO!',
    'pop.s3': '¡CALENTANDO!', 'pop.s5': '¡EN LLAMAS!', 'pop.s8': '¡IMPARABLE!', 'pop.miss': '¡FALLO!', 'pop.time': '+{n}s',
    'ban.bonus': '¡TIEMPO EXTRA x2!', 'ban.time': '¡SE ACABÓ!', 'ban.over': 'FIN DEL JUEGO',
    'ban.move': '¡EL ARO SE MUEVE!', 'ban.fast': '¡ARO DESATADO!',
    'hint': '¡ARRASTRA UN BALÓN Y LANZA HACIA ARRIBA!',
    'count.ready': 'PREPÁRATE', 'count.go': '¡YA!',
    'pause.title': 'PAUSA', 'pause.resume': 'CONTINUAR', 'pause.restart': 'REINICIAR', 'pause.quit': 'MENÚ PRINCIPAL',
    'over.time': '¡SE ACABÓ!', 'over.lives': 'FIN DEL JUEGO', 'over.final': 'PUNTUACIÓN FINAL', 'over.new': '★ NUEVO RÉCORD ★',
    'over.coins': '+{n} monedas', 'over.again': 'OTRA VEZ', 'over.share': 'COMPARTIR', 'over.menu': 'MENÚ',
    'over.t0': 'SIGUE PRACTICANDO', 'over.t1': 'NO ESTÁ MAL', 'over.t2': '¡BUEN TIRO!', 'over.t3': 'LEYENDA ARCADE',
    'stat.baskets': 'CANASTAS', 'stat.accuracy': 'PRECISIÓN', 'stat.streak': 'MEJOR RACHA',
    'stat.games': 'PARTIDAS', 'stat.swishes': 'LIMPIAS',
    'share.text': '¡Hice {score} puntos en Baloncesto Arcade ({mode})! ¿Puedes superarme?', 'copied': 'Copiado',
    'shop.title': 'TIENDA', 'shop.balls': 'BALONES', 'shop.courts': 'CANCHAS', 'shop.owned': 'COMPRADO', 'shop.equipped': 'EQUIPADO',
    'shop.need': 'MONEDAS INSUFICIENTES', 'shop.unlocked': '¡DESBLOQUEADO!',
    'ball.classic': 'Clásico', 'ball.neon': 'Neón', 'ball.bubble': 'Chicle', 'ball.gold': 'Oro',
    'ball.galaxy': 'Galaxia', 'ball.chrome': 'Cromo', 'ball.lava': 'Lava',
    'court.neon': 'Noche Neón', 'court.sunset': 'Atardecer', 'court.arctic': 'Hielo Ártico', 'court.matrix': 'Matrix',
    'tro.title': 'LOGROS', 'tro.unlocked': 'Logro: {name}',
    'ach.first': 'Primera canasta', 'ach.first.d': 'Anota tu primera canasta.',
    'ach.swish10': 'Manos limpias', 'ach.swish10.d': 'Haz 10 canastas limpias.',
    'ach.swish100': 'Rompe redes', 'ach.swish100.d': 'Haz 100 canastas limpias.',
    'ach.streak5': 'Calentando', 'ach.streak5.d': 'Encesta 5 seguidas.',
    'ach.streak10': 'En llamas', 'ach.streak10.d': 'Encesta 10 seguidas.',
    'ach.score40': 'Encestador', 'ach.score40.d': 'Consigue 40 puntos en una partida.',
    'ach.score80': 'Superestrella', 'ach.score80.d': 'Consigue 80 puntos en una partida.',
    'ach.games10': 'Habitual', 'ach.games10.d': 'Juega 10 partidas.',
    'ach.sharp': 'Francotirador', 'ach.sharp.d': '70% de acierto con 10+ tiros.',
    'ach.rush40': 'Señor del tiempo', 'ach.rush40.d': 'Consigue 40 en Contrarreloj.',
    'ach.sudden25': 'Nervios de acero', 'ach.sudden25.d': 'Consigue 25 en Muerte súbita.',
    'ach.moving30': 'Objetivo móvil', 'ach.moving30.d': 'Consigue 30 en Aro móvil.',
    'set.title': 'AJUSTES', 'set.sound': 'SONIDO', 'set.vibration': 'VIBRACIÓN', 'set.lang': 'IDIOMA',
    'on': 'SÍ', 'off': 'NO', 'set.how': 'CÓMO JUGAR',
    'set.how1': 'Arrastra un balón y lánzalo hacia arriba, al aro.', 'set.how2': 'Un lanzamiento más rápido es más fuerte. Apunta hacia donde lanzas.',
    'set.how3': 'Las canastas limpias y las rachas dan más puntos. Gana monedas para desbloquear balones y canchas.',
    'set.reset': 'BORRAR PROGRESO', 'set.reset.q': '¿Borrar monedas, desbloqueos y récords?', 'set.delete': 'BORRAR', 'set.cancel': 'CANCELAR',
    'daily': '¡Bonus diario +{n} monedas!',
    'pause.aria': 'Pausa',
  };

  const LANGS = { en: { name: 'English', dir: 'ltr', s: en }, fa: { name: 'فارسی', dir: 'rtl', s: fa }, es: { name: 'Español', dir: 'ltr', s: es } };
  let lang = 'en';

  function t(key, vars) {
    let s = LANGS[lang].s[key];
    if (s === undefined) s = en[key];
    if (s === undefined) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, n) => (vars[n] != null ? vars[n] : m));
    return s;
  }

  function detect() {
    const n = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
    return n.startsWith('fa') ? 'fa' : n.startsWith('es') ? 'es' : 'en';
  }

  function apply(root) {
    if (typeof document === 'undefined') return;
    const r = root || document;
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGS[lang].dir;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  }

  function setLang(l) { lang = LANGS[l] ? l : 'en'; apply(); }

  return { t, setLang, apply, detect, LANGS, get lang() { return lang; }, get dir() { return LANGS[lang].dir; } };
})();

if (typeof module !== 'undefined') module.exports = I18n;
