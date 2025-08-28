// --- Normalización y matching genérico tipo ↔ indicador ---
const STOPWORDS_ES = new Set([
    "de", "del", "la", "el", "los", "las", "y", "o", "u", "a", "en", "por", "para", "con",
    "según", "lo", "al", "un", "una", "uno", "unos", "unas",
    "incumplimiento", "incumplimientos", "relativo", "relativos", "relativa", "relativas",
    "indicadores", "indicador", "resolución", "resolucion", "ejecución", "ejecucion",
    "tareas", "proyectos", "promociones", "producción", "produccion", "atención", "atencion",
    "alta", "media", "baja", "urgente", "urgencia", "emergencia", "ordinaria", "ordinario",
    "implantación", "implantacion", "modificación", "modificacion", "configuración", "configuracion",
    "entre", "base", "pasos"
]);

function normalize(str) {
    return (str || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // quita tildes
        .replace(/[^a-z0-9\s]/g, " ")                      // signos → espacio
        .replace(/\s+/g, " ")                              // espacios múltiples
        .trim();
}

function tokenize(str) {
    return normalize(str)
        .split(" ")
        .filter(w => w && !STOPWORDS_ES.has(w) && w.length > 2);
}

// Similaridad basada en palabras comunes (recall respecto al indicador)
function similarityByWords(tipoStr, indicadorStr) {
    const tw = new Set(tokenize(tipoStr));
    const iw = tokenize(indicadorStr);
    if (iw.length === 0) return 0;
    let common = 0;
    iw.forEach(w => { if (tw.has(w)) common++; });
    return common / iw.length; // 1 = indicador totalmente cubierto por el tipo
}

// Devuelve el índice del mejor indicador o -1 si no hay coincidencia suficiente
function findBestIndicadorIndex(tipoText, indicadorSelect) {
    const tipoNorm = normalize(tipoText);
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < indicadorSelect.options.length; i++) {
        const opt = indicadorSelect.options[i];
        if (!opt.value) continue; // saltar placeholder

        const indText = opt.value;
        const indNorm = normalize(indText);

        // Regla 1: inclusión directa (muy fuerte)
        if (tipoNorm.includes(indNorm) || indNorm.includes(tipoNorm)) {
            const score = indNorm.length / Math.max(tipoNorm.length, indNorm.length);
            if (score > bestScore) { bestScore = score; bestIdx = i; }
            continue;
        }

        // Regla 2: similitud por palabras
        const score = similarityByWords(tipoText, indText);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    // Umbral razonable para evitar falsos positivos
    return bestScore >= 0.6 ? bestIdx : -1;
}

// Selecciona automáticamente el indicador más parecido al tipo
function autoSelectIndicadorDesdeTipo(tipoText, indicadorSelect) {
    const idx = findBestIndicadorIndex(tipoText, indicadorSelect);
    if (idx >= 0) {
        indicadorSelect.selectedIndex = idx;
        indicadorSelect.dispatchEvent(new Event('change')); // para refrescar panel info
    }
}

// Función para volver a la página anterior
function volverAtras() {
    window.history.back();
}

// Convierte "DD/MM/AAAA hh:mm:ss" a Date (hora local)
function parseFecha(fechaStr) {
    const partes = fechaStr.split(/[/ :]/);
    if (partes.length < 6) return null;
    const [dd, mm, yyyy, hh, min, ss] = partes.map(Number);
    return new Date(yyyy, mm - 1, dd, hh, min, ss);
}

// Días de exceso (fracciones cuentan como día completo)
function calcularDiasExceso(fechaLimite, fechaReal) {
    const msPorDia = 1000 * 60 * 60 * 24;
    const diff = fechaReal - fechaLimite;
    if (diff <= 0) return 0;
    return Math.ceil(diff / msPorDia);
}

/* ================================
   Factores y utilidades
================================ */
const FACTOR_FC = {
    FC1: 0.005,
    FC2: 0.0015,
    FC3: 0.00055,
    FCOG1: 0.00015,
    FCOG2: 0.005
};
const FACTOR_FD = {
    FD1: 0.00525,
    FD2: 0.001556,
    FD3: 0.000564
};

// Mapa para saber a qué nivel (critica | grave | leve) pertenece un área funcional concreta
const AREA_A_NIVEL = {};

function fdPorNivel(nivel) {
    if (!nivel) return null;
    const n = String(nivel).toLowerCase();
    if (n === 'critica' || n === 'crítica') return 'FD1';
    if (n === 'grave') return 'FD2';
    if (n === 'leve')  return 'FD3';
    return null;
}

function fcPorNivel(nivel) {
    if (!nivel) return null;
    const n = String(nivel).toLowerCase();
    if (n === 'critica' || n === 'crítica') return 'FC1';
    if (n === 'grave') return 'FC2';
    if (n === 'leve')  return 'FC3';
    return null;
}

// Devuelve factor/código de calidad solo para códigos explícitos (FC1/FC2/FC3/FCOG1/FCOG2).
// Si aparece "FC" genérico aquí, se ignora (factor 0); la excepción se maneja en evaluarDeduccion()
function obtenerFactorFalloCalidadExplicito(cadenaFc) {
    if (!cadenaFc) return { factor: 0, codigo: null };
    const codigos = String(cadenaFc)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    let maxFactor = 0;
    let codigoAplicado = null;

    codigos.forEach(code => {
        if (FACTOR_FC.hasOwnProperty(code)) {
            if (FACTOR_FC[code] > maxFactor) {
                maxFactor = FACTOR_FC[code];
                codigoAplicado = code;
            }
        }
        // Nota: "FC" genérico se ignora aquí a propósito
    });

    return { factor: maxFactor, codigo: codigoAplicado };
}

/* ================================
   Evaluación de deducción
================================ */
function evaluarDeduccion() {
    const fechaRespMax = parseFecha(document.getElementById('fechaRespuestaMaxima').value);
    const fechaResp    = parseFecha(document.getElementById('fechaRespuesta').value);
    const fechaResMax  = parseFecha(document.getElementById('fechaResolucionMaxima').value);
    const fechaRes     = parseFecha(document.getElementById('fechaResolucion').value);

    if (!fechaRespMax || !fechaResp || !fechaResMax || !fechaRes) {
        alert("Por favor, asegúrate de introducir todas las fechas correctamente (DD/MM/AAAA hh:mm:ss).");
        return;
    }

    const excesoRespuesta  = calcularDiasExceso(fechaRespMax, fechaResp);
    const excesoResolucion = calcularDiasExceso(fechaResMax, fechaRes);

    // numeroDias: excesoRespuesta o excesoResolucion (si ambos > 0, el mayor)
    let numeroDias = 0;
    if (excesoRespuesta > 0 || excesoResolucion > 0) {
        numeroDias = Math.max(excesoRespuesta, excesoResolucion);
    }

    // Mensaje base
    let mensaje = "";
    if (numeroDias > 0) {
        mensaje += "💸 Se genera una deducción.<br>";
        if (excesoRespuesta > 0)
            mensaje += `🕒 Exceso de tiempo de respuesta: ${excesoRespuesta} día(s)<br>`;
        if (excesoResolucion > 0)
            mensaje += `⏳ Exceso de tiempo de resolución: ${excesoResolucion} día(s)<br>`;
    } else {
        mensaje = "✅ No se genera deducción. Todos los tiempos se han cumplido.";
    }

    // Servicio → tas
    const servicioSelect = document.getElementById('servicio');
    let tas = 0;
    if (servicioSelect && servicioSelect.selectedIndex > 0) {
        try {
            const servicioData = JSON.parse(servicioSelect.options[servicioSelect.selectedIndex].dataset.info || "{}");
            tas = Number(servicioData.tas) || 0;
        } catch (_) { tas = 0; }
    }

    // Área elegida
    const areaSelect  = document.getElementById('areaFuncional');
    const areaElegida = areaSelect ? areaSelect.value : "";
    const nivelArea   = areaElegida ? AREA_A_NIVEL[areaElegida] : null;

    // Indicador → fallo_calidad y genera_FD
    const indicadorSelect = document.getElementById('indicador');
    let factor_fallo_calidad = 0;
    let fcCodigoUsado = null;
    let factor_fallo_disponibilidad = 0;
    let avisoFD = "";
    let generaFD = false;

    if (indicadorSelect && indicadorSelect.selectedIndex > 0) {
        const opt = indicadorSelect.options[indicadorSelect.selectedIndex];
        const cadenaFc = opt.dataset.falloCalidad; // "FC" | "FC1, FC2" | etc.
        generaFD = (opt.dataset.falloDisponibilidad === "true");

        // --- Regla especial SOLO para este caso: FC genérico y NO genera FD
        if (cadenaFc && cadenaFc.trim() === "FC" && !generaFD) {
            const fcCode = fcPorNivel(nivelArea); // FC1 | FC2 | FC3
            if (fcCode && FACTOR_FC[fcCode] != null) {
                factor_fallo_calidad = FACTOR_FC[fcCode];
                fcCodigoUsado = fcCode;
            } else {
                factor_fallo_calidad = 0;
                fcCodigoUsado = null;
            }
        } else {
            // Caso normal: usar códigos explícitos del JSON
            const resFC = obtenerFactorFalloCalidadExplicito(cadenaFc);
            factor_fallo_calidad = resFC.factor;
            fcCodigoUsado = resFC.codigo;
        }
    }

    // Fallo de disponibilidad: si generaFD, depende del área
    if (generaFD) {
        const fdCode = fdPorNivel(nivelArea); // FD1 | FD2 | FD3
        if (fdCode && FACTOR_FD[fdCode] != null) {
            factor_fallo_disponibilidad = FACTOR_FD[fdCode];
        } else {
            avisoFD = "⚠️ El indicador genera fallo de disponibilidad, pero no se ha podido determinar el nivel (elige un área funcional). Se toma 0 por defecto.<br>";
        }
    }

    // Fórmula: deducción = días * 0.8 * tas * (factor_fc + factor_fd)
    const sumaFactores = factor_fallo_calidad + factor_fallo_disponibilidad;
    const deduccion = numeroDias * 0.8 * tas * sumaFactores;

    // Render
    let detalle = "";
    detalle += `<hr>`;
    detalle += `<strong>Parámetros de cálculo</strong><br>`;
    detalle += `• Número de días: <strong>${numeroDias}</strong><br>`;
    detalle += `• tas del servicio: <strong>${tas.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong><br>`;
    detalle += `• factor_fallo_calidad: <strong>${factor_fallo_calidad}</strong>`;
    if (fcCodigoUsado) detalle += ` (FC aplicado: <strong>${fcCodigoUsado}</strong>)`;
    detalle += `<br>`;
    detalle += `• factor_fallo_disponibilidad: <strong>${factor_fallo_disponibilidad}</strong><br>`;
    if (avisoFD) detalle += avisoFD;
    detalle += `• Suma de factores: <strong>${sumaFactores}</strong><br>`;
    detalle += `<br><strong>Deducción</strong> = días × 0.8 × tas × (fc + fd) = `;
    detalle += `${numeroDias} × 0.8 × ${tas} × (${sumaFactores})`;
    detalle += `<br><br><span style="font-size:1.1em">💰 <strong>Importe de deducción:</strong> ${deduccion.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
    
    const contMsg = document.getElementById('mensajeDeduccion');
    const contRes = document.getElementById('resultadoDeduccion');
    if (contMsg && contRes) {
        contMsg.innerHTML = mensaje + detalle;
        contRes.style.display = 'block';
    }
}

/* ================================
   Pegar desde portapapeles
================================ */
document.querySelectorAll('.btn-pegar').forEach(boton => {
    boton.addEventListener('click', async function() {
        const inputId = this.getAttribute('data-target');
        const input = document.getElementById(inputId);
        try {
            const texto = await navigator.clipboard.readText();
            input.value = texto;
            input.focus();
        } catch (err) {
            alert('No se pudo leer el portapapeles. Permite el acceso en tu navegador.');
        }
    });
});

/* ================================
   Carga de JSON e inicialización
================================ */
document.addEventListener('DOMContentLoaded', function () {
    fetch('data/servicios.json')
        .then(response => response.json())
        .then(json => {
            if (!json.servicios || !Array.isArray(json.servicios) || json.servicios.length === 0) {
                throw new Error("El archivo JSON no contiene un array 'servicios' válido o está vacío.");
            }

            const servicios = json.servicios;
            const servicioSelect = document.getElementById('servicio');
            const tipoSelect = document.getElementById('tipoIncidencia');
            const indicadorSelect = document.getElementById('indicador');

            // Áreas funcionales
            const areaSelect = document.getElementById('areaFuncional');
            const areas = json.areas_funcionales || {};
            if (areaSelect && Object.keys(areas).length) {
                for (const [nivel, zonas] of Object.entries(areas)) {
                    const group = document.createElement('optgroup');
                    group.label = nivel.charAt(0).toUpperCase() + nivel.slice(1);
                    zonas.forEach(area => {
                        AREA_A_NIVEL[area] = nivel; // Guardar mapeo
                        const option = document.createElement('option');
                        option.value = area;
                        option.textContent = area;
                        group.appendChild(option);
                    });
                    areaSelect.appendChild(group);
                }
            }

            // Servicios
            if (servicioSelect) {
                servicios.forEach(servicio => {
                    const option = document.createElement('option');
                    option.value = servicio.nombre;
                    option.textContent = servicio.nombre;
                    option.dataset.info = JSON.stringify(servicio);
                    servicioSelect.appendChild(option);
                });

                servicioSelect.addEventListener('change', function () {
                    const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];
                    if (!selectedOption.value) return;

                    const servicio = JSON.parse(selectedOption.dataset.info);

                    // Tipos de incidencia
                    if (tipoSelect) {
                        tipoSelect.innerHTML = '<option value="">Selecciona una opción</option>';
                        if (Array.isArray(servicio.tipos_incidencia) && servicio.tipos_incidencia.length > 0) {
                            tipoSelect.disabled = false;
                            servicio.tipos_incidencia.forEach(t => {
                                const option = document.createElement('option');
                                option.value = t.tipo;
                                option.textContent = t.tipo;
                                option.dataset.respuesta = t.tiempo_maximo_respuesta;
                                option.dataset.resolucion = t.tiempo_maximo_resolucion;
                                tipoSelect.appendChild(option);
                            });
                        } else {
                            tipoSelect.disabled = true;
                        }
                    }

                    // Indicadores
                    if (indicadorSelect) {
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
                    }

                    // Limpia visuales
                    const infoT = document.getElementById('infoTiempos');
                    const infoI = document.getElementById('infoIndicador');
                    const resD  = document.getElementById('resultadoDeduccion');
                    if (infoT) infoT.style.display = 'none';
                    if (infoI) infoI.style.display = 'none';
                    if (resD)  resD.style.display = 'none';
                });
            }

            // Mostrar info al seleccionar tipo
            if (tipoSelect) {
                tipoSelect.addEventListener('change', function () {
                    const selected = tipoSelect.options[tipoSelect.selectedIndex];
                    const tiempoRespuesta = selected.dataset.respuesta;
                    const tiempoResolucion = selected.dataset.resolucion;

                    const infoT = document.getElementById('infoTiempos');
                    if (tiempoRespuesta && tiempoResolucion && infoT) {
                        const tR = document.getElementById('tiempoRespuesta');
                        const tZ = document.getElementById('tiempoResolucion');
                        if (tR) tR.textContent = tiempoRespuesta;
                        if (tZ) tZ.textContent = tiempoResolucion;
                        infoT.style.display = 'block';
                    } else if (infoT) {
                        infoT.style.display = 'none';
                    }
                });
            }

            // Mostrar info al seleccionar indicador
            if (indicadorSelect) {
                indicadorSelect.addEventListener('change', function () {
                    const selected = indicadorSelect.options[indicadorSelect.selectedIndex];
                    const fd = selected.dataset.falloDisponibilidad === "true" ? "Sí" : "No";
                    const fc = selected.dataset.falloCalidad || "No definido";

                    const infoI = document.getElementById('infoIndicador');
                    if (selected.value && infoI) {
                        const disp = document.getElementById('disponibilidad');
                        const cali = document.getElementById('calidad');
                        if (disp) disp.textContent = fd;
                        if (cali) cali.textContent = fc;
                        infoI.style.display = 'block';
                    } else if (infoI) {
                        infoI.style.display = 'none';
                    }
                });
            }
        })
        .catch(error => {
            console.error("Error cargando el JSON:", error);
            alert("Error cargando los datos del servicio. Verifica que 'data/servicios.json' exista y tenga el formato correcto.");
        });
});
