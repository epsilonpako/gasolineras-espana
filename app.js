let datosGasolineras = [];
let ubicacionUsuario = null;

// API Key del clima
const apiKey = '2751c34eac1e3f2117bf2038edec76ce';

// Función principal que se ejecuta al cargar la página
async function cargarDatos() {
  console.log("🚀 Iniciando carga de datos...");

  const selectProv = document.getElementById("provincia");
  if (!selectProv) {
    console.error("❌ No se encontró el elemento provincia");
    return;
  }

  selectProv.innerHTML = '<option value="">⏳ Cargando datos...</option>';

  try {
    console.log("📡 Intentando cargar datos de gasolineras...");
    const datos = await intentarCargarDatos();
	// Extraer la fecha de actualización
	let fechaActualizacion = datos.Fecha || datos.fecha || datos.FechaActualizacion || null;
	
	
	
	
    if (fechaActualizacion) {
      mostrarFechaActualizacion(fechaActualizacion);
	}
    if (!datos || !datos.ListaEESSPrecio || !Array.isArray(datos.ListaEESSPrecio)) {
      throw new Error("Datos recibidos no válidos");
    }

    datosGasolineras = datos.ListaEESSPrecio;
    console.log(`✅ Cargadas ${datosGasolineras.length} gasolineras`);

    llenarProvincias();
    configurarGeolocalizacion();

  } catch (err) {
    console.error("❌ Error cargando datos:", err);
    selectProv.innerHTML = '<option value="">❌ Error al cargar datos</option>';
    mostrarErrorConexion(err);
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
      console.log(`🔄 Probando método ${i + 1}/${proxies.length}...`);

      const proxyUrl = proxies[i] + (proxies[i] ? encodeURIComponent(url) : url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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

      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function llenarProvincias() {
  console.log("📋 Llenando provincias...");

  try {
    const provincias = [...new Set(datosGasolineras.map(e => e.Provincia))].sort();
    const selectProv = document.getElementById("provincia");

    if (!selectProv) {
      console.error("❌ Elemento provincia no encontrado");
      return;
    }

    selectProv.innerHTML = `<option value="">✅ Seleccione provincia (${provincias.length} disponibles)</option>`;

    provincias.forEach(p => {
      if (p && p.trim()) {
        selectProv.innerHTML += `<option value="${p}">${p}</option>`;
      }
    });

    console.log(`✅ ${provincias.length} provincias cargadas`);

    // Configurar eventos
    selectProv.addEventListener("change", function() {
      console.log(`🏛️ Provincia seleccionada: ${this.value}`);
      llenarMunicipios();

      if (this.value) {
        cargarClimaProvincia(this.value);
        mostrarResultados();
      } else {
        limpiarClima();
      }
    });

  } catch (error) {
    console.error("❌ Error llenando provincias:", error);
  }
}

function llenarMunicipios() {
  const provincia = document.getElementById("provincia").value;
  const selectMun = document.getElementById("municipio");

  if (!selectMun) {
    console.error("❌ Elemento municipio no encontrado");
    return;
  }

  if (!provincia) {
    selectMun.disabled = true;
    selectMun.innerHTML = '<option value="">Seleccione provincia primero</option>';
    return;
  }

  try {
    const municipios = [...new Set(
      datosGasolineras
      .filter(e => e.Provincia === provincia)
      .map(e => e.Municipio)
      .filter(m => m && m.trim())
    )].sort();

    selectMun.disabled = false;
    selectMun.innerHTML = `<option value="">🏛️ Toda la provincia (${municipios.length} municipios)</option>`;

    municipios.forEach(m => {
      selectMun.innerHTML += `<option value="${m}">${m}</option>`;
    });

    console.log(`✅ ${municipios.length} municipios cargados para ${provincia}`);

    // Configurar eventos (solo una vez)
    selectMun.removeEventListener("change", manejarCambioMunicipio);
    selectMun.addEventListener("change", manejarCambioMunicipio);

    const selectCarb = document.getElementById("carburante");
    if (selectCarb) {
      selectCarb.removeEventListener("change", mostrarResultados);
      selectCarb.addEventListener("change", mostrarResultados);
    }

  } catch (error) {
    console.error("❌ Error llenando municipios:", error);
  }
}

function manejarCambioMunicipio() {
  const provincia = document.getElementById("provincia").value;
  const municipio = this.value;

  console.log(`🏘️ Municipio seleccionado: ${municipio || 'Toda la provincia'}`);

  if (municipio) {
    cargarClimaMunicipio(municipio, provincia);
  } else {
    cargarClimaProvincia(provincia);
  }

  mostrarResultados();
}

function mostrarFechaActualizacion(fecha) {
  const spanFecha = document.getElementById("fecha-actualizacion");
  if (!spanFecha) return;

  // Si la fecha viene en formato "dd/MM/yyyy HH:mm:ss"
  const partes = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (partes) {
    const [ , dia, mes, anio, hora, min ] = partes;
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const texto = `· Última actualización: ${dia} de ${meses[parseInt(mes)-1]} de ${anio}, ${hora}:${min}`;
    spanFecha.textContent = texto;
  } else {
    // Si el formato no es el esperado, lo mostramos tal cual
    spanFecha.textContent = `· Última actualización: ${fecha}`;
  }
}

// FUNCIONES DEL CLIMA
async function cargarClimaProvincia(provincia) {
  const climaContainer = document.getElementById("clima-info");
  if (!climaContainer) return;

  climaContainer.innerHTML = '<div class="clima-loading">🌤️ Cargando clima...</div>';

  try {
    const ciudadBusqueda = obtenerCapitalProvincia(provincia);
    console.log(`🌤️ Buscando clima para: ${ciudadBusqueda}`);

    const clima = await obtenerClima(ciudadBusqueda);
    mostrarClima(clima, provincia, "provincia");
  } catch (error) {
    console.error("❌ Error cargando clima:", error);
    climaContainer.innerHTML = '<div class="clima-error">❌ No se pudo cargar el clima</div>';
  }
}

async function cargarClimaMunicipio(municipio, provincia) {
  const climaContainer = document.getElementById("clima-info");
  if (!climaContainer) return;

  climaContainer.innerHTML = '<div class="clima-loading">🌤️ Cargando clima...</div>';

  try {
    let clima;
    try {
      console.log(`🌤️ Buscando clima para: ${municipio}, ${provincia}`);
      clima = await obtenerClima(`${municipio}, ${provincia}, ES`);
    } catch {
      console.log(`🌤️ Fallback: usando capital de ${provincia}`);
      const ciudadBusqueda = obtenerCapitalProvincia(provincia);
      clima = await obtenerClima(ciudadBusqueda);
    }
    mostrarClima(clima, municipio, "municipio");
  } catch (error) {
    console.error("❌ Error cargando clima:", error);
    climaContainer.innerHTML = '<div class="clima-error">❌ No se pudo cargar el clima</div>';
  }
}

async function obtenerClima(ciudad) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${apiKey}&units=metric&lang=es`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return await response.json();
}

function obtenerCapitalProvincia(provincia) {
  const capitales = {
    'A Coruña': 'A Coruña, ES',
    'Álava': 'Vitoria-Gasteiz, ES',
    'Albacete': 'Albacete, ES',
    'Alicante': 'Alicante, ES',
    'Almería': 'Almería, ES',
    'Asturias': 'Oviedo, ES',
    'Ávila': 'Ávila, ES',
    'Badajoz': 'Badajoz, ES',
    'Baleares': 'Palma, ES',
    'Barcelona': 'Barcelona, ES',
    'Burgos': 'Burgos, ES',
    'Cáceres': 'Cáceres, ES',
    'Cádiz': 'Cádiz, ES',
    'Cantabria': 'Santander, ES',
    'Castellón': 'Castellón, ES',
    'Ciudad Real': 'Ciudad Real, ES',
    'Córdoba': 'Córdoba, ES',
    'Cuenca': 'Cuenca, ES',
    'Girona': 'Girona, ES',
    'Granada': 'Granada, ES',
    'Guadalajara': 'Guadalajara, ES',
    'Guipúzcoa': 'San Sebastián, ES',
    'Huelva': 'Huelva, ES',
    'Huesca': 'Huesca, ES',
    'Jaén': 'Jaén, ES',
    'La Rioja': 'Logroño, ES',
    'Las Palmas': 'Las Palmas, ES',
    'León': 'León, ES',
    'Lleida': 'Lleida, ES',
    'Lugo': 'Lugo, ES',
    'Madrid': 'Madrid, ES',
    'Málaga': 'Málaga, ES',
    'Murcia': 'Murcia, ES',
    'Navarra': 'Pamplona, ES',
    'Ourense': 'Ourense, ES',
    'Palencia': 'Palencia, ES',
    'Pontevedra': 'Pontevedra, ES',
    'Salamanca': 'Salamanca, ES',
    'Santa Cruz de Tenerife': 'Santa Cruz de Tenerife, ES',
    'Segovia': 'Segovia, ES',
    'Sevilla': 'Sevilla, ES',
    'Soria': 'Soria, ES',
    'Tarragona': 'Tarragona, ES',
    'Teruel': 'Teruel, ES',
    'Toledo': 'Toledo, ES',
    'Valencia': 'Valencia, ES',
    'Valladolid': 'Valladolid, ES',
    'Vizcaya': 'Bilbao, ES',
    'Zamora': 'Zamora, ES',
    'Zaragoza': 'Zaragoza, ES'
  };

  return capitales[provincia] || `${provincia}, ES`;
}

 
function mostrarClima(clima, ubicacion, tipo) {
  const climaContainer = document.getElementById("clima-info");
  if (!climaContainer) return;

  const temperatura = Math.round(clima.main.temp);
  const sensacion = Math.round(clima.main.feels_like);
  const descripcion = clima.weather[0].description;
  const icono = clima.weather[0].icon;
  const humedad = clima.main.humidity;
  const viento = Math.round(clima.wind.speed * 3.6);

  const tipoTexto = tipo === "municipio" ? "🏘️" : "🏛️";

  climaContainer.innerHTML = `
    <div class="clima-card">
      <div class="clima-header">
        <h3>${tipoTexto} Clima en ${ubicacion}</h3>
        <img src="https://openweathermap.org/img/wn/${icono}@2x.png" alt="${descripcion}" class="clima-icono">
      </div>
      <div class="clima-info-grid">
        <div class="clima-temp">
          <span class="temp-principal">${temperatura}°C</span>
          <span class="temp-sensacion">Sensación: ${sensacion}°C</span>
        </div>
        <div class="clima-descripcion">${descripcion.charAt(0).toUpperCase() + descripcion.slice(1)}</div>
        <div class="clima-detalles">
          <span>💧 Humedad: ${humedad}%</span>
          <span>💨 Viento: ${viento} km/h</span>
        </div>
      </div>
    </div>
  `;
}

function limpiarClima() {
  const climaContainer = document.getElementById("clima-info");
  if (climaContainer) {
    climaContainer.innerHTML = '';
  }
}

function mostrarErrorConexion(err) {
  const contenedor = document.getElementById("resultados");
  if (!contenedor) return;

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

function mostrarResultados() {
  const provincia = document.getElementById("provincia")?.value;
  const municipio = document.getElementById("municipio")?.value;
  const carburante = document.getElementById("carburante")?.value;

  if (!provincia) {
    const contenedor = document.getElementById("resultados");
    if (contenedor) contenedor.innerHTML = "";
    return;
  }

  try {
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

    mostrarGasolineras(resultados, carburante, false, municipio);
  } catch (error) {
    console.error("❌ Error mostrando resultados:", error);
  }
}

// FUNCIONES DE GEOLOCALIZACIÓN
function configurarGeolocalizacion() {
  const botonGeo = document.getElementById("geolocalizacion");

  if (!botonGeo) {
    console.warn("⚠️ Botón de geolocalización no encontrado");
    return;
  }

  if (!navigator.geolocation) {
    botonGeo.disabled = true;
    botonGeo.innerHTML = '<span>❌</span><span>Geolocalización no disponible</span>';
    return;
  }

  botonGeo.addEventListener("click", obtenerUbicacion);
  console.log("✅ Geolocalización configurada");
}

function obtenerUbicacion() {
  const botonGeo = document.getElementById("geolocalizacion");
  const geoIcon = document.getElementById("geo-icon");
  const geoText = document.getElementById("geo-text");

  if (!botonGeo || !geoIcon || !geoText) return;

  botonGeo.disabled = true;
  geoIcon.textContent = "⏳";
  geoIcon.classList.add("loading");
  geoText.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      ubicacionUsuario = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // 1. Reiniciar selects
      const selectProv = document.getElementById("provincia");
      const selectMun = document.getElementById("municipio");
      if (selectProv) selectProv.value = "";
      if (selectMun) {
        selectMun.value = "";
        selectMun.disabled = true;
        selectMun.innerHTML = '<option value="">Seleccione provincia primero</option>';
      }

      // 2. Mostrar clima de la ubicación real
      await cargarClimaPorCoordenadas(ubicacionUsuario.lat, ubicacionUsuario.lng);

      // 3. Mostrar gasolineras cercanas
      mostrarGasolinerasCercanas();

      geoIcon.textContent = "✅";
      geoIcon.classList.remove("loading");
      geoText.textContent = "Ubicación obtenida";
      botonGeo.disabled = false;

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
      maximumAge: 30000
    }
  );
}

async function cargarClimaPorCoordenadas(lat, lng) {
  const climaContainer = document.getElementById("clima-info");
  if (!climaContainer) return;

  climaContainer.innerHTML = '<div class="clima-loading">🌤️ Cargando clima...</div>';

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=es`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    const clima = await response.json();

    // Mostrar el nombre de la localidad si está disponible
    let ubicacion = clima.name || "tu ubicación";
    mostrarClima(clima, ubicacion, "ubicacion");
  } catch (error) {
    console.error("❌ Error cargando clima:", error);
    climaContainer.innerHTML = '<div class="clima-error">❌ No se pudo cargar el clima</div>';
  }
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

  const carburante = document.getElementById("carburante")?.value || "Precio Gasolina 95 E5";

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
    const contenedor = document.getElementById("resultados");
    if (contenedor) {
      contenedor.innerHTML = "<p>No se encontraron gasolineras cercanas (máximo 25km) con ese carburante.</p>";
    }
    return;
  }

  console.log(`📍 Encontradas ${gasolinerasConDistancia.length} gasolineras cercanas`);
  mostrarGasolineras(gasolinerasConDistancia, carburante, true);
}

function mostrarGasolineras(resultados, carburante, esCercanas = false, municipioSeleccionado = "") {
  const contenedor = document.getElementById("resultados");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (resultados.length === 0) {
    const provincia = document.getElementById("provincia")?.value;
    const mensaje = municipioSeleccionado ? 
      `No se encontraron gasolineras con ${carburante.replace("Precio ", "")} en ${municipioSeleccionado}.` :
      `No se encontraron gasolineras con ${carburante.replace("Precio ", "")} en ${provincia}.`;
    contenedor.innerHTML = `<p>${mensaje}</p>`;
    return;
  }

  const provincia = document.getElementById("provincia")?.value;
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

// INICIALIZAR AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', function() {
  console.log("📄 DOM cargado, iniciando aplicación...");
  cargarDatos();
});

// Fallback por si DOMContentLoaded ya pasó
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarDatos);
} else {
  cargarDatos();
}
