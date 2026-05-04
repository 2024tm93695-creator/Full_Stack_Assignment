const TrafficData = require('../models/TrafficData');

const ROADS = [
  { roadName: 'HITEC City Main Road',      area: 'HITEC City',    coords: [78.3733, 17.4435], normalSpeed: 50 },
  { roadName: 'Gachibowli Flyover',         area: 'Gachibowli',    coords: [78.3499, 17.4404], normalSpeed: 60 },
  { roadName: 'Banjara Hills Road 12',      area: 'Banjara Hills', coords: [78.4479, 17.4191], normalSpeed: 40 },
  { roadName: 'Jubilee Hills Road 36',      area: 'Jubilee Hills', coords: [78.4083, 17.4313], normalSpeed: 45 },
  { roadName: 'Madhapur Cross Road',        area: 'Madhapur',      coords: [78.3922, 17.4482], normalSpeed: 50 },
  { roadName: 'Kondapur Main Road',         area: 'Kondapur',      coords: [78.3548, 17.4617], normalSpeed: 55 },
  { roadName: 'Kukatpally Bypass',          area: 'Kukatpally',    coords: [78.3980, 17.4849], normalSpeed: 65 },
  { roadName: 'Ameerpet Junction',          area: 'Ameerpet',      coords: [78.4487, 17.4355], normalSpeed: 30 },
  { roadName: 'Secunderabad Ring Road',     area: 'Secunderabad',  coords: [78.4980, 17.4380], normalSpeed: 55 },
  { roadName: 'Begumpet Airport Road',      area: 'Begumpet',      coords: [78.4694, 17.4444], normalSpeed: 60 },
  { roadName: 'Outer Ring Road West',       area: 'ORR West',      coords: [78.3200, 17.4600], normalSpeed: 80 },
  { roadName: 'NH-65 Hyderabad Bypass',     area: 'NH65',          coords: [78.5100, 17.3900], normalSpeed: 80 }
];

const level = (score) => {
  if (score < 25) return 'free';
  if (score < 50) return 'moderate';
  if (score < 75) return 'heavy';
  return 'severe';
};

const randomIncident = (score) => {
  if (score < 55) return 'none';
  const pool = ['accident', 'roadwork', 'event', 'breakdown', 'none', 'none', 'none'];
  return pool[Math.floor(Math.random() * pool.length)];
};

// Persistent state so scores drift gradually
const state = ROADS.map(() => 20 + Math.random() * 30);

const runSimulation = async (io) => {
  const h = new Date().getHours();
  const isPeak   = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
  const isOffPeak = h >= 1 && h <= 5;
  const baseLift  = isPeak ? 35 : isOffPeak ? -15 : 0;

  const inserts = [];

  for (let i = 0; i < ROADS.length; i++) {
    const road  = ROADS[i];
    const drift = (Math.random() - 0.45) * 8;
    state[i]    = Math.max(5, Math.min(90, state[i] + drift));
    const score = Math.round(Math.max(5, Math.min(95, state[i] + baseLift + (Math.random() * 6 - 3))));
    const incident = randomIncident(score);
    const speed    = Math.max(5, Math.round(road.normalSpeed * (1 - score / 130)));

    const doc = {
      roadName:   road.roadName,
      area:       road.area,
      location:   { type: 'Point', coordinates: road.coords },
      congestionLevel:     level(score),
      congestionScore:     score,
      averageSpeed:        speed,
      normalSpeed:         road.normalSpeed,
      vehicleCount:        Math.floor(score * 8 + Math.random() * 40),
      incidentType:        incident,
      incidentDescription: incident !== 'none' ? `${incident} reported on ${road.roadName}` : '',
      etaDelay:            Math.round(score / 10),
      timestamp:           new Date()
    };

    inserts.push(TrafficData.create(doc));
    io.emit('traffic:update', doc);

    // Emit congestion alert if severe
    if (score >= 75) {
      io.emit('traffic:alert', {
        area: road.area,
        message: `Heavy congestion on ${road.roadName}. Consider alternate routes.`,
        score
      });
    }
  }

  await Promise.allSettled(inserts);

  // Prune data older than 24 h
  const cutoff = new Date(Date.now() - 86400000);
  await TrafficData.deleteMany({ timestamp: { $lt: cutoff } });
};

const startIoTSimulation = (io) => {
  console.log('🤖 IoT Traffic Simulation started (interval: 15s)');
  runSimulation(io);
  setInterval(() => runSimulation(io), 15000);
};

module.exports = { startIoTSimulation };
