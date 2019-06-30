console.log('hello from wdc.js');

class WsDppClient extends EventTarget {

    constructor(opts) {
        super();

        var self = this;
        opts = opts || {};

        self.host = opts.host || "localhost";
        self.port = opts.port || 3000;
        self.ssl = opts.ssl || self.port === 443;
        self.ddpVersion = ("ddpVersion" in opts) ? opts.ddpVersion : "1";
        self.supportedDdpVersions = ["1", "pre2", "pre1"];

        self.session = undefined;
        self._nextId = 0;
        self._callbacks = {};
        self._pendingMethods = {};
        self._updatedCallbacks = {};

    }

    connect(connected) {
        var self = this;

        if (connected) {
            self.addEventListener("connected", function() {
                connected(undefined);
            });

            self.addEventListener("failed", function(error) {
                connected(error);
            });
        
        }

        var url = self._buildWsUrl();
        self._makeWebSocketConnection(url);
    }

    call(name, params, callback, updatedCallback) {
        var self = this;
        var id = self._getNextId();
    
        self._callbacks[id] = function () {
          delete self._pendingMethods[id];
    
          if (callback) {
            callback.apply(this, arguments);
          }
        };

        self._updatedCallbacks[id] = function () {
            delete self._pendingMethods[id];
      
            if (updatedCallback) {
              updatedCallback.apply(this, arguments);
            }
        };
    
        self._pendingMethods[id] = true;
    
        self._send({
          msg    : "method",
          id     : id,
          method : name,
          params : params
        });
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
          self._endPendingMethodCalls();
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

    _endPendingMethodCalls() {
        var self = this;
        var ids = Object.keys(self._pendingMethods);
        self._pendingMethods = {};
    
        ids.forEach(function (id) {
          if (self._callbacks[id]) {
            self._callbacks[id](new Error("DDPClient: Disconnected from DDP server"));
            delete self._callbacks[id];
          }

          if (self._updatedCallbacks[id]) {
            self._updatedCallbacks[id]();
            delete self._updatedCallbacks[id];
          }
        });
    }

    _message(data) {
        console.log('--> messsage: ', data);

        var self = this;
        data = EJSON.parse(data);

        if (!data.msg) {
            return;
        }

        switch (data.msg) {
            // Establishing connection
            case 'connected':
                self.session = data.session;
                self.dispatchEvent(new Event('connected'));
                break;
            
            case 'failed':
                self.dispatchEvent(new Event('failed'));
                // TODO: implement mechanism for autoReconnect
                break;

            // Heartbeats
            case 'ping':
                let msg = { msg : "pong"};
                if (data.id) {
                    msg = { msg : "pong", id : data.id };
                }
                self._send(msg);
                break;
            
            // RPC
            case 'result':
                var cb = self._callbacks[data.id];

                if (cb) {
                    cb(data.error, data.result);
                    delete self._callbacks[data.id];
                }
                break;
            
            case 'updated':
                data.methods.forEach((method) => {
                    var cb = self._updatedCallbacks[method];
                    if (cb) {
                        cb();
                        delete self._updatedCallbacks[method];
                    }
                });
                break;
        
            default:
                break;
        }
    }

    _getNextId() {
        var self = this;
        return (self._nextId += 1).toString();
    }
    
}