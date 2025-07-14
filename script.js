// 1) Initialize map
const map = L.map('map').setView([40.7357, -74.1724], 15);

// 2) Base layers
const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const osmGray = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OSM & CartoDB'
});

// 3) Containers
let produceHeat, fastFoodHeat, produceCluster, fastFoodCluster;

// 4) Load local produce.geojson
fetch('produce.geojson')
  .then(r => r.json())
  .then(data => {
    // heatmap data
    const pHeat = data.features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
    produceHeat = L.heatLayer(pHeat, { radius: 25, gradient: {0.4: 'blue', 1: 'cyan'} }).addTo(map);

    // clusters
    produceCluster = L.markerClusterGroup({ chunkedLoading: true });
    data.features.forEach(f => {
      const [lon, lat] = f.geometry.coordinates;
      const m = L.circleMarker([lat, lon], { radius: 6, color: 'blue' })
        .bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.address}
                    <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                       target="_blank">Directions</a>`);
      produceCluster.addLayer(m);
    });
    // toggle between produceHeat.addTo(map) or produceCluster.addTo(map)
  });

// 5) Fetch fast food from Overpass
const overpassQ = `
  [out:json][timeout:25];
  area[name="Newark"]->.a;
  node["amenity"="fast_food"](area.a);
  out center;
`;
fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: overpassQ
})
  .then(r => r.json())
  .then(osm => {
    const ffHeatData = [];
    fastFoodCluster = L.markerClusterGroup({ chunkedLoading: true });
    osm.elements.forEach(el => {
      const lat = el.lat || el.center.lat;
      const lon = el.lon || el.center.lon;
      ffHeatData.push([lat, lon, 0.5]);
      const name = el.tags.name || 'Fast Food';
      const addr = [el.tags['addr:street'], el.tags['addr:housenumber'], el.tags['addr:city']]
        .filter(Boolean).join(' ');
      const m = L.circleMarker([lat, lon], { radius: 6, color: 'red' })
        .bindPopup(`<strong>${name}</strong><br>${addr}
                    <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                       target="_blank">Directions</a>`);
      fastFoodCluster.addLayer(m);
    });
    fastFoodHeat = L.heatLayer(ffHeatData, { radius: 25, gradient: {0.4:'red',1:'orange'} }).addTo(map);
  });

// 6) Distance filter
document.getElementById('filterBtn').onclick = () => {
  const addr = document.getElementById('address').value;
  const km   = parseFloat(document.getElementById('radius').value);
  if (!addr) return alert('Enter an address.');
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`)
    .then(r => r.json())
    .then(res => {
      if (!res.length) return alert('Address not found.');
      const { lat, lon } = res[0];
      const center = L.latLng(lat, lon);
      map.setView(center, 14);
      L.circle(center, { radius: km*1000, color: '#333', dashArray: '4' }).addTo(map);
      [produceCluster, fastFoodCluster].forEach(cl => {
        cl.clearLayers();
        cl.eachLayer(m => {
          if (center.distanceTo(m.getLatLng()) <= km*1000) {
            cl.addLayer(m);
          }
        });
      });
    });
};

// 7) Accessibility toggle
document.getElementById('accessToggle').onchange = e => {
  if (e.target.checked) {
    map.removeLayer(osmStandard);
    osmGray.addTo(map);
    produceHeat.setOptions({ gradient: {0.4:'#00429d',1:'#73a2c6'} });
    fastFoodHeat.setOptions({ gradient: {0.4:'#b10026',1:'#f4a582'} });
  } else {
    map.removeLayer(osmGray);
    osmStandard.addTo(map);
    produceHeat.setOptions({ gradient: {0.4:'blue',1:'cyan'} });
    fastFoodHeat.setOptions({ gradient: {0.4:'red',1:'orange'} });
  }
};
