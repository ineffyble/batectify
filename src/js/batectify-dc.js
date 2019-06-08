function dockerComposeToBatect(dc) {
    let supportedRootKeys = ["version", "services"];
    let providedRootKeys = Object.keys(dc);
    warnOnUnsupportedKeys("root", supportedRootKeys, providedRootKeys);
    let batectConfig = {
        "containers": {},
        "tasks": {},
    };
    Object.keys(dc["services"]).forEach(function (serviceName) {
        let container = dcServiceToBatect(serviceName, dc["services"][serviceName]);
        if (container) {
            batectConfig["containers"][serviceName] = container;
        }
    });
    return batectConfig;
}

function dcServiceToBatect(name, dcs) {
    let supportedKeys = [
        "build", "cap_add", "cap_drop", "command", "depends_on", "environment",
        "expose", "healthcheck", "image", "ports", "privileged", "init", "volumes", "working_dir"
    ];
    let simpleKeyMapping = {
        "cap_add": "capabilities_to_add",
        "cap_drop": "capabilities_to_drop",
        "depends_on": "dependencies",
        "privileged": "privileged",
        "init": "enable_init_process",
        "working_dir": "working_directory"
    };
    let providedKeys = Object.keys(dcs);
    warnOnUnsupportedKeys("service " + name, supportedKeys, providedKeys);
    let container = {};
    supportedKeys.forEach(function (key) {
        if (!dcs[key]) {
            return;
        }
        if (Object.keys(simpleKeyMapping).includes(key)) {
            container = Object.assign(container, mapDcKeyToBatect(simpleKeyMapping, key, name, dcs));
        } else {
            switch (key) {
                case "build":
                    container = Object.assign(container, dcBuildToBatect(dcs, key, name));
                    break;
                case "image":
                    if (dcs["build"]) {
                        displayCard("warning", "Conflicting values for service " + name, "Both 'build' and 'image' are specified. 'image' will be dropped.");
                    } else {
                        container["image"] = dcs[key];
                    }
                    break;
                case "command":
                    container["command"] = dcCommandToBatect(dcs, key);
                    break;
                case "environment":
                    container["environment"] = dcEnvironmentToBatect(dcs, key);
                    break;
                case "healthcheck":
                    container["health_check"] = dcHealthcheckToBatect(dcs, key, name);
                    break;
                case "volumes":
                    container["volumes"] = dcVolumeArrayToBatect(dcs, key, name);
                    break;
                case "expose":
                case "ports":
                    container["ports"] = dcPortArrayToBatect(dcs, name);
                    break;
                default:
                    displayCard("error", "Supported key " + key + " has no mapping logic", "This is a bug");
            }
        }
    });
    return container;
}

function mapDcKeyToBatect(simpleKeyMapping, key, serviceName, dcs) {
    let container = {};
    let newKey = simpleKeyMapping[key];
    container[newKey] = dcs[key];
    return container;
}

function dcVolumeToBatect(vol, serviceName) {
    if (typeof (vol) === "string") {
        return (vol);
    } else {
        let volumeSupportedKeys = ["type", "source", "target"];
        let volumeProvidedKeys = Object.keys(vol);
        warnOnUnsupportedKeys("service " + serviceName + " volume", volumeSupportedKeys, volumeProvidedKeys);
        if ((vol["type"]) && (vol["type"] !== "volume")) {
            displayCard("warning", "Unsupported volume type " + vol["type"], "This volume type specified for service " + serviceName + " is not supported.");
            return;
        }
        return ({
            "local": vol["source"],
            "container": vol["target"]
        });
    }
}

function dcBuildToBatect(dcs, key, serviceName) {
    let container = {};
    if (typeof (dcs[key]) === "string") {
        container["build_directory"] = dcs[key];
    } else {
        let buildSupportedKeys = ["context", "dockerfile", "args"];
        let buildProvidedKeys = Object.keys(dcs[key]);
        warnOnUnsupportedKeys("service " + serviceName + " build", buildSupportedKeys, buildProvidedKeys);
        container["build_directory"] = dcs[key]["context"];
        if (dcs[key]["dockerfile"]) {
            container["dockerfile"] = dcs[key]["dockerfile"];
        }
        if (dcs[key]["args"]) {
            container["build_args"] = dcs[key]["args"];
        }
    }
    return container;
}

function dcCommandToBatect(dcs, key) {
    if (typeof (dcs[key]) === "object") {
        return dcs[key].join(" ");
    } else {
        return dcs[key];
    }
}

function dcEnvironmentToBatect(dcs, key) {
    let environment = {};
    if (Array.isArray(dcs[key])) {
        dcs[key].forEach(function (env) {
            let parts = env.split("=");
            let envKey = parts[0];
            if (parts.length === 1) {
                // docker-compose allows implicit passing through an environment variable from host, batect does not
                environment[envKey] = "$" + envKey
            } else {
                let envValue = parts[1];
                environment[envKey] = envValue;
            }
        });
    } else {
        environment = dcs[key];
    }
    return environment;
}

function dcHealthcheckToBatect(dcs, key, serviceName) {
    let healthcheck = {};
    let healthcheckSupportedKeys = ["interval", "retries", "start_period"];
    let healthcheckProvidedKeys = Object.keys(dcs[key]);
    warnOnUnsupportedKeys("service " + serviceName + " healthcheck", healthcheckSupportedKeys, healthcheckProvidedKeys);
    if (dcs[key]["interval"]) {
        healthcheck["interval"] = dcs[key]["interval"];
    }
    if (dcs[key]["retries"]) {
        healthcheck["retries"] = dcs[key]["retries"];
    }
    if (dcs[key]["start_period"]) {
        healthcheck["start_period"] = dcs[key]["start_period"];
    }
    return healthcheck;
}

function dcVolumeArrayToBatect(dcs, key, serviceName) {
    let volumes = [];
    dcs[key].forEach(function (vol) {
        let volume = dcVolumeToBatect(vol, serviceName);
        if (volume) {
            volumes.push(volume);
        }
    });
    return volumes;
}

function dcPortToBatect(port, serviceName) {
    if (typeof(port) === "object") {
        let supportedPortKeys = ["target", "published", "protocol"];
        let providedPortKeys = Object.keys(port);
        warnOnUnsupportedKeys("service " + serviceName, supportedPortKeys, providedPortKeys);
        if (port["protocol"] && port["protocol"] !== "tcp") {
            displayCard("warning", "service " + serviceName + " - " + port["protocol"] + " ports unsupported", "batect only supports TCP ports");
            return;
        }
        let batectPort = {};
        if (port["published"]) {
            batectPort["local"] = port["published"];
        }
        if (port["target"]) {
            batectPort["container"] = port["target"]
        }
        return batectPort;
    } else {
        if (port.match(/\/udp/)) {
            displayCard("warning", "service " + serviceName + " - UDP ports unsupported", "batect only supports TCP ports");
            return;
        }
        return port;
    }
}

function dcPortArrayToBatect(dcs, serviceName) {
    let ports = [];
    if (dcs["expose"]) {
        dcs["expose"].forEach(function(port) {
            let batectPort = dcPortToBatect(port, serviceName);
            if (batectPort) {
                ports.push(batectPort);
            }
        })
    }
    if (dcs["ports"]) {
        dcs["ports"].forEach(function(port) {
           let batectPort = dcPortToBatect(port, serviceName);
           if (batectPort) {
               ports.push(batectPort);
           }
        });
    }
    return ports;
}

// Export node module.
if ( typeof module !== 'undefined' && module.hasOwnProperty('exports') )
{
    module.exports = {
        dockerComposeToBatect,
        dcServiceToBatect,
        mapDcKeyToBatect,
        dcVolumeToBatect,
        dcBuildToBatect,
        dcCommandToBatect,
        dcEnvironmentToBatect,
        dcHealthcheckToBatect,
        dcVolumeArrayToBatect,
        dcPortToBatect,
        dcPortArrayToBatect,
    };
}
