let datosGasolineras = [];
let ubicacionUsuario = null;

async function cargarDatos() {
  try {
    const url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
    const proxy = "https://corsproxy.io/?"; // Solo para desarrollo local
    const res = await fetch(proxy + encodeURIComponent(url));
    const data = await res.json();
    datosGasolineras = data.ListaEESSPrecio;
    llenarProvincias();
    configurarGeolocalizacion();
  } catch (err) {
    alert("Error al cargar los datos: " + err.message);
  }
}

function llenarProvincias() {
  const provincias = [...new Set(datosGasolineras.map(e => e.Provincia))].sort();
  const selectProv = document.getElementById("provincia");

  selectProv.innerHTML = `<option value="">Seleccione provincia</option>`;
  provincias.forEach(p => {
    selectProv.innerHTML += `<option value="${p}">${p}</option>`;
  });

  selectProv.addEventListener("change", llenarMunicipios);
}

function llenarMunicipios() {
  const provincia = document.getElementById("provincia").value;
  const municipios = [...new Set(
    datosGasolineras
    .filter(e => e.Provincia === provincia)
    .map(e => e.Municipio)
  )].sort();

  const selectMun = document.getElementById("municipio");
  selectMun.disabled = false;
  selectMun.innerHTML = `<option value="">Seleccione municipio</option>`;
  municipios.forEach(m => {
    selectMun.innerHTML += `<option value="${m}">${m}</option>`;
  });

  selectMun.addEventListener("change", mostrarResultados);
  document.getElementById("carburante").addEventListener("change", mostrarResultados);
}

function mostrarResultados() {
  const provincia = document.getElementById("provincia").value;
  const municipio = document.getElementById("municipio").value;
  const carburante = document.getElementById("carburante").value;

  // Filtrar por provincia y municipio si se ha seleccionado
  let resultados = datosGasolineras.filter(e => {
    const coincideProvincia = e.Provincia === provincia;
    const coincideMunicipio = municipio ? e.Municipio === municipio : true;
    return coincideProvincia && coincideMunicipio;
  });

  resultados = resultados
    .filter(g => g[carburante] && g[carburante].trim() !== "")
    .map(g => ({
    ...g,
    precio: parseFloat(g[carburante].replace(",", "."))
    }))
    .sort((a, b) => a.precio - b.precio);

  mostrarGasolineras(resultados, carburante);
}

// FUNCIONES DE GEOLOCALIZACIÓN
function configurarGeolocalizacion() {
  const botonGeo = document.getElementById("geolocalizacion");

  if (!navigator.geolocation) {
    botonGeo.disabled = true;
    botonGeo.innerHTML = '<span>❌</span><span>Geolocalización no disponible</span>';
    return;
  }

  botonGeo.addEventListener("click", obtenerUbicacion);
}

function obtenerUbicacion() {
  const botonGeo = document.getElementById("geolocalizacion");
  const geoIcon = document.getElementById("geo-icon");
  const geoText = document.getElementById("geo-text");

  // Mostrar estado de carga
  botonGeo.disabled = true;
  geoIcon.textContent = "⏳";
  geoIcon.classList.add("loading");
  geoText.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      ubicacionUsuario = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Restaurar botón
      geoIcon.textContent = "✅";
      geoIcon.classList.remove("loading");
      geoText.textContent = "Ubicación obtenida";
      botonGeo.disabled = false;

      // Mostrar gasolineras cercanas
      mostrarGasolinerasCercanas();

      // Cambiar texto del botón después de 2 segundos
      setTimeout(() => {
        geoIcon.textContent = "📍";
        geoText.textContent = "Actualizar ubicación";
      }, 2000);
    },
    (error) => {
      let mensaje = "Error desconocido";
      switch(error.code) {
        case error.PERMISSION_DENIED:
          mensaje = "Permiso denegado";
          break;
        case error.POSITION_UNAVAILABLE:
          mensaje = "Ubicación no disponible";
          break;
        case error.TIMEOUT:
          mensaje = "Tiempo agotado";
          break;
      }

      geoIcon.textContent = "❌";
      geoIcon.classList.remove("loading");
      geoText.textContent = mensaje;
      botonGeo.disabled = false;

      alert(`Error de geolocalización: ${mensaje}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutos
    }
  );
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function mostrarGasolinerasCercanas() {
  if (!ubicacionUsuario) {
    alert("Primero debe obtener su ubicación");
    return;
  }

  const carburante = document.getElementById("carburante").value;

  // Calcular distancias y filtrar gasolineras válidas
  let gasolinerasConDistancia = datosGasolineras
    .filter(g => g[carburante] && g[carburante].trim() !== "" && g.Latitud && g["Longitud (WGS84)"])
    .map(g => {
      const lat = parseFloat(g.Latitud.replace(",", "."));
      const lng = parseFloat(g["Longitud (WGS84)"].replace(",", "."));
      const distancia = calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, lat, lng);

      return {
        ...g,
        precio: parseFloat(g[carburante].replace(",", ".")),
        distancia: distancia,
        lat: lat,
        lng: lng
      };
    })
    .filter(g => g.distancia <= 25) // Máximo 25km
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 20); // Máximo 20 resultados

  if (gasolinerasConDistancia.length === 0) {
    document.getElementById("resultados").innerHTML = 
      "<p>No se encontraron gasolineras cercanas (máximo 25km) con ese carburante.</p>";
    return;
  }

  mostrarGasolineras(gasolinerasConDistancia, carburante, true);
}

function mostrarGasolineras(resultados, carburante, esCercanas = false) {
  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "";

  if (resultados.length === 0) {
    contenedor.innerHTML = "<p>No se encontraron gasolineras con ese carburante en esta zona.</p>";
    return;
  }

  resultados.forEach((g, i) => {
    let clase = "gasolinera";

    if (esCercanas) {
      // Para búsqueda por geolocalización, destacar las más cercanas
      if (i < 3) clase += " cercana";
    } else {
      // Para búsqueda normal, destacar las más baratas
      if (i < 3) clase += " destacada";
    }

    const distanciaHTML = g.distancia ? 
      `<p class="distancia"><strong>📍 Distancia:</strong> ${g.distancia.toFixed(1)} km</p>` : '';

    contenedor.innerHTML += `
    <div class="${clase}">
    <h3>${g["Rótulo"]}</h3>
    <p><strong>Dirección:</strong> ${g["Dirección"]}, ${g["Municipio"]}</p>
    <p><strong>${carburante.replace("Precio ", "")}:</strong> ${g.precio.toFixed(3)} €</p>
    ${distanciaHTML}
    <p><strong>Horario:</strong> ${g["Horario"]}</p>
    </div>
    `;
  });
}

cargarDatos();