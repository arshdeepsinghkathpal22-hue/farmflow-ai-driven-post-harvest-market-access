// Seed data for the FarmFlow prototype.
// Everything here is representative dummy data modelled on Agmarknet / e-NAM
// style mandi feeds and a Rampur (UP) pilot cluster. No backend is required.

export const FARMER = {
  id: 'FRM-1042',
  name: 'Rajesh Kumar',
  nameHi: 'राजेश कुमार',
  village: 'Rampur',
  villageHi: 'रामपुर',
  district: 'Rampur, Uttar Pradesh',
  phone: '+91 98••• ••210',
  landAcres: 1.8,
  category: 'Small & Marginal',
}

export const CROPS = [
  {
    id: 'tomato',
    name: 'Tomato',
    plural: 'Tomatoes',
    nameHi: 'टमाटर',
    emoji: '🍅',
    shelfLifeDays: 9,
    idealTemp: [2, 4],
    tint: 'from-red-100 to-orange-100',
  },
  {
    id: 'potato',
    name: 'Potato',
    plural: 'Potatoes',
    nameHi: 'आलू',
    emoji: '🥔',
    shelfLifeDays: 21,
    idealTemp: [2, 4],
    tint: 'from-amber-100 to-yellow-100',
  },
  {
    id: 'onion',
    name: 'Onion',
    plural: 'Onions',
    nameHi: 'प्याज़',
    emoji: '🧅',
    shelfLifeDays: 30,
    idealTemp: [0, 2],
    tint: 'from-purple-100 to-pink-100',
  },
  {
    id: 'capsicum',
    name: 'Capsicum',
    plural: 'Capsicum',
    nameHi: 'शिमला मिर्च',
    emoji: '🫑',
    shelfLifeDays: 12,
    // Capsicum is chilling-sensitive: below about 7 degrees it pits, softens
    // and loses colour. It is the one crop here that a colder facility is
    // actively worse for, which is why storage matching scores it differently.
    idealTemp: [7, 10],
    tint: 'from-emerald-100 to-green-100',
  },
  {
    id: 'cauliflower',
    name: 'Cauliflower',
    plural: 'Cauliflower',
    nameHi: 'फूलगोभी',
    emoji: '🥬',
    shelfLifeDays: 7,
    idealTemp: [0, 2],
    tint: 'from-lime-100 to-green-100',
  },
]

// 7-day mandi price forecast per crop (₹/kg). Index 0 = today.
export const PRICE_SERIES = {
  tomato: [12.0, 12.4, 12.9, 13.3, 13.6, 14.0, 14.2],
  potato: [21.5, 21.8, 22.0, 22.1, 22.0, 21.9, 21.6],
  onion: [27.0, 27.6, 28.5, 29.4, 30.2, 31.0, 31.8],
  cauliflower: [18.0, 17.6, 17.1, 16.8, 16.5, 16.2, 15.9],
  capsicum: [44.0, 45.2, 46.1, 47.4, 48.2, 49.0, 49.6],
}

export const CURRENT_LOT = {
  batchId: '#TM-892',
  cropId: 'tomato',
  quantityKg: 450,
  quality: 'High Quality',
  harvestedDaysAgo: 1,
}

export const STORAGES = [
  {
    id: 'ST-01',
    name: 'Kisan Cold Storage',
    nameHi: 'किसान कोल्ड स्टोरेज',
    distanceKm: 2.4,
    tempRange: [2, 4],
    tempLabel: 'Optimal Temp',
    // Indian cold storage bills roughly ₹1.5-2.5 per kg per month; the
    // per-day rates below sit in that band.
    pricePerKgDay: 0.06,
    microSlots: true,
    slotsFree: 46,
    capacityMt: 5000,
    verified: true,
    gradient: 'from-emerald-200 via-teal-100 to-sky-200',
  },
  {
    id: 'ST-02',
    name: 'Rampur Agro Hub',
    nameHi: 'रामपुर एग्रो हब',
    distanceKm: 4.1,
    tempRange: [2, 5],
    tempLabel: 'Standard Temp',
    pricePerKgDay: 0.05,
    microSlots: false,
    slotsFree: 0,
    capacityMt: 8000,
    verified: true,
    gradient: 'from-amber-200 via-orange-100 to-yellow-200',
  },
  {
    id: 'ST-03',
    name: 'Green Valley Storage',
    nameHi: 'ग्रीन वैली स्टोरेज',
    distanceKm: 6.8,
    tempRange: [-2, 0],
    tempLabel: 'Sub-zero Temp',
    pricePerKgDay: 0.09,
    microSlots: true,
    slotsFree: 18,
    capacityMt: 3200,
    verified: true,
    gradient: 'from-sky-200 via-blue-100 to-indigo-200',
  },
  {
    id: 'ST-04',
    name: 'Sharma Cold Storage',
    nameHi: 'शर्मा कोल्ड स्टोरेज',
    distanceKm: 3.2,
    tempRange: [2, 4],
    tempLabel: 'Optimal Temp',
    pricePerKgDay: 0.07,
    microSlots: true,
    slotsFree: 32,
    capacityMt: 4500,
    verified: true,
    gradient: 'from-green-200 via-emerald-100 to-lime-200',
  },
]

// A pool that is currently forming in the farmer's cluster.
// `members` holds the neighbours who have already committed; the farmer's own
// lot is added only once they join, which is what frees up the 120 kg gap.
export const GROUP_POOL = {
  id: 'PL-8902',
  palletCapacityKg: 450,
  yourLotKg: 120,
  pickupLabel: 'Tomorrow, 9:00 AM',
  // One multi-stop truck run for the whole pool.
  transportCostTotal: 850,
  // Minimum vehicle hire for a single 120 kg lot - the charge that makes
  // transporting a small quantity uneconomic today.
  soloTransportCost: 600,
  storageId: 'ST-01',
  members: [
    { id: 'm1', name: 'Harpreet', village: 'Green Acres Farm', qtyKg: 50 },
    { id: 'm2', name: 'Anil', village: 'Sonalika Agro', qtyKg: 80 },
    { id: 'm3', name: 'Sunita', village: 'Anand Orchards', qtyKg: 200 },
  ],
}

export const MARKETPLACE_LOTS = [
  {
    id: 'LOT-501',
    cropId: 'onion',
    name: 'Premium Onions',
    nameHi: 'प्याज़',
    qtyKg: 500,
    storage: 'Nashik Cold Storage',
    pricePerKg: 28,
    originalPrice: 35,
    freshnessDays: 1,
    priority: true,
    farmer: 'Sunita Devi',
    category: 'Vegetables',
  },
  {
    id: 'LOT-502',
    cropId: 'tomato',
    name: 'Fresh Tomatoes',
    nameHi: 'टमाटर',
    qtyKg: 200,
    storage: 'Kisan Cold Storage',
    pricePerKg: 32,
    originalPrice: 40,
    freshnessDays: 2,
    priority: true,
    farmer: 'Rajesh Kumar',
    category: 'Vegetables',
  },
  {
    id: 'LOT-503',
    cropId: 'potato',
    name: 'Potatoes',
    nameHi: 'आलू',
    qtyKg: 1000,
    storage: 'Agra Cold Storage',
    pricePerKg: 22,
    originalPrice: null,
    freshnessDays: 4,
    priority: false,
    farmer: 'Harpreet Singh',
    category: 'Vegetables',
  },
  {
    id: 'LOT-504',
    cropId: 'cauliflower',
    name: 'Cauliflower',
    nameHi: 'फूलगोभी',
    qtyKg: 320,
    storage: 'Green Valley Storage',
    pricePerKg: 18,
    originalPrice: null,
    freshnessDays: 6,
    priority: false,
    farmer: 'Anil Yadav',
    category: 'Vegetables',
  },
]

export const BUYER_CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Grains']

// Cold storage owner facing data.
export const OWNER = {
  facility: 'Kisan Cold Storage',
  ownerName: 'Vikram Sharma',
  occupancyPct: 82,
  occupancyDelta: 5,
  avgTempC: 3.2,
  optimalRange: [2, 4],
  revenueMonth: 120000,
  revenueExpected: 150000,
  chamberSlots: 84,
  chamberFilled: 69,
  alerts: [
    {
      id: 'a1',
      icon: 'truck',
      title: 'Pooled booking arrival',
      detail: 'Tomorrow 9:00 AM • 450 kg',
    },
    {
      id: 'a2',
      icon: 'money',
      title: 'Payment received',
      detail: 'From 3 farmers • Today 2:30 PM',
    },
    {
      id: 'a3',
      icon: 'temp',
      title: 'Chamber B temp check',
      detail: 'Stable at 3.5°C',
    },
  ],
  incoming: [
    {
      id: 'PL-8902',
      farmers: 'Harpreet, Anil & 2 others',
      initials: ['H', 'A', '+2'],
      volumeKg: 450,
      pooled: true,
      arrival: 'Tomorrow, 9:00 AM',
      status: 'Confirmed',
    },
    {
      id: 'SG-4412',
      farmers: 'Suresh Patel',
      initials: ['S'],
      volumeKg: 120,
      pooled: false,
      arrival: 'Today, 4:00 PM',
      status: 'Arriving Soon',
    },
    {
      id: 'PL-8871',
      farmers: 'Harpreet, Sunita & 3 others',
      initials: ['H', 'S', '+3'],
      volumeKg: 610,
      pooled: true,
      arrival: 'Thu, 11:00 AM',
      status: 'Pending',
    },
  ],
}

// Lots physically sitting in the facility right now (Inventory section).
export const OWNER_INVENTORY = [
  { id: 'LOT-2201', cropId: 'tomato', farmer: 'Harpreet Singh', qtyKg: 350, chamber: 'A', daysStored: 2, pooled: true },
  { id: 'LOT-2202', cropId: 'potato', farmer: 'Suresh Patel', qtyKg: 600, chamber: 'B', daysStored: 6, pooled: false },
  { id: 'LOT-2203', cropId: 'onion', farmer: 'Sunita Devi', qtyKg: 480, chamber: 'B', daysStored: 11, pooled: true },
  { id: 'LOT-2204', cropId: 'cauliflower', farmer: 'Anil Yadav', qtyKg: 220, chamber: 'A', daysStored: 4, pooled: true },
  { id: 'LOT-2205', cropId: 'tomato', farmer: 'Rajesh Kumar', qtyKg: 275, chamber: 'A', daysStored: 7, pooled: true },
  { id: 'LOT-2206', cropId: 'potato', farmer: 'Meena Kumari', qtyKg: 400, chamber: 'B', daysStored: 1, pooled: false },
]

// Settlement ledger for the Payments section.
export const OWNER_PAYMENTS = {
  receivedMonth: 120000,
  pendingSettlement: 34600,
  nextSettlementOn: 'Friday',
  platformFeePct: 8,
  ledger: [
    { id: 'PL-8902', date: '06 Aug', from: 'Harpreet, Anil & 2 others', amount: 16200, status: 'Settled', pooled: true },
    { id: 'SG-4412', date: '05 Aug', from: 'Suresh Patel', amount: 4320, status: 'Settled', pooled: false },
    { id: 'PL-8871', date: '04 Aug', from: 'Harpreet, Sunita & 3 others', amount: 21960, status: 'Processing', pooled: true },
    { id: 'SG-4390', date: '02 Aug', from: 'Meena Kumari', amount: 2400, status: 'Pending', pooled: false },
    { id: 'PL-8844', date: '01 Aug', from: 'Rajesh, Anil & 1 other', amount: 12700, status: 'Settled', pooled: true },
  ],
}

// Trend data for the Analytics section.
export const OWNER_ANALYTICS = {
  months: [
    { month: 'Mar', occupancyPct: 54, revenue: 62000, pooledPct: 18 },
    { month: 'Apr', occupancyPct: 61, revenue: 74000, pooledPct: 27 },
    { month: 'May', occupancyPct: 66, revenue: 83000, pooledPct: 38 },
    { month: 'Jun', occupancyPct: 71, revenue: 96000, pooledPct: 49 },
    { month: 'Jul', occupancyPct: 77, revenue: 108000, pooledPct: 58 },
    { month: 'Aug', occupancyPct: 82, revenue: 120000, pooledPct: 64 },
  ],
  cropMix: [
    { cropId: 'potato', sharePct: 38 },
    { cropId: 'onion', sharePct: 27 },
    { cropId: 'tomato', sharePct: 24 },
    { cropId: 'cauliflower', sharePct: 11 },
  ],
  avgLotKgBefore: 940,
  avgLotKgNow: 210,
}

export const OWNER_STAFF = [
  { id: 'S1', name: 'Ramesh Yadav', role: 'Facility Manager', shift: 'General · 9 AM - 6 PM', phone: '+91 98••• ••114', onDuty: true },
  { id: 'S2', name: 'Kavita Sharma', role: 'Gate & Weighbridge', shift: 'Morning · 6 AM - 2 PM', phone: '+91 98••• ••227', onDuty: true },
  { id: 'S3', name: 'Imran Khan', role: 'Chamber Technician', shift: 'Night · 10 PM - 6 AM', phone: '+91 98••• ••356', onDuty: false },
  { id: 'S4', name: 'Deepak Verma', role: 'Loading Supervisor', shift: 'Afternoon · 2 PM - 10 PM', phone: '+91 98••• ••481', onDuty: true },
]

export const OWNER_SETTINGS = {
  facility: 'Kisan Cold Storage',
  address: 'Plot 14, Mandi Road, Rampur, Uttar Pradesh 244901',
  licenceNo: 'UP/CS/2019/4471',
  // 100 tonnes: a small-town facility, not a mega cold store. At 82% full and
  // Rs 0.06/kg/day this lines up with the ~Rs 1.5L monthly revenue shown above.
  capacityMt: 100,
  slotSizeKg: 25,
  // Fill rates the simulator projects from: bulk demand alone leaves a fifth of
  // the building empty, while micro-slots fill almost completely because the
  // demand for them is currently unmet.
  bulkFillRate: 0.81,
  microFillRate: 0.97,
  avgMicroLotKg: 210,
  minBookingKg: 50,
  chambers: [
    { id: 'A', tempRange: [2, 4], slots: 84, filled: 69, crops: 'Tomato, Cauliflower' },
    { id: 'B', tempRange: [2, 5], slots: 96, filled: 74, crops: 'Potato, Onion' },
  ],
  pricePerKgDay: 0.06,
  toggles: [
    { id: 'micro', label: 'Accept micro-slot bookings', hi: 'माइक्रो-स्लॉट स्वीकारें', on: true, note: 'Lots from 50 kg. Turning this off returns you to bulk-only.' },
    { id: 'pool', label: 'Auto-accept pooled consignments', hi: 'पूल्ड बुकिंग अपने-आप लें', on: true, note: 'Pallet-level arrivals are confirmed without manual review.' },
    { id: 'alerts', label: 'Temperature alerts on WhatsApp', hi: 'तापमान अलर्ट', on: true, note: 'Sent when a chamber drifts outside its band.' },
    { id: 'settle', label: 'Weekly auto-settlement', hi: 'साप्ताहिक निपटान', on: false, note: 'Payouts are released every Friday instead of on request.' },
  ],
}

// Aggregate pilot-cluster impact, used by the carbon dashboard.
export const IMPACT = {
  foodSavedKg: 12400,
  co2AvoidedTonnes: 8.2,
  extraIncome: 460000,
  farmersOnboarded: 148,
  monthly: [
    { month: 'Apr', savedKg: 820 },
    { month: 'May', savedKg: 1240 },
    { month: 'Jun', savedKg: 1680 },
    { month: 'Jul', savedKg: 2100 },
    { month: 'Aug', savedKg: 2650 },
    { month: 'Sep', savedKg: 3910 },
  ],
}

// Phrases the voice-booking demo cycles through.
export const VOICE_SAMPLES = [
  {
    heard: 'Kal 3 crate tamatar pickup...',
    heardHi: 'कल 3 क्रेट टमाटर पिकअप...',
    cropId: 'tomato',
    crates: 3,
    kgPerCrate: 25,
    pickup: 'Tomorrow',
    pickupHi: 'कल',
  },
  {
    heard: 'Parso 8 bori aloo store karna hai...',
    heardHi: 'परसों 8 बोरी आलू स्टोर करना है...',
    cropId: 'potato',
    crates: 8,
    kgPerCrate: 50,
    pickup: 'Day after tomorrow',
    pickupHi: 'परसों',
  },
  {
    heard: 'Aaj shaam 5 crate pyaaz bhejna hai...',
    heardHi: 'आज शाम 5 क्रेट प्याज़ भेजना है...',
    cropId: 'onion',
    crates: 5,
    kgPerCrate: 30,
    pickup: 'Today evening',
    pickupHi: 'आज शाम',
  },
]

export const getCrop = (id) => CROPS.find((c) => c.id === id) ?? CROPS[0]
export const getStorage = (id) => STORAGES.find((s) => s.id === id) ?? STORAGES[0]
