var enlace_impresora = document.getElementById("enlace_impresora");

enlace_impresora.addEventListener("click", function (event) {
    event.preventDefault();

    var url = new URL(window.location.href);
    var parametros = new URLSearchParams(url.search);

    if (parametros.has("?print-pdf")) {
        parametros.delete("?print-pdf");
    } else {
        parametros.set("?print-pdf", "");
    }

    url.search = parametros.toString();
    window.location.href = url.toString();
});