console.log('hello from index.js');

const wdc = new WsDppClient({});

wdc.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }

    wdc.call("login", [{ user : { username : "huong.nguyen" }, password : "123456" }], function (err, result) {
        console.log('----> result', result);
    });
});