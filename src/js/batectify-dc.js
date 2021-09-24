function getUnsupportedKeys(parent, supportedKeys, providedKeys) {
    let unsupportedKeys = providedKeys.filter(function (key) {
        return !supportedKeys.includes(key);
    });
    return unsupportedKeys.map(function(key) { return {parent, key} });
}

function dockerComposeToBatect(dc) {
    let warnings = {
        unsupportedKeys: [],
        conflictingValues: [],
        missingMappings: [],
        unsupportedValues: [],
    };
    let supportedRootKeys = ["version", "services"];
    let providedRootKeys = Object.keys(dc);
    warnings.unsupportedKeys.push(...getUnsupportedKeys("root", supportedRootKeys, providedRootKeys));
    let batectConfig = {
        "containers": {},
        "tasks": {},
    };
    Object.keys(dc["services"]).forEach(function (serviceName) {
        let container = dcServiceToBatect(serviceName, dc["services"][serviceName], warnings);
        if (container) {
            batectConfig["containers"][serviceName] = container;
        }
    });
    return { config: batectConfig, warnings };
}

function dcServiceToBatect(name, dcs, warnings) {
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
    warnings.unsupportedKeys.push(...getUnsupportedKeys("service " + name, supportedKeys, providedKeys));
    let container = {};
    supportedKeys.forEach(function (key) {
        if (!dcs[key]) {
            return;
        }
        if (Object.keys(simpleKeyMapping).includes(key)) {
            container = Object.assign(container, mapDcKeyToBatect(simpleKeyMapping, key, name, dcs, warnings));
        } else {
            switch (key) {
                case "build":
                    container = Object.assign(container, dcBuildToBatect(dcs, key, name, warnings));
                    break;
                case "image":
                    if (dcs["build"]) {
                        warnings.conflictingValues.push({ type: 'service', service: name, key: 'build', msg: "Both 'build' and 'image' are specified. 'image' will be dropped."});
                    } else {
                        container["image"] = dcs[key];
                    }
                    break;
                case "command":
                    container["command"] = dcCommandToBatect(dcs, key, warnings);
                    break;
                case "environment":
                    container["environment"] = dcEnvironmentToBatect(dcs, key, warnings);
                    break;
                case "healthcheck":
                    container["health_check"] = dcHealthcheckToBatect(dcs, key, name, warnings);
                    break;
                case "volumes":
                    container["volumes"] = dcVolumeArrayToBatect(dcs, key, name, warnings);
                    break;
                case "expose":
                    warnings.unsupportedKeys.push({ type: 'service', service: name, key, msg: "'expose' has no equivalent in batect as all container ports are networked internally" });
                    break;
                case "ports":
                    container["ports"] = dcPortArrayToBatect(dcs, name, warnings);
                    break;
                default:
                    warnings.missingMappings.push({ type: 'service', key, msg: "Key has no mapping logic. This is a bug." });
            }
        }
    });
    return container;
}

function mapDcKeyToBatect(simpleKeyMapping, key, serviceName, dcs, warnings) {
    let container = {};
    let newKey = simpleKeyMapping[key];
    container[newKey] = dcs[key];
    return container;
}

function generateNameForBatectVolume(serviceName, path) {
    let name = serviceName + "_" + path.replace(/\//g, '_').slice(0, 255);
    return name;
}

function dcVolumeStringToBatect(volumeString, serviceName, warnings) {
    let bits = volumeString.split(':');
    let bitsNum = bits.length;
    switch(bitsNum) {
        case 1:
            // TARGET-only, maps to a cache volume
            return ({
                "name": generateNameForBatectVolume(serviceName, bits[0]),
                "type": "cache",
                "container": bits[0],
            })
        case 2:
        case 3:
            if (bits[0].indexOf('/') === -1) {
                // Named volume, maps to a cache volume
                let volume = {
                    "name": bits[0],
                    "type": "cache",
                    "container": bits[1]
                };
                if (bitsNum === 3) {
                    volume.options = bits[2];
                }
                return volume;
            }
            if (bitsNum === 2 & bits[1].indexOf('/') === -1) {
                // TARGET-only, maps to a cache volume
                return ({
                    "name": generateNameForBatectVolume(serviceName, bits[0]),
                    "type": "cache",
                    "container": bits[0],
                    "options": bits[1],
                });
            }
            // Should map directly to batect string format
            return volumeString;
        default:
            throw("Unable to parse volume, unexpected syntax");
    }
}

function dcVolumeToBatect(vol, serviceName, warnings) {
    if (typeof (vol) === "string") {
        return dcVolumeStringToBatect(vol, serviceName, warnings);
    } else {
        let volumeSupportedKeys = ["type", "source", "target", "read_only"];
        let volumeProvidedKeys = Object.keys(vol);
        warnings.unsupportedKeys.push(...getUnsupportedKeys("service " + serviceName + " volume", volumeSupportedKeys, volumeProvidedKeys));
        switch (vol["type"]) {
            case "volume":
                batectVolume = {
                    "type": "cache",
                    "container": vol["target"],
                };
                if (vol["source"]) {
                    // For volume type, this is the name of a volume defined in the top-level volumes key
                    batectVolume["name"] = vol["source"];
                } else {
                    batectVolume["name"] = generateNameForBatectVolume(serviceName, vol["target"]);
                }
                if (vol["read_only"] && vol["read_only"] === true) {
                    batectVolume["options"] = "ro";
                }
                return batectVolume;
            case "bind":
                batectVolume = {
                    "local": vol["source"],
                    "container": vol["target"]
                };
                if (vol["read_only"] && vol["read_only"] === true) {
                    batectVolume["options"] = "ro";
                }
                return batectVolume;
            default:
                warnings.unsupportedValues.push({ type: 'volume', service: serviceName, key: "type", value: vol["type"] });
                return;
        }
    }
}

function dcBuildToBatect(dcs, key, serviceName, warnings) {
    let container = {};
    if (typeof (dcs[key]) === "string") {
        container["build_directory"] = dcs[key];
    } else {
        let buildSupportedKeys = ["context", "dockerfile", "args"];
        let buildProvidedKeys = Object.keys(dcs[key]);
        warnings.unsupportedKeys.push(...getUnsupportedKeys("service " + serviceName + " build", buildSupportedKeys, buildProvidedKeys));
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

function dcCommandToBatect(dcs, key, warnings) {
    if (typeof (dcs[key]) === "object") {
        return dcs[key].join(" ");
    } else {
        return dcs[key];
    }
}

function dcEnvironmentToBatect(dcs, key, warnings) {
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

function dcHealthcheckToBatect(dcs, key, serviceName, warnings) {
    let healthcheck = {};
    let healthcheckSupportedKeys = ["interval", "retries", "start_period"];
    let healthcheckProvidedKeys = Object.keys(dcs[key]);
    warnings.unsupportedKeys.push(...getUnsupportedKeys("service " + serviceName + " healthcheck", healthcheckSupportedKeys, healthcheckProvidedKeys));
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

function dcVolumeArrayToBatect(dcs, key, serviceName, warnings) {
    let volumes = [];
    dcs[key].forEach(function (vol) {
        let volume = dcVolumeToBatect(vol, serviceName, warnings);
        if (volume) {
            volumes.push(volume);
        }
    });
    return volumes;
}

function dcPortToBatect(port, serviceName, warnings) {
    if (typeof(port) === "object") {
        let supportedPortKeys = ["target", "published", "protocol"];
        let providedPortKeys = Object.keys(port);
        warnings.unsupportedKeys.push(...getUnsupportedKeys("service " + serviceName, supportedPortKeys, providedPortKeys));
        if (port["protocol"] && port["protocol"] !== "tcp") {
            warnings.unsupportedValues.push({ type: "port", service: serviceName, key: "protocol", value: port["protocol"], msg: "batect only supports TCP ports" });
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
        if (port.toString().indexOf(':') === -1) {
            warnings.unsupportedValues.push({ type: "port", service: serviceName, key: "port", value: port, msg: "specifying just a container port is not supported. this is generally not needed as batect networks all container ports internally regardless." });
            return;
        }
        if (port.toString().match(/\/udp/)) {
            warnings.unsupportedValues.push({ type: "port", service: serviceName, key: "port", value: port, msg: "UDP ports unsupported. batect only supports TCP ports" });
            return;
        }
        return port.toString();
    }
}

function dcPortArrayToBatect(dcs, serviceName, warnings) {
    let ports = [];
    if (dcs["expose"]) {
        dcs["expose"].forEach(function(port) {
            let batectPort = dcPortToBatect(port, serviceName, warnings);
            if (batectPort) {
                ports.push(batectPort);
            }
        })
    }
    if (dcs["ports"]) {
        dcs["ports"].forEach(function(port) {
           let batectPort = dcPortToBatect(port, serviceName, warnings);
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
