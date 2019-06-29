console.log('hello from wdc.js');

class WsDppClient {

    constructor(opts) {
        var self = this;
        opts = opts || {};

        self.host = opts.host || "localhost";
        self.port = opts.port || 3000;
        self.ssl = opts.ssl || self.port === 443;
        self.ddpVersion = ("ddpVersion" in opts) ? opts.ddpVersion : "1";
        self.supportedDdpVersions = ["1", "pre2", "pre1"];

    }

    connect(connected) {
        var self = this;

        var url = self._buildWsUrl();
        self._makeWebSocketConnection(url);

        if (connected) {
            self.socket.addEventListener("connected", function() {
                connected(undefined);
            });

            self.socket.addEventListener("failed", function(error) {
                connected(error);
            });
        
        }
    }

    _buildWsUrl() {
        var self = this;
        var url;
        var protocol = self.ssl ? "wss://" : "ws://";
        if (self.url) {
            url = self.url;
        } else {
            url = protocol + self.host + ":" + self.port + "/websocket";
        }
        return url;         
    }

    _makeWebSocketConnection(url) {
        var self = this;
        self.socket = new WebSocket(url);
        self._prepareHandlers();
    }

    _prepareHandlers() {
        var self = this;
        self.socket.onopen = function() {
          self._send({
            msg : "connect",
            version : self.ddpVersion,
            support : self.supportedDdpVersions
          });
        };
    
        self.socket.onerror = function(error) {
            console.log("--> onerror: ", error);
        };
    
        self.socket.onclose = function(event) {
          console.log("--> onclose: ", event);
        };
    
        self.socket.onmessage = function(event) {
          self._message(event.data);
        };
    }

    _send(data) {
        var self = this;
        console.log('--> send: ', EJSON.stringify(data));
        self.socket.send(
          EJSON.stringify(data)
        );
    }

    _message(data) {
        console.log('--> messsage: ', data);
    }
    
}