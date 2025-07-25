let datosGasolineras = [];
let ubicacionUsuario = null;

async function cargarDatos() {
  const selectProv = document.getElementById("provincia");
  selectProv.innerHTML = '<option value="">⏳ Cargando datos...</option>';

  try {
    const datos = await intentarCargarDatos();
    datosGasolineras = datos.ListaEESSPrecio;

    if (!datosGasolineras || datosGasolineras.length === 0) {
      throw new Error("No se recibieron datos válidos");
    }

    console.log(`✅ Cargadas ${datosGasolineras.length} gasolineras`);
    llenarProvincias();
    configurarGeolocalizacion();

  } catch (err) {
    console.error("❌ Error cargando datos:", err);
    selectProv.innerHTML = '<option value="">❌ Error al cargar datos</option>';

    const contenedor = document.getElementById("resultados");
    contenedor.innerHTML = `
      <div style="background: #ffebee; padding: 20px; border-radius: 8px; color: #c62828;">
        <h3>❌ Error de conexión</h3>
        <p><strong>Problema:</strong> ${err.message}</p>
        <p><strong>Posibles soluciones:</strong></p>
        <ul>
          <li>Verifica tu conexión a internet</li>
          <li>Recarga la página</li>
          <li>Prueba con otro navegador</li>
          <li>Desactiva el modo de ahorro de datos</li>
        </ul>
        <button onclick="location.reload()" style="background: #1976d2; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 10px;">
          🔄 Recargar página
        </button>
      </div>
    `;
  }
}

async function intentarCargarDatos() {
  const url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";

  const proxies = [
    "https://corsproxy.io/?",
    "https://cors-anywhere.herokuapp.com/",
    "https://api.allorigins.win/raw?url=",
    ""
  ];

  for (let i = 0; i < proxies.length; i++) {
    try {
      console.log(`🔄 Intentando método ${i + 1}/${proxies.length}...`);

      const proxyUrl = proxies[i] + (proxies[i] ? encodeURIComponent(url) : url);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.ListaEESSPrecio && Array.isArray(data.ListaEESSPrecio)) {
        console.log(`✅ Éxito con método ${i + 1}`);
        return data;
      } else {
        throw new Error("Formato de datos inválido");
      }

    } catch (error) {
      console.warn(`⚠️ Método ${i + 1} falló:`, error.message);

      if (i === proxies.length - 1) {
        throw new Error(`Todos los métodos fallaron. Último error: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function llenarProvincias() {
  const provincias = [...new Set(datosGasolineras.map(e => e.Provincia))].sort();
  const selectProv = document.getElementById("provincia");

  selectProv.innerHTML = `<option value="">✅ Seleccione provincia (${provincias.length} disponibles)</option>`;
  provincias.forEach(p => {
    selectProv.innerHTML += `<option value="${p}">${p}</option>`;
  });

  selectProv.addEventListener("change", function() {
    llenarMunicipios();
    // NUEVA FUNCIONALIDAD: Mostrar resultados automáticamente cuando se selecciona provincia
    if (this.value) {
      mostrarResultados();
    }
  });
}

function llenarMunicipios() {
  const provincia = document.getElementById("provincia").value;

  if (!provincia) {
    const selectMun = document.getElementById("municipio");
    selectMun.disabled = true;
    selectMun.innerHTML = '<option value="">Seleccione provincia primero</option>';
    return;
  }

  const municipios = [...new Set(
    datosGasolineras
    .filter(e => e.Provincia === provincia)
    .map(e => e.Municipio)
  )].sort();

  const selectMun = document.getElementById("municipio");
  selectMun.disabled = false;
  // CAMBIO IMPORTANTE: Opción por defecto permite ver toda la provincia
  selectMun.innerHTML = `<option value="">🏛️ Toda la provincia (${municipios.length} municipios)</option>`;
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

  // Si no hay provincia seleccionada, no mostrar nada
  if (!provincia) {
    document.getElementById("resultados").innerHTML = "";
    return;
  }

  // Filtrar por provincia (obligatorio) y municipio (opcional)
  let resultados = datosGasolineras.filter(e => {
    const coincideProvincia = e.Provincia === provincia;
    const coincideMunicipio = municipio ? e.Municipio === municipio : true; // Si no hay municipio, mostrar todos
    return coincideProvincia && coincideMunicipio;
  });

  // Filtrar por carburante disponible y ordenar por precio
  resultados = resultados
    .filter(g => g[carburante] && g[carburante].trim() !== "")
    .map(g => ({
    ...g,
    precio: parseFloat(g[carburante].replace(",", "."))
    }))
    .sort((a, b) => a.precio - b.precio);

  mostrarGasolineras(resultados, carburante, false, municipio);
}

// FUNCIONES DE GEOLOCALIZACIÓN (sin cambios)
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

      console.log(`📍 Ubicación obtenida: ${ubicacionUsuario.lat}, ${ubicacionUsuario.lng}`);

      geoIcon.textContent = "✅";
      geoIcon.classList.remove("loading");
      geoText.textContent = "Ubicación obtenida";
      botonGeo.disabled = false;

      mostrarGasolinerasCercanas();

      setTimeout(() => {
        geoIcon.textContent = "📍";
        geoText.textContent = "Actualizar ubicación";
      }, 2000);
    },
    (error) => {
      let mensaje = "Error desconocido";
      switch(error.code) {
        case error.PERMISSION_DENIED:
          mensaje = "Permiso denegado - Activa la ubicación";
          break;
        case error.POSITION_UNAVAILABLE:
          mensaje = "Ubicación no disponible";
          break;
        case error.TIMEOUT:
          mensaje = "Tiempo agotado - Intenta de nuevo";
          break;
      }

      console.error("❌ Error geolocalización:", mensaje);

      geoIcon.textContent = "❌";
      geoIcon.classList.remove("loading");
      geoText.textContent = "Error ubicación";
      botonGeo.disabled = false;

      alert(`Error de geolocalización: ${mensaje}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    }
  );
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371;
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
    .filter(g => g.distancia <= 25)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 20);

  if (gasolinerasConDistancia.length === 0) {
    document.getElementById("resultados").innerHTML = 
      "<p>No se encontraron gasolineras cercanas (máximo 25km) con ese carburante.</p>";
    return;
  }

  console.log(`📍 Encontradas ${gasolinerasConDistancia.length} gasolineras cercanas`);
  mostrarGasolineras(gasolinerasConDistancia, carburante, true);
}

function mostrarGasolineras(resultados, carburante, esCercanas = false, municipioSeleccionado = "") {
  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "";

  if (resultados.length === 0) {
    const provincia = document.getElementById("provincia").value;
    const mensaje = municipioSeleccionado ? 
      `No se encontraron gasolineras con ${carburante.replace("Precio ", "")} en ${municipioSeleccionado}.` :
      `No se encontraron gasolineras con ${carburante.replace("Precio ", "")} en ${provincia}.`;
    contenedor.innerHTML = `<p>${mensaje}</p>`;
    return;
  }

  // NUEVO: Mostrar información de la búsqueda
  const provincia = document.getElementById("provincia").value;
  const tipoCarburante = carburante.replace("Precio ", "");

  let infoHeader = "";
  if (esCercanas) {
    infoHeader = `<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
      <h3 style="margin: 0; color: #27ae60;">📍 ${resultados.length} gasolineras cercanas con ${tipoCarburante}</h3>
      <p style="margin: 5px 0 0 0;">Ordenadas por distancia</p>
    </div>`;
  } else {
    const ubicacion = municipioSeleccionado ? municipioSeleccionado : `toda la provincia de ${provincia}`;
    infoHeader = `<div style="background: #e8f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
      <h3 style="margin: 0; color: #3498db;">🏛️ ${resultados.length} gasolineras en ${ubicacion}</h3>
      <p style="margin: 5px 0 0 0;">Carburante: ${tipoCarburante} - Ordenadas por precio</p>
    </div>`;
  }

  contenedor.innerHTML = infoHeader;

  resultados.forEach((g, i) => {
    let clase = "gasolinera";

    if (esCercanas) {
      if (i < 3) clase += " cercana";
    } else {
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
