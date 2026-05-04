require('dotenv').config({ path: '../../../.env' });
const mongoose = require('mongoose');
const ParkingSlot = require('../models/ParkingSlot');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_traffic_parking';

const slots = [
  {
    name: 'HITEC City Smart Park', slotCode: 'HTC-001',
    location: { type: 'Point', coordinates: [78.3733, 17.4435] },
    address: 'Cyber Towers, HITEC City, Hyderabad', area: 'HITEC City',
    vehicleTypes: ['car', 'bike'], totalSlots: 120, availableSlots: 45,
    pricePerHour: 40, status: 'available',
    facilities: ['CCTV', 'Covered', 'EV Charging', '24/7 Security', 'Lift'],
    rating: 4.5
  },
  {
    name: 'Gachibowli IT Hub Parking', slotCode: 'GCB-001',
    location: { type: 'Point', coordinates: [78.3499, 17.4404] },
    address: 'Near ISB Road, Gachibowli', area: 'Gachibowli',
    vehicleTypes: ['car', 'bike', 'truck'], totalSlots: 200, availableSlots: 0,
    pricePerHour: 30, status: 'occupied',
    facilities: ['CCTV', 'Open Air', 'Guard'], rating: 3.8
  },
  {
    name: 'Banjara Hills Multi-Level', slotCode: 'BJH-001',
    location: { type: 'Point', coordinates: [78.4479, 17.4191] },
    address: 'Road No. 12, Banjara Hills', area: 'Banjara Hills',
    vehicleTypes: ['car', 'bike'], totalSlots: 80, availableSlots: 12,
    pricePerHour: 60, status: 'reserved',
    facilities: ['CCTV', 'Covered', 'Valet', 'Car Wash', 'EV Charging'],
    rating: 4.7
  },
  {
    name: 'Jubilee Hills Park & Go', slotCode: 'JBH-001',
    location: { type: 'Point', coordinates: [78.4083, 17.4313] },
    address: 'Road No. 36, Jubilee Hills', area: 'Jubilee Hills',
    vehicleTypes: ['car', 'bike'], totalSlots: 60, availableSlots: 35,
    pricePerHour: 50, status: 'available',
    facilities: ['CCTV', 'Semi-Covered'], rating: 4.2
  },
  {
    name: 'Madhapur Cyber Pearl', slotCode: 'MDP-001',
    location: { type: 'Point', coordinates: [78.3922, 17.4482] },
    address: 'Cyber Pearl, Madhapur', area: 'Madhapur',
    vehicleTypes: ['car', 'bike'], totalSlots: 150, availableSlots: 80,
    pricePerHour: 35, status: 'available',
    facilities: ['CCTV', 'Covered', 'EV Charging', 'Cafeteria'], rating: 4.3
  },
  {
    name: 'Kondapur Community Park', slotCode: 'KDP-001',
    location: { type: 'Point', coordinates: [78.3548, 17.4617] },
    address: 'Kondapur Main Road, Near Botanical Garden', area: 'Kondapur',
    vehicleTypes: ['car', 'bike', 'truck'], totalSlots: 100, availableSlots: 55,
    pricePerHour: 25, status: 'available',
    facilities: ['Guard', 'Open Air', 'CCTV'], rating: 3.9
  },
  {
    name: 'Kukatpally Metro Park', slotCode: 'KKP-001',
    location: { type: 'Point', coordinates: [78.3980, 17.4849] },
    address: 'Near KPHB Metro Station, Kukatpally', area: 'Kukatpally',
    vehicleTypes: ['car', 'bike'], totalSlots: 90, availableSlots: 70,
    pricePerHour: 20, status: 'available',
    facilities: ['Covered', 'CCTV', 'Metro Access'],
    operatingHours: { open: '05:00', close: '23:00' }, rating: 4.1
  },
  {
    name: 'Ameerpet Central Parking', slotCode: 'AMP-001',
    location: { type: 'Point', coordinates: [78.4487, 17.4355] },
    address: 'Ameerpet Cross Roads, Hyderabad', area: 'Ameerpet',
    vehicleTypes: ['car', 'bike'], totalSlots: 70, availableSlots: 8,
    pricePerHour: 30, status: 'reserved',
    facilities: ['CCTV', 'Open Air'], rating: 3.6
  },
  {
    name: 'Secunderabad Station Parking', slotCode: 'SCB-001',
    location: { type: 'Point', coordinates: [78.4980, 17.4380] },
    address: 'Near Secunderabad Railway Station', area: 'Secunderabad',
    vehicleTypes: ['car', 'bike', 'truck'], totalSlots: 300, availableSlots: 150,
    pricePerHour: 15, status: 'available',
    facilities: ['Guard', 'Open Air', 'Restrooms'],
    operatingHours: { is24Hours: true }, rating: 3.5
  },
  {
    name: 'Begumpet Airport Road Park', slotCode: 'BGP-001',
    location: { type: 'Point', coordinates: [78.4694, 17.4444] },
    address: 'Airport Road, Begumpet', area: 'Begumpet',
    vehicleTypes: ['car', 'truck'], totalSlots: 50, availableSlots: 30,
    pricePerHour: 80, status: 'available',
    facilities: ['CCTV', 'Covered', 'Valet', '24/7 Security', 'EV Charging', 'Lounge'],
    operatingHours: { is24Hours: true }, rating: 4.8
  }
];

async function seed() {
  try {
    await mongoose.connect(URI);
    await ParkingSlot.deleteMany({});
    const created = await ParkingSlot.insertMany(slots);
    console.log(`✅ Seeded ${created.length} parking slots`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
