// Añade un evento al formulario que se activa cuando se envía
document.getElementById('formularioSubida').addEventListener('submit', handleFileUpload);

// Variables para almacenar los datos de los archivos Excel
let festivosData, empleadosData, fichajesData, totalData;

// Función que maneja la subida y procesamiento de archivos cuando se envía el formulario
async function handleFileUpload(event) {
    // Previene el comportamiento por defecto del formulario (evita la recarga de la página)
    event.preventDefault();

    // Obtiene los archivos seleccionados por el usuario
    const festivosFile = document.getElementById('ficheroExcelFestivos').files[0];
    const empleadosFile = document.getElementById('ficheroExcelEmpleados').files[0];
    const fichajesFile = document.getElementById('ficheroExcelFichajes').files[0];
    const nominasFile = document.getElementById('ficheroExcelNominas').files[0];

    // Array para almacenar los datos procesados de los archivos
    const processedDataArray = [];

    // Verifica que los tres archivos hayan sido seleccionados antes de proceder
    if (festivosFile && empleadosFile && fichajesFile && nominasFile) {
        try {
            // Procesa los archivos Excel y almacena los resultados en el array
            festivosData = await readExcelFile(festivosFile, 'Festivos');
            processedDataArray.push(festivosData);

            empleadosData = await readExcelFile(empleadosFile, 'Empleados');
            processedDataArray.push(empleadosData);

            fichajesData = await readExcelFile(fichajesFile, 'Fichajes');
            processedDataArray.push(fichajesData);

            nominasData = await readExcelFile(nominasFile, 'Nominas');
            processedDataArray.push(nominasData);

            // Agrupa los datos de fichajes por empleado
            totalData = groupByEmployee(fichajesData);
            processedDataArray.push(totalData);

            // Compara fichajes con nóminas
            comparisonData = compareFichajesToNominas(totalData, nominasData);
            processedDataArray.push(comparisonData);

            // Muestra los datos procesados en la consola
            console.log('Datos procesados:', processedDataArray);

            // Muestra los datos en una tabla
            displayTotalsInTable(comparisonData);

            // Muestra la sección con resultados
            document.getElementById('resultados').style.display = 'block';
        } catch (error) {
            // Muestra un error si algo falla al procesar los archivos
            console.error('Error al procesar los archivos:', error);
        }
    } else {
        // Muestra una alerta si no se han seleccionado todos los archivos necesarios
        alert('Por favor, selecciona los cuatro archivos Excel.');
    }
}

// Función que lee un archivo Excel y lo convierte en datos JSON
function readExcelFile(file, tipoArchivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Evento que se ejecuta cuando se carga el archivo
        reader.onload = (e) => {
            try {
                // Convierte el archivo a un array de bytes
                const data = new Uint8Array(e.target.result);
                // Lee el archivo Excel y lo convierte en un workbook
                const workbook = XLSX.read(data, { type: 'array' });
                // Obtiene la primera hoja del workbook
                let sheetName = workbook.SheetNames[0];
                let worksheet = workbook.Sheets[sheetName];

                // Convierte la hoja a un array JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Procesa los datos según el tipo de archivo
                let processedData = [];
                if (tipoArchivo === 'Festivos') {
                    // Procesa fechas de festivos
                    const datesProcessedData = processExcelDates(jsonData);
                    processedData.push(convertToHolidaysArray(datesProcessedData));
                } else if (tipoArchivo === 'Empleados') {
                    // Procesa datos de empleados
                    processedData.push(convertToEmployeesArray(jsonData));

                    // Si existe una segunda hoja, la procesa también
                    if (workbook.SheetNames.length > 1) {
                        const additionalSheetName = workbook.SheetNames[1];
                        const additionalWorksheet = workbook.Sheets[additionalSheetName];
                        const additionalData = XLSX.utils.sheet_to_json(additionalWorksheet, { header: 1 });

                        processedData.push(convertToPricesArray(additionalData));
                    }
                } else if (tipoArchivo === 'Fichajes') {
                    // Procesa fichajes de empleados
                    const employeeData = calculatePlusForEmployee(jsonData);
                    processedData.push(employeeData);
                } else if (tipoArchivo === 'Nominas') {
                    // Procesa fichero de nóminas
                    const payrollData = processPayrollData(jsonData);
                    processedData.push(payrollData);
                }

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

// Función que convierte fechas de Excel a fechas de JavaScript
function processExcelDates(data) {
    return data.map(row =>
        row.map(cell => isExcelDate(cell) ? excelDateToJSDate(cell) : cell)
    );
}

// Verifica si un valor es una fecha en formato de Excel
function isExcelDate(value) {
    return typeof value === 'number' && value > 40000 && value < 60000;
}

// Convierte una fecha en formato Excel a un objeto Date de JavaScript
function excelDateToJSDate(excelDate) {
    return new Date((excelDate - 25569) * 86400 * 1000);
}

// Función genérica para convertir un array plano a un array de objetos estructurados
function convertToStructuredArray(rawArray, keys) {
    const structuredArray = [];

    for (let i = 1; i < rawArray.length; i++) {
        const row = rawArray[i];
        const entry = {};

        keys.forEach((key, index) => {
            entry[key] = row[index];
        });

        structuredArray.push(entry);
    }

    return structuredArray;
}

// Convierte datos de festivos a un array estructurado
function convertToHolidaysArray(rawArray) {
    return convertToStructuredArray(rawArray, ['festivo']);
}

// Convierte datos de empleados a un array estructurado
function convertToEmployeesArray(rawArray) {
    return convertToStructuredArray(rawArray, ['empleado', 'categoria']);
}

// Convierte datos de precios a un array estructurado
function convertToPricesArray(rawArray) {
    return convertToStructuredArray(rawArray, ['categoriaProfesional', 'turno', 'noche']);
}

// Extrae datos de asistencia de un array de datos de fichajes
function extractEmployeeData(data) {
    const results = [];
    let currentEmployee = null;
    let currentZone = null;
    let currentShift = null;

    for (let i = 0; i < data.length; i++) {
        if (data[i].includes("PRESENCIAS X EMPLEADO/ZONA/TURNO")) {
            // Reinicia los valores actuales para cada bloque
            currentEmployee = null;
            currentZone = null;
            currentShift = null;
        }

        if (data[i].length === 1 && typeof data[i][0] === 'string' && data[i][0] !== "PRESENCIAS X EMPLEADO/ZONA/TURNO") {
            currentEmployee = data[i][0];
        }

        if (data[i].includes("ZONA")) {
            currentZone = data[i + 1][0];  // Zona
            currentShift = data[i + 1][3]; // Turno
            i++; // Saltar al siguiente índice que ya se utilizó
        }

        if (data[i].includes("FECHA")) {
            let j = i + 1;
            while (j < data.length && data[j].length > 0) {
                const [fecha, , entrada, , salida] = data[j];
                results.push({
                    employee: currentEmployee,
                    zone: currentZone,
                    shift: currentShift,
                    date: excelDateToJSDate(fecha),
                    entryTime: entrada,
                    exitTime: salida
                });
                j++;
            }
            i = j - 1; // Ajustar índice
        }
    }

    return results;
}

// Verifica si una fecha es fin de semana o festivo
function isWeekendOrHoliday(currentDate, festivos) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Bucle manual para verificar si la fecha es festivo
    let isHoliday = false; // Inicializamos como false
    for (let i = 0; i < festivos[0].length; i++) {
        if (festivos[0][i].festivo.toISOString() === currentDate.toISOString()) {
            isHoliday = true; // Si encontramos una coincidencia, lo marcamos como festivo
            break; // Salimos del bucle porque ya encontramos lo que buscábamos
        }
    }

    return isWeekend || isHoliday;
}

// Calcula el plus de turnicidad según el turno y si es un día especial
function calculateShiftPlus(shift, isSpecialDay) {
    if (!isSpecialDay) return 0;
    switch (shift) {
        case 'MAÑANA':
            return 8;
        case 'TARDE':
            return 7;
        case 'NOCHE':
            return 9;
        default:
            return 0;
    }
}

// Calcula el plus de nocturnidad según el turno
function calculateNightPlus(shift, employeeCategory) {
    const allowedCategories = ['OFICIAL 2 MANTENIMIENTO', 'ENCARGADO/A'];
    if (!allowedCategories.includes(employeeCategory)) return 0;
    switch (shift) {
        case 'NOCHE':
            return 9;
        default:
            return 0;
    }
}

// Obtiene el multiplicador del turno para una categoría profesional
function getShiftMultiplier(employeeCategory, categoryData) {
    const category = categoryData.find(item => item.categoriaProfesional === employeeCategory);
    if (category) {
        return category.turno;
    } else {
        throw new Error('Categoría profesional no encontrada en los datos.');
    }
}

// Obtiene el multiplicador del turno para una categoría profesional
function getNightMultiplier(employeeCategory, categoryData) {
    const category = categoryData.find(item => item.categoriaProfesional === employeeCategory);
    if (category) {
        return category.noche;
    } else {
        throw new Error('Categoría profesional no encontrada en los datos.');
    }
}

// Encuentra la categoría de un empleado dado su nombre
function findEmployeeCategory(employeeName) {
    const employee = empleadosData[0].find(item => item.empleado === employeeName);
    if (employee) {
        return employee.categoria;
    } else {
        throw new Error('Empleado no encontrado en los datos.');
    }
}

// Calcula el plus para cada empleado basado en su turno y si es un día especial
function calculatePlusForEmployee(data) {
    const extractedData = extractEmployeeData(data);
    return extractedData.map(record => {
        const categoryData = empleadosData[1];
        const employeeCategory = findEmployeeCategory(record.employee);
        const shiftMultiplier = getShiftMultiplier(employeeCategory, categoryData);
        const nightMultiplier = getNightMultiplier(employeeCategory, categoryData)

        const isSpecialDay = isWeekendOrHoliday(record.date, festivosData);
        const shiftPlusHours = calculateShiftPlus(record.shift, isSpecialDay);
        const shiftAmmount = shiftPlusHours * shiftMultiplier;
        const nightPlusHours = calculateNightPlus(record.shift, employeeCategory);
        const nightAmmount = nightPlusHours * nightMultiplier;

        return {
            ...record,
            isSpecialDay,
            shiftPlusHours,
            shiftAmmount,
            nightPlusHours,
            nightAmmount
        };
    });
}

// Función para agrupar datos por empleado y calcular los totales
function groupByEmployee(data) {
    return data[0].reduce((acc, item) => {
        // Si el empleado aún no está en el acumulador, añádelo con valores iniciales
        if (!acc[item.employee]) {
            acc[item.employee] = {
                shiftPlusHours: 0,
                shiftAmmount: 0,
                nightPlusHours: 0,
                nightAmmount: 0
            };
        }

        // Acumula los totales para el empleado actual
        acc[item.employee].shiftPlusHours += item.shiftPlusHours;
        acc[item.employee].shiftAmmount += item.shiftAmmount;
        acc[item.employee].nightPlusHours += item.nightPlusHours;
        acc[item.employee].nightAmmount += item.nightAmmount;

        return acc;
    }, {});
}

// Muestra los datos agrupados en una tabla HTML
function displayTotalsInTable(totals) {
    const tableBody = document.querySelector('#totalesTabla tbody');
    tableBody.innerHTML = ''; // Limpiar contenido anterior

    // Recorre los datos totales y crea una fila por empleado
    for (const empleado of totals) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empleado.nombreEmpleado}</td>
            <td>${Math.floor(empleado.nightPlusHours)}</td>
            <td>${formatCurrency(empleado.nightAmmount)}</td>
            <td>${Math.floor(empleado.shiftPlusHours)}</td>
            <td>${formatCurrency(empleado.shiftAmmount)}</td>
            <td>${Math.floor(empleado.nightPlusHoursPayroll)}</td>
            <td>${formatCurrency(empleado.nightAmmountPayroll)}</td>
            <td>${Math.floor(empleado.shiftPlusHoursPayroll)}</td>
            <td>${formatCurrency(empleado.shiftAmmountPayroll)}</td>
            <td class="${empleado.coincidente ? 'coincidente-true' : 'coincidente-false'}">${empleado.coincidente ? 'OK' : 'KO'}</td>
            <td>${empleado.motivo}</td>
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

// Función que procesa los datos del fichero de nóminas
function processPayrollData(data) {
    const resultado = [];

    // Iterar desde la tercera fila (índice 2)
    for (let i = 2; i < data.length; i++) {
        const fila = data[i];

        // Agregar una entrada al objeto resultado con el nombre del empleado como clave
        resultado[fila[0]] = {
            shiftPlusHoursPayroll: fila[3],  // Columna para turnicidad
            shiftAmmountPayroll: fila[4],    // Importe para turnicidad
            nightPlusHoursPayroll: fila[1],  // Columna para nocturnidad
            nightAmmountPayroll: fila[2]     // Importe para nocturnidad
        };
    }

    return resultado;
}

// Función para calcular la similitud entre dos cadenas
function similar(a, b) {
    const lengthA = a.length;
    const lengthB = b.length;
    const maxLength = Math.max(lengthA, lengthB);
    const distance = levenshteinDistance(a, b); // Función que calcula la distancia de Levenshtein
    return (maxLength - distance) / maxLength; // Devuelve un valor entre 0 y 1
}

// Función de distancia de Levenshtein
function levenshteinDistance(s1, s2) {
    const dp = Array.from({ length: s1.length + 1 }, (_, i) => Array(s2.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]; // Sin costo
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1, // Eliminación
                    dp[i][j - 1] + 1, // Inserción
                    dp[i - 1][j - 1] + 1 // Sustitución
                );
            }
        }
    }

    return dp[s1.length][s2.length];
}

// Función que fusiona los datos de los arrays de fichajes con los de nóminas
function compareFichajesToNominas(totalData, nominasData) {
    const resultado = Object.keys(totalData).map(key => {
        // Encontrar la clave más parecida en nominasData
        const similarKey = Object.keys(nominasData[0]).reduce((closest, current) => {
            return similar(key, current) > similar(key, closest) ? current : closest;
        }, Object.keys(nominasData[0])[0]);

        let coincidente, motivo;

        if (totalData[key].nightPlusHours === nominasData[0][similarKey].nightPlusHoursPayroll
            && totalData[key].shiftPlusHours === nominasData[0][similarKey].shiftPlusHoursPayroll) {
            coincidente = true;
            motivo = 'FICHAJES Y NÓMINAS COINCIDEN';
        } else {
            coincidente = false;
            motivo = '';

            if (totalData[key].nightPlusHours != nominasData[0][similarKey].nightPlusHoursPayroll) {
                motivo = motivo + `HORAS PLUS NOCHE SEGÚN FICHAJES (${totalData[key].nightPlusHours}) | HORAS PLUS NOCHE SEGÚN NÓMINAS (${nominasData[0][similarKey].nightPlusHoursPayroll})`
            }
            if (totalData[key].shiftPlusHours != nominasData[0][similarKey].shiftPlusHoursPayroll) {
                if (motivo != '') {
                    motivo = motivo + '<br/>';
                }
                motivo = motivo + `HORAS PLUS TURNOS SEGÚN FICHAJES (${totalData[key].shiftPlusHours}) | HORAS PLUS TURNOS SEGÚN NÓMINAS (${nominasData[0][similarKey].shiftPlusHoursPayroll})`
            }
        }

        return {
            nombreEmpleado: key,       // La clave del elemento
            ...totalData[key],         // Datos del primer array
            ...nominasData[0][similarKey], // Datos del segundo array usando la clave más parecida
            coincidente: coincidente,
            motivo: motivo
        };
    });

    return resultado;
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
