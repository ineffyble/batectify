function displayCard(type, heading, message) {
    let card = document.createElement("div");
    card.classList.add("card", type);
    let header = document.createElement("h3");
    header.textContent = heading;
    let body = document.createElement("p");
    body.textContent = message;
    card.appendChild(header);
    card.appendChild(body);
    errorBox.appendChild(card);
}

function warnOnUnsupportedKeys(parent, supportedKeys, providedKeys) {
    let unsupportedKeys = providedKeys.filter(function (key) {
        return !supportedKeys.includes(key);
    });
    unsupportedKeys.forEach(function (key) {
        let heading = "Unsupported " + parent + " key";
        let message = "The key '" + key + "' under '" + parent + "' was not recognised or not is not supported by batect.";
        displayCard("warning", heading, message);
    });
}

function convert() {
    errorBox.innerHTML = "";
    let input = inputField.value;
    try {
        let source = jsyaml.load(input);
        let converted = dockerComposeToBatect(source);
        let valid = validateBatectConfig(converted);
        if (!valid) {
            validateBatectConfig.errors.forEach(function(error) {
                displayCard("warning", "batect.yml output failed validation", error.dataPath + ": " + error.message);
            });
        }
        let output = jsyaml.dump(converted, { lineWidth: -1 });
        outputField.value = output;
    } catch (error) {
        displayCard("error", "Parsing Error", error.message);
    }
}

let convertButton = document.querySelector("#convert");
let inputField = document.querySelector("#input");
let outputField = document.querySelector("#output");
let errorBox = document.querySelector("#error");

let ajv = new Ajv();
let validateBatectConfig = ajv.compile(batectSchema);

convertButton.addEventListener("click", convert);
