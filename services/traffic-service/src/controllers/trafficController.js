const TrafficData = require('../models/TrafficData');

const getAllTraffic = async (req, res) => {
  try {
    const { area, congestion } = req.query;
    const match = {};
    if (area)       match.area = new RegExp(area, 'i');
    if (congestion) match.congestionLevel = congestion;

    const traffic = await TrafficData.aggregate([
      { $match: match },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$roadName', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } }
    ]);
    res.json(traffic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getNearbyTraffic = async (req, res) => {
  try {
    const { lat, lng, radius = 4000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const traffic = await TrafficData.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: Number(radius)
        }
      }
    }).sort({ timestamp: -1 }).limit(20);
    res.json(traffic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Haversine ETA estimate
const getETA = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ error: 'All 4 coordinates required' });
    }
    const R    = 6371;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLon = ((toLng - fromLng) * Math.PI) / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
      Math.cos((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const midLat = (parseFloat(fromLat) + parseFloat(toLat)) / 2;
    const midLng = (parseFloat(fromLng) + parseFloat(toLng)) / 2;
    const nearby = await TrafficData.find({
      location: {
        $near: { $geometry: { type: 'Point', coordinates: [midLng, midLat] }, $maxDistance: 6000 }
      }
    }).limit(6);

    const avgScore = nearby.length
      ? nearby.reduce((s, t) => s + t.congestionScore, 0) / nearby.length
      : 20;

    const speed     = Math.max(10, 40 * (1 - avgScore / 140));
    const etaMin    = Math.ceil((dist / speed) * 60);
    const delayMin  = Math.round(avgScore / 8);

    res.json({
      distance: dist.toFixed(2),
      etaMinutes: etaMin,
      delayMinutes: delayMin,
      congestionScore: Math.round(avgScore),
      trafficLevel: avgScore < 25 ? 'free' : avgScore < 50 ? 'moderate' : avgScore < 75 ? 'heavy' : 'severe'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getHeatmap = async (req, res) => {
  try {
    const data = await TrafficData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$roadName', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $project: { location: 1, congestionScore: 1, area: 1, roadName: 1 } }
    ]);
    const heatmap = data.map(d => ({
      lat:       d.location.coordinates[1],
      lng:       d.location.coordinates[0],
      intensity: d.congestionScore / 100,
      area:      d.area,
      road:      d.roadName
    }));
    res.json(heatmap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await TrafficData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$roadName', doc: { $first: '$$ROOT' } } },
      { $group: { _id: '$doc.congestionLevel', count: { $sum: 1 } } }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllTraffic, getNearbyTraffic, getETA, getHeatmap, getStats };
