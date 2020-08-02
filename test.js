const RainBirdClass = require('./');

let rainbird = new RainBirdClass("_your_ip_address_", "_your_password_");

// If you want debug information, enable this
// rainbird.setDebug();

// Use rainbird with a promise

rainbird
    .stopIrrigation()
    .then(console.log)
    .catch(console.error);
