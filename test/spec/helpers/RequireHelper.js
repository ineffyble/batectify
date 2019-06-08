beforeAll(function () {
    let BatectifyDockerCompose = require("../../../src/js/batectify-dc");
    dockerComposeToBatect = BatectifyDockerCompose.dockerComposeToBatect;
    dcServiceToBatect = BatectifyDockerCompose.dcServiceToBatect;
    mapDcKeyToBatect = BatectifyDockerCompose.mapDcKeyToBatect;
    dcVolumeToBatect = BatectifyDockerCompose.dcVolumeToBatect;
    dcBuildToBatect = BatectifyDockerCompose.dcBuildToBatect;
    dcCommandToBatect = BatectifyDockerCompose.dcCommandToBatect;
    dcEnvironmentToBatect = BatectifyDockerCompose.dcEnvironmentToBatect;
    dcHealthcheckToBatect = BatectifyDockerCompose.dcHealthcheckToBatect;
    dcVolumeArrayToBatect = BatectifyDockerCompose.dcVolumeArrayToBatect;
    dcPortArrayToBatect = BatectifyDockerCompose.dcPortArrayToBatect;
    dcPortToBatect = BatectifyDockerCompose.dcPortToBatect;
});
