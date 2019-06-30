const wdc = new WsDppClient({});

wdc.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }

    wdc.call("login", [{ user : { username : "huong.nguyen" }, password : "123456" }], (logErr) => {
        if (logErr) {
            console.log(logErr);
            return;
        }

        wdc.subscribe('activeUsers', [], (subErr) => {
            if (subErr) {
                console.log(subErr);
                return;
            }
            console.log('HHH---users', wdc.collections.users);
        });
    });
});