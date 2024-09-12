// Añade un evento al formulario que se activa cuando se envía
document.getElementById('formularioSubida').addEventListener('submit', handleFileUpload);

// Variables para almacenar los datos de los archivos Excel
let fichajesData, personalData, totalData;

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

            // Muestra los datos procesados en la consola
            console.log('Datos procesados:', processedDataArray);

            // Muestra los datos en una tabla
            displayTotalsInTable(processedDataArray[1]);

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
            if (nombre && dias >= 0 && mananas >= 0 && tardes >= 0) {
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
        return name;
    }

    // Divide el nombre en apellido y nombre
    const apellido = name.substring(0, commaIndex).trim();
    const nombre = name.substring(commaIndex + 1).trim();

    // Reuniéndolos en el formato deseado
    const text = `${nombre} ${apellido}`;
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
            salida: salida
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
    for (empleado of totals) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empleado.nombre}</td>
            <td>${empleado.morningDays}</td>
            <td>${empleado.eveningDays}</td>
            <td>${empleado.totalDays}</td>
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
