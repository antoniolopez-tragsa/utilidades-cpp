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

    // Array para almacenar los datos procesados de los archivos
    const processedDataArray = [];

    // Verifica que los tres archivos hayan sido seleccionados antes de proceder
    if (festivosFile && personalFile) {
        try {
            // Procesa los archivos PDF y almacena los resultados en el array
            fichajesData = await readPDFFile(fichajesFile, 'Fichajes');
            processedDataArray.push(fichajesData);

            personalData = await readPDFFile(personalFile, 'Personal');
            processedDataArray.push(empleadosData);

            // Agrupa los datos de fichajes por empleado
            totalData = groupByEmployee(fichajesData);
            processedDataArray.push(totalData);

            // Muestra los datos procesados en la consola
            console.log('Datos procesados:', processedDataArray);

            // Muestra los datos en una tabla
            displayTotalsInTable(totalData);

            // Muestra la sección con resultados
            document.getElementById('resultados').style.display = 'block';
        } catch (error) {
            // Muestra un error si algo falla al procesar los archivos
            console.error('Error al procesar los archivos:', error);
        }
    } else {
        // Muestra una alerta si no se han seleccionado todos los archivos necesarios
        alert('Por favor, selecciona los tres archivos Excel.');
    }
}

// Función que lee un archivo PDF y lo convierte en datos JSON
function readPDFFile(file, tipoArchivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Evento que se ejecuta cuando se carga el archivo
        reader.onload = (e) => {
            try {
                

                // Resuelve la promesa con los datos procesados
                resolve(processedData);
            } catch (error) {
                // Rechaza la promesa en caso de error
                reject('Error al procesar el archivo:', error);
            }
        };

        // Lee el archivo como un ArrayBuffer para poder procesarlo
        reader.readAsArrayBuffer(file);
    });
}

// Muestra los datos agrupados en una tabla HTML
function displayTotalsInTable(totals) {
    const tableBody = document.querySelector('#totalesTabla tbody');
    tableBody.innerHTML = ''; // Limpiar contenido anterior

    // Recorre los datos totales y crea una fila por empleado
    for (const [empleado, data] of Object.entries(totals)) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empleado}</td>
            <td>${formatCurrency(data.morningPlusAmmount)}</td>
            <td>${formatCurrency(data.eveningPlusAmmount)}</td>
            <td>${formatCurrency(data.morningPlusAmmount + data.eveningPlusAmmount)}</td>
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
