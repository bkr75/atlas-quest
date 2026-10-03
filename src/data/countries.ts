/**
 * Master country table. One row per playable country.
 *
 * Fields:
 *  - id:        ISO 3166-1 alpha-2 code (also used as the map feature id)
 *  - num:       ISO 3166-1 numeric code used by Natural Earth / world-atlas
 *               ("" for Kosovo, which has no numeric code; matched by name in scripts/build-map.mjs)
 *  - regions:   region ids this country belongs to (see regions.ts)
 *  - en / ar:   official display names
 *  - capEn / capAr: capital city
 *  - altEn / altAr / capAltEn / capAltAr: accepted alternative spellings / short forms
 *  - capitalDisputed: excluded from the capitals quiz because the capital is internationally disputed
 */
export type RegionId =
  | 'world'
  | 'arab'
  | 'gulf'
  | 'africa'
  | 'asia'
  | 'europe'
  | 'namerica'
  | 'samerica'
  | 'oceania';

export interface Country {
  id: string;
  num: string;
  regions: RegionId[];
  en: string;
  ar: string;
  capEn: string;
  capAr: string;
  altEn: string[];
  altAr: string[];
  capAltEn: string[];
  capAltAr: string[];
  capitalDisputed?: boolean;
}

type Alts = {
  altEn?: string[];
  altAr?: string[];
  capAltEn?: string[];
  capAltAr?: string[];
  capitalDisputed?: boolean;
};

function c(
  id: string,
  num: string,
  regions: RegionId[],
  en: string,
  ar: string,
  capEn: string,
  capAr: string,
  alts: Alts = {},
): Country {
  return {
    id,
    num,
    regions,
    en,
    ar,
    capEn,
    capAr,
    altEn: alts.altEn ?? [],
    altAr: alts.altAr ?? [],
    capAltEn: alts.capAltEn ?? [],
    capAltAr: alts.capAltAr ?? [],
    ...(alts.capitalDisputed ? { capitalDisputed: true } : {}),
  };
}

const AF: RegionId[] = ['africa'];
const AFA: RegionId[] = ['africa', 'arab'];
const AS: RegionId[] = ['asia'];
const ASA: RegionId[] = ['asia', 'arab'];
const GULF: RegionId[] = ['asia', 'arab', 'gulf'];
const EU: RegionId[] = ['europe'];
const NA: RegionId[] = ['namerica'];
const SA: RegionId[] = ['samerica'];
const OC: RegionId[] = ['oceania'];

export const COUNTRIES: Country[] = [
  // ───────────── Africa ─────────────
  c('DZ', '012', AFA, 'Algeria', 'الجزائر', 'Algiers', 'الجزائر العاصمة', { capAltAr: ['الجزائر'] }),
  c('AO', '024', AF, 'Angola', 'أنغولا', 'Luanda', 'لواندا', { altAr: ['انجولا'] }),
  c('BJ', '204', AF, 'Benin', 'بنين', 'Porto-Novo', 'بورتو نوفو'),
  c('BW', '072', AF, 'Botswana', 'بوتسوانا', 'Gaborone', 'غابورون'),
  c('BF', '854', AF, 'Burkina Faso', 'بوركينا فاسو', 'Ouagadougou', 'واغادوغو'),
  c('BI', '108', AF, 'Burundi', 'بوروندي', 'Gitega', 'غيتيغا'),
  c('CV', '132', AF, 'Cabo Verde', 'الرأس الأخضر', 'Praia', 'برايا', {
    altEn: ['Cape Verde'],
    altAr: ['كابو فيردي'],
  }),
  c('CM', '120', AF, 'Cameroon', 'الكاميرون', 'Yaoundé', 'ياوندي'),
  c('CF', '140', AF, 'Central African Republic', 'جمهورية أفريقيا الوسطى', 'Bangui', 'بانغي', {
    altEn: ['CAR'],
    altAr: ['أفريقيا الوسطى'],
  }),
  c('TD', '148', AF, 'Chad', 'تشاد', "N'Djamena", 'إنجامينا', {
    capAltEn: ['Ndjamena'],
    capAltAr: ['نجامينا', 'انجمينا'],
  }),
  c('KM', '174', AFA, 'Comoros', 'جزر القمر', 'Moroni', 'موروني', { altAr: ['القمر'] }),
  c('CG', '178', AF, 'Republic of the Congo', 'جمهورية الكونغو', 'Brazzaville', 'برازافيل', {
    altEn: ['Congo', 'Congo-Brazzaville', 'Congo Republic'],
    altAr: ['الكونغو', 'الكونغو برازافيل'],
  }),
  c('CD', '180', AF, 'Democratic Republic of the Congo', 'جمهورية الكونغو الديمقراطية', 'Kinshasa', 'كينشاسا', {
    altEn: ['DR Congo', 'DRC', 'Congo-Kinshasa'],
    altAr: ['الكونغو الديمقراطية', 'الكونغو كينشاسا'],
  }),
  c('DJ', '262', AFA, 'Djibouti', 'جيبوتي', 'Djibouti City', 'مدينة جيبوتي', {
    capAltEn: ['Djibouti'],
    capAltAr: ['جيبوتي'],
  }),
  c('EG', '818', AFA, 'Egypt', 'مصر', 'Cairo', 'القاهرة', { altAr: ['جمهورية مصر العربية'] }),
  c('GQ', '226', AF, 'Equatorial Guinea', 'غينيا الاستوائية', 'Malabo', 'مالابو'),
  c('ER', '232', AF, 'Eritrea', 'إريتريا', 'Asmara', 'أسمرة', { altAr: ['ارتريا'], capAltAr: ['أسمرا'] }),
  c('SZ', '748', AF, 'Eswatini', 'إسواتيني', 'Mbabane', 'مباباني', {
    altEn: ['Swaziland'],
    altAr: ['سوازيلاند'],
    capAltEn: ['Lobamba'],
    capAltAr: ['لوبامبا'],
  }),
  c('ET', '231', AF, 'Ethiopia', 'إثيوبيا', 'Addis Ababa', 'أديس أبابا', { altAr: ['اثيوبيا'] }),
  c('GA', '266', AF, 'Gabon', 'الغابون', 'Libreville', 'ليبرفيل', { altAr: ['غابون'] }),
  c('GM', '270', AF, 'Gambia', 'غامبيا', 'Banjul', 'بانجول', { altEn: ['The Gambia'] }),
  c('GH', '288', AF, 'Ghana', 'غانا', 'Accra', 'أكرا'),
  c('GN', '324', AF, 'Guinea', 'غينيا', 'Conakry', 'كوناكري'),
  c('GW', '624', AF, 'Guinea-Bissau', 'غينيا بيساو', 'Bissau', 'بيساو'),
  c('CI', '384', AF, "Côte d'Ivoire", 'ساحل العاج', 'Yamoussoukro', 'ياموسوكرو', {
    altEn: ['Ivory Coast'],
    altAr: ['كوت ديفوار'],
  }),
  c('KE', '404', AF, 'Kenya', 'كينيا', 'Nairobi', 'نيروبي'),
  c('LS', '426', AF, 'Lesotho', 'ليسوتو', 'Maseru', 'ماسيرو'),
  c('LR', '430', AF, 'Liberia', 'ليبيريا', 'Monrovia', 'منروفيا'),
  c('LY', '434', AFA, 'Libya', 'ليبيا', 'Tripoli', 'طرابلس'),
  c('MG', '450', AF, 'Madagascar', 'مدغشقر', 'Antananarivo', 'أنتاناناريفو'),
  c('MW', '454', AF, 'Malawi', 'مالاوي', 'Lilongwe', 'ليلونغوي', { altAr: ['ملاوي'] }),
  c('ML', '466', AF, 'Mali', 'مالي', 'Bamako', 'باماكو'),
  c('MR', '478', AFA, 'Mauritania', 'موريتانيا', 'Nouakchott', 'نواكشوط'),
  c('MU', '480', AF, 'Mauritius', 'موريشيوس', 'Port Louis', 'بورت لويس'),
  c('MA', '504', AFA, 'Morocco', 'المغرب', 'Rabat', 'الرباط', { altAr: ['المملكة المغربية'] }),
  c('MZ', '508', AF, 'Mozambique', 'موزمبيق', 'Maputo', 'مابوتو'),
  c('NA', '516', AF, 'Namibia', 'ناميبيا', 'Windhoek', 'ويندهوك'),
  c('NE', '562', AF, 'Niger', 'النيجر', 'Niamey', 'نيامي'),
  c('NG', '566', AF, 'Nigeria', 'نيجيريا', 'Abuja', 'أبوجا'),
  c('RW', '646', AF, 'Rwanda', 'رواندا', 'Kigali', 'كيغالي'),
  c('ST', '678', AF, 'São Tomé and Príncipe', 'ساو تومي وبرينسيب', 'São Tomé', 'ساو تومي'),
  c('SN', '686', AF, 'Senegal', 'السنغال', 'Dakar', 'داكار'),
  c('SC', '690', AF, 'Seychelles', 'سيشل', 'Victoria', 'فيكتوريا', { altAr: ['سيشيل'] }),
  c('SL', '694', AF, 'Sierra Leone', 'سيراليون', 'Freetown', 'فريتاون'),
  c('SO', '706', AFA, 'Somalia', 'الصومال', 'Mogadishu', 'مقديشو'),
  c('ZA', '710', AF, 'South Africa', 'جنوب أفريقيا', 'Pretoria', 'بريتوريا', {
    capAltEn: ['Cape Town', 'Bloemfontein'],
    capAltAr: ['كيب تاون', 'بلومفونتين'],
  }),
  c('SS', '728', AF, 'South Sudan', 'جنوب السودان', 'Juba', 'جوبا'),
  c('SD', '729', AFA, 'Sudan', 'السودان', 'Khartoum', 'الخرطوم'),
  c('TZ', '834', AF, 'Tanzania', 'تنزانيا', 'Dodoma', 'دودوما'),
  c('TG', '768', AF, 'Togo', 'توغو', 'Lomé', 'لومي'),
  c('TN', '788', AFA, 'Tunisia', 'تونس', 'Tunis', 'تونس العاصمة', { capAltAr: ['تونس'] }),
  c('UG', '800', AF, 'Uganda', 'أوغندا', 'Kampala', 'كمبالا'),
  c('ZM', '894', AF, 'Zambia', 'زامبيا', 'Lusaka', 'لوساكا'),
  c('ZW', '716', AF, 'Zimbabwe', 'زيمبابوي', 'Harare', 'هراري'),

  // ───────────── Asia ─────────────
  c('AF', '004', AS, 'Afghanistan', 'أفغانستان', 'Kabul', 'كابل'),
  c('AM', '051', AS, 'Armenia', 'أرمينيا', 'Yerevan', 'يريفان'),
  c('AZ', '031', AS, 'Azerbaijan', 'أذربيجان', 'Baku', 'باكو'),
  c('BH', '048', GULF, 'Bahrain', 'البحرين', 'Manama', 'المنامة'),
  c('BD', '050', AS, 'Bangladesh', 'بنغلاديش', 'Dhaka', 'دكا', { capAltAr: ['دكة'] }),
  c('BT', '064', AS, 'Bhutan', 'بوتان', 'Thimphu', 'تيمفو'),
  c('BN', '096', AS, 'Brunei', 'بروناي', 'Bandar Seri Begawan', 'بندر سري بكاوان', {
    altEn: ['Brunei Darussalam'],
    altAr: ['بروناي دار السلام'],
  }),
  c('KH', '116', AS, 'Cambodia', 'كمبوديا', 'Phnom Penh', 'بنوم بنه'),
  c('CN', '156', AS, 'China', 'الصين', 'Beijing', 'بكين', { capAltEn: ['Peking'] }),
  c('CY', '196', ['europe', 'asia'], 'Cyprus', 'قبرص', 'Nicosia', 'نيقوسيا'),
  c('GE', '268', AS, 'Georgia', 'جورجيا', 'Tbilisi', 'تبليسي'),
  c('IN', '356', AS, 'India', 'الهند', 'New Delhi', 'نيودلهي', { capAltAr: ['نيو دلهي'] }),
  c('ID', '360', AS, 'Indonesia', 'إندونيسيا', 'Jakarta', 'جاكرتا'),
  c('IR', '364', AS, 'Iran', 'إيران', 'Tehran', 'طهران'),
  c('IQ', '368', ASA, 'Iraq', 'العراق', 'Baghdad', 'بغداد'),
  c('IL', '376', AS, 'Israel', 'إسرائيل', 'Jerusalem (disputed)', 'القدس (متنازع عليها)', {
    capitalDisputed: true,
  }),
  c('JP', '392', AS, 'Japan', 'اليابان', 'Tokyo', 'طوكيو'),
  c('JO', '400', ASA, 'Jordan', 'الأردن', 'Amman', 'عمّان', { altAr: ['المملكة الأردنية الهاشمية'] }),
  c('KZ', '398', AS, 'Kazakhstan', 'كازاخستان', 'Astana', 'أستانا'),
  c('KW', '414', GULF, 'Kuwait', 'الكويت', 'Kuwait City', 'مدينة الكويت', {
    capAltEn: ['Kuwait'],
    capAltAr: ['الكويت'],
  }),
  c('KG', '417', AS, 'Kyrgyzstan', 'قيرغيزستان', 'Bishkek', 'بيشكيك', { altAr: ['قرغيزستان'] }),
  c('LA', '418', AS, 'Laos', 'لاوس', 'Vientiane', 'فيينتيان'),
  c('LB', '422', ASA, 'Lebanon', 'لبنان', 'Beirut', 'بيروت'),
  c('MY', '458', AS, 'Malaysia', 'ماليزيا', 'Kuala Lumpur', 'كوالالمبور', { capAltAr: ['كوالا لمبور'] }),
  c('MV', '462', AS, 'Maldives', 'جزر المالديف', 'Malé', 'ماليه', { altAr: ['المالديف'] }),
  c('MN', '496', AS, 'Mongolia', 'منغوليا', 'Ulaanbaatar', 'أولان باتور', {
    capAltEn: ['Ulan Bator'],
    capAltAr: ['أولانباتار'],
  }),
  c('MM', '104', AS, 'Myanmar', 'ميانمار', 'Naypyidaw', 'نايبيداو', {
    altEn: ['Burma'],
    altAr: ['بورما'],
    capAltEn: ['Nay Pyi Taw'],
  }),
  c('NP', '524', AS, 'Nepal', 'نيبال', 'Kathmandu', 'كاتماندو'),
  c('KP', '408', AS, 'North Korea', 'كوريا الشمالية', 'Pyongyang', 'بيونغ يانغ', { altEn: ['DPRK'] }),
  c('OM', '512', GULF, 'Oman', 'عُمان', 'Muscat', 'مسقط', { altAr: ['سلطنة عمان'] }),
  c('PK', '586', AS, 'Pakistan', 'باكستان', 'Islamabad', 'إسلام آباد'),
  c('PS', '275', ASA, 'Palestine', 'فلسطين', 'East Jerusalem (declared)', 'القدس الشرقية (المعلنة)', {
    altEn: ['State of Palestine'],
    altAr: ['دولة فلسطين'],
    capitalDisputed: true,
  }),
  c('PH', '608', AS, 'Philippines', 'الفلبين', 'Manila', 'مانيلا'),
  c('QA', '634', GULF, 'Qatar', 'قطر', 'Doha', 'الدوحة'),
  c('SA', '682', GULF, 'Saudi Arabia', 'المملكة العربية السعودية', 'Riyadh', 'الرياض', {
    altEn: ['KSA', 'Saudi'],
    altAr: ['السعودية'],
  }),
  c('SG', '702', AS, 'Singapore', 'سنغافورة', 'Singapore', 'سنغافورة'),
  c('KR', '410', AS, 'South Korea', 'كوريا الجنوبية', 'Seoul', 'سول', { capAltAr: ['سيول'] }),
  c('LK', '144', AS, 'Sri Lanka', 'سريلانكا', 'Sri Jayawardenepura Kotte', 'سري جاياواردنابورا كوتي', {
    altAr: ['سري لانكا'],
    capAltEn: ['Kotte', 'Colombo'],
    capAltAr: ['كوتي', 'كولومبو'],
  }),
  c('SY', '760', ASA, 'Syria', 'سوريا', 'Damascus', 'دمشق', { altAr: ['سورية'] }),
  c('TW', '158', AS, 'Taiwan', 'تايوان', 'Taipei', 'تايبيه'),
  c('TJ', '762', AS, 'Tajikistan', 'طاجيكستان', 'Dushanbe', 'دوشنبه'),
  c('TH', '764', AS, 'Thailand', 'تايلاند', 'Bangkok', 'بانكوك'),
  c('TL', '626', AS, 'Timor-Leste', 'تيمور الشرقية', 'Dili', 'ديلي', {
    altEn: ['East Timor'],
    altAr: ['تيمور ليشتي'],
  }),
  c('TR', '792', ['asia', 'europe'], 'Turkey', 'تركيا', 'Ankara', 'أنقرة', { altEn: ['Türkiye'] }),
  c('TM', '795', AS, 'Turkmenistan', 'تركمانستان', 'Ashgabat', 'عشق آباد', { capAltEn: ['Ashkhabad'] }),
  c('AE', '784', GULF, 'United Arab Emirates', 'الإمارات العربية المتحدة', 'Abu Dhabi', 'أبوظبي', {
    altEn: ['UAE', 'Emirates'],
    altAr: ['الإمارات', 'دولة الإمارات'],
    capAltAr: ['أبو ظبي'],
  }),
  c('UZ', '860', AS, 'Uzbekistan', 'أوزبكستان', 'Tashkent', 'طشقند'),
  c('VN', '704', AS, 'Vietnam', 'فيتنام', 'Hanoi', 'هانوي', { altEn: ['Viet Nam'] }),
  c('YE', '887', ASA, 'Yemen', 'اليمن', "Sana'a", 'صنعاء', { capAltEn: ['Sanaa'] }),
  c('RU', '643', ['europe', 'asia'], 'Russia', 'روسيا', 'Moscow', 'موسكو', {
    altEn: ['Russian Federation'],
    altAr: ['روسيا الاتحادية'],
  }),

  // ───────────── Europe ─────────────
  c('AL', '008', EU, 'Albania', 'ألبانيا', 'Tirana', 'تيرانا'),
  c('AD', '020', EU, 'Andorra', 'أندورا', 'Andorra la Vella', 'أندورا لا فيلا'),
  c('AT', '040', EU, 'Austria', 'النمسا', 'Vienna', 'فيينا'),
  c('BY', '112', EU, 'Belarus', 'بيلاروسيا', 'Minsk', 'مينسك', { altAr: ['روسيا البيضاء'] }),
  c('BE', '056', EU, 'Belgium', 'بلجيكا', 'Brussels', 'بروكسل'),
  c('BA', '070', EU, 'Bosnia and Herzegovina', 'البوسنة والهرسك', 'Sarajevo', 'سراييفو', {
    altEn: ['Bosnia'],
    altAr: ['البوسنة'],
  }),
  c('BG', '100', EU, 'Bulgaria', 'بلغاريا', 'Sofia', 'صوفيا'),
  c('HR', '191', EU, 'Croatia', 'كرواتيا', 'Zagreb', 'زغرب'),
  c('CZ', '203', EU, 'Czechia', 'التشيك', 'Prague', 'براغ', {
    altEn: ['Czech Republic'],
    altAr: ['جمهورية التشيك', 'تشيكيا'],
  }),
  c('DK', '208', EU, 'Denmark', 'الدنمارك', 'Copenhagen', 'كوبنهاغن', { capAltAr: ['كوبنهاجن'] }),
  c('EE', '233', EU, 'Estonia', 'إستونيا', 'Tallinn', 'تالين'),
  c('FI', '246', EU, 'Finland', 'فنلندا', 'Helsinki', 'هلسنكي'),
  c('FR', '250', EU, 'France', 'فرنسا', 'Paris', 'باريس'),
  c('DE', '276', EU, 'Germany', 'ألمانيا', 'Berlin', 'برلين'),
  c('GR', '300', EU, 'Greece', 'اليونان', 'Athens', 'أثينا'),
  c('HU', '348', EU, 'Hungary', 'المجر', 'Budapest', 'بودابست', { altAr: ['هنغاريا'] }),
  c('IS', '352', EU, 'Iceland', 'آيسلندا', 'Reykjavík', 'ريكيافيك', { altAr: ['أيسلندا'] }),
  c('IE', '372', EU, 'Ireland', 'أيرلندا', 'Dublin', 'دبلن', { altAr: ['ايرلندا'] }),
  c('IT', '380', EU, 'Italy', 'إيطاليا', 'Rome', 'روما'),
  c('XK', '', EU, 'Kosovo', 'كوسوفو', 'Pristina', 'بريشتينا'),
  c('LV', '428', EU, 'Latvia', 'لاتفيا', 'Riga', 'ريغا'),
  c('LI', '438', EU, 'Liechtenstein', 'ليختنشتاين', 'Vaduz', 'فادوز'),
  c('LT', '440', EU, 'Lithuania', 'ليتوانيا', 'Vilnius', 'فيلنيوس'),
  c('LU', '442', EU, 'Luxembourg', 'لوكسمبورغ', 'Luxembourg City', 'مدينة لوكسمبورغ', {
    capAltEn: ['Luxembourg'],
    capAltAr: ['لوكسمبورغ'],
  }),
  c('MT', '470', EU, 'Malta', 'مالطا', 'Valletta', 'فاليتا'),
  c('MD', '498', EU, 'Moldova', 'مولدوفا', 'Chișinău', 'كيشيناو'),
  c('MC', '492', EU, 'Monaco', 'موناكو', 'Monaco', 'موناكو'),
  c('ME', '499', EU, 'Montenegro', 'الجبل الأسود', 'Podgorica', 'بودغوريتسا', { altAr: ['مونتينيغرو'] }),
  c('NL', '528', EU, 'Netherlands', 'هولندا', 'Amsterdam', 'أمستردام', {
    altEn: ['Holland', 'The Netherlands'],
    altAr: ['مملكة هولندا'],
  }),
  c('MK', '807', EU, 'North Macedonia', 'مقدونيا الشمالية', 'Skopje', 'سكوبيه', {
    altEn: ['Macedonia'],
    altAr: ['مقدونيا'],
  }),
  c('NO', '578', EU, 'Norway', 'النرويج', 'Oslo', 'أوسلو'),
  c('PL', '616', EU, 'Poland', 'بولندا', 'Warsaw', 'وارسو'),
  c('PT', '620', EU, 'Portugal', 'البرتغال', 'Lisbon', 'لشبونة'),
  c('RO', '642', EU, 'Romania', 'رومانيا', 'Bucharest', 'بوخارست'),
  c('SM', '674', EU, 'San Marino', 'سان مارينو', 'San Marino', 'سان مارينو'),
  c('RS', '688', EU, 'Serbia', 'صربيا', 'Belgrade', 'بلغراد'),
  c('SK', '703', EU, 'Slovakia', 'سلوفاكيا', 'Bratislava', 'براتيسلافا'),
  c('SI', '705', EU, 'Slovenia', 'سلوفينيا', 'Ljubljana', 'ليوبليانا'),
  c('ES', '724', EU, 'Spain', 'إسبانيا', 'Madrid', 'مدريد', { altAr: ['اسبانيا'] }),
  c('SE', '752', EU, 'Sweden', 'السويد', 'Stockholm', 'ستوكهولم'),
  c('CH', '756', EU, 'Switzerland', 'سويسرا', 'Bern', 'برن', { capAltEn: ['Berne'] }),
  c('UA', '804', EU, 'Ukraine', 'أوكرانيا', 'Kyiv', 'كييف', { capAltEn: ['Kiev'] }),
  c('GB', '826', EU, 'United Kingdom', 'المملكة المتحدة', 'London', 'لندن', {
    altEn: ['UK', 'Britain', 'Great Britain'],
    altAr: ['بريطانيا', 'بريطانيا العظمى'],
  }),
  c('VA', '336', EU, 'Vatican City', 'الفاتيكان', 'Vatican City', 'مدينة الفاتيكان', {
    altEn: ['Vatican', 'Holy See'],
    altAr: ['دولة الفاتيكان', 'الكرسي الرسولي'],
    capAltEn: ['Vatican'],
    capAltAr: ['الفاتيكان'],
  }),

  // ───────────── North America (incl. Central America & Caribbean) ─────────────
  c('AG', '028', NA, 'Antigua and Barbuda', 'أنتيغوا وباربودا', "St. John's", 'سانت جونز'),
  c('BS', '044', NA, 'Bahamas', 'جزر البهاما', 'Nassau', 'ناساو', {
    altEn: ['The Bahamas'],
    altAr: ['البهاما'],
  }),
  c('BB', '052', NA, 'Barbados', 'باربادوس', 'Bridgetown', 'بريدجتاون'),
  c('BZ', '084', NA, 'Belize', 'بليز', 'Belmopan', 'بلموبان'),
  c('CA', '124', NA, 'Canada', 'كندا', 'Ottawa', 'أوتاوا'),
  c('CR', '188', NA, 'Costa Rica', 'كوستاريكا', 'San José', 'سان خوسيه', { altAr: ['كوستا ريكا'] }),
  c('CU', '192', NA, 'Cuba', 'كوبا', 'Havana', 'هافانا'),
  c('DM', '212', NA, 'Dominica', 'دومينيكا', 'Roseau', 'روسو'),
  c('DO', '214', NA, 'Dominican Republic', 'جمهورية الدومينيكان', 'Santo Domingo', 'سانتو دومينغو', {
    altAr: ['الدومينيكان'],
  }),
  c('SV', '222', NA, 'El Salvador', 'السلفادور', 'San Salvador', 'سان سلفادور'),
  c('GD', '308', NA, 'Grenada', 'غرينادا', "St. George's", 'سانت جورجز'),
  c('GT', '320', NA, 'Guatemala', 'غواتيمالا', 'Guatemala City', 'مدينة غواتيمالا', {
    capAltEn: ['Guatemala'],
    capAltAr: ['غواتيمالا'],
  }),
  c('HT', '332', NA, 'Haiti', 'هايتي', 'Port-au-Prince', 'بورت أو برنس'),
  c('HN', '340', NA, 'Honduras', 'هندوراس', 'Tegucigalpa', 'تيغوسيغالبا'),
  c('JM', '388', NA, 'Jamaica', 'جامايكا', 'Kingston', 'كينغستون'),
  c('MX', '484', NA, 'Mexico', 'المكسيك', 'Mexico City', 'مكسيكو سيتي', { capAltAr: ['مدينة مكسيكو'] }),
  c('NI', '558', NA, 'Nicaragua', 'نيكاراغوا', 'Managua', 'ماناغوا'),
  c('PA', '591', NA, 'Panama', 'بنما', 'Panama City', 'مدينة بنما', {
    capAltEn: ['Panama'],
    capAltAr: ['بنما'],
  }),
  c('KN', '659', NA, 'Saint Kitts and Nevis', 'سانت كيتس ونيفيس', 'Basseterre', 'باستير'),
  c('LC', '662', NA, 'Saint Lucia', 'سانت لوسيا', 'Castries', 'كاستريس'),
  c('VC', '670', NA, 'Saint Vincent and the Grenadines', 'سانت فينسنت والغرينادين', 'Kingstown', 'كينغستاون'),
  c('TT', '780', NA, 'Trinidad and Tobago', 'ترينيداد وتوباغو', 'Port of Spain', 'بورت أوف سبين'),
  c('US', '840', NA, 'United States', 'الولايات المتحدة الأمريكية', 'Washington, D.C.', 'واشنطن العاصمة', {
    altEn: ['USA', 'US', 'America', 'United States of America'],
    altAr: ['أمريكا', 'أميركا', 'الولايات المتحدة', 'الولايات المتحدة الأميركية'],
    capAltEn: ['Washington', 'Washington DC'],
    capAltAr: ['واشنطن'],
  }),

  // ───────────── South America ─────────────
  c('AR', '032', SA, 'Argentina', 'الأرجنتين', 'Buenos Aires', 'بوينس آيرس', { capAltAr: ['بوينس ايرس'] }),
  c('BO', '068', SA, 'Bolivia', 'بوليفيا', 'Sucre', 'سوكري', {
    capAltEn: ['La Paz'],
    capAltAr: ['لاباز', 'لا باز'],
  }),
  c('BR', '076', SA, 'Brazil', 'البرازيل', 'Brasília', 'برازيليا'),
  c('CL', '152', SA, 'Chile', 'تشيلي', 'Santiago', 'سانتياغو', { altAr: ['شيلي'] }),
  c('CO', '170', SA, 'Colombia', 'كولومبيا', 'Bogotá', 'بوغوتا'),
  c('EC', '218', SA, 'Ecuador', 'الإكوادور', 'Quito', 'كيتو'),
  c('GY', '328', SA, 'Guyana', 'غيانا', 'Georgetown', 'جورج تاون', { altAr: ['غويانا'] }),
  c('PY', '600', SA, 'Paraguay', 'باراغواي', 'Asunción', 'أسونسيون'),
  c('PE', '604', SA, 'Peru', 'بيرو', 'Lima', 'ليما', { altAr: ['البيرو'] }),
  c('SR', '740', SA, 'Suriname', 'سورينام', 'Paramaribo', 'باراماريبو'),
  c('UY', '858', SA, 'Uruguay', 'الأوروغواي', 'Montevideo', 'مونتيفيديو', { altAr: ['أوروغواي'] }),
  c('VE', '862', SA, 'Venezuela', 'فنزويلا', 'Caracas', 'كاراكاس'),

  // ───────────── Oceania ─────────────
  c('AU', '036', OC, 'Australia', 'أستراليا', 'Canberra', 'كانبرا'),
  c('FJ', '242', OC, 'Fiji', 'فيجي', 'Suva', 'سوفا'),
  c('KI', '296', OC, 'Kiribati', 'كيريباتي', 'South Tarawa', 'تاراوا الجنوبية', {
    capAltEn: ['Tarawa'],
    capAltAr: ['تاراوا'],
  }),
  c('MH', '584', OC, 'Marshall Islands', 'جزر مارشال', 'Majuro', 'ماجورو'),
  c('FM', '583', OC, 'Micronesia', 'ميكرونيزيا', 'Palikir', 'باليكير', {
    altEn: ['Federated States of Micronesia'],
    altAr: ['ولايات ميكرونيزيا المتحدة'],
  }),
  c('NR', '520', OC, 'Nauru', 'ناورو', 'Yaren', 'يارين'),
  c('NZ', '554', OC, 'New Zealand', 'نيوزيلندا', 'Wellington', 'ويلينغتون'),
  c('PW', '585', OC, 'Palau', 'بالاو', 'Ngerulmud', 'نغيرولمود'),
  c('PG', '598', OC, 'Papua New Guinea', 'بابوا غينيا الجديدة', 'Port Moresby', 'بورت مورسبي'),
  c('WS', '882', OC, 'Samoa', 'ساموا', 'Apia', 'آبيا'),
  c('SB', '090', OC, 'Solomon Islands', 'جزر سليمان', 'Honiara', 'هونيارا'),
  c('TO', '776', OC, 'Tonga', 'تونغا', "Nuku'alofa", 'نوكوألوفا'),
  c('VU', '548', OC, 'Vanuatu', 'فانواتو', 'Port Vila', 'بورت فيلا'),
];

export const COUNTRY_BY_ID: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((x) => [x.id, x]));

export function getCountry(id: string): Country {
  const country = COUNTRY_BY_ID.get(id);
  if (!country) throw new Error(`Unknown country id: ${id}`);
  return country;
}
