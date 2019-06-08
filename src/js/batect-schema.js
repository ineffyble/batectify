let batectSchema = {
    "title": "JSON schema for batect configuration files",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://batect.charleskorn.com/configSchema.json",
    "type": "object",
    "additionalProperties": false,
    "required": [
        "containers",
        "tasks"
    ],
    "properties": {
        "containers": {
            "$ref": "#/definitions/containers"
        },
        "tasks": {
            "$ref": "#/definitions/tasks"
        },
        "project_name": {
            "type": "string",
            "description": "The name of your project. Used to label any images built.",
            "minLength": 1
        }
    },
    "patternProperties": {
        "^\\.": true
    },
    "definitions": {
        "containers": {
            "type": "object",
            "description": "Definitions for each of the containers that make up your various environments",
            "additionalProperties": {
                "$ref": "#/definitions/container"
            }
        },
        "container": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "image": {
                    "type": "string",
                    "description": "Image name (in standard Docker image reference format) to use for this container",
                    "minLength": 1
                },
                "build_directory": {
                    "type": "string",
                    "description": "Path (relative to the configuration file's directory) to a directory containing a Dockerfile to build and use as an image for this container",
                    "minLength": 1
                },
                "build_args": {
                    "description": "List of build args to use when building the image in build_directory",
                    "$ref": "#/definitions/buildArgList"
                },
                "dockerfile": {
                    "type": "string",
                    "description": "Dockerfile (relative to build_directory) to use when building the image. Defaults to Dockerfile` if not set.",
                    "minLength": 1
                },
                "command": {
                    "type": "string",
                    "description": "Command to run when the container starts",
                    "minLength": 1
                },
                "environment": {
                    "description": "List of environment variables for the container",
                    "$ref": "#/definitions/environmentVariableList"
                },
                "working_directory": {
                    "type": "string",
                    "description": "Working directory to start the container in",
                    "minLength": 1
                },
                "volumes": {
                    "description": "List of volume mounts to create for the container",
                    "$ref": "#/definitions/volumeMountList"
                },
                "ports": {
                    "description": "List of ports to make available to the host machine",
                    "$ref": "#/definitions/portMappingList"
                },
                "dependencies": {
                    "description": "List of other containers that should be started and healthy before starting this container",
                    "$ref": "#/definitions/containerDependencyList"
                },
                "health_check": {
                    "description": "Overrides health check configuration specified in the image or Dockerfile",
                    "$ref": "#/definitions/healthCheckOptions"
                },
                "run_as_current_user": {
                    "$ref": "#/definitions/runAsCurrentUserOptions"
                },
                "privileged": {
                    "type": "boolean",
                    "description": "Enable privileged mode for the container"
                },
                "enable_init_process": {
                    "type": "boolean",
                    "description": "Set to `true` to run an init process inside the container that forwards signals and reaps processes"
                },
                "capabilities_to_add": {
                    "description": "List of additional capabilities to add to the container",
                    "$ref": "#/definitions/capabilityList"
                },
                "capabilities_to_drop": {
                    "description": "List of additional capabilities to remove from the container",
                    "$ref": "#/definitions/capabilityList"
                }
            },
            "oneOf": [
                {
                    "required": [
                        "image"
                    ],
                    "not": {
                        "required": [
                            "build_args",
                            "dockerfile"
                        ]
                    }
                },
                {
                    "required": [
                        "build_directory"
                    ]
                }
            ]
        },
        "tasks": {
            "type": "object",
            "description": "Definitions for each of your tasks, the actions you launch through batect",
            "additionalProperties": {
                "$ref": "#/definitions/task"
            }
        },
        "task": {
            "type": "object",
            "description": "Definition of a single task",
            "additionalProperties": false,
            "properties": {
                "run": {
                    "$ref": "#/definitions/taskRunOptions"
                },
                "description": {
                    "type": "string",
                    "description": "Description shown when running `batect --list-tasks`",
                    "minLength": 1
                },
                "group": {
                    "type": "string",
                    "description": "Name used to group tasks when running `batect --list-tasks`",
                    "minLength": 1
                },
                "dependencies": {
                    "description": "List of other containers that should be started and healthy before starting the task container given in `run`",
                    "$ref": "#/definitions/containerDependencyList"
                },
                "prerequisites": {
                    "type": "array",
                    "description": "List of other tasks that should be run before running this task",
                    "uniqueItems": true,
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": [
                "run"
            ]
        },
        "taskRunOptions": {
            "type": "object",
            "description": "Specifies what to do when this task starts",
            "additionalProperties": false,
            "properties": {
                "container": {
                    "type": "string",
                    "description": "Container to run for this task",
                    "minLength": 1
                },
                "command": {
                    "type": "string",
                    "description": "Command to run for this task",
                    "minLength": 1
                },
                "environment": {
                    "description": "List of environment variables to pass to the container, in addition to those defined on the container itself",
                    "$ref": "#/definitions/environmentVariableList"
                },
                "ports": {
                    "description": "List of port mappings to create for the container, in addition to those defined on the container itself",
                    "$ref": "#/definitions/portMappingList"
                },
                "working_directory": {
                    "type": "string",
                    "description": "Working directory to start the container in",
                    "minLength": 1
                }
            },
            "required": [
                "container"
            ]
        },
        "containerDependencyList": {
            "type": "array",
            "uniqueItems": true,
            "items": {
                "type": "string",
                "minLength": 1
            }
        },
        "environmentVariableList": {
            "type": "object",
            "additionalProperties": {
                "type": "string"
            }
        },
        "buildArgList": {
            "type": "object",
            "additionalProperties": {
                "type": "string"
            }
        },
        "portMappingList": {
            "type": "array",
            "items": {
                "oneOf": [
                    {
                        "type": "string",
                        "pattern": "^\\d+:\\d+$"
                    },
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "local": {
                                "type": "integer",
                                "description": "Port on the host machine to map",
                                "minimum": 1
                            },
                            "container": {
                                "type": "integer",
                                "description": "Port inside the container to map",
                                "minimum": 1
                            }
                        },
                        "required": [
                            "local",
                            "container"
                        ]
                    }
                ]
            }
        },
        "volumeMountList": {
            "type": "array",
            "items": {
                "oneOf": [
                    {
                        "type": "string",
                        "pattern": "^.+:.+(:.+)?$"
                    },
                    {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "local": {
                                "type": "string",
                                "description": "Path on the host machine to mount",
                                "minLength": 1
                            },
                            "container": {
                                "type": "string",
                                "description": "Path inside the container to mount the host path at",
                                "minLength": 1
                            },
                            "options": {
                                "type": "string",
                                "description": "Docker volume mount options to use when creating mount",
                                "enum": [
                                    "cached",
                                    "delegated",
                                    "consistent",
                                    "default",
                                    "ro"
                                ]
                            }
                        },
                        "required": [
                            "local",
                            "container"
                        ]
                    }
                ]
            }
        },
        "healthCheckOptions": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "retries": {
                    "type": "integer",
                    "description": "The number of times to perform the health check before considering the container unhealthy",
                    "minimum": 0
                },
                "interval": {
                    "type": "string",
                    "description": "The interval between runs of the health check. Accepts values such as `2s` (two seconds) or `1m` (one minute).",
                    "minLength": 1
                },
                "start_period": {
                    "type": "string",
                    "description": "The time to wait before failing health checks count against the retry count. The health check is still run during this period, and if the check succeeds, the container is immediately considered healthy. Accepts values such as `2s` (two seconds) or `1m` (one minute).",
                    "minLength": 1
                }
            }
        },
        "runAsCurrentUserOptions": {
            "oneOf": [
                {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "enabled": {
                            "type": "boolean",
                            "description": "Set to `true` to enable 'run as current user' mode",
                            "const": false
                        }
                    },
                    "required": [
                        "enabled"
                    ]
                },
                {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "enabled": {
                            "type": "boolean",
                            "description": "Set to `true` to enable 'run as current user' mode",
                            "const": true
                        },
                        "home_directory": {
                            "type": "string",
                            "description": "Directory to use as home directory for user inside container.",
                            "minLength": 1
                        }
                    },
                    "required": [
                        "enabled",
                        "home_directory"
                    ]
                }
            ]
        },
        "capabilityList": {
            "type": "array",
            "items": {
                "oneOf": [
                    {
                        "type": "string",
                        "enum": [
                            "AUDIT_CONTROL",
                            "AUDIT_READ",
                            "AUDIT_WRITE",
                            "BLOCK_SUSPEND",
                            "CHOWN",
                            "DAC_OVERRIDE",
                            "DAC_READ_SEARCH",
                            "FOWNER",
                            "FSETID",
                            "IPC_LOCK",
                            "IPC_OWNER",
                            "KILL",
                            "LEASE",
                            "LINUX_IMMUTABLE",
                            "MAC_ADMIN",
                            "MAC_OVERRIDE",
                            "MKNOD",
                            "NET_ADMIN",
                            "NET_BIND_SERVICE",
                            "NET_BROADCAST",
                            "NET_RAW",
                            "SETGID",
                            "SETFCAP",
                            "SETPCAP",
                            "SETUID",
                            "SYS_ADMIN",
                            "SYS_BOOT",
                            "SYS_CHROOT",
                            "SYS_MODULE",
                            "SYS_NICE",
                            "SYS_PACCT",
                            "SYS_PTRACE",
                            "SYS_RAWIO",
                            "SYS_RESOURCE",
                            "SYS_TIME",
                            "SYS_TTY_CONFIG",
                            "SYSLOG",
                            "WAKE_ALARM",
                            "ALL"
                        ]
                    }
                ]
            }
        }
    }
};
