console.log('hello from index.js');

const wdc = new WsDppClient({});

wdc.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }

    console.log('---> connected!');
});