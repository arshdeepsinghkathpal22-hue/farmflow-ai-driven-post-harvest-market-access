import BRAND from '../brand'
/**
 * User-facing strings in English, Hindi and Punjabi.
 *
 * Sentences are kept short on purpose. A farmer reading this on a phone in
 * sunlight, or having it read aloud, is better served by four plain sentences
 * than one long one - and short sentences also survive translation intact.
 */

export const STRINGS = {
  en: {
    languagePrompt: 'Choose your language',
    languageNote: 'This sets the guide and the language the microphone listens in.',

    guideTitle: `How to use ${BRAND.nameByLang.en}`,
    guideLead:
      'Every screen, explained in plain words. Nothing here needs an account, and nothing costs money to try.',
    guideFooter: 'You can open this guide at any time from the Profile tab.',

    sections: [
      {
        id: 'what',
        title: 'What this app does',
        lead: 'Cold storages only accept large loads. This app puts small farmers together so that a small load becomes an acceptable one.',
        points: [
          'Your 50 to 500 kg joins the produce of nearby farmers.',
          'Together it becomes one pallet the storage owner is happy to accept.',
          'One truck picks up from everybody, so transport becomes far cheaper.',
        ],
      },
      {
        id: 'home',
        title: 'Home screen',
        lead: 'The first screen shows today’s price for your crop and what is worth doing about it.',
        points: [
          'The big green button starts a booking by voice.',
          'The Market Insights card says whether to store or sell today.',
          'The Group Booking card shows the pool forming near you.',
        ],
      },
      {
        id: 'voice',
        title: 'Speak to Book',
        lead: 'Press the microphone and simply say what you want to store. You do not need to read or type anything.',
        points: [
          'Speak in Hindi, Punjabi or English - whichever you chose.',
          'For example: "tomorrow three crates of tomato for pickup".',
          'The app shows what it understood. Check it, then confirm.',
          'If the microphone is unavailable, a sample booking is shown instead.',
        ],
      },
      {
        id: 'freshness',
        title: 'Freshness check',
        lead: 'Photograph your produce and the app estimates how fresh it is, then tells you whether to store it or sell it now.',
        points: [
          'Take a photo in good light, with the produce filling the frame.',
          'The app looks at colour, dark spots and skin texture.',
          'Fresh produce with a long shelf life should go to cold storage.',
          'Produce that is already turning should be sold now, before it is lost.',
        ],
      },
      {
        id: 'prices',
        title: 'Prices',
        lead: 'A seven day price forecast for your crop, with a clear recommendation.',
        points: [
          'STORE means holding is expected to earn more than it costs.',
          'SELL means prices are falling and storing would lose money.',
          'The thin lines above each bar show how uncertain the forecast is.',
          'Change the crop to see the advice change with it.',
        ],
      },
      {
        id: 'storage',
        title: 'Find storage',
        lead: 'Cold storages near you, ordered by how well they suit your crop.',
        points: [
          'Temperature, distance and price are all considered.',
          'Facilities that only take large loads are marked and ranked lower.',
          'Tap Book Slot to hold space for your produce.',
        ],
      },
      {
        id: 'group',
        title: 'Group booking',
        lead: 'Join farmers near you so one truck serves everybody.',
        points: [
          'The map shows the pickup route and each farmer on it.',
          'Your share of the transport cost falls as more farmers join.',
          'When the pallet is full, the full truck rate applies.',
        ],
      },
      {
        id: 'receipt',
        title: 'Receipt and verification',
        lead: 'Every booking gives you a digital warehouse receipt with a QR code.',
        points: [
          'It is proof that your produce is in storage.',
          'It carries a security seal, so nobody can alter it.',
          'Anyone - a buyer or a lender - can check it on the Verify screen.',
          'Under e-NWR rules such a receipt can be pledged for a loan.',
        ],
      },
      {
        id: 'sell',
        title: 'Selling',
        lead: 'Sell straight to hotels, shops and processors, without a middleman.',
        points: [
          'Produce close to spoiling is shown first, so it sells before it is lost.',
          'The price you see is the price the buyer pays.',
        ],
      },
      {
        id: 'offline',
        title: 'Working without network',
        lead: 'The app keeps working where there is no signal.',
        points: [
          'A booking made offline is saved on your phone.',
          'It is marked "Saved offline" in your bookings.',
          'It is sent automatically the moment the network returns.',
        ],
      },
    ],
  },

  hi: {
    languagePrompt: 'अपनी भाषा चुनें',
    languageNote: 'इससे गाइड की भाषा तय होती है और माइक किस भाषा में सुनेगा, यह भी।',

    guideTitle: `${BRAND.nameByLang.hi} कैसे इस्तेमाल करें`,
    guideLead:
      'हर स्क्रीन आसान शब्दों में समझाई गई है। किसी खाते की ज़रूरत नहीं, और आज़माने का कोई पैसा नहीं लगता।',
    guideFooter: 'यह गाइड आप कभी भी प्रोफ़ाइल टैब से खोल सकते हैं।',

    sections: [
      {
        id: 'what',
        title: 'यह ऐप क्या करता है',
        lead: 'कोल्ड स्टोरेज सिर्फ़ बड़ा माल लेते हैं। यह ऐप छोटे किसानों को जोड़ देता है, जिससे छोटा माल भी स्वीकार होने लायक बन जाता है।',
        points: [
          'आपका 50 से 500 किलो माल पास के किसानों के माल से जुड़ जाता है।',
          'मिलकर यह एक पूरा पैलेट बन जाता है, जिसे स्टोरेज मालिक ख़ुशी से रखता है।',
          'एक ही ट्रक सबका माल उठाता है, इसलिए भाड़ा बहुत कम हो जाता है।',
        ],
      },
      {
        id: 'home',
        title: 'होम स्क्रीन',
        lead: 'पहली स्क्रीन पर आपकी फसल का आज का भाव दिखता है और उस पर क्या करना ठीक रहेगा।',
        points: [
          'बड़ा हरा बटन बोलकर बुकिंग शुरू करता है।',
          'मार्केट इनसाइट्स कार्ड बताता है कि आज स्टोर करें या बेचें।',
          'ग्रुप बुकिंग कार्ड आपके पास बन रहे पूल को दिखाता है।',
        ],
      },
      {
        id: 'voice',
        title: 'बोलकर बुक करें',
        lead: 'माइक दबाइए और बस बोल दीजिए कि क्या रखवाना है। न पढ़ना है, न कुछ लिखना है।',
        points: [
          'हिंदी, पंजाबी या अंग्रेज़ी - जो आपने चुनी है, उसी में बोलिए।',
          'जैसे: "कल तीन क्रेट टमाटर पिकअप"।',
          'ऐप दिखाएगा कि उसने क्या समझा। जाँच लीजिए, फिर पक्का कीजिए।',
          'अगर माइक उपलब्ध न हो, तो एक नमूना बुकिंग दिखाई जाती है।',
        ],
      },
      {
        id: 'freshness',
        title: 'ताज़गी जाँच',
        lead: 'अपनी सब्ज़ी की फ़ोटो लीजिए। ऐप बताएगा कि वह कितनी ताज़ी है और उसे स्टोर करना है या अभी बेचना है।',
        points: [
          'अच्छी रोशनी में फ़ोटो लें और सब्ज़ी को पूरे फ्रेम में रखें।',
          'ऐप रंग, काले धब्बे और छिलके की बनावट देखता है।',
          'जो ताज़ी है और देर तक टिकेगी, उसे कोल्ड स्टोरेज भेजिए।',
          'जो ख़राब होने लगी है, उसे अभी बेच दीजिए, बर्बाद होने से पहले।',
        ],
      },
      {
        id: 'prices',
        title: 'कीमतें',
        lead: 'आपकी फसल का सात दिन का भाव अनुमान, साथ में साफ़ सलाह।',
        points: [
          'STORE का मतलब है रखने से लागत से ज़्यादा कमाई की उम्मीद है।',
          'SELL का मतलब है भाव गिर रहा है और रखने में नुक़सान होगा।',
          'हर बार के ऊपर की पतली लकीर बताती है कि अनुमान कितना पक्का है।',
          'फसल बदलिए और देखिए कि सलाह भी बदल जाती है।',
        ],
      },
      {
        id: 'storage',
        title: 'गोदाम ढूँढें',
        lead: 'आपके पास के कोल्ड स्टोरेज, इस क्रम में कि कौन आपकी फसल के लिए ज़्यादा सही है।',
        points: [
          'तापमान, दूरी और भाव - तीनों देखे जाते हैं।',
          'जो सिर्फ़ बड़ा माल लेते हैं, उन पर निशान लगता है और वे नीचे रहते हैं।',
          'स्लॉट बुक करें दबाकर अपनी जगह पक्की कीजिए।',
        ],
      },
      {
        id: 'group',
        title: 'ग्रुप बुकिंग',
        lead: 'पास के किसानों के साथ जुड़िए, ताकि एक ही ट्रक सबका काम कर दे।',
        points: [
          'नक़्शे में पिकअप का रास्ता और हर किसान दिखता है।',
          'जितने ज़्यादा किसान जुड़ते हैं, आपका भाड़ा उतना कम होता है।',
          'पैलेट भर जाने पर पूरे ट्रक का सस्ता रेट लग जाता है।',
        ],
      },
      {
        id: 'receipt',
        title: 'रसीद और जाँच',
        lead: 'हर बुकिंग पर QR कोड वाली डिजिटल गोदाम रसीद मिलती है।',
        points: [
          'यह सबूत है कि आपका माल गोदाम में रखा है।',
          'इस पर सुरक्षा मुहर होती है, इसलिए कोई इसे बदल नहीं सकता।',
          'कोई भी - ख़रीदार या बैंक - जाँच स्क्रीन पर इसे परख सकता है।',
          'e-NWR नियमों के तहत ऐसी रसीद पर लोन लिया जा सकता है।',
        ],
      },
      {
        id: 'sell',
        title: 'बेचना',
        lead: 'होटल, दुकान और प्रोसेसर को सीधे बेचिए, बिना बिचौलिए के।',
        points: [
          'जो माल ख़राब होने वाला है, वह सबसे ऊपर दिखता है, ताकि समय रहते बिक जाए।',
          'जो भाव आपको दिखता है, ख़रीदार वही देता है।',
        ],
      },
      {
        id: 'offline',
        title: 'बिना नेटवर्क के काम',
        lead: 'जहाँ नेटवर्क नहीं है, वहाँ भी ऐप चलता रहता है।',
        points: [
          'बिना नेटवर्क की गई बुकिंग आपके फ़ोन में सेव हो जाती है।',
          'आपकी बुकिंग सूची में उस पर "ऑफ़लाइन सेव" लिखा दिखता है।',
          'नेटवर्क आते ही वह अपने आप भेज दी जाती है।',
        ],
      },
    ],
  },

  pa: {
    languagePrompt: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ',
    languageNote: 'ਇਸ ਨਾਲ ਗਾਈਡ ਦੀ ਭਾਸ਼ਾ ਤੈਅ ਹੁੰਦੀ ਹੈ, ਅਤੇ ਮਾਈਕ ਕਿਸ ਭਾਸ਼ਾ ਵਿੱਚ ਸੁਣੇਗਾ ਇਹ ਵੀ।',

    guideTitle: `${BRAND.nameByLang.pa} ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ`,
    guideLead:
      'ਹਰ ਸਕਰੀਨ ਸੌਖੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਸਮਝਾਈ ਗਈ ਹੈ। ਕਿਸੇ ਖਾਤੇ ਦੀ ਲੋੜ ਨਹੀਂ, ਅਤੇ ਵਰਤ ਕੇ ਵੇਖਣ ਦਾ ਕੋਈ ਪੈਸਾ ਨਹੀਂ ਲੱਗਦਾ।',
    guideFooter: 'ਇਹ ਗਾਈਡ ਤੁਸੀਂ ਕਦੇ ਵੀ ਪ੍ਰੋਫ਼ਾਈਲ ਟੈਬ ਤੋਂ ਖੋਲ੍ਹ ਸਕਦੇ ਹੋ।',

    sections: [
      {
        id: 'what',
        title: 'ਇਹ ਐਪ ਕੀ ਕਰਦੀ ਹੈ',
        lead: 'ਕੋਲਡ ਸਟੋਰੇਜ ਸਿਰਫ਼ ਵੱਡਾ ਮਾਲ ਲੈਂਦੇ ਹਨ। ਇਹ ਐਪ ਛੋਟੇ ਕਿਸਾਨਾਂ ਨੂੰ ਜੋੜ ਦਿੰਦੀ ਹੈ, ਜਿਸ ਨਾਲ ਛੋਟਾ ਮਾਲ ਵੀ ਲੈਣ ਯੋਗ ਬਣ ਜਾਂਦਾ ਹੈ।',
        points: [
          'ਤੁਹਾਡਾ 50 ਤੋਂ 500 ਕਿਲੋ ਮਾਲ ਨੇੜੇ ਦੇ ਕਿਸਾਨਾਂ ਦੇ ਮਾਲ ਨਾਲ ਜੁੜ ਜਾਂਦਾ ਹੈ।',
          'ਰਲ ਕੇ ਇਹ ਇੱਕ ਪੂਰਾ ਪੈਲਟ ਬਣ ਜਾਂਦਾ ਹੈ, ਜੋ ਸਟੋਰੇਜ ਮਾਲਕ ਖ਼ੁਸ਼ੀ ਨਾਲ ਰੱਖਦਾ ਹੈ।',
          'ਇੱਕੋ ਟਰੱਕ ਸਾਰਿਆਂ ਦਾ ਮਾਲ ਚੁੱਕਦਾ ਹੈ, ਇਸ ਲਈ ਭਾੜਾ ਬਹੁਤ ਘੱਟ ਜਾਂਦਾ ਹੈ।',
        ],
      },
      {
        id: 'home',
        title: 'ਹੋਮ ਸਕਰੀਨ',
        lead: 'ਪਹਿਲੀ ਸਕਰੀਨ ਉੱਤੇ ਤੁਹਾਡੀ ਫ਼ਸਲ ਦਾ ਅੱਜ ਦਾ ਭਾਅ ਦਿਸਦਾ ਹੈ ਅਤੇ ਉਸ ਬਾਰੇ ਕੀ ਕਰਨਾ ਠੀਕ ਰਹੇਗਾ।',
        points: [
          'ਵੱਡਾ ਹਰਾ ਬਟਨ ਬੋਲ ਕੇ ਬੁਕਿੰਗ ਸ਼ੁਰੂ ਕਰਦਾ ਹੈ।',
          'ਮਾਰਕੀਟ ਇਨਸਾਈਟਸ ਕਾਰਡ ਦੱਸਦਾ ਹੈ ਕਿ ਅੱਜ ਸਟੋਰ ਕਰਨਾ ਹੈ ਜਾਂ ਵੇਚਣਾ।',
          'ਗਰੁੱਪ ਬੁਕਿੰਗ ਕਾਰਡ ਤੁਹਾਡੇ ਨੇੜੇ ਬਣ ਰਹੇ ਪੂਲ ਨੂੰ ਵਿਖਾਉਂਦਾ ਹੈ।',
        ],
      },
      {
        id: 'voice',
        title: 'ਬੋਲ ਕੇ ਬੁੱਕ ਕਰੋ',
        lead: 'ਮਾਈਕ ਦਬਾਓ ਅਤੇ ਬੱਸ ਬੋਲ ਦਿਓ ਕਿ ਕੀ ਰਖਵਾਉਣਾ ਹੈ। ਨਾ ਪੜ੍ਹਨਾ ਹੈ, ਨਾ ਕੁਝ ਲਿਖਣਾ।',
        points: [
          'ਪੰਜਾਬੀ, ਹਿੰਦੀ ਜਾਂ ਅੰਗਰੇਜ਼ੀ - ਜੋ ਤੁਸੀਂ ਚੁਣੀ ਹੈ, ਉਸੇ ਵਿੱਚ ਬੋਲੋ।',
          'ਜਿਵੇਂ: "ਕੱਲ੍ਹ ਤਿੰਨ ਕਰੇਟ ਟਮਾਟਰ ਪਿਕਅੱਪ"।',
          'ਐਪ ਵਿਖਾਏਗੀ ਕਿ ਉਸ ਨੇ ਕੀ ਸਮਝਿਆ। ਵੇਖ ਲਓ, ਫਿਰ ਪੱਕਾ ਕਰੋ।',
          'ਜੇ ਮਾਈਕ ਉਪਲਬਧ ਨਾ ਹੋਵੇ, ਤਾਂ ਇੱਕ ਨਮੂਨਾ ਬੁਕਿੰਗ ਵਿਖਾਈ ਜਾਂਦੀ ਹੈ।',
        ],
      },
      {
        id: 'freshness',
        title: 'ਤਾਜ਼ਗੀ ਜਾਂਚ',
        lead: 'ਆਪਣੀ ਸਬਜ਼ੀ ਦੀ ਫ਼ੋਟੋ ਲਓ। ਐਪ ਦੱਸੇਗੀ ਕਿ ਉਹ ਕਿੰਨੀ ਤਾਜ਼ੀ ਹੈ ਅਤੇ ਉਸ ਨੂੰ ਸਟੋਰ ਕਰਨਾ ਹੈ ਜਾਂ ਹੁਣੇ ਵੇਚਣਾ।',
        points: [
          'ਚੰਗੀ ਰੌਸ਼ਨੀ ਵਿੱਚ ਫ਼ੋਟੋ ਲਓ ਅਤੇ ਸਬਜ਼ੀ ਨੂੰ ਪੂਰੇ ਫਰੇਮ ਵਿੱਚ ਰੱਖੋ।',
          'ਐਪ ਰੰਗ, ਕਾਲੇ ਧੱਬੇ ਅਤੇ ਛਿਲਕੇ ਦੀ ਬਣਤਰ ਵੇਖਦੀ ਹੈ।',
          'ਜੋ ਤਾਜ਼ੀ ਹੈ ਅਤੇ ਦੇਰ ਤੱਕ ਟਿਕੇਗੀ, ਉਸ ਨੂੰ ਕੋਲਡ ਸਟੋਰੇਜ ਭੇਜੋ।',
          'ਜੋ ਖ਼ਰਾਬ ਹੋਣ ਲੱਗੀ ਹੈ, ਉਸ ਨੂੰ ਹੁਣੇ ਵੇਚ ਦਿਓ, ਬਰਬਾਦ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ।',
        ],
      },
      {
        id: 'prices',
        title: 'ਭਾਅ',
        lead: 'ਤੁਹਾਡੀ ਫ਼ਸਲ ਦਾ ਸੱਤ ਦਿਨ ਦਾ ਭਾਅ ਅੰਦਾਜ਼ਾ, ਨਾਲ ਸਾਫ਼ ਸਲਾਹ।',
        points: [
          'STORE ਦਾ ਮਤਲਬ ਹੈ ਰੱਖਣ ਨਾਲ ਲਾਗਤ ਤੋਂ ਵੱਧ ਕਮਾਈ ਦੀ ਉਮੀਦ ਹੈ।',
          'SELL ਦਾ ਮਤਲਬ ਹੈ ਭਾਅ ਡਿੱਗ ਰਿਹਾ ਹੈ ਅਤੇ ਰੱਖਣ ਵਿੱਚ ਨੁਕਸਾਨ ਹੋਵੇਗਾ।',
          'ਹਰ ਬਾਰ ਦੇ ਉੱਤੇ ਪਤਲੀ ਲਕੀਰ ਦੱਸਦੀ ਹੈ ਕਿ ਅੰਦਾਜ਼ਾ ਕਿੰਨਾ ਪੱਕਾ ਹੈ।',
          'ਫ਼ਸਲ ਬਦਲੋ ਅਤੇ ਵੇਖੋ ਕਿ ਸਲਾਹ ਵੀ ਬਦਲ ਜਾਂਦੀ ਹੈ।',
        ],
      },
      {
        id: 'storage',
        title: 'ਗੋਦਾਮ ਲੱਭੋ',
        lead: 'ਤੁਹਾਡੇ ਨੇੜੇ ਦੇ ਕੋਲਡ ਸਟੋਰੇਜ, ਇਸ ਕ੍ਰਮ ਵਿੱਚ ਕਿ ਕਿਹੜਾ ਤੁਹਾਡੀ ਫ਼ਸਲ ਲਈ ਵੱਧ ਠੀਕ ਹੈ।',
        points: [
          'ਤਾਪਮਾਨ, ਦੂਰੀ ਅਤੇ ਭਾਅ - ਤਿੰਨੇ ਵੇਖੇ ਜਾਂਦੇ ਹਨ।',
          'ਜੋ ਸਿਰਫ਼ ਵੱਡਾ ਮਾਲ ਲੈਂਦੇ ਹਨ, ਉਨ੍ਹਾਂ ਉੱਤੇ ਨਿਸ਼ਾਨ ਲੱਗਦਾ ਹੈ ਅਤੇ ਉਹ ਹੇਠਾਂ ਰਹਿੰਦੇ ਹਨ।',
          'ਸਲਾਟ ਬੁੱਕ ਕਰੋ ਦਬਾ ਕੇ ਆਪਣੀ ਥਾਂ ਪੱਕੀ ਕਰੋ।',
        ],
      },
      {
        id: 'group',
        title: 'ਗਰੁੱਪ ਬੁਕਿੰਗ',
        lead: 'ਨੇੜੇ ਦੇ ਕਿਸਾਨਾਂ ਨਾਲ ਜੁੜੋ, ਤਾਂ ਜੋ ਇੱਕੋ ਟਰੱਕ ਸਾਰਿਆਂ ਦਾ ਕੰਮ ਕਰ ਦੇਵੇ।',
        points: [
          'ਨਕਸ਼ੇ ਵਿੱਚ ਪਿਕਅੱਪ ਦਾ ਰਸਤਾ ਅਤੇ ਹਰ ਕਿਸਾਨ ਦਿਸਦਾ ਹੈ।',
          'ਜਿੰਨੇ ਵੱਧ ਕਿਸਾਨ ਜੁੜਦੇ ਹਨ, ਤੁਹਾਡਾ ਭਾੜਾ ਓਨਾ ਘੱਟ ਹੁੰਦਾ ਹੈ।',
          'ਪੈਲਟ ਭਰ ਜਾਣ ਉੱਤੇ ਪੂਰੇ ਟਰੱਕ ਦਾ ਸਸਤਾ ਰੇਟ ਲੱਗ ਜਾਂਦਾ ਹੈ।',
        ],
      },
      {
        id: 'receipt',
        title: 'ਰਸੀਦ ਅਤੇ ਜਾਂਚ',
        lead: 'ਹਰ ਬੁਕਿੰਗ ਉੱਤੇ QR ਕੋਡ ਵਾਲੀ ਡਿਜਿਟਲ ਗੋਦਾਮ ਰਸੀਦ ਮਿਲਦੀ ਹੈ।',
        points: [
          'ਇਹ ਸਬੂਤ ਹੈ ਕਿ ਤੁਹਾਡਾ ਮਾਲ ਗੋਦਾਮ ਵਿੱਚ ਪਿਆ ਹੈ।',
          'ਇਸ ਉੱਤੇ ਸੁਰੱਖਿਆ ਮੋਹਰ ਹੁੰਦੀ ਹੈ, ਇਸ ਲਈ ਕੋਈ ਇਸ ਨੂੰ ਬਦਲ ਨਹੀਂ ਸਕਦਾ।',
          'ਕੋਈ ਵੀ - ਖ਼ਰੀਦਦਾਰ ਜਾਂ ਬੈਂਕ - ਜਾਂਚ ਸਕਰੀਨ ਉੱਤੇ ਇਸ ਨੂੰ ਪਰਖ ਸਕਦਾ ਹੈ।',
          'e-NWR ਨਿਯਮਾਂ ਹੇਠ ਅਜਿਹੀ ਰਸੀਦ ਉੱਤੇ ਕਰਜ਼ਾ ਲਿਆ ਜਾ ਸਕਦਾ ਹੈ।',
        ],
      },
      {
        id: 'sell',
        title: 'ਵੇਚਣਾ',
        lead: 'ਹੋਟਲ, ਦੁਕਾਨ ਅਤੇ ਪ੍ਰੋਸੈਸਰ ਨੂੰ ਸਿੱਧਾ ਵੇਚੋ, ਬਿਨਾਂ ਵਿਚੋਲੇ ਦੇ।',
        points: [
          'ਜੋ ਮਾਲ ਖ਼ਰਾਬ ਹੋਣ ਵਾਲਾ ਹੈ, ਉਹ ਸਭ ਤੋਂ ਉੱਤੇ ਦਿਸਦਾ ਹੈ, ਤਾਂ ਜੋ ਵੇਲੇ ਸਿਰ ਵਿਕ ਜਾਵੇ।',
          'ਜੋ ਭਾਅ ਤੁਹਾਨੂੰ ਦਿਸਦਾ ਹੈ, ਖ਼ਰੀਦਦਾਰ ਓਹੀ ਦਿੰਦਾ ਹੈ।',
        ],
      },
      {
        id: 'offline',
        title: 'ਬਿਨਾਂ ਨੈੱਟਵਰਕ ਕੰਮ',
        lead: 'ਜਿੱਥੇ ਨੈੱਟਵਰਕ ਨਹੀਂ ਹੈ, ਉੱਥੇ ਵੀ ਐਪ ਚੱਲਦੀ ਰਹਿੰਦੀ ਹੈ।',
        points: [
          'ਬਿਨਾਂ ਨੈੱਟਵਰਕ ਕੀਤੀ ਬੁਕਿੰਗ ਤੁਹਾਡੇ ਫ਼ੋਨ ਵਿੱਚ ਸੇਵ ਹੋ ਜਾਂਦੀ ਹੈ।',
          'ਤੁਹਾਡੀ ਬੁਕਿੰਗ ਸੂਚੀ ਵਿੱਚ ਉਸ ਉੱਤੇ "ਆਫ਼ਲਾਈਨ ਸੇਵ" ਲਿਖਿਆ ਦਿਸਦਾ ਹੈ।',
          'ਨੈੱਟਵਰਕ ਆਉਂਦੇ ਹੀ ਉਹ ਆਪਣੇ ਆਪ ਭੇਜ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।',
        ],
      },
    ],
  },
}

export const t = (lang) => STRINGS[lang] ?? STRINGS.en
