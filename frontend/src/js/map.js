// =========================
// INIT MAP
// =========================
const map = L.map("map").setView([50.1, 8.25], 12);

const osmLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "© OpenStreetMap contributors",
  },
);

const lightLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "© OpenStreetMap contributors © CARTO",
  },
);

const darkLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "© OpenStreetMap contributors © CARTO",
  },
);

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri",
  },
);
osmLayer.addTo(map);

// =========================
// GLOBALS
// =========================
let greenLayer;
let buildingsLayer;
let transportLayer;
let selectedLayer = null;
let timeout;
let searchMarker = null;
let legendContainer = null;

const layerState = {
  green: true,
  buildings: true,
  transport: true,
};

const baseUrl = "http://127.0.0.1:8000";

const baseMaps = {
  osm: osmLayer,
  light: lightLayer,
  dark: darkLayer,
  satellite: satelliteLayer,
};

let activeBaseLayer = osmLayer;
let activeBaseLayerKey = "osm";

const basemapButtons = document.querySelectorAll(".basemap-option");
const basemapToggle = document.getElementById("basemap-toggle");
const basemapOptions = document.getElementById("basemap-options");

const germanyGeocoder = L.Control.Geocoder.nominatim({
  geocodingQueryParams: { countrycodes: "de", limit: 5 },
});

const geocoder = L.Control.geocoder({
  geocoder: germanyGeocoder,
  defaultMarkGeocode: false,
  placeholder: "Search location...",
  position: "topleft",
}).addTo(map);

const legend = L.control({ position: "bottomleft" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "info legend");
  legendContainer = div;

  div.innerHTML = renderLegend();

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  return div;
};

legend.addTo(map);

// =========================
// STYLES
// =========================
function styleGreen() {
  return {
    color: "green",
    weight: 1,
    fillOpacity: 0.4,
  };
}

function styleBuildings() {
  return {
    color: "#666",
    weight: 0.5,
    fillOpacity: 0.3,
  };
}

function transportMarkerStyle() {
  return {
    radius: 4,
    color: "blue",
    fillOpacity: 0.8,
  };
}
// =========================
// INTERACTION
// =========================
// Switching Basemap
function setBaseLayer(layerKey) {
  const nextLayer = baseMaps[layerKey];

  if (!nextLayer || layerKey === activeBaseLayerKey) {
    return;
  }

  map.removeLayer(activeBaseLayer);
  nextLayer.addTo(map);

  activeBaseLayer = nextLayer;
  activeBaseLayerKey = layerKey;
}

function highlightGreen(e) {
  const layer = e.target;

  layer.setStyle({
    weight: 2,
    color: "#00FF00",
    fillOpacity: 0.7,
  });

  layer.bringToFront();

  const props = layer.feature.properties;
  const area = props.area ? (props.area / 10000).toFixed(2) : "N/A";

  const content = `
    <b>Green Area</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Type: ${props.leisure || props.landuse || "unknown"}<br/>
    Area: ${area} ha
  `;
  layer.bindPopup(content).openPopup();
}

function highlightBuilding(e) {
  const layer = e.target;

  layer.setStyle({ color: "#222", weight: 2, fillOpacity: 0.6 });

  layer.bringToFront();

  const props = layer.feature.properties;

  const content = `
    <b>Building</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Type: ${props.building || "unknown"}
  `;

  layer.bindPopup(content).openPopup();
}

function highlightTransport(e) {
  const layer = e.target;

  layer.setStyle({ radius: 6, color: "#003cff", fillOpacity: 1 });

  const props = layer.feature.properties;

  const content = `
    <b>Transport</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Highway: ${props.highway || "N/A"}
    Railway: ${props.railway || "N/A"}
  `;

  layer.bindPopup(content).openPopup();
}

function resetGreenHighlight(e) {
  if (!greenLayer) {
    return;
  }

  greenLayer.resetStyle(e.target);
  e.target.closePopup();
}

function resetBuildingHighlight(e) {
  if (!buildingsLayer) {
    return;
  }

  buildingsLayer.resetStyle(e.target);
  e.target.closePopup();
}

function resetTransportHighlight(e) {
  e.target.setStyle(transportMarkerStyle());
  e.target.closePopup();
}

function selectGreenFeature(e) {
  const layer = e.target;

  if (selectedLayer && greenLayer) {
    greenLayer.resetStyle(selectedLayer);
  }

  selectedLayer = layer;

  layer.setStyle({
    color: "red",
    weight: 3,
    fillOpacity: 0.7,
  });

  const props = layer.feature.properties;
  const area = props.area ? (props.area / 10000).toFixed(2) : "N/A";

  const content = `
    <b>Selected Area</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Type: ${props.leisure || props.landuse || "unknown"}<br/>
    Area: ${area} ha
  `;

  layer.bindPopup(content).openPopup();
}

function onEachGreenFeature(feature, layer) {
  layer.on({
    mouseover: highlightGreen,
    mouseout: resetGreenHighlight,
    click: selectGreenFeature,
  });
}
function onEachBuildingFeature(feature, layer) {
  layer.on({
    mouseover: highlightBuilding,
    mouseout: resetBuildingHighlight,
  });
}

function onEachTransportFeature(feature, layer) {
  layer.on({
    mouseover: highlightTransport,
    mouseout: resetTransportHighlight,
  });
}

// =========================
// HELPERS
// =========================
function clearGreenSelection() {
  selectedLayer = null;
}

function removeLayer(layerName) {
  if (layerName === "green" && greenLayer) {
    map.removeLayer(greenLayer);
    greenLayer = null;
    clearGreenSelection();
  }

  if (layerName === "buildings" && buildingsLayer) {
    map.removeLayer(buildingsLayer);
    buildingsLayer = null;
  }

  if (layerName === "transport" && transportLayer) {
    map.removeLayer(transportLayer);
    transportLayer = null;
  }
}

function setLoading(isLoading) {
  document.getElementById("loading").style.display = isLoading
    ? "block"
    : "none";
}

function updateGreenLayer(data) {
  removeLayer("green");

  greenLayer = L.geoJSON(data, {
    style: styleGreen,
    onEachFeature: onEachGreenFeature,
  }).addTo(map);
}

function updateBuildingsLayer(data) {
  removeLayer("buildings");

  buildingsLayer = L.geoJSON(data, {
    style: styleBuildings,
    onEachFeature: onEachBuildingFeature,
  }).addTo(map);
}

function updateTransportLayer(data) {
  removeLayer("transport");

  transportLayer = L.geoJSON(data, {
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, transportMarkerStyle()),
    onEachFeature: onEachTransportFeature,
  }).addTo(map);
}

function fetchGeoJson(url, onSuccess, layerName) {
  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!layerState[layerName]) {
        return;
      }

      onSuccess(data);
    });
}

function renderLegend() {
  const items = [];

  if (layerState.green) {
    items.push(
      `<div><span class="legend-swatch legend-green"></span> Green areas</div>`,
    );
  }

  if (layerState.buildings) {
    items.push(
      `<div><span class="legend-swatch legend-buildings"></span> Buildings</div>`,
    );
  }

  if (layerState.transport) {
    items.push(`
      <div><span class="legend-swatch legend-transport"></span> Transport</div>
    `);
  }

  return `<h4>Legend</h4>${items.join("")}`;
}

function updateLegend() {
  if (!legendContainer) {
    return;
  }

  legendContainer.innerHTML = renderLegend();
}

// =========================
// MAIN LOAD FUNCTION
// =========================
function loadData() {
  const bounds = map.getBounds();
  const minx = bounds.getWest();
  const miny = bounds.getSouth();
  const maxx = bounds.getEast();
  const maxy = bounds.getNorth();
  const zoom = map.getZoom();
  const params = `minx=${minx}&miny=${miny}&maxx=${maxx}&maxy=${maxy}`;
  const requests = [];

  setLoading(true);

  if (layerState.green) {
    requests.push(
      fetchGeoJson(
        `${baseUrl}/green?${params}&zoom=${zoom}`,
        updateGreenLayer,
        "green",
      ),
    );
  } else {
    removeLayer("green");
  }

  if (layerState.buildings && zoom >= 14) {
    requests.push(
      fetchGeoJson(
        `${baseUrl}/buildings?${params}&zoom=${zoom}`,
        updateBuildingsLayer,
        "buildings",
      ),
    );
  } else {
    removeLayer("buildings");
  }

  if (layerState.transport) {
    requests.push(
      fetchGeoJson(
        `${baseUrl}/transport?${params}`,
        updateTransportLayer,
        "transport",
      ),
    );
  } else {
    removeLayer("transport");
  }

  Promise.allSettled(requests).finally(() => {
    setLoading(false);
  });
}
basemapButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const layerKey = button.dataset.basemap;

    setBaseLayer(layerKey);

    basemapButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    basemapOptions.classList.remove("is-open");
  });
});

basemapToggle.addEventListener("click", () => {
  basemapOptions.classList.toggle("is-open");
});
// =========================
// DEBOUNCE
// =========================
function debouncedLoad() {
  clearTimeout(timeout);
  timeout = setTimeout(loadData, 100);
}

// =========================
// LAYER TOGGLES
// =========================
function bindLayerToggle(layerName, inputId) {
  const input = document.getElementById(inputId);

  input.addEventListener("change", (event) => {
    layerState[layerName] = event.target.checked;

    if (!layerState[layerName]) {
      removeLayer(layerName);
    }
    updateLegend();
    loadData();
  });
}

bindLayerToggle("green", "toggle-green");
bindLayerToggle("buildings", "toggle-buildings");
bindLayerToggle("transport", "toggle-transport");

// =========================
// EVENTS
// =========================
map.on("moveend", debouncedLoad);

geocoder.on("markgeocode", (event) => {
  const bbox = event.geocode.bbox;
  const center = event.geocode.center;
  const name = event.geocode.name;

  map.fitBounds(bbox);

  if (searchMarker) {
    map.removeLayer(searchMarker);
  }

  searchMarker = L.marker(center)
    .addTo(map)
    .bindPopup(`<b>Search Result</b><br/>${name}`)
    .openPopup();
});

// initial load
loadData();
