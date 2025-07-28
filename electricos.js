// electricos.js - Funcionalidad para puntos de recarga eléctrica

document.addEventListener('DOMContentLoaded', function() {
    const btnElectrico = document.getElementById('btn-electrico');
    const recargaLista = document.getElementById('recarga-lista');

    if (btnElectrico) {
        btnElectrico.addEventListener('click', iniciarBusquedaElectricos);
    }
});

function iniciarBusquedaElectricos() {
    const btnElectrico = document.getElementById('btn-electrico');
    const recargaLista = document.getElementById('recarga-lista');
    
    // Deshabilitar botón y mostrar loading
    btnElectrico.disabled = true;
   btnElectrico.innerHTML = '<span>⏳</span><span>Buscando...</span>';
    recargaLista.innerHTML = '<div class="loading">Obteniendo tu ubicación...</div>';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                buscarPuntosRecarga(lat, lng);
				mostrarClima(lat, lng);
            },
            function(error) {
                mostrarError('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
                resetearBoton();
            }
        );
    } else {
        mostrarError('Tu navegador no soporta geolocalización.');
        resetearBoton();
    }
}

async function buscarPuntosRecarga(lat, lng) {
    const recargaLista = document.getElementById('recarga-lista');
    const apiKey = CONFIG.OPENCHARGE_API_KEY;

    try {
        recargaLista.innerHTML = `
		<div class="spinner-content" style="margin: 0 auto; max-width: 320px;">
		<div class="spinner-icon">⏳</div>
		<div id="mensaje-carga-electricos">Buscando puntos de recarga cercanos...</div>
		<div class="spinner-bar">
		<div class="spinner-progress"></div>
		</div>
		<div class="spinner-tip">
		<small>💡 Puede tardar unos segundos según tu conexión</small>
		</div>
		</div>
			`;
        const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=ES&latitude=${lat}&longitude=${lng}&distance=25&maxresults=15&key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }

        const puntos = await response.json();
        mostrarPuntosRecarga(puntos);

    } catch (error) {
        console.error('Error al buscar puntos de recarga:', error);
        mostrarError('Error al buscar puntos de recarga. Inténtalo de nuevo.');
    } finally {
        resetearBoton();
    }
}

function mostrarPuntosRecarga(puntos) {
    const recargaLista = document.getElementById('recarga-lista');
    if (!puntos || puntos.length === 0) {
        recargaLista.innerHTML = '<div class="error-electricos">No se encontraron puntos de recarga cerca de ti.</div>';
        return;
    }
	
    let html = '<h2>⚡Puntos de recarga cercanos: (25km max.)</h2><div id="resultados-electricos">';
    puntos.forEach(punto => {
        const nombre = punto.AddressInfo?.Title || 'Punto de recarga';
        const direccion = punto.AddressInfo?.AddressLine1 || '';
        const ciudad = punto.AddressInfo?.Town || '';
        const operador = punto.OperatorInfo?.Title || 'Operador desconocido';
        const lat = punto.AddressInfo?.Latitude;
        const lng = punto.AddressInfo?.Longitude;

        // Información de conectores
        let conectores = '';
        if (punto.Connections && punto.Connections.length > 0) {
            conectores = punto.Connections.map(conn => {
                const tipo = conn.ConnectionType?.Title || 'Desconocido';
                const potencia = conn.PowerKW ? `${conn.PowerKW}kW` : '';
                return `${tipo} ${potencia}`.trim();
            }).join(', ');
        }

        html += `
            <div class="gasolinera">
                <h3>${nombre}</h3>
                <p><strong>📍 Dirección:</strong> ${direccion}${ciudad ? ', ' + ciudad : ''}</p>
                <p><strong>🏢 Operador:</strong> ${operador}</p>
                ${conectores ? `<p><strong>🔌 Conectores:</strong> ${conectores}</p>` : ''}
                <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank">
                    Ver en Google Maps →
                </a>
            </div>
        `;
    });
    html += '</div>';
    recargaLista.innerHTML = html;
}
function mostrarError(mensaje) {
    const recargaLista = document.getElementById('recarga-lista');
    recargaLista.innerHTML = `<div class="loading" style="color: #dc3545;">❌ ${mensaje}</div>`;
}

function resetearBoton() {
  const btnElectrico = document.getElementById('btn-electrico');
  btnElectrico.disabled = false;
  btnElectrico.innerHTML = '<span>🔋</span><span>Mi coche es eléctrico</span>';
}