// =========================
// INIT MAP
// =========================
const map = L.map("map").setView([50.1, 8.25], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

// =========================
// GLOBALS
// =========================
let greenLayer;
let buildingsLayer;
let transportLayer;
let selectedLayer = null;
let timeout;

const layerState = {
  green: true,
  buildings: true,
  transport: true,
};

const baseUrl = "http://127.0.0.1:8000";

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

// initial load
loadData();
