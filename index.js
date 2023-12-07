const fetch = require('node-fetch'),
    crypto = require('crypto'),
    TextEncoder = require('text-encoder').TextEncoder,
    TextDecoder = require('text-encoder').TextDecoder,
    aesjs = require('aes-js');

class RainBirdClass {

    constructor(ipAddress, password) {
        this.ip = ipAddress;
        this.password = password;
        this.debug = false;
    }

    setDebug() { this.debug = true; }
    setIp(ip) { this.ip = ip; }
    setPassword(password) { this.password = password; }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Executable RainBird commands
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /*
        Returns the Rainbird mode and firmware version
      */
    getModelAndVersion() { return request(this, "ModelAndVersionRequest"); }

    /*
        Returns the currrent time of the Rainbird controller
     */
    getTime() { return request(this, "CurrentTimeRequest"); }

    /*
        Returns the currrent date of the Rainbird controller
     */
    getDate() { return request(this, "CurrentDateRequest"); }

    /*
        Returns the controller's serial number.
        For ESP-RZXe this is always 0000000000000000
     */
    getSerialNumber() { return request(this, "SerialNumberRequest"); }

    /*
        Returns the state of the rain sensor (true or false)
     */
    getRainSensorState() { return request(this, "CurrentRainSensorStateRequest"); }

    /*
        Returns the watering delay in days.
     */
    getRainDelay() { return request(this, "RainDelayGetRequest"); }

    /*
        Returns the number of zones/stations for the controller.
        For ESP-RZXe this is always 3F000000 where 3F is binary 111111. Each bit is 1 zone.
     */
    getAvailableZones() { return request(this, "AvailableStationsRequest", decToHex(0)); }

    /*
        Returns if the controller is active or irrigation is switched off I think (boolean)
     */
    getIrrigationState() { return request(this, "CurrentIrrigationStateRequest"); }

    /*
        Returns the decimal number of the currently active zone, or 0 when no zones are active.
     */
    getActiveZones() { return request(this, "CurrentStationsActiveRequest", decToHex(0)); }


    /*
        Stops all irrigation
     */
    stopIrrigation() { return request(this, "StopIrrigationRequest"); }

    /*
        Sets the watering delay in days. Parse the delay as a decimal between 0 and 14
     */
    setRainDelay(days) { return request(this, "RainDelaySetRequest", decToHex(days, 4)); }

    /*
        Manually activates a zone for x minutes. When another zone is active, it will be de-activated.
     */
    startZone(zone, minutes) { return request(this, "ManuallyRunStationRequest", decToHex(zone, 4), decToHex(minutes)); }

    /*
        Manually activates all zones in chronological order with x minutes.
     */
    startAllZones(minutes) { return request(this, "TestStationsRequest", decToHex(minutes)); }

    /*
        Manually start program x. Not supported on ESP-RZXe but might work on other controllers
     */
    startProgram(programNr) { return request(this, "ManuallyRunProgramRequest", decToHex(programNr)); }
}

function log(rb, msg) {
    rb.debug && console.log('DEBUG: ' + (typeof msg === 'object' ? JSON.stringify(msg) : msg));
}

function request(rb, command, ...params) {
    return new Promise((resolve, reject) => {
        log(rb, `Requesting ${command} from ${rb.ip}`);
        let commandData = sipCommands.ControllerCommands[command] || null;
        if (!commandData) {
            log(rb, "Invalid command");
            return reject(new Error("Invalid command"));
        }

        let url = `http://${rb.ip}/stick`,
            body;

        try {
            body = encrypt(rb, makeBody(rb, commandData, params));
        } catch (err) {
            log(rb, "Error encrypting request body");
            return reject(err);
        }

        fetch(url, makeRequestOptions(body))
            .then(res => {
                if (!res.ok || res.status !== 200) throw new Error(res.status + ": " + res.statusText);
                return res.buffer();
            })
            .then(data => {
                log(rb, "Received a response from Rainbird controller");
                return processResponse(rb, data);
            })
            .then(response => {
                log(rb, response);
                resolve(response);
            })
            .catch(err => {
                log(rb, "Error during request");
                if (rb.debug) {
                    console.error(err);
                    reject(err);
                } else {
                    reject(err.message);
                }
            });
    });
}

function makeBody(rb, commandObj, params) {
    let command = commandObj.command;
    (params || []).forEach(param => { command += param; });

    if (command.length / 2 !== commandObj.length) throw new Error("Invalid parameters");

    log(rb, `Sending body: ${command}`);

    return {
        "id": 9,
        "jsonrpc": "2.0",
        "method": "tunnelSip",
        "params": {"data": command, "length": commandObj.length}
    };
}

function makeRequestOptions(body) {
    return {
        method: 'POST',
        body: body,
        headers: {
            "Accept-Language": "en",
            "Accept-Encoding": "gzip, deflate",
            "User-Agent": "RainBird/2.0 CFNetwork/811.5.4 Darwin/16.7.0",
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Content-Type": "application/octet-stream"
        }
    }
}

function processResponse(rb, data) {
    let response = unpackResponse(rb, data);
    if (!response) throw new Error("No response received");
    if (response.error) throw new Error(`Received error from Rainbird controller ${response.error.code}: ${response.error.message}`);
    if (!response.result) throw new Error("Invalid response received");
    let resultLength = response.result.length,
        resultData = response.result.data,
        resultCode = resultData.substring(0,2),
        resultObj = sipCommands.ControllerResponses[resultCode];

    if (!resultObj) {
        log(rb, "Response code not found, response: " + resultData);
        throw new Error("Response code not found");
    }

    if (resultLength !== resultObj.length) {
        log(rb, "Invalid response length received: " + resultData);
        throw new Error("Invalid response length");
    }

    // Get the fields from the resultObject
    let output = {};
    Object.keys(resultObj).forEach(key => {
        if (typeof resultObj[key] === 'object' &&
            resultObj[key].hasOwnProperty('position') &&
            resultObj[key].hasOwnProperty('length'))
        {
            output[key] = resultData.slice(resultObj[key].position, resultObj[key].position + resultObj[key].length);
        }
    });

    // Do data conversion if needed
    typeof resultObj.f === 'function' && resultObj.f(output);

    output._type = resultObj.type;

    return output;
}

function unpackResponse(rb, data) {
    return JSON.parse(decrypt(data, rb.password).replace(/[\x10\x0A\x00]/g, ""));
}

function encrypt(rb, body) {
    body = JSON.stringify(body);
    let passwordHash = crypto.createHash('sha256').update(toBytes(rb.password)).digest(),
        randomBytes = crypto.randomBytes(16),
        packedBody = toBytes(addPadding(body + "\x00\x10")),
        hashedBody = crypto.createHash('sha256').update(toBytes(body)).digest(),
        easEncryptor = new aesjs.ModeOfOperation.cbc(passwordHash, randomBytes),
        encryptedBody = Buffer.from(easEncryptor.encrypt(packedBody));
    return Buffer.concat([hashedBody, randomBytes, encryptedBody]);
}

function decrypt(data, password) {
    let passwordHash = crypto.createHash('sha256').update(toBytes(password)).digest().slice(0, 32),
        randomBytes = data.slice(32, 48),
        encryptedBody = data.slice(48, data.length),
        aesDecryptor = new aesjs.ModeOfOperation.cbc(passwordHash, randomBytes);
    return new TextDecoder().decode(aesDecryptor.decrypt(encryptedBody));
}

function toBytes(str) {
    return new TextEncoder('utf-8').encode(str);
}

function addPadding(data) {
    const BLOCK_SIZE = 16;
    let dataLength = data.length;
    let charsToAdd = (dataLength + BLOCK_SIZE) - (dataLength % BLOCK_SIZE) - dataLength;
    let pad_string = Array(charsToAdd + 1).join("\x10");
    return [data, pad_string].join("");
}

function decToHex(value, len) {
    return Math.abs(value).toString(16).toUpperCase().padStart(len || 2, '0');
}

function hexToDec(hex) {
    return parseInt('0x' + hex);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function outputAllToBoolean(o) {
    outputSomeToBoolean(o, Object.keys(o));
}

function outputAllToDecimal(o) {
    outputSomeToDecimal(o, Object.keys(o));
}

function outputSomeToBoolean(o, keys) {
    outputSomeTo(o, keys, 'bool');
}

function outputSomeToDecimal(o, keys) {
    outputSomeTo(o, keys, 'dec');
}

function outputSomeTo(o, keys, type) {
    if (!keys) return o;
    if (typeof keys === 'string') keys = [keys];
    keys.forEach(k => {
        if (o.hasOwnProperty(k)) {
            switch (type) {
                case 'dec': o[k] = hexToDec(o[k]); break;
                case 'bool': o[k] = !!hexToDec(o[k]); break;
            }
        }
    });
}

const sipCommands = {
    "ControllerCommands": {
        "ModelAndVersionRequest": {"command": "02", "response": "82", "length": 1},
        "AvailableStationsRequest": {"command": "03", "parameter": 0, "response": "83", "length": 2},
        "CommandSupportRequest": {"command": "04", "commandToTest": "02", "response": "84", "length": 2},
        "SerialNumberRequest": {"command": "05", "response": "85", "length": 1},
        "CurrentTimeRequest": {"command": "10", "response": "90", "length": 1},
        "CurrentDateRequest": {"command": "12", "response": "92", "length": 1},
        "WaterBudgetRequest": {"command": "30", "parameter": 0, "response": "B0", "length": 2},
        "ZonesSeasonalAdjustFactorRequest": {"command": "32", "parameter": 0, "response": "B2", "length": 2},
        "CurrentRainSensorStateRequest": {"command": "3E", "response": "BE", "length": 1},
        "CurrentStationsActiveRequest": {"command": "3F", "parameter": 0, "response": "BF", "length": 2},
        "ManuallyRunProgramRequest": {"command": "38", "parameter": 0, "response": "01", "length": 2},
        "ManuallyRunStationRequest": { "command": "39", "parameterOne": 0, "parameterTwo": 0, "response": "01", "length": 4 },
        "TestStationsRequest": {"command": "3A", "parameter": 0, "response": "01", "length": 2},
        "StopIrrigationRequest": {"command": "40", "response": "01", "length": 1},
        "RainDelayGetRequest": {"command": "36", "response": "B6", "length": 1},
        "RainDelaySetRequest": {"command": "37", "parameter": 0, "response": "01", "length": 3},
        "AdvanceStationRequest": {"command": "42", "parameter": 0, "response": "01", "length": 2},
        "CurrentIrrigationStateRequest": {"command": "48", "response": "C8", "length": 1},
        "CurrentControllerStateSet": {"command": "49", "parameter": 0, "response": "01", "length": 2},
        "ControllerEventTimestampRequest": {"command": "4A", "parameter": 0, "response": "CA", "length": 2},
        "StackManuallyRunStationRequest": { "command": "4B", "parameter": 0, "parameterTwo": 0, "parameterThree": 0, "response": "01", "length": 4 },
        "CombinedControllerStateRequest": {"command": "4C", "response": "CC", "length": 1}
    },

    "ControllerResponses": {
        "00": {
            "length": 3,
            "type": "NotAcknowledgeResponse",
            "commandEcho": {"position": 2, "length": 2},
            "NAKCode": {"position": 4, "length": 2},
            "f": o => o.ack = false
        },
        "01": {
            "length": 2, "type": "AcknowledgeResponse",
            "commandEcho": {"position": 2, "length": 2},
            "f": o => o.ack = true
        },
        "82": {
            "length": 5,
            "type": "ModelAndVersionResponse",
            "modelID": {"position": 2, "length": 4},
            "protocolRevisionMajor": {"position": 6, "length": 2},
            "protocolRevisionMinor": {"position": 8, "length": 2}
        },
        "83": {
            "length": 6,
            "type": "AvailableStationsResponse",
            "pageNumber": {"position": 2, "length": 2},
            "setStations": {"position": 4, "length": 8}
        },
        "84": {
            "length": 3,
            "type": "CommandSupportResponse",
            "commandEcho": {"position": 2, "length": 2},
            "support": {"position": 4, "length": 2}
        },
        "85": {"length": 9, "type": "SerialNumberResponse", "serialNumber": {"position": 2, "length": 16}},
        "90": {
            "length": 4,
            "type": "CurrentTimeResponse",
            "hour": {"position": 2, "length": 2},
            "minute": {"position": 4, "length": 2},
            "second": {"position": 6, "length": 2},
            "f": outputAllToDecimal
        },
        "92": {
            "length": 4,
            "type": "CurrentDateResponse",
            "day": {"position": 2, "length": 2},
            "month": {"position": 4, "length": 1},
            "year": {"position": 5, "length": 3},
            "f": outputAllToDecimal
        },
        "B0": {
            "length": 4,
            "type": "WaterBudgetResponse",
            "programCode": {"position": 2, "length": 2},
            "seasonalAdjust": {"position": 4, "length": 4}
        },
        "B2": {
            "length": 18,
            "type": "ZonesSeasonalAdjustFactorResponse",
            "programCode": {"position": 2, "length": 2},
            "stationsSA": {"position": 4, "length": 32}
        },
        "BE": {
            "length": 2,
            "type": "CurrentRainSensorStateResponse",
            "sensorState": {"position": 2, "length": 2},
            "f": outputAllToBoolean
        },
        "BF": {
            "length": 6,
            "type": "CurrentStationsActiveResponse",
            "pageNumber": {"position": 2, "length": 2},
            "activeStations": {"position": 4, "length": 8},
            "f": o => o.activeZones = o.activeStations
                .match(/.{1,2}/g)
                .map(x => parseInt('0x' + x).toString(2).split('').reverse().join('').indexOf('1') + 1)
            /* activeStations looks like 20000000 allowing for 4 sets of stations.
                match makes array of 2 characters, map loops over array, parseInt converts hex to decimal giving 32.
                toString converts to binary string giving 100000, split,revers,join reverses and makes 000001.
                indexOf gives position of the 1 or -1. +1 gives value 6. Possible values are 0 (no zone) to 6
             */
        },
        "B6": {
            "length": 3,
            "type": "RainDelaySettingResponse",
            "delaySetting": {"position": 2, "length": 4},
            "f": outputAllToDecimal
        },
        "C8": {
            "length": 2,
            "type": "CurrentIrrigationStateResponse",
            "irrigationState": {"position": 2, "length": 2},
            "f": outputAllToBoolean
        },
        "CA": {
            "length": 6,
            "type": "ControllerEventTimestampResponse",
            "eventId": {"position": 2, "length": 2},
            "timestamp": {"position": 4, "length": 8}
        },
        "CC": {
            "length": 16,
            "type": "CombinedControllerStateResponse",
            "hour": {"position": 2, "length": 2},
            "minute": {"position": 4, "length": 2},
            "second": {"position": 6, "length": 2},
            "day": {"position": 8, "length": 2},
            "month": {"position": 10, "length": 1},
            "year": {"position": 11, "length": 3},
            "delaySetting": {"position": 14, "length": 4},
            "sensorState": {"position": 18, "length": 2},
            "irrigationState": {"position": 20, "length": 2},
            "seasonalAdjust": {"position": 22, "length": 4},
            "remainingRuntime": {"position": 26, "length": 4},
            "activeStation": {"position": 30, "length": 2}
        }
    }
};


module.exports = RainBirdClass;