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

const baseUrl = "https://wiesbaden-gis-live.onrender.com";

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

const infoBasemap = document.getElementById("info-basemap");
const infoZoom = document.getElementById("info-zoom");
const infoLayers = document.getElementById("info-layers");
const infoSelection = document.getElementById("info-selection");

const infoToggle = document.getElementById("info-toggle");
const infoPanelBody = document.getElementById("info-panel-body");

const germanyPhotonGeocoder = L.Control.Geocoder.photon({
  geocodingQueryParams: {
    bbox: "5.53,47.23,15.38,54.96",
    limit: 5,
    lang: "de",
  },
  // htmlTemplate: (result) => result.name,
});

const geocoder = L.Control.geocoder({
  geocoder: germanyPhotonGeocoder,
  defaultMarkGeocode: false,
  placeholder: "Search in Germany...",
  position: "topleft",
  queryMinLength: 3,
  suggestMinLength: 3,
  suggestTimeout: 300,
  showUniqueResult: false,
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
  updateInfoPanelStatus();
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
  setInfoPanelContent("Green Area", [
    { label: "ID", value: props.id || "N/A" },
    { label: "Type", value: props.leisure || props.landuse || "unknown" },
    { label: "Area", value: `${area} ha` },
  ]);
  layer.bindPopup(content).openPopup();
  updateInfoPanelSelection(content);
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
    click: selectBuildingFeature,
  });
}

function onEachTransportFeature(feature, layer) {
  layer.on({
    mouseover: highlightTransport,
    mouseout: resetTransportHighlight,
    click: selectTransportFeature,
  });
}

function updateInfoPanelStatus() {
  infoBasemap.textContent = getBasemapLabel(activeBaseLayerKey);
  infoZoom.textContent = map.getZoom();
  infoLayers.textContent = getActiveLayersLabel();
}

function updateInfoPanelSelection(content) {
  infoSelection.innerHTML = content;
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

function getBasemapLabel(layerKey) {
  const labels = {
    osm: "OpenStreetMap",
    light: "Light",
    dark: "Dark",
    satellite: "Satellite",
  };

  return labels[layerKey] || "Unknown";
}

function getActiveLayersLabel() {
  const activeLayers = [];

  if (layerState.green) {
    activeLayers.push("Green");
  }

  if (layerState.buildings) {
    activeLayers.push("Buildings");
  }

  if (layerState.transport) {
    activeLayers.push("Transport");
  }

  return activeLayers.length ? activeLayers.join(", ") : "None";
}

function setInfoPanelContent(title, rows) {
  const content = rows
    .map((row) => `<p><strong>${row.label}:</strong> ${row.value}</p>`)
    .join("");

  infoSelection.innerHTML = `
    <div class="info-selection-card">
      <h4>${title}</h4>
      ${content}
    </div>
  `;
}

function selectBuildingFeature(e) {
  const layer = e.target;
  const props = layer.feature.properties;
  const content = `
    <b>Building</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Type: ${props.building || "unknown"}
  `;
  layer.bindPopup(content).openPopup();

  setInfoPanelContent("Building", [
    { label: "ID", value: props.id || "N/A" },
    { label: "Type", value: props.building || "unknown" },
  ]);
}

function selectTransportFeature(e) {
  const layer = e.target;
  const props = layer.feature.properties;

  const content = `
    <b>Transport</b><br/>
    ID: ${props.id || "N/A"}<br/>
    Highway: ${props.highway || "N/A"}<br/>
    Railway: ${props.railway || "N/A"}<br/>
    Public transport: ${props.public_transport || "N/A"}
  `;
  layer.bindPopup(content).openPopup();

  setInfoPanelContent("Transport", [
    { label: "ID", value: props.id || "N/A" },
    { label: "Highway", value: props.highway || "N/A" },
    { label: "Railway", value: props.railway || "N/A" },
    { label: "Public transport", value: props.public_transport || "N/A" },
  ]);
}

function resetInfoPanelSelection() {
  infoSelection.innerHTML = "Click a map feature to see details.";
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
  timeout = setTimeout(() => {
    updateInfoPanelStatus();
    loadData();
  }, 100);
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
      resetInfoPanelSelection();
    }
    updateLegend();
    updateInfoPanelStatus();
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

infoToggle.addEventListener("click", () => {
  infoPanelBody.classList.toggle("is-collapsed");

  infoToggle.textContent = infoPanelBody.classList.contains("is-collapsed")
    ? "+"
    : "-";
});

// initial load
loadData();
updateInfoPanelStatus();
