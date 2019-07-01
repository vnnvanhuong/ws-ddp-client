const wdc = new WsDppClient({});

wdc.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }

    wdc.call("login", [{ user : { username : "wdc" }, password : "secret" }], (logErr) => {
        if (logErr) {
            console.log(logErr);
            return;
        }

        wdc.subscribe('activeUsers', [], (subErr) => {
            if (subErr) {
                console.log(subErr);
                return;
            }
            updateUsers();
        });
    });
});

const observer = wdc.observe("users");
observer.added = function(id) {
    updateUsers();
};

observer.changed = function(id, oldFields, clearedFields, newFields) {
    updateUsers();
};

observer.removed = function(id, oldValue) {
    updateUsers();
};

function updateUsers() {
    var myNode = document.getElementById("activeUsers");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }

    Object.keys(wdc.collections.users).forEach(id => {
        var node = document.createElement("LI");
        var textnode = document.createTextNode(wdc.collections.users[id].name);
        node.appendChild(textnode);
        document.getElementById("activeUsers").appendChild(node);
    });
}