import { CharacterId, TraderId } from '../types';

export interface DialoguePool {
  greeting: string[];
  loanRequest: string[];
  counterOffer: string[];
  threatReaction: string[];
  liquidationShout: string[];
  bigWinShout: string[];
  tradeEntry: string[];
  debtRepayment: string[];
}

export const CHARACTER_DATA: Record<
  CharacterId,
  {
    name: string;
    nickname: string;
    title: string;
    description: string;
    voicePitch: number;
    voiceRate: number;
    accentColor: string;
    avatarBg: string;
    badgeIcon: string;
  }
> = {
  cirak: {
    name: 'Ferhat',
    nickname: 'Cilet Ferhat',
    title: 'Mıntıkanın Çırağı & Haberci',
    description: 'Sokakları iyi bilir, kim battı kim uçtu anında tefeciye yetiştirir. Borç aksatana emaneti gösterir.',
    voicePitch: 1.15,
    voiceRate: 1.12,
    accentColor: '#ec4899',
    avatarBg: 'from-pink-500 to-purple-600',
    badgeIcon: '🗡️',
  },
  mehmet: {
    name: 'Mehmet',
    nickname: 'Fitilci Mehmet',
    title: 'Stop & Fitil Avcısı',
    description: 'Balina fitillerini ve patlayan stopları kovalar. Sinsi, yalancı, "seni çok severim abi" der.',
    voicePitch: 1.25,
    voiceRate: 0.96,
    accentColor: '#a855f7',
    avatarBg: 'from-purple-500 to-indigo-600',
    badgeIcon: '⚡',
  },
  kemal: {
    name: 'Kemal',
    nickname: 'Tahta Kemal',
    title: 'Emir Defteri & Spoof Dedektifi',
    description: 'Derinlikteki duvarları ve sahte emirleri koklar. Az konuşur, tok seslidir, tehditkârdır.',
    voicePitch: 0.72,
    voiceRate: 0.88,
    accentColor: '#3b82f6',
    avatarBg: 'from-blue-600 to-slate-800',
    badgeIcon: '🧱',
  },
  nuri: {
    name: 'Nuri',
    nickname: 'Fonlama Nuri',
    title: 'Funding & OI Kurdu',
    description: 'Aşırı fonlama oranlarına ters oynar. Hesabı kitabı çok iyi bilir, tefeciyi bile tongaya düşürmeye çalışır.',
    voicePitch: 0.95,
    voiceRate: 1.05,
    accentColor: '#10b981',
    avatarBg: 'from-emerald-500 to-teal-700',
    badgeIcon: '⚖️',
  },
  selo: {
    name: 'Selo',
    nickname: 'Selo Roket',
    title: 'Hacim & Momentum Canavarı',
    description: 'Hacim ve agresif akış aynı yöndeyse risk bütçeli momentum işlemi arar. Gözü karadır ama motor marjini sınırlar.',
    voicePitch: 1.35,
    voiceRate: 1.25,
    accentColor: '#f97316',
    avatarBg: 'from-orange-500 to-rose-600',
    badgeIcon: '🚀',
  },
  sevil: {
    name: 'Sevil',
    nickname: 'Madam Sevil',
    title: 'Range & Bollinger Kraliçesi',
    description: 'Kanal sınırları ve ortalamaya dönüş kovalar. Cilveli konuşur ama buz gibi matematik yapar.',
    voicePitch: 1.1,
    voiceRate: 0.92,
    accentColor: '#d946ef',
    avatarBg: 'from-fuchsia-500 to-pink-600',
    badgeIcon: '👑',
  },
};

export const CIRAK_DIALOGUES = {
  welcome: [
    'Reis hoş geldin mıntıkaya! Masalar tütüyor, içeride para kokusu var.',
    'Aleykümselam usta! Çaylar taze, traderlar pusuda bekliyor. Kasa senin emrinde!',
    'Eyvallah abi, mıntıkayı kolaçan ettim. Selo yine kudurdu, Mehmet ise fitil kovalıyor.',
  ],
  liquidationAlert: (traderName: string, symbol: string, loss: number) =>
    `Usta koş! ${traderName} ${symbol} tahtasında patladı! Tam ${loss.toFixed(0)} USDT buhar oldu, herif mosmor!`,
  overdueAlert: (traderName: string, amount: number) =>
    `Usta, ${traderName} çakalının vadesi doldu! ${amount.toFixed(0)} USDT'yi içeride tutuyor. Gönder beni, kulaklarını çekeyim!`,
  threatSuccess: (traderName: string) =>
    `Gittim, dükkanın camını tıkladım. ${traderName} beti benzi attı abi! "Hemen topluyorum abi" diye titredi!`,
  threatDefiant: (traderName: string) =>
    `${traderName} diklendi usta! "Pozisyon kârda dönecek, bekle" dedi ama dizleri titriyor.`,
  massiveProfitAlert: (traderName: string, profit: number) =>
    `Vay anasını! ${traderName} tahtayı soydu abi, tam ${profit.toFixed(0)} USDT vurdu! Faizimizi hemen tahsil edelim!`,
};

export const TRADER_DIALOGUES: Record<TraderId, DialoguePool> = {
  mehmet: {
    greeting: [
      'Selamın aleyküm canım abim, senin gibi delikanlı tefeci var mı bu alemde!',
      'Usta gözünü seveyim, tam likidasyon fitili atıldı, dipte altın yatıyor!',
    ],
    loanRequest: [
      'Abi kurbanın olayım, bana acil 2,000 USDT ateşle. Fitil iğne gibi battı, 5 dakikaya dönecek, paranı ikiye katlarım!',
      'Büyük tefecim, kasam kurudu ama tahta bana çağrı yapıyor. Faizini de helalinden veririm, aç şu kasayı!',
    ],
    counterOffer: [
      'Aman abi yapma! Bu faiz ne, ciğerimi mi sökeceksin? Faizden %5 kır, vadeyi 10 dakika uzat anlaşalım!',
      'Kıymetli abim, bu oran beni bitirir. Gel %{rate} yap, sana söz ilk kârda ana parayı masaya vururum!',
    ],
    threatReaction: [
      'Abi Ferhat’ı niye üstüme saldın ya! Ayıptır günahtır, vallahi pozisyondaydım, hemen kapatıp veriyorum borcu!',
      'Tamam abi tamam! Korkuttun beni, elim ayağım titredi. Al faizini fazlasıyla!',
    ],
    liquidationShout: [
      'Lan kahpe balinalar! O fitili oraya nasıl uzattınız lan! Bittim ben usta...',
      'Gitti güzelim marjin! Stopumu avladılar şerefsizler!',
    ],
    bigWinShout: [
      'Gördün mü fitil nasıl yakalanır! İğnenin ucundan aldım lokmayı, kâr cepte!',
      'Dedim sana usta! Mehmet fitili gördü mü affetmez!',
    ],
    tradeEntry: [
      'Fitil uzadı, alt gölge devasa. Tersine vuruyorum longu!',
      'Yukarı fitil attı, hacimsiz tepe. Şortu kafasına indiriyorum!',
    ],
    debtRepayment: [
      'Al abim helalinden paranı ve faizini. Mehmet sözünün eridir, yine geleceğim ama!',
      'Borcum borçtur tefeci baba. Hesabı kapattık, aramız bozulmasın!',
    ],
  },
  kemal: {
    greeting: [
      'Aleykümselam. Lafı uzatmayalım, tahta bekliyor.',
      'Paran varsa konuşalım. Derinlikte balina duvarı var.',
    ],
    loanRequest: [
      'Tefeci. Bana 3,000 USDT lazım. Tahtada 500 BTC alım duvarı dizdiler, kırılmadan önce trene biniyorum. Faizini koy ver.',
      'Boş muhabbet sevmem. Kasadan 4,000 USDT çıkar. Vadesinde masaya bırakırım.',
    ],
    counterOffer: [
      'Çok konuştun. O faiz fazla. Yüzde %{rate} kesersin, gerisini masaya koyarsın. İşim var.',
      'Bana ayak yapma tefeci. Ya bu teklifi al ya da tahtayı kaçırıp arkasından bak.',
    ],
    threatReaction: [
      'Çırağın Ferhat delikanlı çocuk ama haddini bilsin. Al şu paranı, bir daha kapıma adam yollama.',
      'Beni korkutamazsın. Ama borcumuzu da yemeyiz. Hesabı kapatıyorum.',
    ],
    liquidationShout: [
      'Sahte duvar koyup çektiler... Spoofing yaptılar kahpeler. Tahta çöktü.',
      'Ulan koca duvarı saniyede sildiler... Marjin sıfırlandı.',
    ],
    bigWinShout: [
      'Duvar çalıştı. Emir defteri yalan söylemez. Vurgunu yaptık.',
      'Sessiz ve derinden... Masayı süpürdük.',
    ],
    tradeEntry: [
      'Alış kademeleri dolu, satış bomboş. Yukarı sürecekler, giriyorum.',
      'Satışa blok koydular, duvarın arkasına geçip şortluyorum.',
    ],
    debtRepayment: [
      'Al paranı. Faizini de aldın, hakkını helal et de etme de umurumda değil.',
      'Hesap kapandı. Bir daha faizi şişirme.',
    ],
  },
  nuri: {
    greeting: [
      'Vay benim matematikçi üstadım! Sayılar asla yalan söylemez bilesin.',
      'Selamlar tefeci patron. Fonlama oranları bu gece delirdi, para akacak!',
    ],
    loanRequest: [
      'Hocam bak, fonlama oranı eksi yüzde 0.05! Bu ne demek biliyor musun? Short squeeze kapıda! 2,500 USDT ver, fonlama ödemesini cebe indirelim!',
      'Abi piyasa aşırı ısındı. Herkes longda, balinalar bunları biçmeye geliyor. Bana sermaye ver, tersine girip voleyi vuralım!',
    ],
    counterOffer: [
      'Hocam senin matematik zayıf galiba. O faizi yazarsan bileşik getirisi beni ezer. Yüzde %{rate} yap, vadeyi de biraz esnet.',
      'Mantıklı olalım patron. Sen de kazan ben de kazanayım. Gel yarı yolda buluşalım.',
    ],
    threatReaction: [
      'Yahu Ferhat kardeşim sakin ol, ceketimi çekiştirme! Abi vallahi fonlama periyodunu bekliyordum, tamam hemen ödüyorum!',
      'Tamam usta, sinirlenme. Hesabı kitapladık, al paranı faiziyle.',
    ],
    liquidationShout: [
      'Açık pozisyonlar patlamadı, beni patlattı! Matematik iflas etti bu piyasada!',
      'Fonlama ters tepti, balinalar kuralları çiğnedi! Eridi marjin...',
    ],
    bigWinShout: [
      'Gördün mü ters köşe nasıl yapılır! Shortçuların fonlamasını cukkaladık!',
      'İstatistik asla şaşmaz! Kasa katlandı!',
    ],
    tradeEntry: [
      'Aşırı pozitif fonlama, kalabalık ters yöne sıkışacak. Kontra vuruş!',
      'Negatif fonlama tavan yaptı. Long squeeze bitti, roket vakti.',
    ],
    debtRepayment: [
      'İşte böyle! Ana para + faiz kuruşu kuruşuna ödendi. Matematik temiz!',
      'Hesabımız tam patron. Yine masaya oturacağız.',
    ],
  },
  selo: {
    greeting: [
      'Ooo tefeci babam! Kanım kaynıyor abi, volalite tavan yaptı bugün!',
      'Abi durma ne olursun! Tahtada canavar var, para basıyor resmen!',
    ],
    loanRequest: [
      'Abi acil para lazım acil! 3,500 USDT ver hemen! Hacim 3 katına çıktı, 40 kaldıraç gireceğim, zengin oluyoruz abi zengin!',
      'Patron kasada tek kuruş kalmadı ama şu yeşil muma bak! Ver bana 5,000 USDT, 3 dakikada parayı ikiye katlayıp geri atayım!',
    ],
    counterOffer: [
      'Aman abi faizine kurban olayım ne yazarsan yaz yeter ki parayı ver kaçıyor tren!',
      'Abi tamam %{rate} olsun ne olur hemen bas parayı hesaba, saniyeler sayıyor!',
    ],
    threatReaction: [
      'Abi Ferhat’a söyle bıçağı indirsin vallahi kalbime iniyordu! Al bütün bakiyeyi veriyorum, yeter ki canımı bağışla!',
      'Tamam abi vurma! Pozisyonu zararda kestim borcu kapattım, affet!',
    ],
    liquidationShout: [
      'HAYIIIR! Tek kırmızı mumda likit olduk! 50 kaldıraç duman etti beni abi...',
      'Abi ekran kıpkırmızı oldu, sıfırlandım! Yardım et!',
    ],
    bigWinShout: [
      'ROKETTTT! VURDUK GEÇTİK ABİİİ! Risk bütçesi nasıl çalıştı ama!',
      'Paranın kokusunu aldım dedim sana! ZENGİNİİİZZZZ!',
    ],
    tradeEntry: [
      'Hacim patladı! 30 kaldıraçla muma atlıyorum, durmak yok!',
      'Kırılım geldi! Piyasa çıldırıyor, bas kaldıracı bas!',
    ],
    debtRepayment: [
      'Al abilerin güzeli, faizinle beraber fazlasını al! Selo kazandı mı herkes kazanır!',
      'Borcum bitti usta! Birazdan tekrar isterim ama hazırlıklı ol!',
    ],
  },
  sevil: {
    greeting: [
      'Merhabalar canım tefecim. Mahallenin en tatlı kasasına uğrayayım dedim.',
      'Hoş bulduk şekerim. Bugün piyasa biraz nazlı ama tam benim dişime göre.',
    ],
    loanRequest: [
      'Şekerim, Bollinger bantları öyle bir sıkıştı ki... Patlama an meselesi. Bana 2,500 USDT borç ver de şu kanalı güzelce sağayım. Faizini de üzme beni.',
      'Tefeci beyciğim, kasamda biraz açılma oldu. Şöyle tatlı bir 3,000 USDT ateşlersen, 15 dakikaya hem ana parayı hem güzel faizini takdim ederim.',
    ],
    counterOffer: [
      'Aşk olsun ama! Bu faiz ne böyle, bana da mı acımıyorsun? Hadi kırma beni, %{rate} yap, yanına da bir kahve ısmarlarım.',
      'Tatlım, bu oranla ticaret dönmez. Gel bunu tatlıya bağlayalım, faizi indir, vadeyi uzat, iki taraf da gülsün.',
    ],
    threatReaction: [
      'Ferhat çocuğum, o ses tonu bir hanımefendiye yakışıyor mu hiç? Al bakalım tefeci efendi, borcunu kuruşu kuruşuna ödüyorum. Bir daha da kapıma terbiyesiz yollama.',
      'Sakin olun beyler, madam borcunu kimsede bırakmaz. Alın paranızı.',
    ],
    liquidationShout: [
      'İnanılır gibi değil... Bant öyle bir patladı ki geri dönmedi. Eridi sermaye.',
      'Zarafetimizi bozdular! Trend durmadı, likidasyon geldi...',
    ],
    bigWinShout: [
      'Kanalın tepesinden aldım, dibinde kapattım. Şiir gibi kâr!',
      'Dedim sana şekerim, madam ortalamayı asla kaçırmaz!',
    ],
    tradeEntry: [
      'Fiyat üst banta çarptı, RSI aşırı alımda. Zarifçe şorta dönüyorum.',
      'Alt banttan onay aldık, dönüş mumu yandı. Long pozisyonu alıyorum.',
    ],
    debtRepayment: [
      'Borcumuzu fazlasıyla kapattık tefeciciğim. Güle güle harca tatlım.',
      'Hesap bitti şekerim. Teşekkür ederim nezaketin için.',
    ],
  },
};
