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

function warnOnUnsupportedKeys(unsupportedKeys) {
    for (let uk of unsupportedKeys) {
        const { parent, key } = uk;
        let heading = "Unsupported " + parent + " key";
        let message = "The key '" + key + "' under '" + parent + "' was not recognised or not is not supported by batect.";
        displayCard("warning", heading, message);
    }
}

function warnOnConflictingValues(conflictingValues) {
    for (let cv of conflictingValues) {
        const { type, service, key, msg } = cv;
        let heading = "Conflicting value " + key + " under " + type + " " + service;
        let message = msg;
        displayCard("warning", heading, message);
    }
}

function warnOnMissingMappings(missingMappings) {
    for (let mm of missingMappings) {
        const { type, key, msg } = mm;
        let heading = "Missing mapping for " + type + " under " + key;
        let message = msg;
        displayCard("warning", heading, message);
    }
}

function warnOnUnsupportedValues(unsupportedValues) {
    for (let uv of unsupportedValues) {
        const { type, service, key, value, msg } = uv;
        let heading = "Unsupported value " + value + " for key " + key + " of " + type + " under service " + service;;
        let message = msg ? msg : "This value is not supported.";
        displayCard("warning", heading, message);
    }
}

function showWarnings({ unsupportedKeys, conflictingValues, missingMappings, unsupportedValues }) {
    warnOnUnsupportedKeys(unsupportedKeys);
    warnOnConflictingValues(conflictingValues);
    warnOnMissingMappings(missingMappings);
    warnOnUnsupportedValues(unsupportedValues);
}

function convert() {
    errorBox.innerHTML = "";
    let input = inputField.value;
    try {
        let source = jsyaml.load(input);
        let results = dockerComposeToBatect(source);
        let converted = results.config;
        showWarnings(results.warnings);
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
