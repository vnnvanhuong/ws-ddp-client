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
        self.maintainCollections = ("maintainCollections" in opts) ? opts.maintainCollections : true;

        if (self.maintainCollections) {
            self.collections = {};
        }

        self.session = undefined;
        self._nextId = 0;
        self._callbacks = {};
        self._pendingMethods = {};
        self._updatedCallbacks = {};
        self._observers = {};

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

    subscribe(name, params, callback) {
        var self = this;
        var id = self._getNextId();
    
        if (callback) {
          self._callbacks[id] = callback;
        }
    
        self._send({
          msg    : "sub",
          id     : id,
          name   : name,
          params : params
        });
    
        return id;
    }

    unsubscribe(id) {
        var self = this;
        self._send({
          msg : "unsub",
          id  : id
        });
    }

    observe(name, added, updated, removed) {
        var self = this;
        var observer = {};
        var id = self._getNextId();
    
        // name, _id are immutable
        Object.defineProperty(observer, "name", {
          get: function() { return name; },
          enumerable: true
        });
    
        Object.defineProperty(observer, "_id", { get: function() { return id; }});
    
        observer.added   = added   || function(){};
        observer.updated = updated || function(){};
        observer.removed = removed || function(){};
    
        observer.stop = function() {
          self._removeObserver(observer);
        };
    
        self._addObserver(observer);
    
        return observer;
    }
    

    close() {
        var self = this;
        self.socket.close();
        self.removeAllListeners("connected");
        self.removeAllListeners("failed");
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
            
            // Managing data
            case 'nosub':
                var cb = self._callbacks[data.id];

                if (cb) {
                    cb(data.error);
                    delete self._callbacks[data.id];
                }
                break;
            
            case 'added':
                if (self.maintainCollections && data.collection) {
                    var name = data.collection;
                    var id = data.id;
            
                    if (! self.collections[name]) {
                        self.collections[name] = {}; 
                    }

                    if (! self.collections[name][id]) {
                        self.collections[name][id] = {};
                    }
            
                    self.collections[name][id]._id = id;
            
                    if (data.fields) {
                        Object.entries(data.fields).forEach(function(value, key) {
                            self.collections[name][id][key] = value;
                        });
                    }
            
                    if (self._observers[name]) {
                        Object.values(self._observers[name]).forEach(function(observer) {
                            observer.added(id);
                        });
                    }
                }
                break;

            case 'changed':
                if (self.maintainCollections && data.collection) {
                    var name = data.collection;
                    var id = data.id;
            
                    if (! self.collections[name]){ 
                        return; 
                    }

                    if (! self.collections[name][id]) {
                        return;
                    }
            
                    var oldFields = {};
                    var clearedFields = data.cleared || [];
                    var newFields = {};
            
                    if (data.fields) {
                        Object.entries(data.fields).forEach(function(value, key) {
                            oldFields[key] = self.collections[name][id][key];
                            newFields[key] = value;
                            self.collections[name][id][key] = value;
                        });
                    }
            
                    if (data.cleared) {
                        data.cleared.forEach(function(value) {
                            delete self.collections[name][id][value];
                        });
                    }
            
                    if (self._observers[name]) {
                        Object.values(self._observers[name]).forEach(function(observer) {
                            observer.changed(id, oldFields, clearedFields, newFields);
                        });
                    }
                }

                break;
            
            case 'removed':
                if (self.maintainCollections && data.collection) {
                    var name = data.collection;
                    var id = data.id;
            
                    if (! self.collections[name][id]) {
                        return;
                    }
            
                    var oldValue = self.collections[name][id];
            
                    delete self.collections[name][id];
            
                    if (self._observers[name]) {
                        Object.values(self._observers[name]).forEach(function(observer) {
                            observer.removed(id, oldValue);
                        });
                    }
                }

                break;
            
            case 'ready':
                data.subs.forEach(function(id) {
                    var cb = self._callbacks[id];
                    if (cb) {
                        cb();
                        delete self._callbacks[id];
                    }
                });
                
                break;
            
            case 'addedBefore':
                // TODO: not yet implemented in Meteor
                break;
            
            case 'movedBefore':
                // TODO: not yet implemented in Meteor
                break;
        
            default:
                break;
        }
    }

    _getNextId() {
        var self = this;
        return (self._nextId += 1).toString();
    }

    _addObserver(observer) {
        var self = this;
        if (! self._observers[observer.name]) {
          self._observers[observer.name] = {};
        }
        self._observers[observer.name][observer._id] = observer;
    }
    
    _removeObserver(observer) {
        var self = this;
        if (! self._observers[observer.name]) { return; }

        delete self._observers[observer.name][observer._id];
    }
    
}