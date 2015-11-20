var _ = require('lodash');
var os = require('os');
var midi = require('midi');
var atem = require('./atem.js');
var LaunchControl = require('./launchcontrol.js');
var EventEmitter = require('events');
var events = new EventEmitter();

var log= {
    midi: console.log.bind(console, 'MIDI -'),
    atem: console.log.bind(console, 'ATEM -')
};

/* GuiState */
var state = {
	atemState: "disconnected",
	midiState: "disconnected"
}

var setState = function(newState){
	_.extend(state, newState);
	events.emit('statechange', state);
}

/* MIDI connection */
var first = true;
var midiInterval;
var midiConnected = false;

var input = new midi.input();
var output = new midi.output();

// Order: (Sysex, Timing, Active Sensing)
input.ignoreTypes(false, false, false)

var probeMidi = function(print){
    var ports = {};
    for(var i=0; i<input.getPortCount(); i++){
        var portname = input.getPortName(i);
        if(print)
            log.midi('\tIN: \tPort', i, portname);
        if(portname.match(/Launch Control XL/))
            ports.in = i;
    }
    for(var i=0; i<output.getPortCount(); i++){
        var portname = output.getPortName(i);
        if(print)
            log.midi('\tOUT: \tPort', i, portname);
        if(portname.match(/Launch Control XL/))
            ports.out = i;
    }
    return ports;
}

var sendMidiMessage = function(message){
    if(midiConnected)
        output.sendMessage(message);
}

var sendMidiMessages = function(messages){
    for(var i=0; i<messages.length; i++){
        sendMidiMessage(messages[i]);
    }
}

var tryMidi = function(){
    if(first)
        log.midi('Ports In:', input.getPortCount(), 'Out:', output.getPortCount());
    var ports = probeMidi(first);
    if(!isNaN(ports.in) && !isNaN(ports.out)){
        if(!midiConnected){
			setState({midiState: "connected"});
            midiConnected = true;
            log.midi('Connected');
            input.openPort(ports.in);
            output.openPort(ports.out);
			sendMidiMessage(LaunchControl.led('pad1', 0, 'lightRed', 0));
			sendMidiMessage(LaunchControl.led('pad2', 0, 'lightGreen', 0));
        }
    }else{
		setState({midiState: "disconnected"});
        if(first)
            log.midi('Launchpad not found, will keep searching for it');

        if(midiConnected){
			midiConnected = false;
			clearInterval(midiInterval);
			setState({midiState: "midi disconnected - please restart as reconnect is not supported atm"});
            input.closePort();
            output.closePort();

        }
    }
    first = false;
}

input.cancelCallback = function(){
    console.log("midi cancel", arguments)
}

process.on('exit', function(code){
    if(midiConnected){
        input.closePort();
        output.closePort();
    }
});

midiInterval = setInterval(tryMidi, 3000);
tryMidi();

/* LaunchControl Button Tally */
var TALLY_PROGRAM = 1;
var TALLY_PREVIEW = 2;
atem.events.on('tallyByIndex', function(count, tally){
    var messages = [];
    for (var i = 0; i<Math.min(count, 8); i++){
        var pad1col = (tally[i] & TALLY_PROGRAM) ? 'lightRed' : 'off';
        var pad2col = (tally[i] & TALLY_PREVIEW) ? 'lightGreen' : 'off';
        // console.log(i, tally[i], 'set 1', pad1col, 'set 2', pad2col)
        messages.push(LaunchControl.led('pad1', i, pad1col, 0));
        messages.push(LaunchControl.led('pad2', i, pad2col, 0));
    }
    sendMidiMessages(messages);
});

/* Get Atem Status */
atem.events.on('connectionStateChange', function(atemState){
	setState({atemState: atemState})
});


/* Map atem events to launchControl leds */
atem.events.on('transitionPreview', function(enabled){
    var color = enabled ? 'lightAmber'  : 'off'
    sendMidiMessage(LaunchControl.led('misc', 0, color, 0));
});

atem.events.on('nextTransitionChange', function(style, map){
    var color = LaunchControl.colorWheel[style];
    // console.log('fargl', style, color, LaunchControl.colorWheel);
    sendMidiMessages(LaunchControl.led('knob1', 'all', color, 0));
});

atem.events.on('transitionMixRate', function(value){
    var color = LaunchControl.colorWheel[Math.floor(value/250 * LaunchControl.colorWheel.length)]
});

atem.events.on('transitionPosition', _.throttle(function(inTransition, position){
    var color = inTransition ? 'lightAmber'  : 'off'
    sendMidiMessage(LaunchControl.led('misc', 1, color, 0));
}, 30));

/* LaunchControl MIDI Handler */
var transitionReverse = false;
input.on('message', function(deltaTime, message) {
    var msg = LaunchControl.parseMessage(message);
    if(!msg){
        return;
    }

    console.log('m:', msg);

    if(msg.type == 'on'){
        if(msg.name == 'pad1'){
            atem.setProgram(msg.track + 1);

        }else if(msg.name == 'pad2'){
            atem.setPreview(msg.track + 1)

        }else if(msg.name == 'misc' && msg.track == 0){
            atem.toggleTransitionPreview();

        }else if(msg.name == 'misc' && msg.track == 1){
            atem.auto();

        }else if(msg.name == 'misc' && msg.track == 2){
            atem.cut();
        }
    }else if(msg.type == 'change'){
        if(msg.name == 'knob3' && msg.track == 0){
            var val = Math.round(msg.value / 127 * 4)
            atem.setTransitionType(val);

        }else if(msg.name == 'knob3' && msg.track == 1){
            var val = Math.round(msg.value / 127 * 125)
            atem.setTransitionMixRate(val);

        }else if(msg.name == 'slider' && msg.track == 7){
            var val;
            if(transitionReverse){
                val = (1 - msg.value / 127) * 10000;
            }else{
                val = msg.value / 127 * 10000;
            }
            if(val == 10000){
                transitionReverse = !transitionReverse
            }
            atem.setTransitionPosition(val);
        }
    }
});

process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log('foo', err)
    return true;
})

/* Define Public API */
exports.events = events;
exports.getState = function(){
	return state;
}
exports.connectAtem = function(ip){
	atem.connect(ip);
}
