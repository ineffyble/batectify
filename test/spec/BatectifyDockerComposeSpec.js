let warnings;

beforeEach(function () {
    warnings = {
        unsupportedKeys: [],
        conflictingValues: [],
        missingMappings: [],
        unsupportedValues: [],
    };
});

describe("dcEnvironmentToBatect", function () {
    it("should pass an object through without conversion", function () {
        let input = {
            "environment": {
                "ENVIRONMENT": "dev",
                "beep": "boop",
            },
        };
        let result = dcEnvironmentToBatect(input, "environment", warnings);
        expect(result).toEqual(input["environment"]);
    });

    it("should convert an array to an object", function () {
        let input = {
            "environment": [
                "ENVIRONMENT=dev",
                "beep=boop"
            ],
        };
        let expected = {
            "ENVIRONMENT": "dev",
            "beep": "boop"
        };
        let result = dcEnvironmentToBatect(input, "environment", warnings);
        expect(result).toEqual(expected);
    });

    it("should convert environment variables passed implicitly to explicit", function () {
        let input = {
            "environment": [
                "ENVIRONMENT",
                "beep=boop"
            ],
        };
        let expected = {
            "ENVIRONMENT": "$ENVIRONMENT",
            "beep": "boop"
        };
        let result = dcEnvironmentToBatect(input, "environment", warnings);
        expect(result).toEqual(expected);
    });
});

describe("dcCommandToBatect", function () {
    it("should pass a string through without conversion", function () {
        let input = {
            "command": "/bin/bash ls",
        };
        let result = dcCommandToBatect(input, "command", warnings);
        expect(result).toEqual(input["command"]);
    });

    it("should convert a command array to a space-joined string", function () {
        let input = {
            "command": [
                "/bin/bash",
                "ls"
            ],
        };
        let expected = "/bin/bash ls";
        let result = dcCommandToBatect(input, "command", warnings);
        expect(result).toEqual(expected);
    });
});

describe("dcHealthcheckToBatect", function () {

    it("should pass through supported parameters", function () {
        let input = {
            "healthcheck": {
                "interval": "5s",
                "retries": "5",
            },
        };
        let result = dcHealthcheckToBatect(input, "healthcheck", "service", warnings);
        expect(result).toEqual(input["healthcheck"]);
    });

    it("should not pass through unsupported parameters", function () {
        let input = {
            "healthcheck": {
                "interval": "5s",
                "test": ["CMD", "curl", "http://test.com"],
            },
        };
        let expected = {
            "interval": "5s",
        };
        let result = dcHealthcheckToBatect(input, "healthcheck", "service", warnings);
        expect(result).toEqual(expected);
    });

    it("should warn if unsupported parameters are present", function () {
        let input = {
            "healthcheck": {
                "interval": "5s",
                "test": ["CMD", "curl", "http://test.com"],
            },
        };
        dcHealthcheckToBatect(input, "healthcheck", "web", warnings);
        expect(warnings.unsupportedKeys[0]).toEqual({ key: 'test', parent: 'service web healthcheck' });
    });
});

describe("dcVolumeToBatect", function () {

    describe("short syntax", function () {

        // Examples from https://docs.docker.com/compose/compose-file/compose-file-v3/#volumes

        it("should pass a string with a relative host-path source through without conversion", function () {
            let input = "./cache:/tmp/cache";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual(input);
        });

        it("should pass a string with an absolute host-path source through without conversion", function () {
            let input = "/opt/data:/var/lib/mysql";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual(input);
        });

        it("should pass a string with a host-path source and options through without conversion", function () {
            let input = "~/configs:/etc/configs/:ro";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual(input);
        });

        it("should convert a target-only string to a volume object with generated name", function () {
            let input = "/var/lib/mysql";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual({
                name: 'web__var_lib_mysql',
                type: 'cache',
                container: '/var/lib/mysql'
            });
        });

        it("should preserve options when converting a target-only string to a volume object", function () {
            let input = "/var/lib/mysql:ro";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual({
                name: 'web__var_lib_mysql',
                type: 'cache',
                container: '/var/lib/mysql',
                options: 'ro'
            });
        });

        it("should set the name when converting a named volume string to a volume object ", function () {
            let input = "datavolume:/var/lib/mysql";
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual({
                name: 'datavolume',
                type: 'cache',
                container: '/var/lib/mysql',
            });
        });
    });

    describe("long syntax", function () {

        describe("bind type", function () {
            it("should convert bind volume object parameters to batect format", function () {
                let input = {
                    "type": "bind",
                    "source": "./work",
                    "target": "/work",
                };
                let expected = {
                    "local": "./work",
                    "container": "/work",
                };
                let result = dcVolumeToBatect(input, "web", warnings);
                expect(result).toEqual(expected);
            });

            it("should append read_only to docker options parameter if true", function () {
                let input = {
                    "type": "bind",
                    "source": "./work",
                    "target": "/work",
                    "read_only": true,
                };
                let expected = {
                    "local": "./work",
                    "container": "/work",
                    "options": "ro",
                };
                let result = dcVolumeToBatect(input, "web", warnings);
                expect(result).toEqual(expected);
            });

            it("should not append read_only to docker options parameter if false", function () {
                let input = {
                    "type": "bind",
                    "source": "./work",
                    "target": "/work",
                    "read_only": false,
                };
                let expected = {
                    "local": "./work",
                    "container": "/work",
                };
                let result = dcVolumeToBatect(input, "web", warnings);
                expect(result).toEqual(expected);
            });
        });

        describe("volume type", function () {
            it("should convert volume volume object parameters to batect format", function () {
                let input = {
                    "type": "volume",
                    "source": "work",
                    "target": "/work",
                };
                let expected = {
                    "type": "cache",
                    "name": "work",
                    "container": "/work",
                };
                let result = dcVolumeToBatect(input, "web", warnings);
                expect(result).toEqual(expected);
            });
        });

        describe("volume type", function () {
            it("should generate a name from the service and path if none is provided", function () {
                let input = {
                    "type": "volume",
                    "target": "/var/lib/mysql",
                };
                let expected = {
                    "type": "cache",
                    "name": "web__var_lib_mysql",
                    "container": "/var/lib/mysql",
                };
                let result = dcVolumeToBatect(input, "web", warnings);
                expect(result).toEqual(expected);
            });
        });

        it("should append read_only to docker options parameter if true", function () {
            let input = {
                "type": "bind",
                "source": "./work",
                "target": "/work",
                "read_only": true,
            };
            let expected = {
                "local": "./work",
                "container": "/work",
                "options": "ro",
            };
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual(expected);
        });

        it("should not append read_only to docker options parameter if false", function () {
            let input = {
                "type": "bind",
                "source": "./work",
                "target": "/work",
                "read_only": false,
            };
            let expected = {
                "local": "./work",
                "container": "/work",
            };
            let result = dcVolumeToBatect(input, "web", warnings);
            expect(result).toEqual(expected);
        });
    });

    it("should not include unsupported parameters and warn", function () {
        let input = {
            "type": "bind",
            "source": "./work",
            "target": "/work",
            "volume": {
                "nocopy": true,
            },
        };
        let expected = {
            "local": "./work",
            "container": "/work",
        };
        let result = dcVolumeToBatect(input, "web", warnings);
        expect(result).toEqual(expected);
        expect(warnings.unsupportedKeys.length).toEqual(1);
    });

    it("should warn on unsupported volume types and not return anything", function () {
        displayCard = jasmine.createSpy("displayCard", function (type, heading, message) {
        });

        let input = {
            "type": "tmpfs",
            "target": "/work",
        };
        let result = dcVolumeToBatect(input, "web", warnings);
        expect(result).toBeUndefined();
        expect(warnings.unsupportedValues[0]).toEqual({
            type: "volume",
            service: "web",
            key: "type",
            value: "tmpfs"
        },
        );
    });
});

describe("dcVolumeArrayToBatect", function () {

    it("should return an array of volumes", function () {
        let input = {
            "volumes": [
                "./work:/work",
                {
                    "source": "./work",
                    "target": "/work",
                },
            ],
        };
        let result = dcVolumeArrayToBatect(input, "volumes", "web", warnings);
        expect(Array.isArray(result)).toEqual(true);
    });
});


describe("dcBuildToBatect", function () {

    it("should only return a build_directory if given a string", function () {
        let input = {
            "build": "docker/image",
        };
        let expected = {
            "build_directory": "docker/image",
        };
        let result = dcBuildToBatect(input, "build", "web", warnings);
        expect(result).toEqual(expected);
    });

    it("should return a mapped set of batect parameters if given an object", function () {
        let input = {
            "build": {
                "context": "docker/image",
                "dockerfile": "Dockerfile",
                "args": {
                    "buildno": "1"
                },
                "cache_from": [
                    "alpine:latest"
                ],
            },
        };
        let expected = {
            "build_directory": "docker/image",
            "dockerfile": "Dockerfile",
            "build_args": {
                "buildno": "1",
            }
        };
        let result = dcBuildToBatect(input, "build", "web", warnings);
        expect(result).toEqual(expected);
    });
});

describe("dockerComposeToBatect", function () {

    it("should return a batect configuration file object", function () {
        let input = {
            "version": 3.1,
            "services": {
                "alpine": {
                    "image": "alpine:latest",
                },
            },
        };
        let expected = {
            "containers": {
                "alpine": {
                    "image": "alpine:latest",
                }
            },
            "tasks": {},
        };
        let result = dockerComposeToBatect(input).config;
        expect(result).toEqual(expected);
    });
});

describe("mapDcKeyToBatect", function () {
    it("should map one key to another", function () {
        let input = {
            "depends_on": [
                "web"
            ],
        };
        let mapping = {
            "depends_on": "dependencies"
        };
        let expected = {
            "dependencies": [
                "web"
            ],
        };
        let result = mapDcKeyToBatect(mapping, "depends_on", "redis", input, warnings);
        expect(result).toEqual(expected);
    });
});

describe("dcServiceToBatect", function () {

    it("converts a docker-compose service to a batect container", function () {
        let input = {
            "image": "alpine:latest",
            "healthcheck": {
                "interval": "5s",
            },
        };
        let expected = {
            "image": "alpine:latest",
            "health_check": {
                "interval": "5s",
            }
        };
        let result = dcServiceToBatect("alpine", input, warnings);
        expect(result).toEqual(expected);
    });

    it("should warn if both 'build' and 'image' are set, and only keep 'build'", function () {
        let input = {
            "image": "alpine:latest",
            "build": "./docker",
        };
        let expected = {
            "build_directory": "./docker",
        };
        let result = dcServiceToBatect("alpine", input, warnings);
        expect(result).toEqual(expected);
        expect(warnings.conflictingValues[0]).toEqual({
            type: "service",
            service: "alpine",
            key: "build",
            msg: "Both 'build' and 'image' are specified. 'image' will be dropped."
        });
    });

    it("should return nothing and warn for expose ports", function () {
        let input = {
            "expose": [
                "4000",
            ],
        };
        let result = dcServiceToBatect("web", input, warnings);
        expect(result).toEqual({});
        expect(warnings.unsupportedKeys[0]).toEqual({
            type: "service",
            service: "web",
            key: "expose",
            msg: "'expose' has no equivalent in batect as all container ports are networked internally"
        })
    });
});

describe("dcPortToBatect", function () {

    it("should pass a string without conversion", function () {
        let input = "8000:8000";
        let result = dcPortToBatect(input, "web", warnings);
        expect(result).toEqual(input);
    });

    it("should warn and return nothing if given a container-port-only string ", function () {
        let input = "8000";
        let result = dcPortToBatect(input, "web", warnings);
        expect(result).toBeUndefined();
        expect(warnings.unsupportedValues[0]).toEqual({
            type: "port",
            service: "web",
            key: "port",
            value: "8000",
            msg: "specifying just a container port is not supported. this is generally not needed as batect networks all container ports internally regardless."
        })
    });

    it("should convert a long syntax port to batect format", function () {
        let input = {
            "target": "80",
            "published": "8000",
        };
        let expected = {
            "local": "8000",
            "container": "80",
        };
        let result = dcPortToBatect(input, "web", warnings);
        expect(result).toEqual(expected);
    });

    it("should warn if given a non-tcp protocol in long syntax and return nothing", function () {
        let input = {
            "target": "80",
            "published": "8000",
            "protocol": "echo",
        };
        let result = dcPortToBatect(input, "web", warnings);
        expect(result).toBeUndefined();
        expect(warnings.unsupportedValues[0]).toEqual({
            service: 'web',
            type: 'port',
            key: 'protocol',
            value: 'echo',
            msg: "batect only supports TCP ports"
        });
    });

    it("should warn if given a udp port in short syntax and return nothing", function () {
        let input = "6060:6060/udp";
        let result = dcPortToBatect(input, "web", warnings);
        expect(result).toBeUndefined();
        expect(warnings.unsupportedValues[0]).toEqual({
            service: 'web',
            type: 'port',
            key: 'port',
            value: '6060:6060/udp',
            msg: "UDP ports unsupported. batect only supports TCP ports"
        });
    });
});

describe("dcPortArrayToBatect", function () {

    it("should return an array of ports", function () {
        let input = {
            "ports": [
                "4000:4000",
                "6000:6000",
            ],
        };
        let result = dcPortArrayToBatect(input, "web", warnings);
        expect(result).toEqual(input["ports"]);
    });

});
