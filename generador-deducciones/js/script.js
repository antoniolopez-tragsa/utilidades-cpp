// Función para volver a la página anterior
function volverAtras() {
    window.history.back();
}

function parseFecha(fechaStr) {
    const partes = fechaStr.split(/[/ :]/);
    if (partes.length < 6) return null;
    const [dd, mm, yyyy, hh, min, ss] = partes.map(Number);
    return new Date(yyyy, mm - 1, dd, hh, min, ss);
}

function calcularDiasExceso(fechaLimite, fechaReal) {
    const msPorDia = 1000 * 60 * 60 * 24;
    const diff = fechaReal - fechaLimite;
    if (diff <= 0) return 0;
    return Math.ceil(diff / msPorDia); // Cada fracción cuenta como día completo
}

function evaluarDeduccion() {
    const fechaRespMax = parseFecha(document.getElementById('fechaRespuestaMaxima').value);
    const fechaResp = parseFecha(document.getElementById('fechaRespuesta').value);
    const fechaResMax = parseFecha(document.getElementById('fechaResolucionMaxima').value);
    const fechaRes = parseFecha(document.getElementById('fechaResolucion').value);

    if (!fechaRespMax || !fechaResp || !fechaResMax || !fechaRes) {
        alert("Por favor, asegúrate de introducir todas las fechas correctamente.");
        return;
    }

    const excesoRespuesta = calcularDiasExceso(fechaRespMax, fechaResp);
    const excesoResolucion = calcularDiasExceso(fechaResMax, fechaRes);

    let mensaje = "";

    if (excesoRespuesta > 0 || excesoResolucion > 0) {
        mensaje += "💸 Se genera una deducción.<br>";
        if (excesoRespuesta > 0)
            mensaje += `🕒 Exceso de tiempo de respuesta: ${excesoRespuesta} día(s)<br>`;
        if (excesoResolucion > 0)
            mensaje += `⏳ Exceso de tiempo de resolución: ${excesoResolucion} día(s)`;
    } else {
        mensaje = "✅ No se genera deducción. Todos los tiempos se han cumplido.";
    }

    document.getElementById('mensajeDeduccion').innerHTML = mensaje;
    document.getElementById('resultadoDeduccion').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function () {
    fetch('data/servicios.json')
        .then(response => response.json())
        .then(json => {
            const servicioSelect = document.getElementById('servicio');
            const tipoSelect = document.getElementById('tipoIncidencia');
            const indicadorSelect = document.getElementById('indicador');

            // Para ahora, solo un servicio en el JSON
            const servicios = [json.servicio];

            // Cargar selector de servicios
            servicios.forEach(servicio => {
                const option = document.createElement('option');
                option.value = servicio.nombre;
                option.textContent = servicio.nombre;
                option.dataset.info = JSON.stringify(servicio);
                servicioSelect.appendChild(option);
            });

            // Al seleccionar servicio
            servicioSelect.addEventListener('change', function () {
                const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];
                if (!selectedOption.value) return;

                const servicio = JSON.parse(selectedOption.dataset.info);

                // Cargar tipos de incidencia
                tipoSelect.innerHTML = '<option value="">Selecciona una opción</option>';
                servicio.tipos_incidencia.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.tipo;
                    option.textContent = t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1);
                    option.dataset.respuesta = t.tiempo_maximo_respuesta;
                    option.dataset.resolucion = t.tiempo_maximo_resolucion;
                    tipoSelect.appendChild(option);
                });

                // Cargar indicadores
                indicadorSelect.innerHTML = '<option value="">Selecciona un indicador</option>';
                servicio.indicadores.forEach(ind => {
                    const option = document.createElement('option');
                    option.value = ind.nombre;
                    option.textContent = ind.nombre;
                    option.dataset.falloDisponibilidad = ind.genera_fallo_disponibilidad;
                    option.dataset.falloCalidad = Array.isArray(ind.fallo_calidad)
                        ? ind.fallo_calidad.join(', ')
                        : ind.fallo_calidad;
                    indicadorSelect.appendChild(option);
                });

                // Resetear información visual
                document.getElementById('infoTiempos').style.display = 'none';
                document.getElementById('infoIndicador').style.display = 'none';
                document.getElementById('resultadoDeduccion').style.display = 'none';
            });

            // Tipo de incidencia seleccionado
            tipoSelect.addEventListener('change', function () {
                const selected = tipoSelect.options[tipoSelect.selectedIndex];
                const tiempoRespuesta = selected.dataset.respuesta;
                const tiempoResolucion = selected.dataset.resolucion;

                if (tiempoRespuesta && tiempoResolucion) {
                    document.getElementById('tiempoRespuesta').textContent = tiempoRespuesta;
                    document.getElementById('tiempoResolucion').textContent = tiempoResolucion;
                    document.getElementById('infoTiempos').style.display = 'block';
                } else {
                    document.getElementById('infoTiempos').style.display = 'none';
                }
            });

            // Indicador seleccionado
            indicadorSelect.addEventListener('change', function () {
                const selected = indicadorSelect.options[indicadorSelect.selectedIndex];
                const fd = selected.dataset.falloDisponibilidad === "true" ? "Sí" : "No";
                const fc = selected.dataset.falloCalidad || "No definido";

                if (selected.value) {
                    document.getElementById('disponibilidad').textContent = fd;
                    document.getElementById('calidad').textContent = fc;
                    document.getElementById('infoIndicador').style.display = 'block';
                } else {
                    document.getElementById('infoIndicador').style.display = 'none';
                }
            });
        })
        .catch(error => console.error("Error cargando el JSON:", error));
});
