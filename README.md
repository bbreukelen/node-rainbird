![](http://iqweb.rainbird.com/iq/images/logos/rainbird.png) 
# Node-Rainbird
 
#####Node.js library for interacting with WiFi LNK module of the Rain Bird Irrigation system  

----

*Note: The API and encryption are based on [pyrainbird](https://github.com/jbarrancos/pyrainbird) by jbarrancos.
All credits for reverse engineering the rainbird api go to him.* 

*Note: This project has no affiliation with Rain Bird. This module works with the [Rain Bird LNK WiFi Module](http://www.rainbird.com/landscape/products/controllers/LNK-WiFi.htm)*

----

You can start/stop the irrigation, get the currently active zone, set the watering delay, etc.  
This module communicates directly with the IP Address of the WiFi module it does NOT support the cloud.  
The library is Promise based.


## Installation
```sh
$ npm install node-rainbird
```

## Usage
```js
const RainBirdClass = require('node-rainbird');

let rainbird = new RainBirdClass("_your_ip_address_", "_your_password_");

rainbird.setDebug(); // Only set this for verbose logging information 

rainbird
    .stopIrrigation()
    .then(console.log)
    .catch(console.error);
```

## License
[GNU](https://github.com/bbreukelen/node-rainbird/blob/master/LICENSE)

## Author
Created by Boudewijn van Breukelen @ Future Software  
Please consider donating if you use this code in your project.  
Donating a Euro will make my day :-P   
[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://paypal.me/bbreukelen)  

## API

#### setDebug
Enables verbose console logging
```js
rainbird.setDebug()
```

##### setIp
Sets the rainbird ip address. Not needed when provided in constructor.
```js
rainbird.setIp('your ip')
```

##### setPassword
Sets the rainbird password. Not needed when provided in constructor.
```js
rainbird.setPassword()
```

#### getModelAndVersion
Returns the Rainbird mode and firmware version
```js
rainbird.getModelAndVersion()
```

#### getTime
Returns the currrent time of the Rainbird controller
```js
rainbird.getTime()
```

#### getDate
Returns the currrent date of the Rainbird controller
```js
rainbird.getDate()
```

#### getSerialNumber
Returns the controller's serial number. For ESP-RZXe this is always 0000000000000000
```js
rainbird.getSerialNumber()
```

#### getRainSensorState
Returns the state of the rain sensor (true or false)
```js
rainbird.getRainSensorState()
```

#### getRainDelay
Returns the watering delay in days.
```js
rainbird.getRainDelay()
```

#### getAvailableZones
Returns the number of zones/stations for the controller. For ESP-RZXe this is always 3F000000 where 3F is binary 111111. Each bit is 1 zone.
```js
rainbird.getAvailableZones()
```

#### getIrrigationState
Returns if the controller is active or irrigation is switched off I think (boolean)
```js
rainbird.getIrrigationState()
```

#### getActiveZones
Returns the decimal number of the currently active zone, or 0 when no zones are active.
```js
rainbird.getActiveZones()
```

#### stopIrrigation
Stops all irrigation
```js
rainbird.stopIrrigation()
```

#### setRainDelay(days)
Sets the watering delay in days. Parse the delay as a decimal between 0 and 14
```js
rainbird.setRainDelay(days)
```

#### startZone(zone, minutes)
Manually activates a zone for x minutes. When another zone is active, it will be de-activated.
```js
rainbird.startZone(zone, minutes)
```

#### startAllZones(minutes)
Manually activates all zones in chronological order with x minutes.
```js
rainbird.startAllZones(minutes)
```

#### startProgram(programNr)
Manually start program x. Not supported on ESP-RZXe but might work on other controllers
```js
rainbird.startProgram(programNr)
```

## Contribute
More methods are available but not all are supported by my Rainbird controller.
Please feel free to contribute by adding more API methods.