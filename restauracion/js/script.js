// Añade un evento al formulario que se activa cuando se envía
document.getElementById('formularioSubida').addEventListener('submit', handleFileUpload);

// Variables para almacenar los datos de los archivos Excel
let fichajesData, personalData, signingData, resultData;

// Función que maneja la subida y procesamiento de archivos cuando se envía el formulario
async function handleFileUpload(event) {
    // Previene el comportamiento por defecto del formulario (evita la recarga de la página)
    event.preventDefault();

    // Obtiene los archivos seleccionados por el usuario
    const fichajesFile = document.getElementById('ficheroPDFFichajes').files[0];
    const personalFile = document.getElementById('ficheroPDFPersonal').files[0];

    // Carga la biblioteca pdf.js
    var { pdfjsLib } = globalThis;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

    // Array para almacenar los datos procesados de los archivos
    const processedDataArray = [];

    // Verifica que los dos archivos hayan sido seleccionados antes de proceder
    if (fichajesFile && personalFile) {
        try {
            // Procesa los archivos PDF y almacena los resultados en el array
            fichajesData = await readPDFFile(fichajesFile, 'Fichajes');
            processedDataArray.push(processSigningData(fichajesData));

            personalData = await readPDFFile(personalFile, 'Personal');
            processedDataArray.push(processEmployeeData(personalData));

            // Procesa los turnos de los trabajadores y lo anexa al array
            signingData = totalizarTurnos(processedDataArray);
            processedDataArray.push(signingData);

            // Genera los resultados de la comparación entre fichajes y turnos
            resultData = generarResultados(processedDataArray[1], processedDataArray[2]);
            processedDataArray.push(resultData);

            // Muestra los datos procesados en la consola
            console.log('Datos procesados:', processedDataArray);

            // Muestra los datos en una tabla
            displayTotalsInTable(processedDataArray[3]);

            // Muestra la sección con resultados
            document.getElementById('resultados').style.display = 'block';
        } catch (error) {
            // Muestra un error si algo falla al procesar los archivos
            console.error('Error al procesar los archivos:', error);
        }
    } else {
        // Muestra una alerta si no se han seleccionado todos los archivos necesarios
        alert('Por favor, selecciona los dos archivos PDF.');
    }
}

// Función que lee un archivo PDF y lo convierte en datos JSON
function readPDFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function () {
            const typedArray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let textContent = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContentObj = await page.getTextContent();
                    const pageText = textContentObj.items.map(item => item.str).join(' ');
                    textContent += pageText + '\n';
                }

                resolve(textContent); // Resuelve la promesa con el contenido del texto
            } catch (error) {
                reject(`Error al leer el archivo PDF: ${error}`);
            }
        };

        reader.readAsArrayBuffer(file);
    });
}

// Función que transforma los datos en bruto del PDF en un array de objetos de tipo empleado
function processEmployeeData(input) {
    // Remover la palabra "TOTAL" y la suma total del final
    const data = input.replace(/TOTAL\s+\d+\s+\d+\s+\d+/g, '');

    // Dividir el texto por los espacios excesivos para obtener un array plano de elementos
    const tokens = data.split(/\s{2,}/);

    // Inicializamos un array para guardar los objetos
    const employees = [];

    // Función para verificar si un valor es un número válido
    function esNumeroValido(valor) {
        return !isNaN(parseInt(valor, 10));
    }

    // Recorre los tokens y verifica que se agrupan correctamente
    let i = 0;
    while (i < tokens.length) {
        const nombre = tokens[i].trim();

        // Si el siguiente token no es un número válido, podría ser parte del nombre
        if (!esNumeroValido(tokens[i + 1])) {
            i++;
            continue; // Saltamos este índice ya que es parte del nombre
        }

        // Verificar que los siguientes tres tokens son números
        if (esNumeroValido(tokens[i + 1]) && esNumeroValido(tokens[i + 2]) && esNumeroValido(tokens[i + 3])) {
            const dias = parseInt(tokens[i + 1], 10) || 0; // Días trabajados
            const mananas = parseInt(tokens[i + 2], 10) || 0; // Días de mañanas
            const tardes = parseInt(tokens[i + 3], 10) || 0; // Días de tardes/noches

            // Agregar el empleado solo si hay un nombre válido y días correctos
            if (nombre && dias > 0 && mananas >= 0 && tardes >= 0) {
                employees.push({
                    nombre: reformatName(nombre),
                    totalDays: dias,
                    morningDays: mananas,
                    eveningDays: tardes
                });
            }
            // Mover el índice al siguiente conjunto de datos
            i += 4;
        } else {
            // En caso de datos inesperados, mover al siguiente elemento
            i++;
        }
    }

    // Ordenar alfabéticamente por el nombre del empleado
    employees.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return employees;
}

// Función que formatea el nombre y apellidos del trabajador
function reformatName(name) {
    // Encuentra la posición de la coma
    const commaIndex = name.indexOf(',');

    if (commaIndex === -1) {
        // Si no se encuentra una coma, simplemente devuelve el nombre tal como está
        return name.toUpperCase().normalize('NFD')
            .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi, "$1")
            .replace(/Mª/gi, 'MARIA')
            .replace('.', '')
            .normalize();
    }

    // Divide el nombre en apellido y nombre
    const apellido = name.substring(0, commaIndex).trim();
    const nombre = name.substring(commaIndex + 1).trim();

    // Reuniéndolos en el formato deseado
    const text = `${nombre} ${apellido}`.toUpperCase().normalize('NFD')
        .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi, "$1")
        .replace(/Mª/gi, 'MARIA')
        .normalize();
    return text.replace(/\s+/g, ' ').trim();
}

// Función que transforma los datos en texto plano del PDF en un array de objetos de fichajes
function processSigningData(text) {
    // Dividir el texto en líneas por el separador 'Trabajo'
    const lines = text.trim().split('Trabajo').slice(0, -1);

    // Array para almacenar los datos procesados
    const fichajes = [];

    // Expresiones regulares
    const empleadoRegex = /(?:[A-ZÁÉÍÓÚÄËÏÖÜÑ,ºª\s]+),?\s*(?=\d{2}\/\d{2}\/\d{4})/;
    const fechaRegex = /(?:0[1-9]|[12]\d|3[01])\/(?:0[1-9]|1[0-2])\/\d{4}\b/;
    const horaRegex = /\d{2}:\d{2}:\d{2}/g;

    // Procesar cada línea
    lines.forEach(line => {
        // Extraer el nombre del empleado
        const empleadoMatch = line.match(empleadoRegex);
        const empleado_nombre = empleadoMatch ? empleadoMatch[0].trim() : '';

        // Extraer la fecha
        const fechaMatch = line.match(fechaRegex);
        const jornada = fechaMatch ? fechaMatch[0].trim() : '';

        // Extraer las horas de entrada y salida
        const horasMatch = line.match(horaRegex);
        const entrada = horasMatch && horasMatch.length > 0 ? horasMatch[0].trim() : '';
        const salida = horasMatch && horasMatch.length > 1 ? horasMatch[1].trim() : '';

        // Agregar el registro a la lista de fichajes
        fichajes.push({
            empleado_nombre: reformatName(empleado_nombre),
            jornada: jornada,
            entrada: entrada,
            salida: salida,
            duracion: calcularDiferenciaHoras(entrada, salida),
            turno: determinarTurno(entrada)
        });
    });

    // Ordenar alfabéticamente por el nombre del empleado
    fichajes.sort((a, b) => a.empleado_nombre.localeCompare(b.empleado_nombre));

    return fichajes;
}

// Muestra los datos agrupados en una tabla HTML
function displayTotalsInTable(totals) {
    const tableBody = document.querySelector('#totalesTabla tbody');
    tableBody.innerHTML = ''; // Limpiar contenido anterior

    // Recorre los datos totales y crea una fila por empleado
    for (total of totals) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${total.empleado_nombre}</td>
            <td class="${total.coincidente ? 'coincidente-true' : 'coincidente-false'}">${total.coincidente ? 'OK' : 'KO'}</td>
            <td>${total.motivo}</td>
        `;
        tableBody.appendChild(row);
    }
}

// Formatea un valor numérico como moneda
function formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

// Función para calcular la diferencia de tiempo en horas y minutos
function calcularDiferenciaHoras(entrada, salida) {
    // Convertir las horas de entrada y salida en objetos Date
    const [hEntrada, mEntrada, sEntrada] = entrada.split(':').map(Number);
    const [hSalida, mSalida, sSalida] = salida.split(':').map(Number);

    // Crear fechas usando una fecha arbitraria, ya que solo nos interesa el tiempo
    const fechaEntrada = new Date(0, 0, 0, hEntrada, mEntrada, sEntrada);
    const fechaSalida = new Date(0, 0, 0, hSalida, mSalida, sSalida);

    // Calcular la diferencia en milisegundos
    let diferenciaMs = fechaSalida - fechaEntrada;

    // Asegurar que la salida es posterior a la entrada, considerando cambios de día
    if (diferenciaMs < 0) {
        // Si la salida es pasada la medianoche, ajustamos sumando 24 horas (un día completo)
        diferenciaMs += 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    }

    // Convertir la diferencia a horas y minutos
    const horas = Math.floor(diferenciaMs / (1000 * 60 * 60));
    const minutos = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60));

    // Formatear la diferencia como "hh:mm"
    return `${horas}h ${minutos}m`;
}

// Función para determinar si la entrada es "mañana" o "tarde"
function determinarTurno(entrada) {
    const [hEntrada] = entrada.split(':').map(Number); // Obtener la hora de entrada

    // Considerar "mañana" si la hora es antes de las 12:00 PM
    return hEntrada < 12 ? 'mañana' : 'tarde';
}

// Función para totalizar los turnos por nombre de empleado
function totalizarTurnos(registros) {
    // Objeto para almacenar los resultados agrupados por nombre de empleado
    const resultados = {};

    // Iterar sobre cada registro de fichaje
    registros[0].forEach(registro => {
        const nombre = registro.empleado_nombre;

        // Si el empleado aún no está en el objeto de resultados, inicializarlo
        if (!resultados[nombre]) {
            resultados[nombre] = {
                empleado_nombre: nombre,
                turnos_mañana: 0,
                turnos_tarde: 0,
                turnos_totales: 0
            };
        }

        // Contar los turnos según si son de mañana o tarde
        if (registro.turno === "mañana") {
            resultados[nombre].turnos_mañana++;
        } else if (registro.turno === "tarde") {
            resultados[nombre].turnos_tarde++;
        }

        // Incrementar el contador total de turnos
        resultados[nombre].turnos_totales++;
    });

    // Convertir el objeto de resultados en un array
    return Object.values(resultados);
}

// Función para calcular la distancia de Levenshtein entre dos cadenas
function levenshteinDistance(a, b) {
    // Crear una matriz bidimensional de tamaño (a.length + 1) x (b.length + 1)
    const matrix = Array(a.length + 1).fill(null).map(() =>
        Array(b.length + 1).fill(null)
    );

    // Inicializar la primera columna de la matriz con índices (0, 1, 2, ...)
    for (let i = 0; i <= a.length; i++) {
        matrix[i][0] = i; // Representa las eliminaciones necesarias para transformar 'a' en una cadena vacía
    }

    // Inicializar la primera fila de la matriz con índices (0, 1, 2, ...)
    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j; // Representa las inserciones necesarias para transformar una cadena vacía en 'b'
    }

    // Llenar la matriz con los cálculos de las distancias
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            // Si los caracteres actuales de 'a' y 'b' son iguales, el costo es 0; si no, es 1
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            // Calcular el valor mínimo entre inserción, eliminación y sustitución
            matrix[i][j] = Math.min(
                matrix[i][j - 1] + 1, // Inserción
                matrix[i - 1][j] + 1, // Eliminación
                matrix[i - 1][j - 1] + indicator // Sustitución
            );
        }
    }

    // La distancia de Levenshtein entre 'a' y 'b' es el valor en la esquina inferior derecha de la matriz
    return matrix[a.length][b.length];
}

// Función para buscar la coincidencia más cercana de un nombre en un array utilizando Levenshtein
function buscarCoincidencia(nombre, array) {
    // Iniciar con la primera coincidencia en el array
    let coincidenciaCercana = array[0];
    // Calcular la distancia mínima usando la primera coincidencia
    let distanciaMinima = levenshteinDistance(nombre.toLowerCase(), coincidenciaCercana.empleado_nombre.toLowerCase());

    // Recorrer el array desde el segundo elemento
    for (let i = 1; i < array.length; i++) {
        // Calcular la distancia de Levenshtein entre el nombre y el nombre actual en el array
        const distancia = levenshteinDistance(nombre.toLowerCase(), array[i].empleado_nombre.toLowerCase());
        // Si se encuentra una distancia menor, actualizar la coincidencia más cercana y la distancia mínima
        if (distancia < distanciaMinima) {
            coincidenciaCercana = array[i];
            distanciaMinima = distancia;
        }
    }

    // Retornar la coincidencia más cercana encontrada
    return coincidenciaCercana;
}

// Función para generar un array de resultados comparando turnos y fichajes
// Función para generar un array de resultados comparando turnos y fichajes
function generarResultados(arrayTurnos, arrayFichajes) {
    // Inicializar un array vacío para almacenar los resultados
    const resultados = [];

    // Recorrer cada turno en arrayTurnos
    arrayTurnos.forEach(turno => {
        // Buscar la coincidencia más cercana del nombre en arrayFichajes
        const coincidencia = buscarCoincidencia(turno.nombre, arrayFichajes);

        // Inicializar un array para almacenar los motivos de las discrepancias
        let motivos = [];

        // Comparar los valores de turnos entre el turno y la coincidencia encontrada
        const coincidente =
            turno.morningDays === coincidencia.turnos_mañana && // Comparar turnos de mañana
            turno.eveningDays === coincidencia.turnos_tarde &&   // Comparar turnos de tarde
            turno.totalDays === coincidencia.turnos_totales; // Comparar turnos totales

        // Revisar discrepancias y añadir los motivos con detalles específicos
        if (turno.morningDays !== coincidencia.turnos_mañana) {
            motivos.push(`MAÑANAS DISTINTAS, ${turno.morningDays} mañanas según turnos y ${coincidencia.turnos_mañana} mañanas según fichajes`);
        }
        if (turno.eveningDays !== coincidencia.turnos_tarde) {
            motivos.push(`TARDES DISTINTAS, ${turno.eveningDays} tardes según turnos y ${coincidencia.turnos_tarde} tardes según fichajes`);
        }
        if (turno.totalDays !== coincidencia.turnos_totales) {
            motivos.push(`TOTAL DISTINTAS, ${turno.totalDays} días totales según turnos y ${coincidencia.turnos_totales} días totales según fichajes`);
        }

        // Añadir el resultado al array con el nombre, estado de coincidencia y motivos detallados
        resultados.push({
            empleado_nombre: turno.nombre,
            coincidente: coincidente, // true si todos los valores coinciden, false en caso contrario
            motivo: motivos.join(', ') || 'COINCIDENTE' // Si coincidente es true, el motivo será "COINCIDENTE"
        });
    });

    // Retornar el array de resultados
    return resultados;
}

// Añade un evento al botón de exportar para generar y descargar un archivo Excel
document.getElementById('exportarExcel').addEventListener('click', exportToExcel);

// Función que exporta los datos de la tabla a un archivo Excel
function exportToExcel() {
    // Obtén los datos de la tabla
    const table = document.getElementById('totalesTabla');

    // Convierte la tabla HTML a un array de objetos
    const ws = XLSX.utils.table_to_sheet(table);

    // Crea un nuevo libro de trabajo
    const wb = XLSX.utils.book_new();

    // Añade la hoja al libro de trabajo
    XLSX.utils.book_append_sheet(wb, ws, 'Totales');

    // Genera el archivo Excel y dispara la descarga
    XLSX.writeFile(wb, 'totales_por_empleado.xlsx');
}

// Función para volver a la página anterior
function volverAtras() {
    window.history.back();
}
