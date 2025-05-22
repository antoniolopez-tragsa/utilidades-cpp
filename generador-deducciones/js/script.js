// Función para volver a la página anterior
function volverAtras() {
    window.history.back();
}

// Convierte una fecha en formato "DD/MM/AAAA hh:mm:ss" a un objeto Date
function parseFecha(fechaStr) {
    const partes = fechaStr.split(/[/ :]/);
    if (partes.length < 6) return null;
    const [dd, mm, yyyy, hh, min, ss] = partes.map(Number);
    return new Date(yyyy, mm - 1, dd, hh, min, ss);
}

// Calcula el número de días de exceso (fracciones cuentan como día completo)
function calcularDiasExceso(fechaLimite, fechaReal) {
    const msPorDia = 1000 * 60 * 60 * 24;
    const diff = fechaReal - fechaLimite;
    if (diff <= 0) return 0;
    return Math.ceil(diff / msPorDia);
}

// Evalúa si hay deducción por incumplimiento de tiempos
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

// Ejecuta cuando la página está completamente cargada
document.addEventListener('DOMContentLoaded', function () {
    fetch('data/servicios.json')
        .then(response => response.json())
        .then(json => {
            // Verifica que haya al menos un servicio en el array
            if (!json.servicios || !Array.isArray(json.servicios) || json.servicios.length === 0) {
                throw new Error("El archivo JSON no contiene un array 'servicios' válido o está vacío.");
            }

            // Carga servicios en el selector
            const servicios = json.servicios;
            const servicioSelect = document.getElementById('servicio');
            const tipoSelect = document.getElementById('tipoIncidencia');
            const indicadorSelect = document.getElementById('indicador');

            // Carga áreas funcionales en el selector
            const areaSelect = document.getElementById('areaFuncional');
            const areas = json.areas_funcionales;

            // Recorre cada grupo: crítica, grave, leve
            for (const [nivel, zonas] of Object.entries(areas)) {
                const group = document.createElement('optgroup');
                group.label = nivel.charAt(0).toUpperCase() + nivel.slice(1); // Capitaliza

                zonas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    group.appendChild(option);
                });

                areaSelect.appendChild(group);
            }

            // Llenar el <select> de servicios
            servicios.forEach(servicio => {
                const option = document.createElement('option');
                option.value = servicio.nombre;
                option.textContent = servicio.nombre;
                option.dataset.info = JSON.stringify(servicio);
                servicioSelect.appendChild(option);
            });

            // Evento al seleccionar un servicio
            servicioSelect.addEventListener('change', function () {
                const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];
                if (!selectedOption.value) return;

                const servicio = JSON.parse(selectedOption.dataset.info);

                tipoSelect.innerHTML = '<option value="">Selecciona una opción</option>';
                if (Array.isArray(servicio.tipos_incidencia) && servicio.tipos_incidencia.length > 0) {
                    tipoSelect.disabled = false;
                    servicio.tipos_incidencia.forEach(t => {
                        const option = document.createElement('option');
                        option.value = t.tipo;
                        option.textContent = t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1);
                        option.dataset.respuesta = t.tiempo_maximo_respuesta;
                        option.dataset.resolucion = t.tiempo_maximo_resolucion;
                        tipoSelect.appendChild(option);
                    });
                } else {
                    tipoSelect.disabled = true;
                }

                // Rellena indicadores
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

                // Limpia visuales anteriores
                document.getElementById('infoTiempos').style.display = 'none';
                document.getElementById('infoIndicador').style.display = 'none';
                document.getElementById('resultadoDeduccion').style.display = 'none';
            });

            // Evento para mostrar info al seleccionar tipo de incidencia
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

            // Evento para mostrar info al seleccionar un indicador
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
        .catch(error => {
            console.error("Error cargando el JSON:", error);
            alert("Error cargando los datos del servicio. Verifica que el archivo 'data/servicios.json' exista y tenga el formato correcto.");
        });
});
