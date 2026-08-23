// Major cities by country, ordered by population (biggest first).
// Used for the "recommended cities" row and the city picker in Vacancies.

export const COUNTRIES = [
  {
    code: 'az',
    name: 'Azerbaijan',
    flag: '🇦🇿',
    cities: ['Bakı', 'Sumqayıt', 'Xırdalan', 'Gəncə', 'Mingəçevir', 'Naxçıvan', 'Şirvan', 'Şəki', 'Lənkəran', 'Yevlax'],
  },
  {
    code: 'tr',
    name: 'Türkiye',
    flag: '🇹🇷',
    cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Kayseri', 'Mersin'],
  },
  {
    code: 'de',
    name: 'Deutschland',
    flag: '🇩🇪',
    cities: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg'],
  },
  {
    code: 'ru',
    name: 'Россия',
    flag: '🇷🇺',
    cities: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону'],
  },
  {
    code: 'us',
    name: 'United States',
    flag: '🇺🇸',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'],
  },
  {
    code: 'gb',
    name: 'United Kingdom',
    flag: '🇬🇧',
    cities: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff'],
  },
  {
    code: 'fr',
    name: 'France',
    flag: '🇫🇷',
    cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg', 'Bordeaux', 'Lille'],
  },
  {
    code: 'it',
    name: 'Italia',
    flag: '🇮🇹',
    cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Firenze', 'Bari', 'Catania'],
  },
  {
    code: 'es',
    name: 'España',
    flag: '🇪🇸',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Bilbao', 'Alicante', 'Valladolid'],
  },
  {
    code: 'nl',
    name: 'Nederland',
    flag: '🇳🇱',
    cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen'],
  },
  {
    code: 'pl',
    name: 'Polska',
    flag: '🇵🇱',
    cities: ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Bydgoszcz', 'Lublin', 'Katowice'],
  },
  {
    code: 'ua',
    name: 'Україна',
    flag: '🇺🇦',
    cities: ['Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя', 'Вінниця', 'Полтава', 'Черкаси', 'Житомир'],
  },
  {
    code: 'ge',
    name: 'საქართველო',
    flag: '🇬🇪',
    cities: ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Zugdidi', 'Gori', 'Poti', 'Telavi'],
  },
  {
    code: 'kz',
    name: 'Қазақстан',
    flag: '🇰🇿',
    cities: ['Алматы', 'Астана', 'Шымкент', 'Актобе', 'Қарағанды', 'Тараз', 'Павлодар', 'Семей', 'Атырау', 'Қостанай'],
  },
  {
    code: 'uz',
    name: 'Oʻzbekiston',
    flag: '🇺🇿',
    cities: ['Toshkent', 'Samarqand', 'Buxoro', 'Namangan', 'Andijon', 'Farg‘ona', 'Nukus', 'Termiz', 'Urganch', 'Jizzax'],
  },
  {
    code: 'ir',
    name: 'ایران',
    flag: '🇮🇷',
    cities: ['تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز', 'کرمانشاه', 'ارومیه'],
  },
  {
    code: 'ae',
    name: 'الإمارات العربية المتحدة',
    flag: '🇦🇪',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
  },
  {
    code: 'ca',
    name: 'Canada',
    flag: '🇨🇦',
    cities: ['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Québec City', 'Winnipeg', 'Hamilton', 'Halifax'],
  },
  {
    code: 'in',
    name: 'India',
    flag: '🇮🇳',
    cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur'],
  },
  {
    code: 'cn',
    name: '中国',
    flag: '🇨🇳',
    cities: ['上海 Shanghai', '北京 Beijing', '广州 Guangzhou', '深圳 Shenzhen', '成都 Chengdu', '天津 Tianjin', '重庆 Chongqing', '武汉 Wuhan', '杭州 Hangzhou', '南京 Nanjing'],
  },
  {
    code: 'br',
    name: 'Brasil',
    flag: '🇧🇷',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre'],
  },
];

export function findCountry(code) {
  if (!code) return null;
  return COUNTRIES.find(c => c.code === String(code).toLowerCase()) || null;
}
